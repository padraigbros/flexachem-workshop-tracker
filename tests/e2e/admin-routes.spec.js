import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

// Demo mode is always admin, so all admin routes are reachable here. The staff→redirect
// path can only be exercised against a real cloud staff account (documented limitation).
// Markers are visible page HEADINGS (not nav hints / subtitles, which can be hidden on mobile).
const ADMIN_ROUTES = [
  ["/staff", /staff management/i],
  ["/job-types", /job type management/i],
  ["/customers", /customer management/i],
  ["/business-units", "Pharma"],
  ["/due-dates", "Overdue"],
  ["/master-list", /master job register/i],
];

test.beforeEach(async ({ page }) => { await seedUser(page); });

for (const [route, marker] of ADMIN_ROUTES) {
  test(`admin route ${route} renders without crashing`, async ({ page }) => {
    // Uncaught exceptions / render crashes are the meaningful signal (console.error can
    // include benign network noise under parallel load).
    const crashes = [];
    page.on("pageerror", (e) => crashes.push(String(e)));

    await page.goto(route);
    await expect(page.getByRole("heading", { name: marker }).first()).toBeVisible();
    await expect(page.getByText(/unexpected application error/i)).toHaveCount(0);
    expect(crashes, crashes.join("\n")).toHaveLength(0);
  });
}
