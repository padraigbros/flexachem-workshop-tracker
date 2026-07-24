// Estimate-accuracy analytics — pure functions over normalized jobs.
// Shared by the scatter plot and the staff scorecards so both read the same numbers.
import { hoursVariance, completedInstant } from "./jobs";

// One row per completed job carrying BOTH an estimate and a logged actual. Jobs closed
// without an actual are dropped rather than counted as zero, which would make the
// workshop look permanently under its estimates. Oldest first, so a per-person series
// reads left-to-right as a timeline.
export function accuracyRows(jobs) {
  return jobs
    .filter((job) => job.status === "Complete")
    .map((job) => ({ job, variance: hoursVariance(job) }))
    .filter((entry) => entry.variance)
    .map(({ job, variance }) => ({
      id: job.id,
      job,
      person: job.alloc || "Unassigned",
      est: variance.est,
      actual: variance.actual,
      delta: variance.delta,
      pct: variance.pct,
      at: completedInstant(job)?.getTime() || 0,
    }))
    .sort((a, b) => a.at - b.at);
}

function mean(nums) {
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0;
}

// `bias` is the signed mean error (positive = estimates come in too low, i.e. the job
// over-ran). `spread` is the mean ABSOLUTE error. They are kept separate on purpose:
// grading on bias alone hands an A to someone who is wildly wrong in both directions and
// happens to average out, so the grade keys off spread and bias is reported alongside it.
export function summarize(rows) {
  const pcts = rows.map((row) => row.pct);
  const within10 = rows.filter((row) => Math.abs(row.pct) <= 10).length;
  return {
    count: rows.length,
    bias: Math.round(mean(pcts)),
    spread: Math.round(mean(pcts.map(Math.abs))),
    within10,
    within10Pct: rows.length ? Math.round((within10 / rows.length) * 100) : 0,
    totalEst: Math.round(rows.reduce((sum, row) => sum + row.est, 0) * 10) / 10,
    totalActual: Math.round(rows.reduce((sum, row) => sum + row.actual, 0) * 10) / 10,
  };
}

const GRADES = [
  { grade: "A", max: 10, tone: "var(--status-done)", label: "Dependable" },
  { grade: "B", max: 25, tone: "var(--status-active)", label: "Usable" },
  { grade: "C", max: 40, tone: "var(--status-blocked)", label: "Needs review" },
  { grade: "D", max: Infinity, tone: "var(--danger)", label: "Coach" },
];

export function grade(spread) {
  return GRADES.find((entry) => Math.abs(spread) <= entry.max);
}

// Compare the older half of a person's jobs against the more recent half. Needs a real
// sample on both sides — below that any "trend" is noise, so it reads as steady.
export function trend(rows) {
  if (rows.length < 6) return { key: "steady", label: "not enough history" };
  const half = Math.floor(rows.length / 2);
  const before = mean(rows.slice(0, half).map((row) => Math.abs(row.pct)));
  const after = mean(rows.slice(rows.length - half).map((row) => Math.abs(row.pct)));
  const shift = after - before;
  if (shift <= -8) return { key: "improving", label: "improving" };
  if (shift >= 8) return { key: "slipping", label: "slipping" };
  return { key: "steady", label: "steady" };
}

// Per-person breakdown, worst spread first — the list doubles as a coaching queue.
export function byPerson(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.person)) groups.set(row.person, []);
    groups.get(row.person).push(row);
  });
  return Array.from(groups.entries())
    .map(([person, personRows]) => ({
      person,
      rows: personRows,
      stats: summarize(personRows),
      grade: grade(summarize(personRows).spread),
      trend: trend(personRows),
    }))
    .sort((a, b) => b.stats.spread - a.stats.spread || a.person.localeCompare(b.person));
}

// Round an axis maximum up to a clean gridline so the ticks land on whole hours.
export function niceMax(values, minimum = 4) {
  const peak = Math.max(minimum, ...values.filter((v) => Number.isFinite(v)));
  const step = peak <= 10 ? 2 : peak <= 24 ? 4 : 8;
  return Math.ceil(peak / step) * step;
}
