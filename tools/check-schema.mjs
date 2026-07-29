#!/usr/bin/env node
// Schema contract check: does the database require any column the app never writes?
//
// This exists because of the 29 Jul 2026 incident. `public.jobs.allocated_to` was NOT NULL
// with no default, but toDbPayload() only ever sends `alloc` — a database-side trigger had
// been quietly bridging the two. When that bridge stopped working, every job insert failed
// with 23502 and two jobs were lost. Nothing in the app, the tests, or the build would have
// told you: the mismatch lived in the gap between the schema and the client.
//
// Run it after ANY database change. It needs a SECRET key — the API root that describes the
// schema refuses publishable/anon keys ("Only secret API keys can be used for this endpoint"):
//
//   SUPABASE_KEY=sb_secret_xxx node tools/check-schema.mjs
//
// Get one from Dashboard → Project Settings → API keys. Pass it on the command line or via
// the environment; do NOT put it in .env.local, which is bundled into the client build.
//
// The URL falls back to VITE_SUPABASE_URL in .env.local, which is not sensitive.
//
// How it knows the schema: PostgREST serves an OpenAPI description at the API root, and its
// `required` array is exactly "NOT NULL and no default" — the columns an insert must supply.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Which payload builder feeds which table. Keys are extracted from the source at runtime so
// this can't drift out of date the way a hand-copied list would.
const CONTRACTS = [
  { table: "jobs", file: "src/lib/jobs.js", fn: "toDbPayload" },
  { table: "staff", file: "src/lib/staff.js", fn: "toStaffDbPayload" },
  { table: "job_types", file: "src/lib/staff.js", fn: "toJobTypeDbPayload" },
  { table: "customers", file: "src/lib/customers.js", fn: "toCustomerDbPayload" },
  { table: "staff_calendar", file: "src/lib/calendar.js", fn: "toCalendarDbPayload" },
  { table: "public_holidays", file: "src/lib/calendar.js", fn: "toHolidayDbPayload" },
];

// Columns the database fills in for us. `id` is an identity column on jobs; the timestamps
// have defaults. Anything else missing is a genuine finding.
const DB_SUPPLIED = new Set(["id", "created_at", "updated_at"]);

function loadEnv() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Secret keys only — see the header. Never read the anon key from .env.local here: it
  // cannot read this endpoint, so falling back to it just produces a confusing 401.
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envFile = join(root, ".env.local");
  if (!url && existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && m[1] === "VITE_SUPABASE_URL") url = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { url, key };
}

// Pull the object-literal keys out of a `export function toXDbPayload(...) { ... }` body.
// Also picks up `payload[SUPABASE_START_COLUMN] = ...` style dynamic assignments, resolving
// them to the same defaults src/lib/supabase.js uses.
function writtenColumns(file, fn) {
  const source = readFileSync(join(root, file), "utf8");
  const start = source.indexOf(`function ${fn}(`);
  if (start === -1) throw new Error(`${fn} not found in ${file}`);
  // Walk braces from the function signature to find its body.
  let depth = 0, i = source.indexOf("{", start), bodyStart = i;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  const body = source.slice(bodyStart, i);

  const cols = new Set();
  for (const m of body.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gim)) cols.add(m[1]);
  if (/payload\[SUPABASE_START_COLUMN\]/.test(body)) cols.add(process.env.VITE_SUPABASE_START_COLUMN || "start_date");
  if (/payload\[SUPABASE_DUE_COLUMN\]/.test(body)) cols.add(process.env.VITE_SUPABASE_DUE_COLUMN || "due_date");
  return cols;
}

async function main() {
  const { url, key } = loadEnv();
  if (!url || !key) {
    console.error("✖ Missing a secret API key.");
    console.error("  Usage:  SUPABASE_KEY=sb_secret_xxx node tools/check-schema.mjs");
    console.error("  Get one from Dashboard → Project Settings → API keys. The publishable/anon");
    console.error("  key cannot read the schema endpoint, so it is deliberately not used here.");
    process.exitCode = 2;
    return;
  }

  // Only legacy JWT keys double as a bearer token. A new-style `sb_publishable_…` /
  // `sb_secret_…` key sent as Bearer is read as a user JWT and rejected with 401.
  const headers = { apikey: key, accept: "application/openapi+json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`✖ Could not read the API schema: ${res.status} ${res.statusText}`);
    if (/secret API key/i.test(body)) {
      console.error("  That key is publishable/anon. This endpoint accepts secret keys only —");
      console.error("  use sb_secret_… or the service_role key from Project Settings → API keys.");
    } else if (body) {
      console.error(`  ${body.slice(0, 200)}`);
    }
    process.exitCode = 2;
    return;
  }
  const spec = await res.json();

  let problems = 0;
  for (const { table, file, fn } of CONTRACTS) {
    const definition = spec.definitions?.[table];
    if (!definition) {
      console.log(`•  ${table.padEnd(16)} not exposed by the API — skipped`);
      continue;
    }
    const required = new Set(definition.required || []);
    const written = writtenColumns(file, fn);
    const missing = [...required].filter((col) => !written.has(col) && !DB_SUPPLIED.has(col));

    if (missing.length) {
      problems += missing.length;
      console.error(`✖  ${table.padEnd(16)} requires ${missing.map((c) => `"${c}"`).join(", ")} but ${fn}() never sends ${missing.length > 1 ? "them" : "it"}`);
    } else {
      console.log(`✓  ${table.padEnd(16)} ${written.size} columns written, ${required.size} required — no gap`);
    }
  }

  if (problems) {
    console.error(`\n${problems} column(s) will make every insert fail with 23502 unless something else fills them in.`);
    console.error("Either send the column from the payload builder, or give it a default / drop NOT NULL in the database.");
    process.exitCode = 1;
    return;
  }
  console.log("\nNo schema contract gaps.");
}

main().catch((err) => {
  console.error("✖", err.message);
  process.exitCode = 2;
});
