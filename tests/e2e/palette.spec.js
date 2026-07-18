import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("command palette navigates to a view and opens a job", async ({ page }) => {
  await page.goto("/");

  // Open via the topbar trigger (also verifies the button); then type a view + Enter.
  await page.getByTitle(/search jobs, navigate/i).click();
  const input = page.getByPlaceholder(/search jobs, navigate/i);
  await expect(input).toBeVisible();
  await input.fill("Master");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/master-list$/);

  // Reopen with the Ctrl+K shortcut → fuzzy-search a job → Enter opens its drawer.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/search jobs, navigate/i).fill("A007584");
  await page.keyboard.press("Enter");
  await expect(page.locator("aside").filter({ hasText: "A007584" })).toBeVisible();
});
