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
