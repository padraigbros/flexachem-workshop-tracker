// Display formatting for hours. A 7.5h day makes every capacity figure a half-hour
// multiple, and "37.5000000001" in a capacity meter reads as a bug.
//
// Capacity arithmetic is exact on its own: 7.5 = 15 x 2^-1 is exactly representable in
// float64, so 7.5 x n and every sum of 7.5s (15, 22.5, 30, 37.5, a 22-weekday month's 165)
// are exact. The BOOKED side is not: job.hrs comes straight out of a numeric column with no
// rounding on read (roundHours only runs on save), so legacy and PDF-imported rows can hold
// arbitrary decimals whose sum drifts.
//
// Deliberately kept out of workload.js: capacity is not workload, and the lower-level
// calendar/capacity surfaces need this too. Zero imports, so it can never join a cycle.
export function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10; // one decimal is the finest the shop books
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
