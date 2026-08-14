import { test, expect } from "@playwright/test";
import { seedUser, addStaffMember } from "./helpers.js";

test.beforeEach(async ({ page }) => { await seedUser(page); });

// Demo mode holds no `accounts` rows, so it cannot exercise the role SPLIT itself (there is
// nobody to demote). What it can prove is the half that would break silently if the role
// derivation were inverted the wrong way: a staff record with no account must stay assignable.
// rosterRole and activePeople both default such a person to `technician` for exactly that
// reason — see CLAUDE.md §5.
test("assignment field is labelled Technician and lists people with no account", async ({ page }) => {
  await addStaffMember(page, "Nora Blake", "nora.blake@flexachem.com");

  await page.goto("/");
  const topbarNew = page.getByRole("button", { name: /log new job/i });
  if (await topbarNew.count()) await topbarNew.first().click();
  else await page.getByRole("button", { name: /^log new job$/i }).click();

  const dialog = page.locator("form").filter({ hasText: /create a production record/i });
  await expect(dialog).toBeVisible();

  // "Technician", not "Staff / Technician". Anchored because the holiday note and the capacity
  // warning render INSIDE this label, so they join its accessible name.
  const assignee = dialog.getByLabel(/^Technician/);
  await expect(assignee).toBeVisible();
  await expect(assignee.locator("option", { hasText: "Nora Blake" })).toHaveCount(1);
  // `alloc` is one text column meaning either a person or nobody — exactly one "Unassigned".
  await expect(assignee.locator("option", { hasText: /^Unassigned$/ })).toHaveCount(1);
});

test("Booked is settable on the availability grid and costs the day's hours", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "the desktop grid is hidden below lg");

  await addStaffMember(page, "Ivan Toft", "ivan.toft@flexachem.com");

  // Assertions go through the cells' own tooltips (cellTooltip / the Hours column title), which
  // carry the derived numbers rather than re-deriving them in the spec.
  await expect(page.getByTitle("0h booked · 37.5h available of 37.5h capacity")).toBeVisible();

  // First editable weekday of the shown week → Booked. The picker button is addressed by its
  // aria-label ("Set Booked") rather than its visible text: bare status words collide app-wide
  // (the Input Needed job status renders a chip reading "Blocked", and the hours column calls
  // job hours "bkd"), which is what drove the rename away from "Blocked" in the first place.
  await page.getByTitle("Available", { exact: true }).first().click();
  await page.getByRole("button", { name: "Set Booked" }).click();

  // The cell reports the new status and the week loses exactly one day.
  const cell = page.getByTitle("Booked — 7.5h deducted");
  await expect(cell).toHaveCount(1);
  await expect(page.getByTitle("0h booked · 30h available of 37.5h capacity")).toBeVisible();

  // The cell must carry Booked's OWN fill plus the 45° chevron. Asserting the tooltip alone
  // missed a real bug: `background` (shorthand) alongside `backgroundImage` made React write
  // an EMPTY background-color, so the chevron rendered over the previous status's colour.
  //
  // Expected values are resolved from the tokens in this same document, not hardcoded RGB, and
  // asserted with toHaveCSS so they RETRY: the cell carries `transition-colors`, so reading it
  // once samples a half-finished interpolation between the old status and the new one.
  const tokens = await page.evaluate(() => {
    const resolve = (token) => {
      const probe = document.createElement("div");
      probe.style.color = `var(${token})`;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    return { bg: resolve("--cal-booked-bg"), ink: resolve("--cal-booked") };
  });
  await expect(cell).toHaveCSS("background-color", tokens.bg);
  await expect(cell).toHaveCSS("color", tokens.ink);
  // Tokens must actually resolve — a literal "var(" here means the gradient never painted.
  await expect(cell).toHaveCSS("background-image", /^repeating-linear-gradient\(45deg, rgb/);

  // And it persists (demo mode → localStorage `flexachem_workshop_calendar_v1`).
  await page.reload();
  await expect(page.getByTitle("Booked — 7.5h deducted")).toHaveCount(1);
});
