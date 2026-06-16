-- ─── MONTHLY / ANALYTICS PERFORMANCE ──────────────────────────────────────────
-- The monthly_summaries table itself is created in 0001 so that 0002 can attach
-- its RLS policy. This migration adds the supporting indexes the monthly view
-- and analytics aggregations rely on (completion-rate, on-time-rate, cycle-time
-- queries all filter tasks by completed_at within a workspace).

create index if not exists tasks_workspace_completed_idx
  on tasks(workspace_id, completed_at);

create index if not exists monthly_summaries_workspace_period_idx
  on monthly_summaries(workspace_id, year, month);
