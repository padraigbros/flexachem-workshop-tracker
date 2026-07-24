// Staff availability calendar — domain model + pure helpers (mirrors staff.js/customers.js).
// "Available" is the absence of an entry; "Public Holiday" is derived from the holidays
// catalogue and never stored per-staff. Capacity: a 40h week (5 weekdays × 8h) loses 8h per
// non-available weekday (Training / Leave / Sick, or a public holiday).
import { WEEK_CAPACITY, DAY_HOURS } from "./constants";
import { parseISODate, toISODate, formatDate } from "./dates";

// Per-status colour + label. Tokens resolve to CSS variables defined in styles/app.css so
// they follow the light/dark theme like the rest of the app. Available uses the "done" green.
export const CALENDAR_STATUS_META = {
  Available: { label: "Available", ink: "var(--status-done)", bg: "var(--status-done-bg)" },
  Training: { label: "Training", ink: "var(--cal-training)", bg: "var(--cal-training-bg)" },
  Leave: { label: "Leave", ink: "var(--cal-leave)", bg: "var(--cal-leave-bg)" },
  Sick: { label: "Sick", ink: "var(--cal-sick)", bg: "var(--cal-sick-bg)" },
  "Public Holiday": { label: "Public Holiday", ink: "var(--cal-holiday)", bg: "var(--cal-holiday-bg)" },
};

export function calendarEntryKey(staffId, date) {
  return `${staffId}::${String(date).slice(0, 10)}`;
}

export function normalizeCalendarEntry(row) {
  const staffId = row?.staffId || row?.staff_id || "";
  const date = String(row?.date || "").slice(0, 10);
  return {
    id: row?.id || calendarEntryKey(staffId, date),
    staffId,
    date,
    status: row?.status || "Available",
    note: row?.note || "",
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
    updatedAt: row?.updatedAt || row?.updated_at || new Date().toISOString(),
  };
}

