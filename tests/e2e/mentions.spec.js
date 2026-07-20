import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("@-mention in a note raises a notification the bell surfaces", async ({ page }) => {
  await page.goto("/schedule?job=demo-1");
  const drawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(drawer).toBeVisible();

  // Type an @-mention; the suggestion list should offer a demo staff member.
  const composer = drawer.getByPlaceholder(/type @ to notify/i);
  await composer.click();
  await composer.pressSequentially("Reviewing with @Da");

  const option = page.getByRole("option", { name: /darragh/i });
  await expect(option).toBeVisible();
  await option.click();

  await expect(composer).toHaveValue(/@Darragh/);

  await drawer.getByRole("button", { name: /post update/i }).click();

  // Note posts with the mention text.
  await expect(drawer.getByText(/Reviewing with @Darragh/)).toBeVisible();

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
