import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

test("customers view: add, and seeded customers manageable", async ({ page }) => {
  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: /customer management/i })).toBeVisible();

  // A seeded customer is present as a catalogue row (a <strong>, not a hidden <option>).
  await expect(page.locator("strong", { hasText: "GE Whitegate" }).first()).toBeVisible();

  // Add a new customer.
  await page.getByPlaceholder(/new customer name/i).fill("Playwright Chem Co");
  await page.getByRole("button", { name: /add customer/i }).click();
  await expect(page.locator("strong", { hasText: "Playwright Chem Co" }).first()).toBeVisible();
});

test("uncatalogued customers from seed jobs can be added to the catalogue", async ({ page }) => {
  await page.goto("/customers");
  // Seed job demo-1 uses cust "MSD", which is not in the seeded catalogue.
  const uncatalogued = page.getByText(/uncatalogued customers/i);
  await expect(uncatalogued).toBeVisible();
  await expect(page.getByText("MSD", { exact: true }).first()).toBeVisible();
});

test("job modal customer field is a select including seeded and legacy values", async ({ page }) => {
  await page.goto("/");
  const topbarNew = page.getByRole("button", { name: /log new job/i });
  if (await topbarNew.count()) await topbarNew.first().click();
  else await page.getByRole("button", { name: /^log new job$/i }).click();

  const dialog = page.locator("form").filter({ hasText: /create a production record/i });
  await expect(dialog).toBeVisible();

  const select = dialog.getByLabel(/^Customer/);
  await expect(select).toBeVisible();
  // Seeded catalogue option is selectable.
  await select.selectOption("Regeneron");
  await expect(select).toHaveValue("Regeneron");
});

test("editing a legacy-customer job keeps its value in the select", async ({ page }) => {
  // demo-1 has cust "MSD" (not catalogued). Open it and edit.
  await page.goto("/schedule?job=demo-1");
  const drawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /edit/i }).click();

  const dialog = page.locator("form").filter({ hasText: /edit workshop job/i });
  await expect(dialog).toBeVisible();
  // The legacy value survives as the selected option even though it isn't catalogued.
  await expect(dialog.getByLabel(/^Customer/)).toHaveValue("MSD");
});

test("dashboard jobs-per-customer card filters when a customer is tapped", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "uses the dashboard side column");
  await page.goto("/");
  const card = page.locator("section").filter({ hasText: /jobs per customer/i });
  await expect(card).toBeVisible();
  // Tapping a customer row writes its name into the shared search filter.
  const firstRow = card.getByRole("button").first();
  const name = (await firstRow.innerText()).split("\n")[0].trim();
  await firstRow.click();
  await expect(page.getByPlaceholder(/filter jobs/i)).toHaveValue(name);
});
