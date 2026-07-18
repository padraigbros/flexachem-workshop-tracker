import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("?job= deep link opens the drawer; browser back closes it", async ({ page }) => {
  await page.goto("/schedule");            // establish history so back() stays in-app
  await page.goto("/schedule?job=demo-1");

  const drawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(drawer).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(drawer).toBeHidden();
});
