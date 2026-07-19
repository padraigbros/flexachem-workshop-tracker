import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

// A note posted now must read as a present/past time, never "in N hours". Regression
// guard for the timestamp bug where full ISO instants were parsed as local noon.
test("posting a note shows a present-time timestamp, never 'in N hours'", async ({ page }) => {
  await page.goto("/schedule?job=demo-1");
  const drawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(drawer).toBeVisible();

  await drawer.getByPlaceholder(/Waiting on customer spec/i).fill("Timestamp regression note");
  await drawer.getByRole("button", { name: /Post update/i }).click();

  await expect(drawer.getByText("Timestamp regression note")).toBeVisible();
  // The freshly posted note's relative time must not be in the future.
  await expect(drawer.getByText(/^in \d/)).toHaveCount(0);
  await expect(drawer.getByText(/just now/i).first()).toBeVisible();
});

// The job drawer is a centered modal-style card on desktop (matching "Edit workshop job"),
// while the Recent-updates drawer stays a right-edge panel.
test("job drawer is centered on desktop; updates drawer stays on the right", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "centering only applies at desktop widths");

  await page.goto("/schedule?job=demo-1");
  const jobDrawer = page.locator("aside").filter({ hasText: "A007563" });
  await expect(jobDrawer).toBeVisible();
  await expect(jobDrawer.getByText("Workshop job status")).toBeVisible();

  const vw = page.viewportSize().width;
  const box = await jobDrawer.boundingBox();
  const leftGap = box.x;
  const rightGap = vw - (box.x + box.width);
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(24); // horizontally centered

  // Recent-updates drawer must remain anchored to the right edge.
  await page.goto("/schedule");
  await page.getByRole("button", { name: /Recent updates|Updates/i }).click();
  const updatesDrawer = page.locator("aside").filter({ hasText: "Recent updates" });
  await expect(updatesDrawer).toBeVisible();
  const ub = await updatesDrawer.boundingBox();
  const uRightGap = vw - (ub.x + ub.width);
  expect(ub.x).toBeGreaterThan(vw / 2); // left edge past center → right-anchored
  expect(uRightGap).toBeLessThan(48);
});
