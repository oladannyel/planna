#!/usr/bin/env node
/**
 * Regenerate `supabase/all_migrations.sql` by concatenating every migration.
 *
 * The combined file exists so a new user can paste one script into the
 * Supabase SQL editor without installing the CLI — which is the first thing
 * someone trying the project does, and so the worst place for the schema to be
 * out of date. It was previously maintained by hand, and by the time this was
 * written it was already missing a migration.
 *
 *   node scripts/build-combined-schema.mjs           # write the file
 *   node scripts/build-combined-schema.mjs --check   # fail if it is stale
 *
 * CI runs the `--check` form, so the two cannot drift again without the build
 * going red.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const outputPath = join(root, "supabase", "all_migrations.sql");

const RULE = "─".repeat(73);

function build() {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${migrationsDir}`);
  }

  const parts = [
    "-- plAnna — complete schema, generated from supabase/migrations/.",
    "--",
    "-- DO NOT EDIT BY HAND. Regenerate with:",
    "--   node scripts/build-combined-schema.mjs",
    "--",
    "-- Apply to a fresh Supabase project: paste into the SQL Editor and run",
    "-- once. Equivalent to `supabase db push`; prefer that when the CLI is",
    "-- linked.",
    "",
  ];

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8").trimEnd();
    parts.push(`-- ${RULE}`, `-- ${file}`, `-- ${RULE}`, sql, "");
  }

  return `${parts.join("\n")}\n`;
}

const generated = build();
const check = process.argv.includes("--check");

if (check) {
  let current = "";
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    // Missing file is a mismatch, reported the same way below.
  }

  if (current !== generated) {
    console.error(
      "supabase/all_migrations.sql is out of date.\n" +
        "Regenerate it with: node scripts/build-combined-schema.mjs",
    );
    process.exit(1);
  }

  console.log("supabase/all_migrations.sql is up to date.");
} else {
  writeFileSync(outputPath, generated);
  console.log(`Wrote ${outputPath}`);
}
