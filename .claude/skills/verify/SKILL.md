---
name: verify
description: Regression checklist for the Flexachem Workshop Tracker. Run before committing any change that touches src/ — every behaviour listed here must still work. Also run the "Cloud write smoke test" section after ANY database, RLS, policy or function change, even when no src/ file was touched. If a change intentionally alters one of these behaviours, update this file in the same commit and call the change out explicitly in the commit message and to the user.
---

# Flexachem Workshop Tracker — regression checklist

## ⚠ Cloud write smoke test — REQUIRED after any database change

**Demo mode cannot validate a database change.** `.env.test` sets the Supabase vars empty, so
`supabase === null` and every write goes to localStorage. The entire Playwright suite below
can pass with a completely broken database. On 29 Jul 2026 that gap let an RLS/schema change
ship that silently broke job creation — two jobs were lost and nobody knew for hours.

After ANY change to a table, column, RLS policy, grant, trigger or function — even when no
`src/` file was touched — do all three:

- [ ] **Schema contract check.** Catches a NOT NULL column the app never writes — the exact
      `jobs.allocated_to` mismatch behind that incident. Expect zero rows that aren't `id`,
      `created_at` or `updated_at` (the database fills those itself).

      **Preferred: run this in the Supabase SQL Editor.** No key, no shell, no setup.
      ```sql
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('jobs','staff','job_types','customers','staff_calendar','public_holidays')
        and is_nullable = 'NO'
        and column_default is null
      order by table_name, column_name;
      ```
      Compare the result against what the payload builders send (`toDbPayload` in
      `src/lib/jobs.js` and the `to*DbPayload` functions in `staff.js` / `customers.js` /
      `calendar.js`). Any column in the query result that no builder writes is a gap.

      Alternative: `tools/check-schema.mjs` does the same diff automatically, but needs a
      SECRET API key in the environment and is fiddly to invoke on Windows. Use it for CI;
      for a manual check after a migration, the SQL above is faster and harder to get wrong.
- [ ] **Create a job in the real app**, signed in against the live project. Then **reload the
      page** and confirm it is still there. A job that only survives until a refetch was never
      saved — that is precisely what the incident looked like from the user's side.
      A NORMAL reload (F5) is enough: the service-worker deadlock that used to require
      Ctrl+Shift+R was fixed on 2026-07-22 (`skipWaiting` + `clientsClaim`). If you ever find
      a plain reload is not enough, that is a PWA regression — fix it, don't work around it.
- [ ] **Sync indicator is green** ("Data synced") and no red "Your last change was not saved"
      banner appears. If the banner shows, read it: it names the real Postgres reason.

Then run the cloud-mode failure suite, which proves the app still *reports* a rejected write:

```
npm run test:cloud
```

3 tests, hermetic (stubbed Supabase, port 5174 — never 5173). If you change `addJob`'s
rollback or `AppShell.saveJob`'s early return, these must go red.

Start the dev server (`.claude/launch.json` → `dev`, port 5173). No `.env.local` = demo
mode (localStorage, auto-admin). Test in the browser pane; prefer real interactions over
code reading. `npx vite build` must pass at the end.

## Critical behaviours (never break silently)

### Schedule board (dnd-kit)
- [ ] **Drag a card from anywhere on its surface** to another column → status changes,
      an audit entry ("Status: X → Y") appears. Mouse: press + move ≥8px. Touch: hold 200ms.
      NOTE: the whole card is the drag target (listeners on the `<article>`, NOT a handle
      button — a nested-button handle breaks dnd-kit). The grip icon is decorative only.
- [ ] **Columns must NOT have an internal scroll** (no `overflow-y-auto`/`max-h` on the
      column or its list). Nested scrollbars break touch drag and are unusable on mobile.
- [ ] **Single click opens the JobDrawer**; **double-click opens the edit modal** (admins).
      Click is suppressed right after a drop (`src/lib/dnd.js`).
- [ ] Every card has an **Active/Blocked/Done status control** (tap to change status —
      the reliable path on touch; drag is a bonus). Sensors: MouseSensor (8px) +
      TouchSensor (250ms long-press). Do NOT use PointerSensor — it hijacks touch scroll.
