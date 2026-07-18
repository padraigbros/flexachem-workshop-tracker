import { test, expect } from "@playwright/test";
import { seedUser, ROUTES } from "./helpers.js";

// Mobile only — encodes the "no horizontal page scroll + bottom nav visible" invariant
// that the APK screenshots violated.
test.describe("mobile layout invariants", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile only");
    await seedUser(page);
  });

  for (const route of ROUTES) {
    test(`no horizontal scroll and bottom nav visible on ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("[data-mobile-nav]")).toBeVisible();
      const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noHScroll, `page scrolls horizontally on ${route}`).toBe(true);
    });
  }

  test("invariant holds with the job drawer open", async ({ page }) => {
    await page.goto("/schedule?job=demo-1");
    await expect(page.locator("aside").filter({ hasText: "A007563" })).toBeVisible();
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHScroll).toBe(true);
  });
});
