import { test, expect } from "@playwright/test";

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