export function toCalendarDbPayload(entry) {
  return {
    id: entry.id,
    staff_id: entry.staffId,
    date: String(entry.date).slice(0, 10),
    status: entry.status,
    note: entry.note || null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeHoliday(row) {
  const date = String(row?.date || "").slice(0, 10);
  return {
    date,
    name: row?.name || "Public Holiday",
    active: row?.active ?? true,
  };
}

export function toHolidayDbPayload(holiday) {
  return {
    date: String(holiday.date).slice(0, 10),
    name: holiday.name || "Public Holiday",
    active: holiday.active ?? true,
    updated_at: new Date().toISOString(),
  };
}

// ---- Lookups -------------------------------------------------------------

// Index calendar entries by "staffId::date" for O(1) status lookups.
export function indexEntries(entries) {
  const map = new Map();
  (entries || []).forEach((e) => map.set(calendarEntryKey(e.staffId, e.date), e));
  return map;
}

// A Set of active public-holiday ISO dates, plus a name lookup for display.
export function holidayIndex(holidays) {
  const set = new Set();
  const names = new Map();
  (holidays || []).forEach((h) => {
    if (h.active === false) return;
    const date = String(h.date).slice(0, 10);
    set.add(date);
    names.set(date, h.name);
  });
  return { set, names };
}

// Resolve the effective status for a staff member on a date. Public holidays win over any
// stored entry (they're auto-applied and non-editable).
export function statusOn(staffId, isoDate, entriesByKey, holidaySet) {
  const date = String(isoDate).slice(0, 10);
  if (holidaySet?.has(date)) return "Public Holiday";
  const entry = entriesByKey?.get(calendarEntryKey(staffId, date));
  return entry?.status || "Available";
}

// ---- Weekday / capacity --------------------------------------------------

export function isWeekday(isoDate) {
  const d = parseISODate(isoDate);
  if (!d) return false;
  const day = d.getDay(); // 0 Sun … 6 Sat
  return day >= 1 && day <= 5;
}

// The Mon–Fri ISO dates of the week containing isoDate. (Distinct from dates.js weekStart(),
// which returns Sunday for the completed-jobs archive window.)
export function weekdaysOfWeek(isoDate) {
  const d = parseISODate(isoDate);
  if (!d) return [];
  const monday = new Date(d);
  const offset = (d.getDay() + 6) % 7; // days since Monday (Mon→0 … Sun→6)
  monday.setDate(d.getDate() - offset);
  const out = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    out.push(toISODate(day));
  }
  return out;
}

// Remaining available hours for the week containing isoDate:
// 40 − 8 × (non-available weekdays), floored at 0.
export function weekAvailableHours(staffId, isoDate, entriesByKey, holidaySet) {
  const days = weekdaysOfWeek(isoDate);
  const lost = days.reduce((n, day) => (statusOn(staffId, day, entriesByKey, holidaySet) === "Available" ? n : n + 1), 0);
  return Math.max(0, WEEK_CAPACITY - lost * DAY_HOURS);
}

// ---- Timeline (team availability) ---------------------------------------

// Monday (ISO) of the week containing isoDate — the anchor for the horizontal timeline.
export function mondayOf(isoDate) {
  const d = parseISODate(isoDate);
  if (!d) return "";
  const offset = (d.getDay() + 6) % 7; // days since Monday (Mon→0 … Sun→6)
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

// isoDate shifted by n days (n may be negative), returned as an ISO date string.
export function addDaysISO(isoDate, n) {
  const d = parseISODate(isoDate);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// The 7 ISO dates (Mon→Sun) of the week containing isoDate — the columns of the week view.
export function weekDates(isoDate) {
  const monday = mondayOf(isoDate);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

// Every ISO date in the given month — the columns of the month view.
export function monthDates(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => toISODate(new Date(year, month, i + 1)));
}

// Available vs. total capacity across an arbitrary set of ISO dates: only weekdays count,
// each available weekday is worth DAY_HOURS. Generalises weekAvailableHours() to any span
// (a single week → 40h capacity, a month → weekdays × 8h) for the timeline's Hours column.
export function availableHoursInRange(staffId, isoDates, entriesByKey, holidaySet) {
  let available = 0;
  let capacity = 0;
  (isoDates || []).forEach((date) => {
    if (!isWeekday(date)) return;
    capacity += DAY_HOURS;
    if (statusOn(staffId, date, entriesByKey, holidaySet) === "Available") available += DAY_HOURS;
  });
  return { available, capacity };
}

// ---- Assignment availability --------------------------------------------

// Inclusive list of ISO dates from start..end (capped so a bad range can't loop forever).
export function datesInRange(startISO, endISO) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO) || start;
  if (!start) return [];
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const out = [];
  const cursor = new Date(from);
  for (let i = 0; i < 366 && cursor <= to; i++) {
    out.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// The first non-available reason across a job's date range, or null if available throughout.
// Weekends are ignored (no work scheduled), so only weekday conflicts block assignment.
export function unavailableReason(staffId, startISO, endISO, entriesByKey, holidaySet) {
  for (const date of datesInRange(startISO, endISO)) {
    if (!isWeekday(date)) continue;
    const status = statusOn(staffId, date, entriesByKey, holidaySet);
    if (status !== "Available") {
      const when = formatDate(date);
      return status === "Public Holiday" ? `Public holiday (${when})` : `On ${status.toLowerCase()} (${when})`;
    }
  }
  return null;
}

// ---- Month grid ----------------------------------------------------------

// Weeks (rows) of day cells for a month view. Leading/trailing cells (from adjacent months)
// carry `inMonth: false` so the UI can mute them. Each cell has an ISO `date` string.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first grid
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: toISODate(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // Stop after the week that contains the last day of the month.
    if (cursor.getMonth() !== month && cursor > new Date(year, month + 1, 0)) break;
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
