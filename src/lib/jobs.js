// Job domain helpers — normalization, sorting, risk scoring, grouping.
// Logic moved verbatim from App.jsx.
import { JOB_TYPES, STATUS_ORDER, BUSINESS_UNITS, HOURS_STEP } from "./constants";
import { SUPABASE_START_COLUMN, SUPABASE_DUE_COLUMN } from "./supabase";
import { asISO, daysBetween, daysUntil, offsetDate, parseISODate, parseInstant, weekStart } from "./dates";

export function parseNotes(notes) {
  if (!notes) return [];
  if (Array.isArray(notes)) return notes.filter(Boolean);
  if (typeof notes === "string") {
    try {
      const parsed = JSON.parse(notes);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return notes.trim() ? [{ at: new Date().toISOString(), by: "System", txt: notes.trim() }] : [];
    }
  }
  return [];
}

export function normalizeStatus(status) {
  const found = STATUS_ORDER.find((s) => s.toLowerCase() === String(status || "").toLowerCase());
  return found || "Not Started";
}

export function normalizeJob(row) {
  const notes = parseNotes(row.notes || row.updates || row.comments);
  const due = asISO(row.due || row.due_date || row.target_completion || row.target_date);
  const estimatedHours = Number(row.est_hours ?? row.estimated_hours ?? row.hours_required ?? row.hours ?? 0) || 0;
  const bookedHours = Number(row.hrs ?? 0) || estimatedHours;
  const start = asISO(row.start || row.start_date || row.to_be_done || row.scheduled_start) || (due ? asISO(offsetDate(-Math.max(0, Math.ceil(Number(bookedHours || 0) / 8)))) : "");
  const allocatedTo = String(row.allocated_to || row.employee || row.assignee || "").trim();
  const allocValue = String(row.alloc || "").trim();
  const allocation = allocatedTo || (allocValue && allocValue.toLowerCase() !== "unassigned" ? allocValue : "") || "Unassigned";
  return {
    // Always a string: URL params (?job=) and dnd-kit ids are strings, so a numeric
    // DB id (bigint) must be coerced or `job.id === jobId` silently fails and the
    // drawer/edit never opens with real data.
    id: String(row.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    asm: row.asm || row.assembly_no || row.assembly || row.tag || "",
    so: row.so || row.sales_order || row.sales_order_no || "",
    cust: row.cust || row.customer || row.customer_name || "",
    type: row.type || row.job_type || row.classification || JOB_TYPES[0],
    owner: row.owner || row.project_owner || row.contact || "",
    alloc: allocation,
    start,
    due,
    hrs: bookedHours,
    actualHrs: Number(row.actualHrs ?? row.actual_hours ?? 0) || 0,
    status: normalizeStatus(row.status),
    // Falls back to the first configured unit — a hardcoded name here would resurrect a
    // phantom column on the Business Units board after the catalogue is renamed.
    bus: row.bus || row.business_unit || row.business_stream || BUSINESS_UNITS[0],
    priority: row.priority || "Normal",
    details: row.details || row.description || row.work_order || "",
    notes,
    attachment: row.attachment || null,
    deleted: Boolean(row.deleted),
    completedAt: row.completedAt ?? row.completed_at ?? null,
    archived: Boolean(row.archived),
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || notes[0]?.at || new Date().toISOString(),
  };
}

// When a completed job "left" the board: its completion instant. Falls back to the
// last-updated time for jobs completed before completed_at existed (no backfill needed).
export function completedInstant(job) {
  if (!job || job.status !== "Complete") return null;
  return parseInstant(job.completedAt) || parseInstant(job.updatedAt);
}

// A completed job is archived (off the board, kept in the Master List) when it was
// closed out manually, or completed in a week that has already ended (before the most
// recent Saturday-midnight boundary). Non-complete jobs are never archived.
export function isArchived(job, now = new Date()) {
  if (!job || job.status !== "Complete") return false;
  if (job.archived) return true;
  const completed = completedInstant(job);
  return !completed || completed.getTime() < weekStart(now).getTime();
}

// Snap an hours value to the nearest half hour. Typed input and quick-add buttons both
// go through this so no job ends up holding an un-bookable quarter-hour figure.
export function roundHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / HOURS_STEP) * HOURS_STEP;
}

