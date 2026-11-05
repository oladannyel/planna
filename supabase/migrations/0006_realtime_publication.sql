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
