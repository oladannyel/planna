-- ─── Request inbox, notifications and the mail outbox ────────────────────────
--
-- See docs/adr/0001-request-approval-inbox.md.
--
-- A request from the share link used to be inserted straight into `tasks`, so
-- "a stranger asked for this" and "I agreed to do this" were one event. They
-- are separated here: a submission writes a `requests` row and waits. Only an
-- accept creates the task — which is also where the model call now happens, so
-- an unauthenticated caller can spend a row and not a model call.
--
-- Additive throughout: three new tables, nothing altered, nothing backfilled.
-- Tasks created by the old path keep working; they simply have no request
-- behind them, and the status page says so by 404ing.

create type request_state as enum ('pending', 'accepted', 'rejected');

create table if not exists requests (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,

  -- What was submitted, as submitted. The parser does not touch these; the
  -- task it later produces holds the interpreted version, and keeping the two
  -- apart means a bad parse never rewrites what the colleague actually wrote.
  requester_name    text not null,
  requester_email   text,
  title             text not null,
  description       text not null,
  urgency           task_priority not null default 'medium',
  desired_deadline  date,

  state             request_state not null default 'pending',
  decided_at        timestamptz,
  decline_reason    text,

  -- The task an accept produced. Null while pending, and null forever on a
  -- reject. `on delete set null`: deleting the task must not delete the record
  -- that someone asked for it.
  task_id           uuid references tasks(id) on delete set null,

  -- Addresses the public status page. 32 hex characters from gen_random_bytes,
  -- so guessing one is not a strategy. Unique because the page looks it up.
  token             text not null unique,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table requests is
  'Submissions through a workspace request link, awaiting or holding a decision.';

-- The inbox reads pending-first within a workspace; the status page reads by
-- token (already unique); the task-status hook reads by task_id.
create index if not exists requests_workspace_state_idx on requests (workspace_id, state, created_at desc);
create index if not exists requests_task_idx on requests (task_id);

create trigger requests_updated_at
  before update on requests
  for each row execute function update_updated_at();

-- ─── Notifications ───────────────────────────────────────────────────────────
-- In-app only: what the bell in the top bar shows. Email is a separate
-- delivery with its own table, because an email that failed to send is an
-- operational fact and an unread bell item is not.

create type notification_kind as enum ('request_received');

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  kind          notification_kind not null,
  title         text not null,
  body          text,
  request_id    uuid references requests(id) on delete cascade,
  task_id       uuid references tasks(id) on delete set null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

comment on table notifications is 'Bell items for the workspace owner.';

-- The bell asks one question: my workspace, newest first, which are unread.
create index if not exists notifications_workspace_created_idx
  on notifications (workspace_id, created_at desc);
create index if not exists notifications_workspace_unread_idx
  on notifications (workspace_id) where read_at is null;

-- ─── Mail outbox ─────────────────────────────────────────────────────────────
-- Mail is enqueued in the same transaction-ish step as the state change that
-- justifies it, then sent. A send that fails leaves a row to retry rather than
-- a lost notification, and the daily cron drains what is left. At-least-once:
-- a duplicate "your request was accepted" is a far smaller failure than
-- silence, which is what the previous design delivered on every transition.

create type email_state as enum ('pending', 'sent', 'failed');

create table if not exists email_outbox (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  request_id    uuid references requests(id) on delete cascade,
  to_email      text not null,
  subject       text not null,
  body_text     text not null,
  body_html     text,
  state         email_state not null default 'pending',
  attempts      integer not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

comment on table email_outbox is
  'Queued outbound mail. Service role only; addresses never leave the server.';

-- The drain scans pending rows oldest first.
create index if not exists email_outbox_pending_idx
  on email_outbox (created_at) where state = 'pending';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table requests      enable row level security;
alter table notifications enable row level security;
alter table email_outbox  enable row level security;

-- Requests and notifications: the workspace owner, and nobody else. The public
-- status page reads by token through the service role, which bypasses RLS —
-- there is deliberately no `anon` policy, because a policy that matched on a
-- token would also have to be readable by anon to be evaluated.
create policy "requests_owner" on requests
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "notifications_owner" on notifications
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- email_outbox: RLS on, no policies. Deny by default. It holds requesters'
-- email addresses and the text of every mail sent; nothing but the service
-- role has business reading it, and the owner sees the same information in a
-- nicer form on the request itself.

revoke all on table email_outbox from anon, authenticated;
