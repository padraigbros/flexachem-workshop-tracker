import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test("unauthenticated visitor is redirected to login, can sign in, and stays signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  // Demo login form has sensible defaults; just submit.
  await page.getByRole("button", { name: /enter workshop dashboard/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /command centre/i })).toBeVisible();

  // Session persists across reload (localStorage).
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /command centre/i })).toBeVisible();
});

test("mobile users can sign out via the account sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the account sheet is mobile-only (desktop uses the sidebar)");
  await seedUser(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /command centre/i })).toBeVisible();

  await page.getByRole("button", { name: /^account$/i }).click();
  const sheet = page.locator("aside").filter({ hasText: /sign out/i });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /sign out/i }).click();

  await expect(page).toHaveURL(/\/login$/);
});
