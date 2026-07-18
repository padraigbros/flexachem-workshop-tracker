import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("master list: delete moves a job to Archive; restore brings it back", async ({ page }) => {
  await page.goto("/master-list");

  const row = page.locator("tr").filter({ hasText: "A007563" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /delete/i }).click();

  // ConfirmDialog → confirm. Row icon-buttons share the aria-label "Delete" but have no
  // text; the confirm button has visible text, so filter by text to disambiguate.
  await page.getByRole("button").filter({ hasText: /^Delete$/ }).click();
  await expect(page.locator("tr").filter({ hasText: "A007563" })).toBeHidden();

  // Reveal archive and restore.
  await page.getByRole("button", { name: /show \(/i }).click();
  const archived = page.locator("div").filter({ hasText: "A007563" }).filter({ has: page.getByRole("button", { name: /restore/i }) }).last();
  await archived.getByRole("button", { name: /restore/i }).click();

  await expect(page.locator("tr").filter({ hasText: "A007563" })).toBeVisible();
});
