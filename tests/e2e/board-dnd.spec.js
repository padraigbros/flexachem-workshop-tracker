import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

// Desktop only — touch-hold drag emulation on the mobile project is flaky.
test.describe("board drag & drop", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
    await seedUser(page);
  });

  test("dragging a card changes status and logs an audit entry; a click opens the drawer", async ({ page }) => {
    await page.goto("/schedule");

    // demo-4 "A007445" starts in Not Started.
    const card = page.locator("article").filter({ hasText: "A007445" }).first();
    await expect(card).toBeVisible();

    const completeCol = page.locator("section").filter({ has: page.getByText("Complete", { exact: true }) }).first();
    const from = await card.boundingBox();
    const to = await completeCol.boundingBox();

    // dnd-kit PointerSensor: 8px activation, then move in steps to the target.
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + 20, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
    await page.mouse.up();

    // The card's drawer should now record the status change.
    await page.locator("article").filter({ hasText: "A007445" }).first().click();
    const drawer = page.locator("aside").filter({ hasText: "A007445" });
    await expect(drawer.getByText(/Status:.*Complete/i)).toBeVisible();
  });
});
