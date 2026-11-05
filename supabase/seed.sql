-- Local development seed. Runs on `supabase db reset`.
-- Creates one demo user + workspace with default ethics questions and a few tasks.
-- NOT for production.

-- Deterministic demo identifiers so re-seeding is idempotent.
do $$
declare
  demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
  demo_ws_id   uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- Demo auth user.
  --
  -- GoTrue looks users up by (email, aud, instance_id), so a row missing
  -- those columns is invisible to it: sign-in then tries to CREATE the user
  -- and collides with this row on users_email_partial_key (23505), making the
  -- seeded account impossible to log in as. Every column below is load-bearing.
  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous,
    -- GoTrue scans these into non-nullable Go strings. Left NULL they produce
    -- "Database error finding user" on every sign-in attempt. Empty, not null.
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'demo@planna.local',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Demo User"}'::jsonb,
    false, false,
    '', '', '', ''
  )
  on conflict (id) do nothing;

  -- Matching email identity. Without it GoTrue has no provider record for the
  -- account and the magic-link flow has nothing to attach the session to.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    demo_user_id::text,
    demo_user_id,
    jsonb_build_object('sub', demo_user_id::text, 'email', 'demo@planna.local', 'email_verified', true),
    'email',
    now(), now(), now()
  )
  on conflict (provider, provider_id) do nothing;

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
