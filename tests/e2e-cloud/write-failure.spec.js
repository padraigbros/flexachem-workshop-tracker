import { test, expect } from "@playwright/test";
import { seedCloudSession, notNullViolation } from "./helpers.js";

// Regression test for the 29 Jul 2026 incident: two jobs were created against production,
// appeared on the board, and never reached the database. The insert failed on a not-null
// constraint; the app rolled nothing back, said nothing, and closed the modal.
//
// If this file ever goes green with the rollback removed from addJob, it is not testing
// anything — see the "rolls the card back" assertion.

async function openNewJobModal(page) {
  await page.goto("/");
  const newJob = page.getByRole("button", { name: /log new job/i });
  await newJob.first().click();
  const dialog = page.locator("form").filter({ hasText: /create a production record/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillMinimum(dialog) {
  await dialog.getByLabel(/^Assembly \/ Tag/).fill("A008344");
  await dialog.getByLabel(/^Customer/).selectOption({ index: 1 });
}

test("a rejected insert keeps the modal open, names the reason, and rolls the card back", async ({ page }) => {
  let insertAttempts = 0;
  await seedCloudSession(page, {
    onInsertJob: (route) => {
      insertAttempts += 1;
      return route.fulfill(notNullViolation("allocated_to"));
    },
  });

  const dialog = await openNewJobModal(page);
  await fillMinimum(dialog);
  await page.getByRole("button", { name: /create job/i }).click();

  // The write was attempted...
  await expect.poll(() => insertAttempts).toBe(1);

  // ...and the modal STAYED OPEN with the typed values intact. This is the core of the fix:
  // closing here is what made the data loss invisible.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Assembly \/ Tag/)).toHaveValue("A008344");

  // The reason is stated in words, and names the offending column.
  const alert = dialog.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/couldn't create this job/i);
  await expect(alert).toContainText(/allocated_to/);
  // A not-null violation is NOT retryable — the copy must say so rather than inviting the
  // user to hammer a button that cannot work.
  await expect(alert).toContainText(/database fix|tell an admin/i);

  // The button offers another attempt rather than pretending the save happened.
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();

  // The phantom card is GONE from the board. Anna's two jobs sat on screen looking saved.
  //
  // This MUST be a client-side navigation, not page.goto(). A full reload refetches jobs from
  // the server and would wipe the phantom whether or not addJob rolled back — a green test
  // that proves nothing. Clicking the nav link keeps the same React state the user sees.
  await page.getByRole("button", { name: /^cancel$/i }).click();
  await page.getByRole("link", { name: /schedule/i }).first().click();
  await expect(page).toHaveURL(/\/schedule/);
  await expect(page.locator("article").filter({ hasText: "A008344" })).toHaveCount(0);
});

test("a successful insert still saves and closes", async ({ page }) => {
  await seedCloudSession(page, {
    onInsertJob: async (route, request) => {
      const sent = JSON.parse(request.postData() || "{}");
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ ...sent, id: 4242 }),
      });
    },
  });

  const dialog = await openNewJobModal(page);
  await fillMinimum(dialog);
  await page.getByRole("button", { name: /create job/i }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/schedule");
  await expect(page.locator("article").filter({ hasText: "A008344" })).toBeVisible();
});

test("a rejected insert emails an alert naming the job and the code", async ({ page }) => {
  const alertCalls = [];
  await seedCloudSession(page, {
    alertCalls,
    onInsertJob: (route) => route.fulfill(notNullViolation("allocated_to")),
  });

  const dialog = await openNewJobModal(page);
  await fillMinimum(dialog);
  await page.getByRole("button", { name: /create job/i }).click();
  await dialog.getByRole("alert").waitFor();

  // A failed insert leaves no row, so the database cannot alert on it — the client is the
  // only witness. Nobody outside the room finds out unless this call happens.
  await expect.poll(() => alertCalls.length).toBeGreaterThan(0);
  const alert = alertCalls.find((c) => c.kind === "failed");
  expect(alert).toBeTruthy();
  expect(alert.action).toBe("create");
  expect(alert.jobLabel).toBe("A008344");
  expect(alert.code).toBe("23502");
  // The email says whether a retry can possibly work. A not-null violation cannot.
  expect(alert.retryable).toBe(false);
});

test("a dropped connection is reported as retryable", async ({ page }) => {
  let attempts = 0;
  await seedCloudSession(page, {
    onInsertJob: (route) => {
      attempts += 1;
      return route.abort("failed");
    },
  });

  const dialog = await openNewJobModal(page);
  await fillMinimum(dialog);
  await page.getByRole("button", { name: /create job/i }).click();
  await expect.poll(() => attempts).toBe(1);

  const alert = dialog.getByRole("alert");
  await expect(alert).toBeVisible();
  // Network failures never reach supabase-js's { error } channel — they throw. Before
  // runWrite() caught that, this case produced an unhandled rejection and no message at all.
  await expect(alert).toContainText(/can't reach the server/i);
});
