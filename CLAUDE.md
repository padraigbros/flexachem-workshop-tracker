# Flexachem Workshop Tracker — working rules

This is a **live production app** used by a working shop, backed by a production Supabase
project and deployed on Vercel. A bad change is not a failed test — it is lost job data. On
29 Jul 2026 an unverified schema change silently dropped two real jobs.

Read this file before doing anything. The subagents below read it too, so anything you learn
the hard way belongs here, not in a chat message that disappears.

---

## 1. You have live access. Verify, never guess.

Both production systems are connected as MCP tools. There is no excuse for asserting an
unverified fact about the database or a deployment.

| System | Identifier | Use it for |
| --- | --- | --- |
| Supabase (`mcp__*__*`) | project `pxekejsjwxlrnaufmjxo` (`flexachem-workshop`, PRODUCTION) | `execute_sql`, `list_tables`, `get_advisors`, `get_logs`, `apply_migration`, `deploy_edge_function` |
| Vercel (`mcp__*__*`) | `flexachem-workshop-tracker` | `list_deployments`, `get_deployment_build_logs`, `get_runtime_errors`, `get_runtime_logs` |

**Rules:**

- **Never hardcode a database identifier you have not read from the catalog** — constraint,
  index, policy, trigger or sequence names. Postgres' default naming (`<table>_pkey`) is a
  guess. On 30 Jul 2026 that guess aborted a migration mid-run. Query `pg_constraint` /
  `pg_policies` / `pg_indexes` first, or write catalog-driven SQL in a `DO` block that skips
  when the object is absent.
- **`supabase-setup.sql` is documentation, not truth.** It has drifted from the live project.
  Objects have been added by hand in the dashboard that appear nowhere in the repo (see §5).
  Check the live catalog before reasoning about schema.
- **Read-only SQL is free — use it constantly.** Row counts, `\d`-equivalents, policy dumps,
  function bodies. Confirm, then act.
- Before claiming something is broken or fixed in production, check `get_advisors`,
  `get_logs`, or Vercel's `get_runtime_errors`. Do not infer from source alone.

## 2. Migrations

Writes to production are the one place to slow down.

- **Confirm with the user before any DDL or data write.** Read-only is free; writes are not.
- Use `apply_migration` (not `execute_sql`) for DDL so it is recorded in migration history.
- Back the affected tables up into a `backup` schema **before** the transaction begins.
- Wrap in a transaction and make it **idempotent** — assume a previous attempt half-ran.
  Guard every step (`if to_regclass(...) is null then ...`), because the most likely second
  run is a retry after a partial failure.
- `alter table ... rename` carries rows, PK, FKs, indexes and RLS policies. It does **not**
  rewrite function bodies: every SECURITY DEFINER function naming the table as text must be
  recreated in the same migration, or login and RLS break silently.
- End with verification queries proving nothing was lost (counts vs. the backup, FK orphan
  checks) and actually run them afterwards.
- **Re-run `get_advisors` after any DDL.** It catches missing RLS, mutable `search_path`, and
  over-permissive policies that a passing build will never reveal.
- Edge functions deploy **separately** from the frontend — say so explicitly, and use
  `deploy_edge_function` rather than telling the user to do it by hand.

## 3. Verification — what actually proves something

- **Demo mode proves nothing about the database.** `.env.test` leaves the Supabase vars empty,
  so `supabase === null` and every write goes to localStorage. The whole Playwright suite can
  pass against a completely broken database. That gap is what hid the 29 Jul incident.
- Load the **`verify` skill** (`.claude/skills/verify/SKILL.md`) BEFORE editing `src/`,
  `supabase/`, or writing SQL — not at the end as a formality. Name which of its items your
  change touches, and update it in the same change when you alter one deliberately.
- `npx vite build` and `npm run test:cloud` are necessary, not sufficient.
- After a schema change: query the live DB for the result, then create a job in the real app
  and reload to confirm it persisted.
- Report what you ran and what you did not. Never describe an unverified change as working.

## 4. The team you have — use it

Installed plugins (`~/.claude/plugins`, official marketplace):

- **`/feature-dev`** — guided feature development: discovery → clarifying questions →
  architecture → implementation. Use for anything non-trivial rather than diving into edits.
- **`/code-review`** — reviews the working diff.
- **Subagents** (`feature-dev` plugin): **`code-explorer`** traces how an existing feature
  actually works end-to-end; **`code-architect`** produces an implementation blueprint from
  existing patterns; **`code-reviewer`** reviews against *this file* with confidence-based
  filtering.

`code-architect` and `code-reviewer` explicitly read `CLAUDE.md` — **this file is the brief
those agents work from.** A rule written here is enforced by every future review; a rule
explained only in chat dies with the session. When a mistake is worth not repeating, add it
here in the same change.

Note the project's own scoped skill: **`flexachem-workshop-tracker:verify`** (§3).

## 5. Verified live-schema facts the repo does not document

Confirmed against production on 30 Jul 2026. These exist only in the live database — they are
in no migration file, so nothing in the repo will tell you about them.

- **`jobs.staff_id` exists**, alongside the name-based `jobs.alloc`. Two hand-written triggers
  keep them in sync:
  - `flexachem_sync_job_columns()` — resolves `alloc` ⇄ `allocated_to`, then **name-matches
    `alloc` against `staff.name` to populate `staff_id`**; also syncs `hrs`/`est_hours`,
    `actual_hours`/`act_hours`, `cust`/`customer`, `type`/`job_type`, `bus`/`business_unit`.
  - `flexachem_sync_job_staff()` — the same linkage in the other direction.
  - Consequence: **job→staff linkage is by NAME, not id.** Renaming a staff member, or having
    no `staff` row for an assignee, silently leaves `staff_id` null. This is why the roster
    split in §6 mattered more than it looked.
  - Both have a **mutable `search_path`** (flagged by `get_advisors`) — worth fixing, and a
    reminder that dashboard-authored SQL skips every repo safeguard.
- **People are split across two tables**: `accounts` (login: role, active, theme, onboarded;
  PK = `auth.users.id`; renamed from `profiles` on 30 Jul 2026) and `staff` (assignable
  technician + calendar). Matched **by email**. Admins deliberately get **no** `staff` row and
  are not assignable. The `profiles` compatibility view was dropped once the new build went
  live — nothing named `profiles` exists any more.
- **The alerting safety net from the 29 Jul retrospective is NOT fully installed.**
  `supabase/alerts-setup.sql` has never been applied: there is **no `job_alerts` table** and
  **no AFTER INSERT alert trigger on `jobs`** (the only triggers there are the two sync ones
  above). Consequences: the server-side "job created" email never fires; the client-reported
  failure path still emails, but its `job_alerts` insert fails silently and the hourly rate
  cap counts zero, so it can never engage. Do not assume alerting covers you.
- Deleting a `staff` row does not delete the `accounts` row or the `auth.users` account. To
  free an email for re-invite, delete the user in Dashboard → Authentication → Users.
- **Supabase JWT signing key must stay Legacy HS256.** ES256 breaks the `invite-user` edge
  function with `invalid JWT: unrecognized JWT kid <nil> for algorithm ES256` — a Supabase
  platform issue, not an app bug.

## 6. House style

- Match the surrounding code's comment density and idiom. Comments here explain *why*,
  especially where a naive change would reintroduce a fixed bug — keep that convention.
- All colour via semantic tokens; no raw hex in `src/**/*.jsx`.
- Every Supabase mutation returns `{ ok, error, message }` and rolls back its optimistic
  update on failure (`runWrite`, `src/lib/writes.js`). A write returning `undefined` cannot
  tell its caller it failed — do not add one.