- [ ] **Every status move raises the "Log actual hours" prompt** (drag-drop, the card
      status control, the Master List switch, and the drawer). Moving to **Complete is
      gated**: no Skip button and Save stays disabled until hours > 0. Other transitions
      offer **Skip** (applies the move, logs nothing). **Cancel abandons the move entirely** —
      the job must NOT land in the new column. Saving writes ONE audit entry combining both
      ("Status: In Progress → Complete · Actual hours: 0 → 24").
- [ ] The **JobModal Status dropdown enforces the same gate** — setting Status to Complete
      with Actual hours 0 blocks the save with "Required to mark a job complete". Without
      this the edit modal is a back door around the prompt and the job drops silently out of
      the dashboard's estimate-vs-actual figures.

### Jobs
- [ ] `?job=<id>` deep link opens the drawer; browser Back closes it. IDs are strings —
      `normalizeJob` MUST `String()` the id or numeric DB ids fail `job.id === jobId` and the
      drawer/edit silently no-op with real Supabase data (demo ids are strings, so demo hides it).
- [ ] Create job (topbar button / mobile FAB / palette): Assembly + Customer required inline,
      job appears on board, "Job created" audit entry exists. Customer is a **Select** driven
      by the active customer catalogue; a job whose stored `cust` isn't catalogued (legacy /
      PDF-imported) still shows as the selected option and re-saves unchanged.
- [ ] Edit job → changed fields produce an audit diff entry.
- [ ] PDF import: drop an Assembly Order PDF in the JobModal → fields autofill, chips list
      what was found, PDF attaches (pdfjs loads lazily — no pdfjs in initial network log).
- [ ] Post a note from the drawer (with status change) → the note posts against the CURRENT
      status, then the status move runs through the actual-hours prompt (two entries: the note,
      then the audit diff). Cancelling the prompt keeps the note. Appears in feed + Recent updates.
      Its timestamp reads a present/past relative time ("just now", "4 minutes ago") — NEVER
      "in N hours". Note `at` is a full ISO instant; `formatRelative`/`formatDateTime` parse it
      via `parseInstant` (NOT `parseISODate`, which noon-anchors date-only start/due fields).
