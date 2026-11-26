-- plAnna — complete schema, generated from supabase/migrations/.
--
-- DO NOT EDIT BY HAND. Regenerate with:
--   node scripts/build-combined-schema.mjs
--
-- Apply to a fresh Supabase project: paste into the SQL Editor and run
-- once. Equivalent to `supabase db push`; prefer that when the CLI is
-- linked.

-- ─────────────────────────────────────────────────────────────────────────
-- 0001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── WORKSPACES ───────────────────────────────────────────────────────────────
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique,       -- used for request links: /request/[slug]
  created_at  timestamptz not null default now()
);

-- ─── TASKS ────────────────────────────────────────────────────────────────────
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_source as enum ('manual', 'ai_parsed', 'request_link');

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  title             text not null,
  description       text,
  status            task_status not null default 'todo',
  priority          task_priority not null default 'medium',
  tags              text[] not null default '{}',
  due_date          date,
  estimated_minutes integer,                        -- AI-estimated effort
  source            task_source not null default 'manual',
  requested_by      text,                           -- name from request link
  carried_over      boolean not null default false,
  carry_count       integer not null default 0,     -- how many times deferred
  status_history    jsonb not null default '[]',    -- [{status, changed_at}]
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index tasks_workspace_status_idx on tasks(workspace_id, status);
create index tasks_workspace_due_idx on tasks(workspace_id, due_date);
create index tasks_workspace_created_idx on tasks(workspace_id, created_at);

-- ─── DAILY LOGS ───────────────────────────────────────────────────────────────
-- Snapshot written nightly via cron (Supabase pg_cron or Vercel cron)
create table daily_logs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  log_date        date not null,
  completed_count integer not null default 0,
  created_count   integer not null default 0,
  carried_count   integer not null default 0,
  on_time_count   integer not null default 0,       -- completed before due_date
  unique(workspace_id, log_date)
);

-- ─── WEEKLY REPORTS ───────────────────────────────────────────────────────────
create table weekly_reports (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  week_start      date not null,                    -- always Monday
  narrative       text not null,                    -- AI-generated prose
  stats           jsonb not null default '{}',      -- raw numbers snapshot
  ethics_answers  jsonb,                            -- {question, answer}[]
  created_at      timestamptz not null default now(),
  unique(workspace_id, week_start)
);

-- ─── MONTHLY SUMMARIES ────────────────────────────────────────────────────────
create table monthly_summaries (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  year            integer not null,
  month           integer not null check (month between 1 and 12),
  narrative       text not null,                    -- AI-generated monthly prose
  stats           jsonb not null default '{}',      -- aggregated monthly numbers
  top_categories  jsonb not null default '[]',      -- [{tag, count}] top 5
  created_at      timestamptz not null default now(),
  unique(workspace_id, year, month)
);

-- ─── ETHICS QUESTIONS ─────────────────────────────────────────────────────────
-- User-defined weekly reflection questions
create table ethics_questions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  question      text not null,
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ─── STATUS HISTORY APPEND ────────────────────────────────────────────────────
-- Atomically append an entry to a task's status_history JSONB array.
-- Used by the updateTaskStatus server action (Phase 2).
create or replace function append_status_history(task_id uuid, entry jsonb)
returns jsonb language plpgsql as $$
declare
  next_history jsonb;
begin
  update tasks
    set status_history = status_history || jsonb_build_array(entry)
    where id = task_id
    returning status_history into next_history;
  return next_history;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 0002_rls_policies.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table workspaces       enable row level security;
alter table tasks             enable row level security;
alter table daily_logs        enable row level security;
alter table weekly_reports    enable row level security;
alter table monthly_summaries enable row level security;
alter table ethics_questions  enable row level security;

-- Workspace: owner only
create policy "workspace_owner" on workspaces
  for all using (auth.uid() = owner_id);

-- Tasks: workspace owner only
create policy "tasks_owner" on tasks
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Task insert via request link: service role only (anon cannot write tasks directly).
-- The /api/request route uses SUPABASE_SERVICE_ROLE_KEY after validating the slug.
-- The service role bypasses RLS, so no anon policy is required here.

