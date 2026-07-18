import { defineConfig, devices } from "@playwright/test";

// The dev server runs in `test` mode so .env.test forces demo mode (deterministic seed
// data, auto-admin). Tests never touch a real Supabase project.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  // Cap workers — a single preview server + many browser contexts overwhelmed this
  // machine at the default worker count (timeouts, shifting failures).
  workers: 2,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  // Run against the production preview build: fast, deterministic, no on-demand
  // compilation (which made the dev server flaky under parallel load).
  webServer: {
    command: "npm run build:test && npm run preview:test",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