- [ ] JobDrawer is **centered** on desktop (modal-style, like "Edit workshop job") via the
      `desktopCentered` prop; header shows the "Workshop job status" eyebrow. The Recent-updates
      drawer and Filters sheet stay **right-anchored** (they don't pass the prop). All three
      remain mobile bottom-sheets with drag-to-dismiss.
- [ ] Delete (Master List) → ConfirmDialog → job moves to Archive → Restore brings it back.
- [ ] **Complete column is a weekly window**: it shows only jobs completed since the most
      recent Saturday-midnight (Sunday 00:00) boundary; older completed jobs auto-drop off the
      board. Completing a job stamps `completed_at`; legacy completes fall back to `updated_at`.
      A completed job's drawer has an **Archive** (close-out) action that removes it from the
      board early; archived/older-completed jobs still appear in the **Master List** in
      perpetuity (non-deleted) with an "Archived" badge, and can be returned to the board.
      Archived ≠ deleted (deleted = the separate trash/restore Archive card).
- [ ] **@-mentions**: typing `@` in the JobDrawer note composer opens a suggestion list
      (login accounts in cloud; staff names in demo). Picking inserts `@Full Name`; posting a
      note with a mention raises a notification (demo: a self-notification so it's testable).
      Mentioned `@Name` renders highlighted in the posted note.

### Customers
- [ ] `/customers` (admin) lists the seeded catalogue: add, deactivate/reactivate, batch
      "Move all" onto another customer (writes an audit diff), remove-if-no-open-jobs.
      "Uncatalogued customers" lists `cust` strings on jobs not in the catalogue with one-click Add.
- [ ] Dashboard "Jobs per customer" card ranks by open jobs; tapping a row toggles the shared
      search filter to that customer name.

### Estimate accuracy (admin)
- [ ] `/accuracy` (admin-only, code-split) toggles between **Scatter Plot** and **Staff
      Scorecards**; the choice is deep-linkable (`?view=scorecards`). Scatter dots open the
      job drawer; a scorecard toggles the shared `employee` filter to that person.
- [ ] Only completed jobs with BOTH an estimate and logged actual hours are scored — the
      rest are excluded (not counted as zero) and the excluded count is stated on the page.
- [ ] **Grades come from the mean ABSOLUTE error (`spread`), not the signed average
      (`bias`)** — see `src/lib/accuracy.js`. Grading on bias awards an A to someone who
      misses by ±60% in alternating directions. Both numbers are shown on each card.

### Team roster, calendar, availability & invitations
- [ ] `/staff` is a **single unified "Team" card** (the old separate "Staff management" +
      "Login accounts" cards were merged). One row per person, reconciling the staff record
      (assignable, has a calendar) with its login account row in `accounts` (role, sign-in status),
      **matched by email**. Row shows: avatar, name, email, **Admin/Staff** badge, and
      **Pending** when an invited person has never signed in. Deliberately NOT shown: an
      Active/Inactive chip (Deactivate/Reactivate says it, and the row dims) and the
      open-jobs count.
- [ ] **Exactly three action slots per row, fixed width `34px 106px 106px`:**
      1. calendar (staff only; admins get an empty placeholder so columns still line up)
      2. **role toggle OR Resend OR Remove** — mutually exclusive by construction, which is
         why they share one slot and no gap is ever left: the role toggle needs an account,
         Resend needs an account that has never signed in, and **Remove is only offered for a
         staff record with NO account**. A staff record is derived from an active staff-role
         account, so deleting one for a person who can log in just gets it recreated by the
         reconciler — the button appeared broken because the system disagreed with the click.
         Removing such a person = Deactivate, or delete the auth user in the dashboard.
      3. Deactivate / Reactivate
      Bulk reassign (Unassigned dropdown + Move jobs) lives ONLY in the Team Availability
      drawer now, not on the roster row.
- [ ] **The name column must never collapse.** The row grid is
      `minmax(0,1fr) 9rem auto`, and `minmax(0,1fr)` will happily go to ZERO to satisfy the
      fixed tracks. A wider action cluster (628px) did exactly that at the 1280px CI viewport:
      every name rendered at 0px, Playwright reported it hidden, and `mentions.spec.js` failed
      while the page looked fine at 1900px. **Check `/staff` at 1280 after any change here** —
      `document.querySelector('.grid strong').getBoundingClientRect().width` must be > 0.
- [ ] **The Staff/Technician dropdown shows "Unassigned" exactly once.** `alloc` is one text
      column meaning either a person or nobody; `JobModal` must not fold the literal
      "Unassigned" into its list of technicians alongside the hardcoded option.
- [ ] **Only Staff-role people are assignable.** `activePeople` excludes any staff whose
      email matches an admin-role account, so admins never appear in the JobModal assignment
      dropdown or the per-person job cards. Demo mode has no accounts → everyone is staff.
- [ ] Each staff row has a **calendar icon** → month calendar (Modal) with prev/next + Today.
      Clicking an editable weekday opens a status picker (Available / Training / Leave / Sick);
      setting a status colours the day (icon, not truncated text), drops that week's trailing
      **hours badge** (set-apart column) by 8h; Available removes the entry, restores the hour.
      **Today** = solid brand-orange number badge; the day being edited = brand ring (distinct
      cues). Picker flips up on bottom rows and clamps horizontally so it stays in the modal.
      Legend lists all 5 statuses. Entries persist (demo: localStorage `flexachem_workshop_calendar_v1`; cloud: `staff_calendar`).
- [ ] **Irish public holidays** (config seed `DEFAULT_HOLIDAYS` / cloud `public_holidays`) show
      on every calendar in **purple**, are **read-only** (disabled, name in tooltip), and reduce
      that week's hours by 8h each. Capacity = 40 − 8×(non-available weekdays), floored at 0.
- [ ] `/staff` shows three stacked sections (NOT a List/Calendar toggle): the **Team roster
      card**, then a **Team Availability** calendar section (per-staff rows × day columns,
      week/month toggle, filters, click/shift-click to set status; "Open full calendar" opens
      the per-person Modal), then the **per-person workload cards**. Editing availability in the
      calendar updates a person's card live. Each card's tiles are **Assigned / Estimated /
      Actual** (open-job count, Σ estimated `hrs`, Σ `actualHrs`) and the capacity line/meter use
      the person's **available** hours this week (`weekAvailableHours`), e.g. "3h of 32h week"
      when on leave — NOT a flat 40h. The calendar's detail drawer mirrors the same tiles/capacity.
- [ ] **Assignment dropdown** (JobModal): staff unavailable on any weekday in the job's
      start..due range are **disabled** with a reason (e.g. "— On leave (27 Jul)"); Unassigned
      and the job's current assignee stay selectable. A **non-blocking** amber capacity warning
      shows when the selected person's free hours that week < the job's hours (save still works).
- [ ] **Add person** is a Modal (Name, Email validated, Role Staff/Admin). Staff → staff
      record (assignable) + invite; Admin → invite only (no staff record) except demo mode
      always adds a record so the person is visible. Cloud invokes the `invite-user` Edge
      Function; demo toasts that invites need Supabase. `/invite` (public route) establishes
      the invite session and asks for a password only (no email re-verification), then
      `complete_onboarding` flips the account to onboarded (drops the "Pending" chip).
      Invite errors surface the **real** function message (dug out of `error.context`, not the
      generic non-2xx) and an already-registered email gets a friendly toast. Requires SMTP +
      `<APP_URL>/invite` in the Auth redirect allowlist (see supabase-setup.sql + function comments).
- NOTE: framer-motion modal EXIT animations need a compositing browser — in a non-displayed
      automation pane, open→close (Cancel/Close on any Modal, incl. ConfirmDialog) may appear
      stuck. Verify modal close in a real browser or the deployed app, not a headless pane.

### Failed writes (never let one pass silently)
- [ ] **A rejected save keeps the modal open with the typed data**, shows a `role="alert"`
      banner naming the real reason, and the button reads "Try again". It must NOT close.
      Covered by `npm run test:cloud`; the manual equivalent is to break a constraint in the
      DB, try to create a job, and confirm nothing is lost.
- [ ] **The optimistic card rolls back.** A job whose insert failed must disappear from the
      board immediately — not linger looking saved until a refetch deletes it. NOTE: assert
      this via CLIENT-SIDE navigation (click the nav link). A `page.goto()` triggers a
      refetch that wipes the phantom either way, so a reload-based test proves nothing.
- [ ] **Every mutation returns `{ ok, error, message }`** and undoes its optimistic update on
      failure (`src/state/WorkshopProvider.jsx`, via `runWrite` in `src/lib/writes.js`). A
      write that returns `undefined` has no way to tell its caller it failed — do not add one.
- [ ] **Non-retryable errors don't offer a retry.** 23502 / 42703 / 42501 say "tell an admin";
      only network-class failures get a Reload button (`isRetryable` in `src/lib/writes.js`).
- [ ] **The red banner is visible on every breakpoint** (`WriteErrorBanner`, mounted in
      AppShell above `<main>`). The sidebar `SyncBadge` is a secondary signal only — it is
      hidden below `lg` and reads as "catching up", which is how the incident stayed invisible.

### Notifications
- [ ] Bell in the Topbar (all breakpoints) shows an unread badge; clicking opens the
      notifications panel; a row click marks it read and opens the job. RLS: a user only ever
      sees their own notification rows (cloud). Realtime insert raises a toast + live badge.

### Resilience to stale deploys
- [ ] **Chunk-load crash self-heals.** Router is wrapped in a pathless root route with
      `errorElement: <RouteErrorBoundary />` (`router.jsx`) so ANY route error — including
      every lazy-loaded admin view — is caught, not just react-router's raw default crash
      screen. On a "Failed to fetch dynamically imported module" error (stale tab open
      across a Vercel deploy, old chunk hash 404s), it auto-reloads ONCE (guarded by a
      sessionStorage flag so it can't loop) and shows a branded "Something went wrong"
      fallback with Reload/Dashboard buttons if that doesn't fix it. Verified by deleting a
      built chunk file and confirming: (1) first load reloads automatically, (2) second
      failure shows the fallback instead of looping, (3) once the chunk is available again,
      a normal load fully recovers.
- [ ] **PWA auto-update.** `dist/sw.js` MUST contain a top-level `self.skipWaiting()` AND
      `clientsClaim()` — grep for both after any `vite.config.js` change. If it instead only
      calls skipWaiting inside a `SKIP_WAITING` message handler, the update handshake is
      deadlocked: the new SW parks in "waiting", the old one keeps serving stale precached
      assets, and only Ctrl+Shift+R shows a new deploy. `injectRegister: false` does NOT
      apply the `registerType: 'autoUpdate'` defaults, so `workbox.skipWaiting`/`clientsClaim`
      are set explicitly.
- [ ] `main.jsx` reloads once on `controllerchange`, guarded by `hadController` so a
      first-ever install doesn't self-reload, and by a `reloading` flag so it can't loop.
      Registration also polls `registration.update()` hourly and on tab refocus, so a tab
      left open all day still picks up a deploy.

### Shell
- [ ] Ctrl/Cmd+K opens the palette: fuzzy job search opens drawer; Go-to navigates; actions run.
- [ ] Filters (staff/unit/status/horizon + search) narrow every view; Reset appears when active.
- [ ] Theme toggle flips instantly, persists across reload (key `flexachem_theme_v3`),
      updates `<meta theme-color>`. New visitors default to LIGHT. Signed-in users:
      toggle mirrors to `accounts.theme` via the `set_my_theme` RPC and follows the account.
- [ ] Auth: staff-role users are redirected from admin routes (`/staff` → `/`); demo mode
      auto-grants admin; logout returns to `/login`. Desktop signs out from the sidebar card;
      **mobile** signs out from the Topbar account (avatar) sheet — the only mobile sign-out.
- [ ] **No staff are seeded anywhere, demo or cloud.** `PEOPLE`/`DEFAULT_STAFF` in
      `constants.js` are intentionally empty arrays — a fresh demo session, a fresh cloud
      project, or a wiped `staff` table all show a genuinely empty technician
      dropdown/Staff view ("0 active") until someone adds a real person via the Staff view.
      Demo seed jobs (`storage.js`) use `alloc: "Unassigned"` / `owner: ""` / note
      `by: "Workshop"` — no hardcoded names. `StaffView.jsx`'s "Remove" button has no more
      protected-default guard (there are no defaults to protect). Tests must never assume a
      named technician exists — seed one via the Staff view first (see `mentions.spec.js`).
- [ ] Demo-mode data survives a hard refresh (localStorage).

### Responsive (resize_window 375×812)
- [ ] Bottom tab bar with animated active pill; FAB visible (admin); drawers become
      bottom-sheets with drag-to-dismiss; board columns snap-scroll horizontally.
- [ ] **No-overflow invariant**: on EVERY route, `scrollWidth <= innerWidth` AND
      `main.scrollWidth <= main.clientWidth` (the second catches content clipped by the
      `overflow-x: clip` guard). Any `grid gap-*` used as a single-column stack MUST have a
      base `grid-cols-1` OR rely on the `:where(.grid){grid-auto-columns:minmax(0,1fr)}` rule
      in app.css — a bare grid sizes its column to max-content and overflows narrow screens.
- [ ] Topbar clears the status bar (safe-area top inset); bottom nav visible.
- [ ] Filters open as a **bottom sheet** on mobile (Reset + Show results) and inline on `sm+`.
- [ ] Board columns: the next column peeks (~88vw) and the board snap-scrolls horizontally
      **when not dragging**. Scroll-snap is suspended while a drag is active (`!activeId`) so
      auto-scroll can reach middle columns; drag-drop lands in the correct column (incl. In
      Progress / Input Needed). `DndContext` uses `MeasuringStrategy.Always` so column rects
      stay fresh as the board scrolls mid-drag.
- [ ] Status controls + card icon buttons are ≥44px on touch (`pointer-coarse` variants).
- [ ] Page gutter, display numerals and page title use the fluid tokens
      (`--spacing-gutter`, `--text-display`, `--text-title`) — no fixed px gutters left.

### Build gates
- [ ] `npx vite build` succeeds; pdfjs + admin views remain separate chunks.
- [ ] No new raw hex colours in `src/**/*.jsx` (grep) — all colour via semantic tokens.
- [ ] Zero console errors across Dashboard, Schedule, Master List, drawer open/close.

## Known intentional behaviour changes (log them here)
- 2026-07-31: **Roster rows stripped back to three actions.** Removed from each row: the
  reassign dropdown, Move jobs, the open-jobs count and the Active/Inactive chip. Remove now
  shares the middle slot with the role toggle and Resend (they can never co-occur), so there
  is no reserved empty slot and no gap. Bulk reassign survives only in the Team Availability
  drawer. **This also fixed CI**: the previous 628px action cluster starved the
  `minmax(0,1fr)` name column to 0px at the 1280px CI viewport, so every name was "hidden"
  and `mentions.spec.js` failed — while looking perfectly fine on a 1900px monitor. Verified
  after the change at 1280: names 110–136px wide, row template `448px 144px 262px`, action
  slots `34px 106px 106px`, identical control x-positions on every row, no overflow at 375.
- 2026-07-30: **Alerting is failure-only, and a public holiday no longer blocks assignment.**
  - `job_alerts` installed and `sweep-job-errors` scheduled hourly (`pg_cron`), but the
    `on_job_created` trigger deliberately NOT installed — no per-job confirmation email. Note
    the sweeper still returns 500 until `SUPABASE_MGMT_TOKEN`/`SUPABASE_PROJECT_REF` are set
    as function secrets; a scheduled job that 500s hourly reports nothing on its own, so check
    `net._http_response` after changing it.
  - `unavailableReason` (`src/lib/calendar.js`) no longer treats a public holiday as personal
    unavailability. It closes the shop for everyone, so it cannot distinguish technicians —
    and because `JobModal` disables any option that has a reason, EVERY option except the
    current assignee was disabled, making any job spanning a holiday impossible to assign.
    Holidays still shrink capacity via `weekAvailableHours`, and `holidaysInRange` states them
    once against the job's date range ("Shop closed in this range: …").
  - Staff rows use fixed grid tracks (`minmax(0,1fr) 13rem auto`, action slots
    `2.25rem 11.5rem 5.5rem 6rem 6rem 5.5rem`) with empty placeholders for unused slots.
    Each row is its own grid, so an `auto` track resolved per-row and pulled every control out
    of line with the row above. Verified: all rows report an identical computed
    `grid-template-columns` and identical control x-positions.
- 2026-07-30: **One source of truth for "is this person a technician": the login account.**
  An active `accounts.role='staff'` row always implies a `staff` record, enforced by the
  reconciler in `WorkshopProvider`. Consequence, and the reason for the change: deleting a
  staff row for someone who has an account was not a stable state — the reconciler recreated
  it on the next load, which is why "Remove" appeared to do nothing on PBTest2 (the row came
  back 55 minutes later with a fresh `created_at`). Remove is now hidden for any row with an
  account; removing such a person means Deactivate (revokes access, keeps history) or
  deleting the auth user in the dashboard (erases them, frees the email). Remove still works
  normally for a staff record with no login behind it, which the reconciler never touches.
  Also fixed: `JobModal` folded the literal string "Unassigned" into the technician list,
  duplicating the hardcoded option on every unassigned job (12 of them in production).
- 2026-07-30: **`profiles` renamed to `accounts`, and every staff-role person now gets a
  `staff` record.** Root cause of "I can't assign jobs or a calendar to anyone but Padraig
  Test": being on the team lived in `profiles`, but being *assignable* lives in `staff`, and
  only the "Add person → Staff" flow ever wrote both — so anyone invited as an admin and later
  demoted, or created any other way, had no staff row and therefore no calendar button, no
  reassign dropdown and no availability. Fixes: `WorkshopProvider` self-heals on load (admin
  sessions only — the staff table's RLS is admin-write), `StaffView.toggleRole` creates the
  staff record when demoting an admin to staff, and
  `supabase/migrations/001-rename-profiles-to-accounts.sql` backfills existing data.
  **Admins still deliberately get NO staff record** and remain unassignable.
  Migration gotchas worth remembering: `alter table ... rename` carries rows, PK, FKs, indexes
  and policies, but does NOT rewrite function bodies — all five SECURITY DEFINER functions
  (`handle_new_user`, `private.is_admin`, `set_my_theme`, `complete_onboarding`,
  `notify_mentions`) name the table as plain text and had to be recreated, or login and every
  RLS policy break. The `invite-user` edge function needs redeploying separately from the
  frontend. A `security_invoker` view named `profiles` is left over `accounts` as a
  deploy-window shim — drop it once the new build is verified live.
- 2026-07-29: **Failed writes now stop the user instead of failing silently.** Incident: two
  jobs created against production appeared on the board and never reached the database (insert
  rejected with `23502 null value in column "allocated_to"`); the only signal was the sidebar
  "Sync issue" chip, so the loss went unnoticed for hours. All 19 Supabase writes now run
  through `runWrite` (`src/lib/writes.js`), return `{ ok, error, message }`, and roll back
  their optimistic update on failure. `JobModal` stays open with the typed values and a
  "Try again" button; `AppShell.saveJob` no longer closes the modal unconditionally. New
  app-wide `WriteErrorBanner`; `SyncBadge` now receives all four sync states (job types and
  customers previously set an error state that was rendered nowhere) and its copy changed from
  "Sync issue / Some changes may not be live yet" to "Not saved / Some changes did not reach
  the server". New hermetic cloud-mode suite (`npm run test:cloud`, port 5174,
  `tests/e2e-cloud/`) — the first tests in this project to exercise a Supabase write at all —
  and `tools/check-schema.mjs` to catch NOT NULL columns the client never writes.
- 2026-07-25: **New admin-only `/accuracy` route** (Estimate Accuracy) with a scatter plot of
  estimate-vs-actual per completed job and per-staff scorecards. Guarded by `RequireAdmin` and
  lazy-loaded like the other admin views; nav entry is `admin: true` and sits after Master List
  so the 5-item mobile tab set is unchanged. Scoring lives in `src/lib/accuracy.js` and grades
  on mean ABSOLUTE error rather than signed bias (bias is reported alongside). The dashboard's
  existing "Estimate vs actual" card is unchanged. Android `versionCode 1 → 2` / `versionName
  1.0 → 1.1` for the accompanying Play release.
- 2026-07-24: **Staff page: Team Availability calendar is now a permanent section, not a
  List/Calendar toggle.** `/staff` stacks roster → Team Availability calendar → per-person
  cards. The per-person card tiles changed from Open/Hours/Blocked to **Assigned/Estimated/
  Actual** (over open jobs), and the card capacity line + meter now use the person's
  availability-adjusted weekly hours (`weekAvailableHours`, StaffView.jsx) instead of a flat
  40h, so leave/training/sick shrink the denominator (e.g. "3h of 32h week"). The calendar's
  detail drawer uses the same tiles/capacity for consistency.
- 2026-07-22: **Deploys now apply themselves; the "new version available" toast is gone.**
  Fixed a deadlocked service-worker handshake: `registerType: 'autoUpdate'` with
  `injectRegister: false` emitted a prompt-shaped SW (skipWaiting only on a `SKIP_WAITING`
  message) driven by autoUpdate registration code that never sent that message — so the new
  SW waited forever and only Ctrl+Shift+R surfaced a deploy. Now `workbox.skipWaiting` +
  `clientsClaim` are explicit, and `main.jsx` reloads once on `controllerchange` plus polls
  for updates hourly/on refocus. Accepted trade-off: a tab CAN reload while someone is
  typing (the idle-gated variant was considered and declined).
- 2026-07-22: Android **targetSdk 34 → 35** (Play Store requirement), superseding the
  2026-07-18 entry below. Android 15+ forces edge-to-edge at this target; the app relies on
  Capacitor 8's Bridge/StatusBar handling system-bar insets via WindowInsets, with
  `StatusBar.overlaysWebView: false` still set in `capacitor.config.json`.
  **UNVERIFIED ON DEVICE** — build an APK and confirm the status bar does not overlap the
  Topbar before shipping. If it does, revert to 34 (the app is sideloaded, so the Play Store
  requirement only binds if/when it is actually submitted).
- 2026-07-22: Business units renamed Pharma/Industrial/Engineering/Mining/Other →
  **Pumps/Valves/Mechanical Seals/Process/Venting**. `normalizeJob`'s fallback for a job with
  no unit is now `BUSINESS_UNITS[0]` (was the hardcoded "Other", which resurrected a phantom
  column on the Business Units board after the rename).
- 2026-07-22: **Status changes now prompt for actual hours.** New `StatusPromptProvider`
  (`src/state/StatusPromptProvider.jsx`) is the single funnel — every call site uses
  `requestStatusChange(id, patch)` instead of `auditPatch` directly, so the prompt cannot be
  bypassed on web or native. Completing REQUIRES hours; other moves may be skipped; cancel
  abandons the move. The drawer's note composer posts the note first, then routes its status
  change through the same funnel (so a note + status change is now two entries, not one).
- 2026-07-22: Estimated/actual hours step in **0.5h (30 min)** increments, not 0.25.
  `HOURS_STEP`/`QUICK_HOURS` in `constants.js`; `roundHours()` in `jobs.js` snaps typed values
  on save so a hand-typed 1.25 can't persist. New "Estimate vs actual" dashboard card
  (paired est/act bars per completed job + total variance %); jobs completed with 0 actual
  hours are EXCLUDED from it rather than counted as zero.
- 2026-07-18: Card drag restored to whole-card surface (was briefly grip-handle-only);
  click opens drawer (was double-click in the pre-overhaul app).
- 2026-07-18: Board collision detection closestCorners → pointerWithin (drops land under
  the pointer; the old behaviour biased toward short columns).
- 2026-07-18: Cloud mode gained realtime sync + refetch-on-resume. Notes are now
  merge-on-write (union by at|by|txt) so concurrent note-adds don't overwrite each other;
  other scalar fields remain last-write-wins (newer updated_at wins). Demo mode unchanged.
- 2026-07-18: Reverted to whole-card drag (the grip-handle-button broke dnd-kit drop
  resolution); removed the per-column internal scroll (P4 sticky headers) — it broke touch
  drag and caused nested scrollbars. Added double-click-to-edit. normalizeJob now String()s
  the id (fixes drawer/edit dead on real numeric-id data). Android: targetSdk 34 +
  StatusBar.overlaysWebView false (env(safe-area-inset) is 0 in the Android WebView, so the
  CSS-only approach never worked — the WebView is now natively inset below the system bars).
- 2026-07-18: Dark theme WAS the default (dark-first "control room"); superseded below.
- 2026-07-19: JobDrawer is now CENTERED on desktop (was a right-side panel) via a new
  `desktopCentered` prop on the shared `Drawer`; added a "Workshop job status" header eyebrow.
  UpdatesDrawer + FilterSheet keep right-anchored/side-panel behaviour (opt-in prop). Mobile
  bottom-sheet behaviour unchanged for all.
- 2026-07-19: Fixed note timestamps rendering "in N hours". `formatRelative`/`formatDateTime`
  now parse full ISO instants with `parseInstant` instead of the noon-anchored `parseISODate`
  (which is still used for date-only start/due fields).
- 2026-07-19: Mobile touch-drag can now reach middle columns. Scroll-snap on the board is
  suspended while dragging (snap-mandatory fought dnd-kit auto-scroll, pinning drops to the
  first/last column) and `MeasuringStrategy.Always` keeps droppable rects fresh mid-scroll.
- 2026-07-18: LIGHT is now the default for new visitors (key bumped to flexachem_theme_v3).
  Signed-in users' choice is saved to their account (`profiles.theme` + `set_my_theme` RPC)
  and applied on next login across devices. Dark remains available via the toggle.
- 2026-07-20: BrandMark now renders the real Flexachem wordmark PNG (was a CSS "F" tile) on a
  white tile so it stays legible on navy surfaces; the `size` prop was replaced by `className`.
- 2026-07-20: Customers are now first-class (new `customers` table + `/customers` admin view).
  JobModal's Customer field changed from a free-text Input to a Select over the catalogue
  (legacy values preserved as the current option). New "Jobs per customer" dashboard card.
  Playwright: `job-create.spec` fills Customer via `selectOption`; `/customers` added to ROUTES.
- 2026-07-20: Added @-mentions in job notes + an in-app notification bell/panel (new
  `notifications` table, `notify_mentions` security-definer RPC, `NotificationsProvider`).
  Profiles are now fetched for ALL authenticated users (was admin-only) to power mention
  suggestions. Mobile gained a Topbar account sheet (first mobile sign-out). Optional Android
  push via FCM (`push_tokens` table, `src/lib/push.js`, `supabase/functions/notify-push`) —
  inert until Firebase is configured per BUILD_APK.md; does not affect web/demo.
