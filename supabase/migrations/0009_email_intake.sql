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
