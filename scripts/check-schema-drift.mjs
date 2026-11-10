// Compare a reference database against a live one and fail on anything the
// reference has that the live one is missing.
//
// Why this exists: nothing links this repository to the production Supabase
// project. No pipeline applies migrations, so a migration can reach `main`,
// deploy, and never reach the database. That has happened twice — 0005_due_at,
// and 0007_request_throttle, which made every request-link submission return
// 500 in production while CI stayed green, because the unit tests mock
// Supabase and a missing table is invisible to them.
//
// The reference is the local stack after `supabase start`, which applies every
// migration in order. Deriving expectations from it rather than from a
// hand-maintained list is the whole point: a new migration is covered the day
// it lands, with nothing to remember and nothing to rot.
//
// Direction matters. Objects in the reference but not in production are a
// FAILURE — the migration never ran. Objects in production but not in the
// reference are reported and do not fail: Supabase's own tooling adds things
// (`rls_auto_enable`, auth plumbing), and a dashboard-created object is worth
// knowing about without blocking a merge on it.
//
// TLS: the connection string decides. Append `?sslmode=require` (or
// `verify-full`) to SUPABASE_DB_URL and `pg` negotiates TLS with the system
// trust store. If a host ever presents a certificate that fails verification,
// the fix is to supply its CA — never to disable the check, which would turn
// a credentialed connection into one anybody on the path can impersonate.

import { Client } from "pg";

const FAIL_ON_EXTRA = process.argv.includes("--strict");

/**
 * Catalogue queries, scoped to `public`.
 *
 * Each returns a flat list of comparable identity strings. They deliberately
 * avoid definition bodies: comparing a function's source across environments
 * produces noise from formatting and search_path rewriting, and the failure
 * this guards against is absence, not divergence.
 */
const PROBES = {
  table: `
    select c.relname as id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')`,

  column: `
    select table_name || '.' || column_name as id
    from information_schema.columns
    where table_schema = 'public'`,

  index: `
    select indexname as id
    from pg_indexes
    where schemaname = 'public'`,

  policy: `
    select tablename || '.' || policyname as id
    from pg_policies
    where schemaname = 'public'`,

  function: `
    select p.proname || '/' || p.pronargs as id
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`,

  // Row-level security is a property of the table, and a table that exists
  // with RLS switched off is worse than a missing one: it reads as present
  // and serves every row to anon.
  "rls-enabled": `
    select c.relname as id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`,

  // Realtime: 0006 adds `tasks` to the publication. Absent, the board's
  // postgres_changes subscription receives nothing and simply feels stale —
  // no error anywhere.
  "realtime-publication": `
    select tablename as id
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'`,

  // REPLICA IDENTITY FULL, so DELETE events carry the old row.
  "replica-identity-full": `
    select c.relname as id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relreplident = 'f'`,
};

async function catalogue(connectionString, label) {
  const client = new Client({ connectionString, statement_timeout: 30_000 });

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Could not connect to ${label}: ${cause.message}\n` +
        "If this is a TLS failure, add ?sslmode=require to the connection string.",
      { cause },
    );
  }

  try {
    const result = {};
    for (const [kind, sql] of Object.entries(PROBES)) {
      const { rows } = await client.query(sql);
      result[kind] = new Set(rows.map((r) => r.id));
    }
    return result;
  } finally {
    await client.end();
  }
}

function difference(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

const referenceUrl = process.env.REFERENCE_DB_URL;
const liveUrl = process.env.SUPABASE_DB_URL;

if (!referenceUrl || !liveUrl) {
  console.error("Both REFERENCE_DB_URL (local stack) and SUPABASE_DB_URL (live) must be set.");
  process.exit(2);
}

const [reference, live] = await Promise.all([
  catalogue(referenceUrl, "the reference database"),
  catalogue(liveUrl, "the live database"),
]);

const missing = [];
const extra = [];

for (const kind of Object.keys(PROBES)) {
  for (const id of difference(reference[kind], live[kind])) missing.push(`${kind}: ${id}`);
  for (const id of difference(live[kind], reference[kind])) extra.push(`${kind}: ${id}`);
}

if (extra.length > 0) {
  console.log(`\nIn production but not in the migrations (${extra.length}):`);
  for (const line of extra) console.log(`  ~ ${line}`);
  console.log(
    "\n  Not a failure by default. Supabase's own tooling creates some of these;\n" +
      "  anything else is a dashboard change that belongs in a migration.",
  );
}

if (missing.length > 0) {
  console.error(`\nMissing from production (${missing.length}):`);
  for (const line of missing) console.error(`  - ${line}`);
  console.error(
    "\nA migration has not been applied to the production database.\n" +
      "Apply it using scripts/apply-migration-0005.mjs as a template, or\n" +
      "`supabase db push` once the project is linked.",
  );
  process.exit(1);
}

if (extra.length > 0 && FAIL_ON_EXTRA) {
  console.error("\n--strict: failing on objects that no migration defines.");
  process.exit(1);
}

console.log(
  `\nNo drift. Production matches the migrations across ${Object.keys(PROBES).length} object kinds.`,
);
