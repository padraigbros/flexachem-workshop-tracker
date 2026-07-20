import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("Complete column is a weekly window with an archive note", async ({ page }) => {
  await page.goto("/schedule");
  await expect(page.getByText(/this week only/i)).toBeVisible();
});

test("a completed job can be archived off the board but stays in the Master List", async ({ page }) => {
  await page.goto("/schedule");
  // demo-10 (A007623) was completed a few hours ago, so it sits in the Complete column
  // for the current week.
  const card = page.locator("article").filter({ hasText: "A007623" });
  await expect(card).toBeVisible();

  // Open its drawer and archive (close out).
  await card.getByRole("button", { name: /open notes/i }).click();
  const drawer = page.locator("aside").filter({ hasText: "A007623" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /^archive$/i }).click();
  await drawer.getByRole("button", { name: /^close$/i }).click();

  // It leaves the board...
  await expect(page.locator("article").filter({ hasText: "A007623" })).toHaveCount(0);

  // ...but remains in the Master List, flagged Archived (perpetual record).
  await page.goto("/master-list");
  const row = page.locator("tr").filter({ hasText: "A007623" });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^archived$/i)).toBeVisible();
});
