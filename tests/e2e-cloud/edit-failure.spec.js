import { test, expect } from "@playwright/test";
import { seedCloudSession, notNullViolation, jobRow } from "./helpers.js";

// Creation is covered by write-failure.spec.js. This covers the OTHER half: edits and status
// changes, which flow through auditPatch -> patchJob rather than addJob. Every drag-drop, card
// status control, note and edit in the app lands here, so a silent failure on this path would
// be just as damaging as the one that lost two jobs on 29 Jul 2026.

// Use the card's explicit "Edit job" button rather than double-clicking the card. Both open
// the modal, but a dblclick also fires the single-click handler that opens the drawer, and
// under parallel load the race between them made these tests flaky.
async function openEditModal(page) {
  await page.goto("/schedule");
  const card = page.locator("article").filter({ hasText: "A007563" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /edit job/i }).click();
  const dialog = page.locator("form").filter({ hasText: /A007563/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Assembly \/ Tag/)).toHaveValue("A007563");
  return dialog;
}

test("a rejected edit keeps the modal open and reverts the job", async ({ page }) => {
  let patchAttempts = 0;
  await seedCloudSession(page, {
    jobs: [jobRow()],
    onPatchJob: (route) => {
      patchAttempts += 1;
      return route.fulfill(notNullViolation("customer"));
    },
  });

  const dialog = await openEditModal(page);
  await dialog.getByLabel(/^Assembly \/ Tag/).fill("A007563-EDITED");
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect.poll(() => patchAttempts).toBeGreaterThan(0);

  // Modal stays open with the edit intact, and states the reason.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Assembly \/ Tag/)).toHaveValue("A007563-EDITED");
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText(/couldn't save your changes/i);
  await expect(alert).toContainText(/customer/);

  // And the board still shows the ORIGINAL value — the rejected edit was rolled back rather
  // than left on screen looking applied.
  await page.getByRole("button", { name: /^cancel$/i }).click();
  await expect(page.locator("article").filter({ hasText: "A007563-EDITED" })).toHaveCount(0);
  await expect(page.locator("article").filter({ hasText: "A007563" })).toBeVisible();
});

test("a rejected write raises a banner in the app shell, not just the modal", async ({ page }) => {
  await seedCloudSession(page, {
    jobs: [jobRow()],
    onPatchJob: (route) => route.fulfill(notNullViolation("customer")),
  });

  const dialog = await openEditModal(page);
  await dialog.getByLabel(/^Assembly \/ Tag/).fill("A007563-EDITED");
  await page.getByRole("button", { name: /save changes/i }).click();
  await dialog.getByRole("alert").waitFor();
  await page.getByRole("button", { name: /^cancel$/i }).click();
  await expect(dialog).toBeHidden();

  // The banner is the safety net for every write that has NO modal of its own — drag-drop,
  // the card status control, notes posted from the drawer.
  const banner = page.getByRole("alert").filter({ hasText: /was not saved/i });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/customer/);

  // It must live in the app shell rather than inside the form, otherwise it would vanish with
  // the modal and those other write paths would report nothing.
  await expect(dialog.getByRole("alert").filter({ hasText: /was not saved/i })).toHaveCount(0);

  // NOTE: persistence across a route change is by construction — WriteErrorBanner is mounted
  // in AppShell above <main>, outside the <Outlet>. It is deliberately NOT asserted by
  // clicking a nav link here: the modal's framer-motion exit leaves a full-screen backdrop
  // that swallows clicks in an automation pane (see .claude/skills/verify/SKILL.md). That is
  // a harness limitation, not a product one — verify it by hand in a real browser.
});
