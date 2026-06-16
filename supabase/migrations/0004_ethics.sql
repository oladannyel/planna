-- ─── ETHICS REFLECTIONS ───────────────────────────────────────────────────────
-- Reflection answers live in weekly_reports.ethics_answers. Allow a row to exist
-- for a week before a report narrative is generated (ethics-only check-ins).
alter table weekly_reports alter column narrative drop not null;

-- Support listing a workspace's reflection history by week.
create index if not exists weekly_reports_workspace_week_idx
  on weekly_reports(workspace_id, week_start desc);
