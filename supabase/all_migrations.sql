-- plAnna combined migrations (0001 + 0002 + 0003)
-- Paste into Supabase Dashboard → SQL Editor → Run. Safe to run once on a fresh project.

-- ======================================================================
-- migrations/0001_initial_schema.sql
-- ======================================================================
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

-- ======================================================================
-- migrations/0002_rls_policies.sql
-- ======================================================================
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

-- ======================================================================
-- migrations/0003_monthly_summary.sql
-- ======================================================================
-- ─── MONTHLY / ANALYTICS PERFORMANCE ──────────────────────────────────────────
-- The monthly_summaries table itself is created in 0001 so that 0002 can attach
-- its RLS policy. This migration adds the supporting indexes the monthly view
-- and analytics aggregations rely on (completion-rate, on-time-rate, cycle-time
-- queries all filter tasks by completed_at within a workspace).

create index if not exists tasks_workspace_completed_idx
  on tasks(workspace_id, completed_at);

create index if not exists monthly_summaries_workspace_period_idx
  on monthly_summaries(workspace_id, year, month);


-- ======================================================================
-- migrations/0004_ethics.sql
-- ======================================================================
-- ─── ETHICS REFLECTIONS ───────────────────────────────────────────────────────
-- Reflection answers live in weekly_reports.ethics_answers. Allow a row to exist
-- for a week before a report narrative is generated (ethics-only check-ins).
alter table weekly_reports alter column narrative drop not null;

-- Support listing a workspace's reflection history by week.
create index if not exists weekly_reports_workspace_week_idx
  on weekly_reports(workspace_id, week_start desc);
