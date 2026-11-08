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

  -- Enough tasks, spread over the past three weeks, that the analytics and
  -- monthly views have something to plot on a fresh clone. Three rows all
  -- created today left every chart empty and the board looking broken, which
  -- is a poor first impression of a tool whose whole point is showing you
  -- where your attention went.
  insert into tasks (
    workspace_id, title, description, status, priority, tags, source,
    created_at, updated_at, completed_at, due_date, estimated_minutes
  )
  values
    -- To do
    (demo_ws_id, 'Draft Q3 planning doc', 'Outline goals and milestones for the quarter.',
     'todo', 'high', array['planning'], 'manual',
     now() - interval '2 days', now() - interval '2 days', null, (now() + interval '2 days')::date, 90),
    (demo_ws_id, 'Prepare board update', 'Pull the headline metrics into one slide.',
     'todo', 'urgent', array['planning','exec'], 'manual',
     now() - interval '1 day', now() - interval '1 day', null, (now() + interval '1 day')::date, 45),
    (demo_ws_id, 'Rewrite the pricing page', 'The current copy buries the free tier.',
     'todo', 'medium', array['marketing'], 'manual',
     now() - interval '5 days', now() - interval '5 days', null, (now() + interval '4 days')::date, 120),
    (demo_ws_id, 'Reply to the integration request', null,
     'todo', 'low', array['support'], 'request_link',
     now() - interval '3 days', now() - interval '3 days', null, null, 20),

    -- In progress
    (demo_ws_id, 'Review onboarding flow', 'Walk the whole signup path and note every drop-off.',
     'in_progress', 'medium', array['ux'], 'manual',
     now() - interval '4 days', now() - interval '6 hours', null, (now() + interval '1 day')::date, 60),
    (demo_ws_id, 'Migrate the reporting job', 'Move the weekly rollup off the old scheduler.',
     'in_progress', 'high', array['infra'], 'manual',
     now() - interval '8 days', now() - interval '1 day', null, (now() + interval '3 days')::date, 240),

    -- Done, spread across three weeks so the charts have a shape
    (demo_ws_id, 'Ship landing page copy', null,
     'done', 'medium', array['marketing'], 'manual',
     now() - interval '6 days', now() - interval '5 days', now() - interval '5 days', (now() - interval '5 days')::date, 75),
    (demo_ws_id, 'Fix the export timeout', 'CSV export dropped the last row on large datasets.',
     'done', 'urgent', array['bug'], 'request_link',
     now() - interval '9 days', now() - interval '8 days', now() - interval '8 days', (now() - interval '8 days')::date, 50),
    (demo_ws_id, 'Instrument the signup funnel', null,
     'done', 'high', array['analytics'], 'manual',
     now() - interval '13 days', now() - interval '11 days', now() - interval '11 days', (now() - interval '12 days')::date, 180),
    (demo_ws_id, 'Write the incident postmortem', 'What broke, why, and what changes.',
     'done', 'high', array['infra','writing'], 'manual',
     now() - interval '16 days', now() - interval '15 days', now() - interval '15 days', (now() - interval '15 days')::date, 110),
    (demo_ws_id, 'Refresh the API docs', null,
     'done', 'low', array['docs'], 'manual',
     now() - interval '19 days', now() - interval '18 days', now() - interval '18 days', (now() - interval '17 days')::date, 95),

    -- Cancelled
    (demo_ws_id, 'Evaluate the analytics vendor', 'Dropped — the open-source option covers it.',
     'cancelled', 'low', array['analytics'], 'manual',
     now() - interval '11 days', now() - interval '10 days', null, null, null)
  on conflict do nothing;
end $$;