// Estimate-vs-actual for a single job. Returns null unless both sides carry a real
// number, so jobs closed without a logged actual never skew the dashboard averages.
export function hoursVariance(job) {
  const est = Number(job?.hrs) || 0;
  const actual = Number(job?.actualHrs) || 0;
  if (!est || !actual) return null;
  return { est, actual, delta: actual - est, pct: Math.round(((actual - est) / est) * 100) };
}

export function riskScore(job) {
  if (job.status === "Complete") return 0;
  const due = daysUntil(job.due);
  const blocked = job.status === "Input Needed" ? 25 : 0;
  const priority = job.priority === "Critical" ? 25 : job.priority === "High" ? 12 : 0;
  const dueRisk = due === null ? 8 : due < 0 ? 40 + Math.min(20, Math.abs(due) * 2) : due <= 2 ? 28 : due <= 7 ? 14 : 0;
  return dueRisk + blocked + priority;
}

export function jobSort(a, b) {
  return (riskScore(b) - riskScore(a)) || ((parseISODate(a.due)?.getTime() || 0) - (parseISODate(b.due)?.getTime() || 0));
}

export function toDbPayload(job) {
  const payload = {
    asm: job.asm,
    so: job.so,
    cust: job.cust,
    type: job.type,
    owner: job.owner,
    alloc: job.alloc,
    // Write BOTH assignment columns. normalizeJob reads `allocated_to` first (see its
    // fallback chain), but until 29 Jul 2026 only `alloc` was ever written — a legacy
    // database trigger bridged the two. When that bridge stopped populating it, every insert
    // failed with `23502 null value in column "allocated_to"` and two jobs were lost. The app
    // now fills the column itself, so no trigger has to exist for a job to save.
    allocated_to: job.alloc,
    hrs: Number(job.hrs) || 0,
    actual_hours: Number(job.actualHrs) || 0,
    status: job.status,
    bus: job.bus,
    priority: job.priority,
    details: job.details,
    notes: job.notes,
    attachment: job.attachment || null,
    deleted: Boolean(job.deleted),
    completed_at: job.completedAt || null,
    archived: Boolean(job.archived),
    updated_at: new Date().toISOString(),
  };
  payload[SUPABASE_START_COLUMN] = job.start || null;
  payload[SUPABASE_DUE_COLUMN] = job.due || null;
  return payload;
}

// Union two note arrays, de-duped by (at|by|txt), newest-first. Used so concurrent
// note-adds from different devices don't overwrite each other (last-write-wins loss).
export function mergeNotes(a, b) {
  const seen = new Set();
  const out = [];
  for (const note of [...parseNotes(a), ...parseNotes(b)]) {
    const key = `${note.at}|${note.by}|${note.txt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(note);
  }
  return out.sort((x, y) => (parseISODate(y.at)?.getTime() || 0) - (parseISODate(x.at)?.getTime() || 0));
}

export function makeGroups(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item) || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function jobCalendarSpan(job) {
  if (!job.start || !job.due) return Math.max(1, Math.ceil((Number(job.hrs) || 1) / 8));
  return Math.max(1, daysBetween(job.start, job.due) + 1);
}

export function dueBucket(job) {
  if (job.status === "Complete") return "Complete";
  const delta = daysUntil(job.due);
  if (delta === null) return "No due date";
  if (delta < 0) return "Overdue";
  if (delta === 0) return "Due today";
  if (delta <= 7) return "Next 7 days";
  if (delta <= 30) return "Next 30 days";
  return "Later";
}

// Derived list of business units present across the given jobs.
export function collectBusinessUnits(jobs) {
  const set = new Set(BUSINESS_UNITS);
  jobs.forEach((job) => job.bus && set.add(job.bus));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Deterministic hue from a name — used for avatars in the redesign.
export function nameHue(name) {
  let hash = 0;
  const str = String(name || "");
  for (let i = 0; i < str.length; i += 1) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
