import { test, expect } from "@playwright/test";
import { seedCloudSession } from "./helpers.js";

// 20 Aug 2026. Reported as "why can I only see two tabs on my phone?".
//
// A three-week-old cached bundle was still asking for the `profiles` table that migration 002
// dropped. AuthProvider discarded that error (`const { data: account } = await ...`) and fell
// back to `role: "staff"`, so a live admin was rendered as staff: a two-item nav bar, no New
// button, no FAB — and no toast, no banner, no Sentry event to say why. The database said
// `admin` the entire time.
//
// Demo mode cannot cover this at all (`supabase === null`, so the whole branch never runs),
// which is exactly why it lived here undetected. These are the only tests that exercise it.

test("a failed account lookup says so instead of silently downgrading an admin", async ({ page }) => {
  await seedCloudSession(page, { accountsStatus: 500 });
  await page.goto("/");

  // Let the app finish booting so BOTH applySession passes (getSession and the
  // onAuthStateChange event) have landed before counting toasts.
  await expect(page.getByRole("heading", { name: /workshop command centre/i })).toBeVisible();

  // The whole point: the failure is visible. Previously this produced silence.
  // Exactly ONE toast — applySession runs twice on boot and the warning is duration:Infinity,
  // so without a stable id it stacks a permanent copy per auth event.
  const warning = page.getByText(/couldn't load your account permissions/i);
  await expect(warning).toHaveCount(1);
  await expect(warning).toBeVisible();

  // And it still fails CLOSED — a role we could not read must never grant privilege.
  await expect(page.getByRole("button", { name: /log new job/i })).toHaveCount(0);
});

test("a successful lookup still grants admin and shows no warning", async ({ page }) => {
  // The control. The fix added a retry loop around this read, so the happy path has to be
  // pinned too — a retry that quietly broke normal sign-in would be a worse bug than the one
  // being fixed.
  await seedCloudSession(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /log new job/i }).first()).toBeVisible();
  await expect(page.getByText(/couldn't load your account permissions/i)).toHaveCount(0);
});
