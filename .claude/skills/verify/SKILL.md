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
      an audit entry ("Status: X → Y") appears in the job's activity feed.
      Mouse: press + move ≥8px. Touch: hold 200ms then move.
- [ ] **Plain click on a card opens the JobDrawer** — and does NOT open it right after a drop
      (click-suppression in `src/lib/dnd.js`).
- [ ] Drop-target column highlights; DragOverlay ghost follows the pointer.

### Jobs
- [ ] `?job=<id>` deep link (e.g. `/schedule?job=demo-1`) opens the drawer; browser Back closes it.
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
- [ ] Dark-mode toggle flips instantly, persists across reload, updates `<meta theme-color>`.
- [ ] Auth: staff-role users are redirected from admin routes (`/staff` → `/`); demo mode
      auto-grants admin; logout returns to `/login`.
- [ ] Demo-mode data survives a hard refresh (localStorage).

### Responsive (resize_window 375×812)
- [ ] Bottom tab bar with animated active pill; FAB visible (admin); drawers become
      bottom-sheets with drag-to-dismiss; board columns snap-scroll horizontally.

### Build gates
- [ ] `npx vite build` succeeds; pdfjs + admin views remain separate chunks.
- [ ] No new raw hex colours in `src/**/*.jsx` (grep) — all colour via semantic tokens.
- [ ] Zero console errors across Dashboard, Schedule, Master List, drawer open/close.

## Known intentional behaviour changes (log them here)
- 2026-07-18: Card drag restored to whole-card surface (was briefly grip-handle-only);
  click opens drawer (was double-click in the pre-overhaul app).
- 2026-07-18: Board collision detection closestCorners → pointerWithin (drops land under
  the pointer; the old behaviour biased toward short columns).
- 2026-07-18: Dark theme is the default for new visitors (dark-first "control room"
  identity; theme storage key bumped to flexachem_theme_v2 so pre-existing auto-persisted
  "system" values re-default to dark once). Light mode remains available via the toggle.
