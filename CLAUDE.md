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
| Vercel (`mcp__*__*`) | project `flexachem-workshop-tracker`, team `team_UUR9CWM7KlNjKtGZUlhMfBsW` | `list_deployments`, `get_deployment_build_logs`, `get_runtime_errors`, `get_runtime_logs` |
| Sentry (`mcp__*__*`) | org `padraigbrosnan`, project `flexachem-workshop-tracker`, region `https://de.sentry.io` | `search_issues`, `get_sentry_resource`, `update_issue`, `find_alert_rules` |

**What the connectors cannot do — these need the dashboard, or the browser tools:**

- **Supabase Edge Function secrets.** No MCP tool exists. Dashboard → Edge Functions → Secrets.
- **Vercel environment variables.** No MCP tool exists either; use the `claude-in-chrome`
  tools against the real browser (it holds the logged-in session).
- **GitHub.** The `gh` CLI is **not installed** on this machine. To read CI results, drive
  `github.com/padraigbros/flexachem-workshop-tracker/actions` with the browser tools.
- The Vercel connector dropped out repeatedly on 30–31 Jul. If it returns
  "connection invalidated", say so and fall back to the browser rather than guessing.
- **Never create or handle credentials** (personal access tokens, API keys) — hand those back
  to the user even when the surrounding task is yours.

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

**Run what CI runs, at the size CI runs it.**

- CI (`.github/workflows/ci.yml`, on every push) = `npm ci` → `npm run build` →
  `npx playwright install chromium` → **`npm test`**. Reproduce failures locally with
  `npx playwright test` — same suite, no GitHub round-trip needed.
- **`npm test` runs at a 1280×800 desktop viewport and a Pixel 7 mobile viewport.** Verifying
  a layout change only on a wide monitor proves nothing about either. On 31 Jul a change that
  looked perfect at 1900px starved a `minmax(0,1fr)` column to **zero width** at 1280 and
  broke three consecutive CI runs. **Measure at 1280 before pushing.**
- `npm run test:cloud` is the separate hermetic write-failure suite (port 5174, stubbed
  Supabase). Both must be green.
- A green local run is the bar for pushing to `main` — pushing onto a red build hides
  whichever failure comes next.

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
    no `staff` row for an assignee, silently leaves `staff_id` null. This is why the
    accounts/staff split described below mattered more than it looked.
  - Both had a **mutable `search_path`** until migration 002 pinned it — a standing reminder
    that dashboard-authored SQL skips every safeguard the repo has.
- **People are split across two tables**: `accounts` (login: role, active, theme, onboarded;
  PK = `auth.users.id`; renamed from `profiles` on 30 Jul 2026) and `staff` (assignable
  technician + calendar). Matched **by email**. Admins deliberately get **no** `staff` row and
  are not assignable. The `profiles` compatibility view was dropped once the new build went
  live — nothing named `profiles` exists any more.
- **Alerting: Sentry is the live channel; the Resend email path has never worked.**
  As of 30 Jul 2026, Sentry is wired and verified end-to-end (org `padraigbrosnan`, project
  `flexachem-workshop-tracker`, region `https://de.sentry.io`; `VITE_SENTRY_DSN` set on Vercel
  for Production+Preview). It covers JS crashes, rejected DB writes (`captureWriteFailure`)
  and auth failures, and its default rule emails on new high-priority issues.
  **The Resend/`notify-job-event` email path has never sent an email**: `RESEND_API_KEY` and
  `ALERT_EMAIL_TO` are not set (Edge Function Secrets holds only `PUSH_WEBHOOK_SECRET`,
  `FCM_SERVICE_ACCOUNT`, `APP_URL`), so `sendEmail()` returns early every time. Likewise
  `sweep-job-errors` returns `500 SUPABASE_MGMT_TOKEN / SUPABASE_PROJECT_REF not set` and is
  scheduled hourly, so it fails hourly in silence. Sentry now covers most of what the Resend
  path was for — do not assume both are running.
  **A scheduled job that fails reports nothing about itself** — the only trace is
  `select id, status_code, left(content,200) from net._http_response order by id desc limit 5;`
  Check that after touching anything cron- or webhook-driven.
