import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

// Seed the user but NOT a theme, so we assert the light default.
test.beforeEach(async ({ page }) => { await seedUser(page); });

test("light is the default; toggle persists to v3 across reload", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: /switch to dark mode/i }).first().click();
  await expect(html).toHaveClass(/\bdark\b/);
  const stored = await page.evaluate(() => localStorage.getItem("flexachem_theme_v3"));
  expect(stored).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
