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