- `on_job_created` (the per-job confirmation email) is deliberately **not** installed.
- **`sweep-job-errors` is publicly triggerable**: deployed with `verify_jwt = false` and it
  performs no auth check of its own. It only reads logs and mails `ALERT_EMAIL_TO`, but that
  is an inbox-flood vector. `notify-job-event` guards itself with an `x-alert-secret` header;
  the sweeper should do the same.
- Deleting a `staff` row does not delete the `accounts` row or the `auth.users` account. To
  free an email for re-invite, delete the user in Dashboard → Authentication → Users.
- **Supabase JWT signing key must stay Legacy HS256.** ES256 breaks the `invite-user` edge
  function with `invalid JWT: unrecognized JWT kid <nil> for algorithm ES256` — a Supabase
  platform issue, not an app bug.

## 6. Applied migrations

Every migration applied to production is recorded in `supabase/migrations/`, in order:

| File | What it did |
| --- | --- |
| `001-rename-profiles-to-accounts.sql` | `profiles` → `accounts`, recreated the five SECURITY DEFINER functions, backfilled `staff` records, left a temporary compatibility view |
| `002-drop-profiles-shim-and-pin-trigger-search-path.sql` | dropped the shim once the new build was live; pinned `search_path` on the two hand-written job/staff triggers |
| `003-failure-only-alerting.sql` | created `job_alerts`; enabled `pg_cron` and scheduled `sweep-job-errors` hourly at `:07`. Deliberately did NOT install `on_job_created` |

Add the file in the same change as the `apply_migration` call, so the repo and the database
never disagree about what has run.

## 7. House style

- Match the surrounding code's comment density and idiom. Comments here explain *why*,
  especially where a naive change would reintroduce a fixed bug — keep that convention.
- All colour via semantic tokens; no raw hex in `src/**/*.jsx`.
- **Fixed grid tracks are a budget, and `minmax(0,1fr)` pays for them.** A `1fr` column will
  collapse to zero rather than force overflow, so every pixel added to a fixed track is taken
  from the flexible one — silently, and only at narrow widths. Anything added to a row of
  fixed slots has to earn its width, and has to be re-measured at 1280 (§3).

## 8. Open items (as of 31 Jul 2026)

Carried forward deliberately, not forgotten. Confirm each is still true before acting.

1. **`sweep-job-errors` fails every hour, silently.** It is scheduled via `pg_cron` but
   returns `500 SUPABASE_MGMT_TOKEN / SUPABASE_PROJECT_REF not set`. Either set both secrets
   (the token is a personal access token the user must create), or unschedule the cron —
   a job that cannot succeed is worse than no job. User's call, still pending.
2. **Resend email path**: set `RESEND_API_KEY` + `ALERT_EMAIL_TO`, or accept that Sentry is
   the only alerting channel and treat `notify-job-event` as dormant.
3. **`sweep-job-errors` is publicly triggerable** (`verify_jwt = false`, no auth of its own).
   Add the same `x-alert-secret` check `notify-job-event` uses.
4. **Leaked-password protection is disabled** in Supabase Auth — a dashboard toggle.
5. `jobs update authenticated` is `USING (true)` — flagged by `get_advisors`, but it is the
   documented design (staff change their own job statuses; the finer rule is enforced in the
   UI). Do not "fix" it without asking.
6. `VITE_SENTRY_DSN` on Vercel is flagged Sensitive, so its value can't be read back in the
   dashboard. Harmless — a DSN ships in the client bundle anyway — but don't waste time
   hunting for the value there; get it from the Sentry connector.
- Every Supabase mutation returns `{ ok, error, message }` and rolls back its optimistic
  update on failure (`runWrite`, `src/lib/writes.js`). A write returning `undefined` cannot
  tell its caller it failed — do not add one.
