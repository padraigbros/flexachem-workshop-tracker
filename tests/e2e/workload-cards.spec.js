import { test, expect } from "@playwright/test";
import { seedUser, addStaffMember } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

// The workload cards moved to /calendar on 20 Aug 2026 and stopped rendering empty
// placeholders the same day. With 25 accounts on the books, a card per person put a screen of
// "No filtered work allocated" between the reader and whoever was actually loaded.
test("a person with no active and no closed-this-week jobs gets no card", async ({ page }) => {
  // Someone with work: the demo seed allocates every job to "Unassigned", which is a real
  // bucket of work and must keep its card.
  // Someone without: a technician added just now, holding nothing at all.
  await addStaffMember(page, "Nora Blake", "nora.blake@flexachem.com");
  await page.goto("/calendar");

  await expect(page.locator('[data-workload-card="Unassigned"]')).toBeVisible();
  await expect(page.locator('[data-workload-card="Nora Blake"]')).toHaveCount(0);

  // Hidden from the CARDS, still present on the availability grid above — that is what makes
  // hiding safe here. If this assertion ever fails, the person has genuinely vanished from the
  // page and the filter has gone too far.
  //
  // Filtered to the VISIBLE match on purpose: the grid renders a desktop table and a mobile
  // list and hides one of them per breakpoint, so a bare .first() picks the hidden copy on
  // whichever project is running and fails for a reason that has nothing to do with this test.
  await expect(page.getByText("Nora Blake", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("filtering to nothing explains itself instead of leaving a blank gap", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.locator('[data-workload-card="Unassigned"]')).toBeVisible();

  // A search no job can match empties every card.
  await page.getByPlaceholder(/filter jobs by assembly/i).fill("zzz-no-such-job-zzz");

  await expect(page.locator("[data-workload-card]")).toHaveCount(0);
  await expect(page.getByText(/nobody is carrying work that matches/i)).toBeVisible();
});