-- Daily logs, reports, summaries: workspace owner only
create policy "daily_logs_owner" on daily_logs
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "weekly_reports_owner" on weekly_reports
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "monthly_summaries_owner" on monthly_summaries
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "ethics_questions_owner" on ethics_questions
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 0003_monthly_summary.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ─── MONTHLY / ANALYTICS PERFORMANCE ──────────────────────────────────────────
-- The monthly_summaries table itself is created in 0001 so that 0002 can attach
-- its RLS policy. This migration adds the supporting indexes the monthly view
-- and analytics aggregations rely on (completion-rate, on-time-rate, cycle-time
-- queries all filter tasks by completed_at within a workspace).

create index if not exists tasks_workspace_completed_idx
  on tasks(workspace_id, completed_at);

create index if not exists monthly_summaries_workspace_period_idx
  on monthly_summaries(workspace_id, year, month);

-- ─────────────────────────────────────────────────────────────────────────
-- 0004_ethics.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ─── ETHICS REFLECTIONS ───────────────────────────────────────────────────────
-- Reflection answers live in weekly_reports.ethics_answers. Allow a row to exist
-- for a week before a report narrative is generated (ethics-only check-ins).
alter table weekly_reports alter column narrative drop not null;

-- Support listing a workspace's reflection history by week.
create index if not exists weekly_reports_workspace_week_idx
  on weekly_reports(workspace_id, week_start desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 0005_due_at.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 0005_due_at.sql
-- Add a precise timestamp deadline alongside the date-only due_date.
-- due_at is the source of truth for the deadline and the on-time metric;
-- due_date is kept (derived from due_at) for calendar/weekly grouping & range queries.

alter table tasks add column if not exists due_at timestamptz;

-- Backfill: existing date-only deadlines become end-of-day timestamps.
update tasks
set due_at = (due_date::timestamptz + interval '23 hours 59 minutes 59 seconds')
where due_at is null and due_date is not null;

create index if not exists tasks_workspace_due_at_idx on tasks(workspace_id, due_at);

-- ─────────────────────────────────────────────────────────────────────────
-- 0006_realtime_publication.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime for the tasks table.
--
-- `useTasks` subscribes to postgres_changes on `tasks`, but no migration ever
-- added the table to the supabase_realtime publication, so the subscription
-- has never received an event: the board only updated on reload and on
-- optimistic local writes. Declaring it here means a fresh clone behaves the
-- same as any other environment, instead of depending on someone having
-- clicked the right toggle in the dashboard.
--
-- Idempotent: adding a table already in the publication raises an error, so
-- the membership is checked first.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- REPLICA IDENTITY FULL so DELETE events carry the old row. Without it,
-- `payload.old` holds only the primary key, and the client cannot tell which
-- workspace a deleted task belonged to — which the workspace filter needs.
alter table public.tasks replica identity full;

-- ─────────────────────────────────────────────────────────────────────────
-- 0007_request_throttle.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ─── Atomic throttling for the one unauthenticated path ──────────────────────
--
-- Request links let anyone holding a slug file a task, and each submission
-- spends a language-model call. The previous cap counted `tasks` rows created
-- in the last hour and then inserted — read-then-write, with no serialisation
-- between the two. Concurrent submissions all read a count below the limit
-- before any of them inserted, so a burst of N parallel requests spent N
-- model calls against a cap of 20. The check only ever held against a
-- sequential attacker, which is not the one worth defending against.
--
-- This replaces it with a counter row per (bucket, window) and a single
-- `insert ... on conflict do update ... returning` statement. Postgres takes a
-- row lock for the duration of the update, so concurrent callers queue and
-- each one observes its own incremented value. The limit is enforced on the
-- value the statement returns, which no other transaction can have seen.
--
-- The window is fixed, not sliding: `window_start` is floored to the window
-- size so every caller in the same hour contends for the same row. The honest
-- cost of that choice is a boundary burst — up to 2× the limit across the
-- instant a window rolls over. A sliding window would need a row per request
-- and a range count, which is a lot of machinery to tighten a bound that is
-- already generous. Fixed window, stated plainly, is the trade.

create table if not exists request_throttle (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);

comment on table request_throttle is
  'Fixed-window hit counters for unauthenticated request-link submissions. Service-role only.';

-- Pruning scans by window, not by bucket.
create index if not exists request_throttle_window_idx
  on request_throttle (window_start);

-- RLS on with no policies at all: deny by default. Nothing reaches this table
-- except the service role, which bypasses RLS. An authenticated user has no
-- business reading another workspace's request volume, and `anon` — the role
-- the public request form would use if it ever talked to the table directly —
-- must not be able to read, reset or inflate its own counter.
alter table request_throttle enable row level security;

/**
 * Claim one slot in `p_bucket`'s current window.
 *
 * Returns true when the caller is within `p_limit`, false when it is not.
 * The hit is recorded either way: a blocked caller still counts, so hammering
 * a refused endpoint cannot reset or outrun the window.
 */
create or replace function claim_request_slot(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'claim_request_slot: limit and window must be positive';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into request_throttle as t (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = t.hits + 1
  returning t.hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

/**
 * Drop counter rows for windows that have closed. Called by the daily cron at
 * /api/cron/ai-health; nothing depends on a closed window, and left alone the
 * table would grow one row per bucket per hour forever.
 */
create or replace function prune_request_throttle(
  p_older_than_seconds integer default 86400
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from request_throttle
  where window_start < now() - make_interval(secs => p_older_than_seconds);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- `security definer` functions are executable by `public` unless told
-- otherwise, and these two decide whether an unauthenticated caller is over
-- its limit. A client that could call `claim_request_slot` directly could
-- exhaust its own quota harmlessly, but one that could call
-- `prune_request_throttle` could wipe every counter in the table.
revoke all on function claim_request_slot(text, integer, integer) from public, anon, authenticated;
revoke all on function prune_request_throttle(integer) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 0008_request_inbox.sql
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 0009_email_intake.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ─── Email task intake (Gmail, polled over OAuth) ────────────────────────────
--
-- See docs/adr/0002-gmail-polling-intake.md.
--
-- One connected mailbox per workspace. The poll reads only messages matching
-- the owner's query (default `label:plAnna`), turns each new one into a task,
-- and records the message id so a re-run cannot create it twice.

-- A task can now come from an email. Added with `if not exists` and never used
-- in this transaction, which is what Postgres requires of an enum extension.
alter type task_source add value if not exists 'email';

create type email_connection_state as enum ('active', 'revoked', 'error');

create table if not exists email_connections (
  -- One per workspace: the primary key is the workspace, so a second connect
  -- replaces the first rather than quietly polling two mailboxes.
  workspace_id    uuid primary key references workspaces(id) on delete cascade,

  provider        text not null default 'gmail',
  email_address   text not null,

  -- AES-256-GCM, sealed with EMAIL_TOKEN_KEY, stored as
  -- `v1:<iv>:<tag>:<ciphertext>` base64url. Never selected into anything that
  -- reaches a client; the only reader is the poll.
  refresh_token   text not null,

  -- The Gmail search that defines "a task". The owner's, not ours.
  query           text not null default 'label:plAnna',

  state           email_connection_state not null default 'active',
  last_error      text,
  last_polled_at  timestamptz,
  last_task_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table email_connections is
  'Connected mailboxes polled for task emails. refresh_token is encrypted at rest.';

create trigger email_connections_updated_at
  before update on email_connections
  for each row execute function update_updated_at();

-- ─── Idempotency ─────────────────────────────────────────────────────────────
-- The label is removed after ingestion, but that call can fail while the task
-- insert succeeded. The log, not the label, is what stops a duplicate.

create table if not exists email_ingest_log (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  message_id    text not null,
  task_id       uuid references tasks(id) on delete set null,
  ingested_at   timestamptz not null default now(),
  primary key (workspace_id, message_id)
);

comment on table email_ingest_log is
  'Message ids already turned into tasks. The idempotency key for the poll.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table email_connections enable row level security;
alter table email_ingest_log  enable row level security;

-- The owner may see that a mailbox is connected and disconnect it. The token
-- column is never selected by the client paths; RLS is row-level, not
-- column-level, so the application never names it outside the poll, and the
-- settings query lists its columns explicitly.
create policy "email_connections_owner" on email_connections
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- The ingest log is bookkeeping for the poll. RLS on, no policies: deny by
-- default, service role only.
revoke all on table email_ingest_log from anon, authenticated;
