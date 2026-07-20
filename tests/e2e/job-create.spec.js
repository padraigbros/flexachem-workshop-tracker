import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("create job: validation, appears on board, audit entry", async ({ page }) => {
  await page.goto("/");

  // Open the new-job modal (topbar button on desktop, FAB on mobile).
  const topbarNew = page.getByRole("button", { name: /log new job/i });
  if (await topbarNew.count()) await topbarNew.first().click();
  else await page.getByRole("button", { name: /^log new job$/i }).click();

  const dialog = page.locator("form").filter({ hasText: /create a production record/i });
  await expect(dialog).toBeVisible();

  // Empty required fields → inline validation.
  await page.getByRole("button", { name: /create job/i }).click();
  await expect(dialog.getByText("Required").first()).toBeVisible();

  // Fill the minimum and save. Anchored regexes — the inline "Required" text appends to
  // the label's accessible name, and a bare /assembly/i also matches the Job Type select.
  await dialog.getByLabel(/^Assembly \/ Tag/).fill("TEST-9001");
  await dialog.getByLabel(/^Customer/).selectOption("Eli Lilly");
  await page.getByRole("button", { name: /create job/i }).click();
  await expect(dialog).toBeHidden();

  // New card shows on the board and its drawer has the creation audit entry.
  await page.goto("/schedule");
  const card = page.locator("article").filter({ hasText: "TEST-9001" });
  await expect(card).toBeVisible();
  await card.click();
  const drawer = page.locator("aside").filter({ hasText: "TEST-9001" });
  await expect(drawer.getByText(/job created/i)).toBeVisible();
});
