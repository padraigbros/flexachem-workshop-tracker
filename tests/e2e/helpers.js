import { USER_KEY, THEME_KEY } from "../../src/lib/constants.js";

// Seed a signed-in demo user (demo mode grants admin) so specs can skip the login form.
// Runs before any app script via addInitScript, so the app boots already authenticated.
export async function seedUser(page, { theme } = {}) {
  await page.addInitScript(
    ({ userKey, themeKey, theme }) => {
      localStorage.setItem(userKey, JSON.stringify({ name: "Workshop Lead", email: "workshop@flexachem.com" }));
      if (theme) localStorage.setItem(themeKey, theme);
    },
    { userKey: USER_KEY, themeKey: THEME_KEY, theme },
  );
}

// All app routes, used by the layout-invariant sweep.
export const ROUTES = ["/", "/schedule", "/staff", "/job-types", "/customers", "/business-units", "/due-dates", "/master-list"];

// Assert the page itself never scrolls horizontally (only inner scrollers may).
export async function expectNoHorizontalScroll(page) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  return ok;
}
