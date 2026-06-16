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
