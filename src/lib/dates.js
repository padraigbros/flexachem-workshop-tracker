// Date helpers — moved verbatim from App.jsx, plus a relative-time formatter for the redesign.

export const today = () => new Date();

export const toISODate = (date) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const offsetDate = (days) => {
  const d = today();
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export function parseISODate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + value);
    return new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [y, m, d] = text.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asISO(value) {
  const parsed = parseISODate(value);
  return parsed ? toISODate(parsed) : "";
}

export function daysBetween(a, b) {
  const start = parseISODate(a);
  const end = parseISODate(b);
  if (!start || !end) return 0;
  const ms = end.setHours(12, 0, 0, 0) - start.setHours(12, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function daysUntil(value) {
  const due = parseISODate(value);
  if (!due) return null;
  const now = today();
  now.setHours(12, 0, 0, 0);
  return Math.round((due.setHours(12, 0, 0, 0) - now.getTime()) / 86400000);
}

export function formatDate(value, options = {}) {
  const parsed = parseISODate(value);
  if (!parsed) return "TBA";
  return parsed.toLocaleDateString("en-IE", { day: "2-digit", month: "short", ...options });
}

// Full ISO timestamps carry a real time-of-day; date-only values stay noon-anchored via parseISODate.
export function parseInstant(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value.trim())) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return parseISODate(value);
}

// Start of the current workshop week: the most recent Sunday at 00:00 local time.
// The week runs Sunday 00:00 → Saturday 24:00 (Saturday midnight), so a job completed
// in a finished week falls before this boundary and auto-archives off the board.
export function weekStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return d;
}

export function formatDateTime(value) {
  const parsed = parseInstant(value);
  if (!parsed) return "Just now";
  return parsed.toLocaleString("en-IE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const rtf = new Intl.RelativeTimeFormat("en-IE", { numeric: "auto" });
const RELATIVE_UNITS = [
  ["year", 31536000000],
  ["month", 2592000000],
  ["week", 604800000],
  ["day", 86400000],
  ["hour", 3600000],
  ["minute", 60000],
];

// "2 h ago" style relative timestamp for the activity feeds.
export function formatRelative(value) {
  const parsed = parseInstant(value);
  if (!parsed) return "just now";
  const diff = parsed.getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60000) return "just now";
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}
