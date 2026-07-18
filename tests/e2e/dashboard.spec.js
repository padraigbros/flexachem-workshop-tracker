import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("dashboard shows stat cards, high-risk queue and recent updates", async ({ page }) => {
  await page.goto("/");

  for (const label of ["Overdue", "Hours booked", "Complete", "Total jobs"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  // Total jobs = the 12 seed rows.
  await expect(page.getByText(/12 in database/i)).toBeVisible();

  await expect(page.getByRole("heading", { name: /high-risk queue/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /recent workshop updates/i })).toBeVisible();
});
