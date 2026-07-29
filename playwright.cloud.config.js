import { defineConfig, devices } from "@playwright/test";

// Cloud-mode suite: the app runs WITH a Supabase client so write paths and their failure
// branches are reachable. Every request is stubbed by page.route() — no real project is
// touched. See tests/e2e-cloud/helpers.js.
//
// Deliberately on port 5174, not 5173: a stray dev server on 5173 gets silently reused by
// Playwright and the whole suite then fails at the login wall, which reads exactly like a
// real regression. Separate port, separate outDir, no interference with the demo suite.
export default defineConfig({
  testDir: "./tests/e2e-cloud",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 2,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build:e2e-cloud && npm run preview:e2e-cloud",
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
