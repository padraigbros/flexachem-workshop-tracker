import { test, expect } from "@playwright/test";
import { seedUser, addStaffMember } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("@-mention in a note raises a notification the bell surfaces", async ({ page }) => {
  // No staff are seeded by default (demo or cloud) — add a technician ourselves so the
  // mention picker has someone to suggest, rather than relying on any built-in name.
  await addStaffMember(page, "Priya Shah", "priya.shah@flexachem.com");

  await page.goto("/schedule?job=demo-1");
  const drawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(drawer).toBeVisible();

  // Type an @-mention; the suggestion list should offer the staff member just added.
  const composer = drawer.getByPlaceholder(/type @ to notify/i);
  await composer.click();
  await composer.pressSequentially("Reviewing with @Pri");

  const option = page.getByRole("option", { name: /priya/i });
  await expect(option).toBeVisible();

  // REGRESSION GUARD (20 Aug 2026): the suggestion list must render OUTSIDE the drawer.
  // The drawer is a Framer Motion drag-to-dismiss sheet, so Framer puts `touch-action:
  // pan-x` on it and claims every vertical touch inside — a thumb tap that drifts a few
  // pixels became a sheet drag, Framer preventDefault'd it, no compatibility mousedown was
  // emitted and the pick never ran. It worked on some phones and not others depending on
  // touch slop, and a Playwright tap (zero drift) passed throughout. Assert the structure,
  // because the behaviour is not reproducible with a synthetic tap.
  await expect(option).toHaveAttribute("role", "option");
  expect(await option.evaluate((el) => Boolean(el.closest("aside")))).toBe(false);
  expect(await option.evaluate((el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const ta = getComputedStyle(n).touchAction;
      if (ta !== "auto" && ta !== "pan-y") return ta;
    }
    return null;
  })).toBe(null);

  await option.click();

  await expect(composer).toHaveValue(/@Priya Shah/);

  await drawer.getByRole("button", { name: /post update/i }).click();

  // Note posts with the mention text.
  await expect(drawer.getByText(/Reviewing with @Priya Shah/)).toBeVisible();

  // Bell shows an unread badge.
  const bell = page.getByRole("button", { name: /notifications, 1 unread/i });
  await expect(bell).toBeVisible();

  // Close the job drawer (its backdrop covers the topbar), then open the notifications panel.
  await drawer.getByRole("button", { name: /^close$/i }).click();
  await expect(drawer).toBeHidden();
  await bell.click();
  const panel = page.locator("aside").filter({ hasText: /notifications/i });
  await expect(panel.getByText(/mentioned you/i).first()).toBeVisible();

  // Clicking the notification marks it read → badge clears.
  await panel.getByText(/mentioned you/i).first().click();
  await expect(page.getByRole("button", { name: /notifications, 1 unread/i })).toHaveCount(0);
});
