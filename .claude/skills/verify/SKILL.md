---
name: verify
description: Regression checklist for the Flexachem Workshop Tracker. Run before committing any change that touches src/ — every behaviour listed here must still work. If a change intentionally alters one of these behaviours, update this file in the same commit and call the change out explicitly in the commit message and to the user.
---

# Flexachem Workshop Tracker — regression checklist

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

### Jobs
- [ ] `?job=<id>` deep link opens the drawer; browser Back closes it. IDs are strings —
      `normalizeJob` MUST `String()` the id or numeric DB ids fail `job.id === jobId` and the
      drawer/edit silently no-op with real Supabase data (demo ids are strings, so demo hides it).
- [ ] Create job (topbar button / mobile FAB / palette): Assembly + Customer required inline,
      job appears on board, "Job created" audit entry exists.
- [ ] Edit job → changed fields produce an audit diff entry.
- [ ] PDF import: drop an Assembly Order PDF in the JobModal → fields autofill, chips list
      what was found, PDF attaches (pdfjs loads lazily — no pdfjs in initial network log).
- [ ] Post a note from the drawer (with status change) → appears in feed + Recent updates.
- [ ] Delete (Master List) → ConfirmDialog → job moves to Archive → Restore brings it back.

### Shell
- [ ] Ctrl/Cmd+K opens the palette: fuzzy job search opens drawer; Go-to navigates; actions run.
- [ ] Filters (staff/unit/status/horizon + search) narrow every view; Reset appears when active.
- [ ] Theme toggle flips instantly, persists across reload (key `flexachem_theme_v3`),
      updates `<meta theme-color>`. New visitors default to LIGHT. Signed-in users:
      toggle mirrors to `profiles.theme` via the `set_my_theme` RPC and follows the account.
- [ ] Auth: staff-role users are redirected from admin routes (`/staff` → `/`); demo mode
      auto-grants admin; logout returns to `/login`.
- [ ] Demo-mode data survives a hard refresh (localStorage).

### Responsive (resize_window 375×812)
- [ ] Bottom tab bar with animated active pill; FAB visible (admin); drawers become
      bottom-sheets with drag-to-dismiss; board columns snap-scroll horizontally.
- [ ] **No-horizontal-scroll invariant**: on EVERY route (and with a drawer/modal open),
      `document.documentElement.scrollWidth <= window.innerWidth`. Only the board's internal
      scroller and the master-list table's own `overflow-x` container may scroll sideways.
- [ ] Topbar clears the status bar (safe-area top inset); bottom nav visible.
- [ ] Filters open as a **bottom sheet** on mobile (Reset + Show results) and inline on `sm+`.
- [ ] Board columns have a bounded height with **sticky headers** (header stays, cards scroll
      inside); the next column peeks (~88vw). Drag-drop still lands in the correct column.
- [ ] Status controls + card icon buttons are ≥44px on touch (`pointer-coarse` variants).
- [ ] Page gutter, display numerals and page title use the fluid tokens
      (`--spacing-gutter`, `--text-display`, `--text-title`) — no fixed px gutters left.

### Build gates
- [ ] `npx vite build` succeeds; pdfjs + admin views remain separate chunks.
- [ ] No new raw hex colours in `src/**/*.jsx` (grep) — all colour via semantic tokens.
- [ ] Zero console errors across Dashboard, Schedule, Master List, drawer open/close.

## Known intentional behaviour changes (log them here)
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
- 2026-07-18: LIGHT is now the default for new visitors (key bumped to flexachem_theme_v3).
  Signed-in users' choice is saved to their account (`profiles.theme` + `set_my_theme` RPC)
  and applied on next login across devices. Dark remains available via the toggle.
