import { test, expect } from "@playwright/test";
import { seedUser } from "./helpers.js";

// Every status move routes through the actual-hours prompt (StatusPromptProvider) so the
// dashboard can measure estimated vs actual. Completing is the one transition that cannot
// be skipped — that's the point the comparison is finalised.

test.beforeEach(async ({ page }) => { await seedUser(page); });

const promptTitle = (page) => page.getByRole("heading", { name: "Log actual hours" });
const hoursInput = (page) => page.getByLabel("Actual hours worked");

// The whole card is one <article>; scope to it so a status button belongs to that job.
function cardFor(page, asm) {
  return page.locator("article").filter({ hasText: asm }).first();
}

test("completing a job demands actual hours before the move applies", async ({ page }) => {
  await page.goto("/schedule");
  await cardFor(page, "A007563").getByRole("button", { name: "Done" }).click();

  await expect(promptTitle(page)).toBeVisible();
  // Completion is gated: no Skip escape hatch, and saving stays blocked at zero hours.
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  const save = page.getByRole("button", { name: "Save & complete" });
  await expect(save).toBeDisabled();

  await hoursInput(page).fill("12");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(promptTitle(page)).toBeHidden();

  // The logged figure is persisted against the job, not just shown in the dialog.
  await page.goto("/master-list");
  await expect(page.locator("tr").filter({ hasText: "A007563" }).first()).toContainText("Act 12h");
});

test("cancelling the prompt abandons the status change entirely", async ({ page }) => {
  await page.goto("/schedule");
  const card = cardFor(page, "A007563");
  await card.getByRole("button", { name: "Done" }).click();
  await expect(promptTitle(page)).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(promptTitle(page)).toBeHidden();
  // The job must not have landed in Complete — a cancelled prompt leaves no half-applied
  // move behind. Identified by the weekly-window note, which only the Complete column has.
  const completeColumn = page.locator("section").filter({ hasText: "This week only" }).first();
  await expect(completeColumn).not.toContainText("A007563");
});

test("a non-completing move can be skipped without logging hours", async ({ page }) => {
  await page.goto("/schedule");
  await cardFor(page, "A007445").getByRole("button", { name: "Blocked" }).click();

  await expect(promptTitle(page)).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(promptTitle(page)).toBeHidden();
  await expect(cardFor(page, "A007445")).toContainText("Blocked");
});

test("quick-add buttons step hours in half-hour increments", async ({ page }) => {
  await page.goto("/schedule");
  await cardFor(page, "A007445").getByRole("button", { name: "Blocked" }).click();
  await expect(promptTitle(page)).toBeVisible();

  await page.getByRole("button", { name: "+0.5h" }).click();
  await expect(hoursInput(page)).toHaveValue("0.5");
  await page.getByRole("button", { name: "+2h" }).click();
  await expect(hoursInput(page)).toHaveValue("2.5");
  await page.getByRole("button", { name: "Subtract half an hour" }).click();
  await expect(hoursInput(page)).toHaveValue("2");
});

test("the edit modal cannot complete a job with no actual hours either", async ({ page }) => {
  await page.goto("/schedule");
  await cardFor(page, "A007445").dblclick(); // admin edit modal
  await expect(page.getByText(/Edit workshop job/i)).toBeVisible();

  await page.getByLabel("Status").selectOption("Complete");
  await page.getByRole("button", { name: "Save changes" }).click();

  // The Status dropdown must not be a back door around the prompt's requirement.
  await expect(page.getByText("Required to mark a job complete")).toBeVisible();
  await expect(page.getByText(/Edit workshop job/i)).toBeVisible();
});

test("dashboard charts estimated against actual once a job is completed", async ({ page }) => {
  await page.goto("/");
  // Nothing logged yet, so the card explains itself rather than rendering an empty chart.
  await expect(page.getByRole("heading", { name: "Estimate vs actual" })).toBeVisible();
  await expect(page.getByText(/No completed jobs with actual hours/i)).toBeVisible();

  await page.goto("/schedule");
  await cardFor(page, "A007563").getByRole("button", { name: "Done" }).click();
  await hoursInput(page).fill("24");
  await page.getByRole("button", { name: "Save & complete" }).click();
  await expect(promptTitle(page)).toBeHidden();

  // 24h actual against an 18h estimate is a +33% overrun on the only measured job.
  await page.goto("/");
  const card = page.locator("section").filter({ hasText: "Estimate vs actual" }).first();
  await expect(card).toContainText("24h / 18h");
  await expect(card).toContainText("+33%");
});
