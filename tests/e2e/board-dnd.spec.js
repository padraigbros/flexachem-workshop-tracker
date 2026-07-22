import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

// Status changes on the board are driven by the per-card status control (reliable on
// touch and mouse) — drag-to-move is an enhancement on top. We test the control + the
// card open/edit interactions here; drag itself is exercised manually (dnd-kit synthetic
// drag is not reproducible headlessly). Runs on desktop + mobile projects.
test.describe("board interactions", () => {
  test.beforeEach(async ({ page }) => { await seedUser(page); });

  test("tapping a card's status control changes status and logs an audit entry", async ({ page }) => {
    await page.goto("/schedule");
    const card = page.locator("article").filter({ hasText: "A007563" }).first();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Blocked" }).click();
    // Status moves now route through the actual-hours prompt; skipping applies the move
    // untouched. See actual-hours.spec.js for the prompt's own behaviour.
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { name: "Log actual hours" })).toBeHidden();

    await card.click(); // open the drawer
    const drawer = page.locator("aside").filter({ hasText: "A007563" });
    await expect(drawer.getByText(/Status:.*Input Needed/i)).toBeVisible();
  });

  test("single click opens the drawer; double-click opens the edit modal", async ({ page }) => {
    await page.goto("/schedule");
    const card = page.locator("article").filter({ hasText: "A007445" }).first();

    await card.click();
    await expect(page).toHaveURL(/\?job=/);
    await expect(page.locator("aside").filter({ hasText: "A007445" })).toBeVisible();

    await page.goBack();
    await card.dblclick();
    await expect(page.getByText(/Edit workshop job/i)).toBeVisible();
  });
});
