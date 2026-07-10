// One-off runner: applies supabase/migrations/0005_due_at.sql to SUPABASE_DB_URL.
// Idempotent (add column if not exists). Reads the connection string from .env.local.
import { readFileSync } from "node:fs";
import { Client } from "pg";

function readEnv(key) {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const url = process.env.SUPABASE_DB_URL || readEnv("SUPABASE_DB_URL");
if (!url) {
  console.error("SUPABASE_DB_URL not found in env or .env.local");
  process.exit(1);
}

const sql = readFileSync(new URL("../supabase/migrations/0005_due_at.sql", import.meta.url), "utf8");

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "select column_name, data_type from information_schema.columns where table_name = 'tasks' and column_name = 'due_at'",
  );
  const { rows: backfill } = await client.query(
    "select count(*)::int as with_due_at from tasks where due_at is not null",
  );
  console.log("Migration applied. due_at column:", rows);
  console.log("Rows with due_at set:", backfill[0]?.with_due_at);
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
