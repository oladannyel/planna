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
// TLS: Supabase serves Postgres behind its own private root ("Supabase Root
// 2021 CA"), not a publicly trusted one, so the system trust store cannot
// verify it and `sslmode=require` alone fails with "self-signed certificate in
// certificate chain". The fix is the one this file has always argued for:
// supply the CA, never disable the check, which would turn a credentialed
// connection into one anybody on the path can impersonate.
//
// Give the certificate to this script as SUPABASE_CA_CERT (the PEM text, which
// is how a CI secret carries it) or SUPABASE_CA_CERT_FILE (a path). Download it
// from the Supabase dashboard → Project Settings → Database → SSL
// Configuration. The connection then runs at `verify-full`: the chain and the
// hostname are both checked. A remote database with no CA configured is a
// setup failure, not a clean run.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "pg";

/** Drift found: production is missing something the migrations define. */
const EXIT_DRIFT = 1;
/** The comparison could not be made at all — bad config, no CA, no route. */
const EXIT_SETUP = 3;

/** Something stopped the check before it could compare anything. */
class SetupError extends Error {}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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

/**
 * Point a connection string at the CA, so TLS verifies instead of failing.
 *
 * `pg` lets the connection string win over any `ssl` object passed beside it
 * (ConnectionParameters assigns the parsed string over the config), so the
 * CA goes into the URL as `sslrootcert` rather than into client options where
 * it would be silently ignored.
 *
 * The local stack speaks plaintext on loopback and needs none of this.
 */
function withVerifiedTls(rawUrl, label) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SetupError(`${label} is not a valid connection URL.`);
  }

  if (LOCAL_HOSTS.has(url.hostname)) return rawUrl;
  if (url.searchParams.has("sslrootcert")) return rawUrl;

  const caFile = resolveCaFile();
  if (!caFile) {
    throw new SetupError(
      `${label} is remote, and no CA certificate is configured.\n\n` +
        "Supabase signs its database certificates with a private root, so the\n" +
        "system trust store cannot verify them and the connection fails with\n" +
        '"self-signed certificate in certificate chain".\n\n' +
        "Download the certificate from the Supabase dashboard (Project Settings →\n" +
        "Database → SSL Configuration) and pass it as SUPABASE_CA_CERT (the PEM\n" +
        "text) or SUPABASE_CA_CERT_FILE (a path). In CI, add the PEM as a repository\n" +
        "secret and hand it to the job as SUPABASE_CA_CERT.",
    );
  }

  url.searchParams.set("sslmode", "verify-full");
  url.searchParams.set("sslrootcert", caFile);
  return url.toString();
}

/** The CA as a file path, whether it arrived as a path or as PEM text. */
function resolveCaFile() {
  const path = process.env.SUPABASE_CA_CERT_FILE?.trim();
  if (path) return path;

  const pem = process.env.SUPABASE_CA_CERT?.trim();
  if (!pem) return null;
  if (!pem.includes("BEGIN CERTIFICATE")) {
    throw new SetupError(
      "SUPABASE_CA_CERT does not look like a PEM certificate — expected a\n" +
        "-----BEGIN CERTIFICATE----- block. Check that the secret holds the file's\n" +
        "contents and not its name.",
    );
  }

  /*
   * 0600 in the OS temp directory: the certificate is public material, but the
   * file is this run's own and nothing else needs to read it.
   */
  const file = join(tmpdir(), `supabase-ca-${randomUUID()}.crt`);
  writeFileSync(file, `${pem}\n`, { mode: 0o600 });
  return file;
}

async function catalogue(rawConnectionString, label) {
  const connectionString = withVerifiedTls(rawConnectionString, label);
  const client = new Client({ connectionString, statement_timeout: 30_000 });

  try {
    await client.connect();
  } catch (cause) {
    /*
     * Only certificate failures get the certificate advice. Appending it to
     * every connection error is how the last version of this message misled:
     * a wrong host or a dead tenant read as a TLS problem.
     */
    const tls = /certificate|self[- ]signed|SSL|TLS/i.test(cause.message ?? "");
    throw new SetupError(
      `Could not connect to ${label}: ${cause.message}` +
        (tls
          ? "\nThe CA supplied does not match the one this server presents;" +
            "\nre-download it from the dashboard."
          : ""),
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
  process.exit(EXIT_SETUP);
}

/*
 * Setup failures exit 3, drift exits 1. They are different events and the
 * workflow says different things about them: for two days this check reported
 * "production is missing objects" when what had actually happened was that it
 * could not open a connection at all.
 */
let reference;
let live;
try {
  [reference, live] = await Promise.all([
    catalogue(referenceUrl, "the reference database"),
    catalogue(liveUrl, "the live database"),
  ]);
} catch (error) {
  if (error instanceof SetupError) {
    console.error(`\n${error.message}`);
    process.exit(EXIT_SETUP);
  }
  throw error;
}

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
  process.exit(EXIT_DRIFT);
}

if (extra.length > 0 && FAIL_ON_EXTRA) {
  console.error("\n--strict: failing on objects that no migration defines.");
  process.exit(EXIT_DRIFT);
}

console.log(
  `\nNo drift. Production matches the migrations across ${Object.keys(PROBES).length} object kinds.`,
);
