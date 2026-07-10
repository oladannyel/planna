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
