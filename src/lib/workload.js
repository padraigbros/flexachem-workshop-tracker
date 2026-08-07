// Booked-hours arithmetic — "how much work sits against this person in this period".
// Deliberately separate from calendar.js, which answers the complementary question ("how
// many hours are they available for"). The two are compared in the Team Availability Hours
// column and nowhere else.
//
// Imports nothing but ./format on purpose: jobs.js pulls in supabase.js, so importing it
// here would drag Supabase config into a module that is pure arithmetic.
//
// PERIOD RULE: a job belongs to exactly ONE period — the one containing its start date,
// falling back to due. This is the rule JobModal's capacity warning already shipped
// (jobPeriodDate is now shared with it); duplicating it with a different rule would give the
// workshop two contradictory answers to "what's booked this week". Because each job lands in
// exactly one bucket, the total is bounded no matter how many completed jobs accumulate in
// history — which is what makes counting Complete jobs safe at all.
//
// Known cost of that rule: a job running 3 Aug → 21 Aug counts all its hours in the week of
// 3 Aug and none in the two weeks it is actually worked. The alternatives are worse —
// span-intersection shows a 20h job as 20h in EVERY week it touches (40h booked for 20h of
// work), and anchoring completed jobs on completedAt makes a job jump periods the moment it
// is marked done, so a Friday completion silently drops Monday's total.

// The single date that anchors a job to a period. "" = the job belongs to no period and is
// counted nowhere (neither start nor due; normalizeJob usually derives a start from due, so
// this is the both-missing case). Omitting is the safe direction — it can never inflate a
// figure that a capacity is judged against.
export function jobPeriodDate(job) {
  const start = String(job?.start || "").slice(0, 10);
  if (start) return start;
  return String(job?.due || "").slice(0, 10);
}

// The hours a job consumes. A completed job is judged on what it ACTUALLY took; the estimate
// is the fallback for legacy rows completed before the actual-hours prompt existed (the
// prompt now blocks Complete with 0 actual hours, so new rows always carry one).
//
// NOT reusable by accuracy.js: fabricating an actual from an estimate would hand every
// legacy completed job a perfect estimate score.
export function jobWorkloadHours(job) {
  if (job?.status === "Complete") {
    const actual = Number(job.actualHrs) || 0;
    if (actual > 0) return actual;
  }
  return Number(job?.hrs) || 0;
}

// name -> booked hours, for jobs anchored inside isoDates. One pass over jobs so the caller
// can memoize on [jobs, days] and stay O(J) rather than O(J × staff).
//
// Note the deliberate asymmetry with calendar.js's availableHoursInRange: that counts
// WEEKDAYS only (nobody is rostered on a Saturday), while this counts every date in view —
// a job whose start lands on a Saturday is still booked work. Both describe the same period;
// only the capacity side is weekday-gated.
export function bookedHoursByName(jobs, isoDates, { includeComplete = true } = {}) {
  const period = new Set(isoDates || []);
  const map = new Map();
  (jobs || []).forEach((job) => {
    const name = job?.alloc;
    if (!name || name === "Unassigned") return;
    if (!includeComplete && job.status === "Complete") return;
    const anchor = jobPeriodDate(job);
    if (!anchor || !period.has(anchor)) return;
    map.set(name, (map.get(name) || 0) + jobWorkloadHours(job));
  });
  return map;
}
