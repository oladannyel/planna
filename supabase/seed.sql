-- Local development seed. Runs on `supabase db reset`.
-- Creates one demo user + workspace with default ethics questions and a few tasks.
-- NOT for production.

-- Deterministic demo identifiers so re-seeding is idempotent.
do $$
declare
  demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
  demo_ws_id   uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- Demo auth user (Supabase local exposes auth.users for seeding).
  insert into auth.users (id, email, raw_user_meta_data)
  values (demo_user_id, 'demo@planna.local', '{"name":"Demo User"}'::jsonb)
  on conflict (id) do nothing;

  insert into workspaces (id, owner_id, name, slug)
  values (demo_ws_id, demo_user_id, 'Demo Workspace', 'demo')
  on conflict (id) do nothing;

  insert into ethics_questions (workspace_id, question, sort_order) values
    (demo_ws_id, 'Did my work this week align with my stated values?', 0),
    (demo_ws_id, 'Did I treat collaborators and requesters fairly?', 1),
    (demo_ws_id, 'What did I avoid that I should have faced?', 2)
  on conflict do nothing;

  insert into tasks (workspace_id, title, description, status, priority, tags, source)
  values
    (demo_ws_id, 'Draft Q3 planning doc', 'Outline goals and milestones', 'todo', 'high', array['planning'], 'manual'),
    (demo_ws_id, 'Review onboarding flow', null, 'in_progress', 'medium', array['ux'], 'manual'),
    (demo_ws_id, 'Ship landing page copy', null, 'done', 'medium', array['marketing'], 'manual')
  on conflict do nothing;
end $$;
