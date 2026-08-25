// Re-capture the Google Play phone screenshots from the DEMO build.
//
// Why this exists: the first set of store assets (committed in be7258a) were all three the
// same image - the demo LOGIN page, rendered in the DESKTOP layout inside a 1080x1920
// portrait frame. Whatever produced them never signed in. A script makes the next capture
// reproducible instead of a hand exercise that can go wrong the same way.
//
// Usage:
//   1. start the demo server:  .claude/launch.json -> "dev-demo"  (port 5199, --mode test)
//   2. node tools/capture-store-screenshots.mjs <output-dir>
//
// Demo mode is localStorage-only and auto-admin, so nothing here can reach production.
// DEFAULT_STAFF is deliberately empty (constants.js), so this seeds technicians, spreads the
// seed jobs across them and sets a few calendar statuses - without that the Calendar page is
// a blank grid with no workload cards and the screenshot is worthless.

import { chromium } from "@playwright/test";

const BASE = "http://localhost:5199";
const OUT = process.argv[2];
// 432x768 CSS at 2.5x => exactly 1080x1920 device pixels, which is what Play wants and
// what the old assets claimed to be. Phone-width in CSS px so the MOBILE layout renders
// (MobileNav is lg:hidden) - the previous screenshots' whole problem was a desktop layout
// stretched into a portrait frame.
const CSS_W = 432, CSS_H = 768, DSF = 2.5;

const seed = () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const day = (n) => { const d = new Date(monday); d.setDate(monday.getDate() + n); return iso(d); };
  const people = ["Declan Moran", "Aoife Kelly", "Cathal Byrne", "Niamh Doyle", "Ruairi Walsh"];
  const now = new Date().toISOString();
  const staff = people.map((n) => ({
    id: "staff-" + n.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: n, role: "Workshop technician", active: true,
    email: n.toLowerCase().replace(/[^a-z0-9]+/g, ".") + "@flexachem.com",
    phone: "", notes: "", createdAt: now, updatedAt: now,
  }));
  localStorage.setItem("flexachem_workshop_staff_v1", JSON.stringify(staff));
  const jobs = JSON.parse(localStorage.getItem("flexachem_workshop_jobs_v2") || "null");
  if (jobs) {
    const alloc = [0, 1, 2, 0, 3, 1, 4, 2, 0, 1, 3, 4];
    jobs.forEach((j, i) => { j.alloc = people[alloc[i % alloc.length]]; });
    localStorage.setItem("flexachem_workshop_jobs_v2", JSON.stringify(jobs));
  }
  const cal = [
    { s: staff[1].id, d: day(2), st: "Training" },
    { s: staff[1].id, d: day(3), st: "Training" },
    { s: staff[3].id, d: day(1), st: "Leave" },
    { s: staff[4].id, d: day(4), st: "Booked" },
    { s: staff[2].id, d: day(0), st: "Sick" },
  ].map((e) => ({ id: e.s + "_" + e.d, staffId: e.s, date: e.d, status: e.st, note: "", createdAt: now, updatedAt: now }));
  localStorage.setItem("flexachem_workshop_calendar_v1", JSON.stringify(cal));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: CSS_W, height: CSS_H },
  deviceScaleFactor: DSF,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

await page.goto(BASE);
await page.getByLabel(/your name/i).fill("Workshop Lead");
await page.getByLabel(/^email$/i).fill("workshop@flexachem.com");
await page.getByRole("button", { name: /enter workshop dashboard/i }).click();
await page.getByRole("heading", { name: /workshop command centre/i }).waitFor();

await page.evaluate(seed);
await page.reload();
await page.getByRole("heading", { name: /workshop command centre/i }).waitFor();

// The trailing number scrolls the page before capturing. Calendar needs it: the filter card
// occupies the top third, so an unscrolled shot is mostly chrome and clips the technician
// rows that are the actual subject of the page.
const shots = [
  ["/", "screenshot-1-dashboard.png", /workshop command centre/i, 0],
  ["/schedule", "screenshot-2-schedule.png", /schedule production board/i, 0],
  ["/calendar", "screenshot-3-calendar.png", /team availability/i, 300],
];

for (const [path, file, heading, scrollY] of shots) {
  await page.goto(BASE + path);
  await page.getByRole("heading", { name: heading }).waitFor();
  await page.waitForTimeout(1200); // let motion settle
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
    await page.waitForTimeout(400);
  }
  const tabs = await page.$$eval("[data-mobile-nav] a", (as) => as.map((a) => a.textContent.trim()));
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`${file}  tabs=[${tabs.join(" | ")}]`);
}

await browser.close();
