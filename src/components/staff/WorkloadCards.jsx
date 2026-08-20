import { useMemo } from "react";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useStatusPrompt } from "../../state/StatusPromptProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { useNow } from "../../state/useNow";
import { makeGroups, isArchived } from "../../lib/jobs";
import { indexEntries, holidayIndex, weekdaysOfWeek, hoursLeftInWeek } from "../../lib/calendar";
import { toISODate } from "../../lib/dates";
import { WEEK_CAPACITY } from "../../lib/constants";
import { formatHours } from "../../lib/format";
import { jobPeriodDate } from "../../lib/workload";
import { Card, EmptyState, Chip, cx } from "../ui/primitives";
import { Avatar, Meter } from "../ui/dataviz";
import { StatusChip } from "../ui/StatusChip";
import { MiniJob } from "../jobs/JobBits";

// Per-person workload cards. Lived inline in StaffView until 20 Aug 2026, then moved to
// /calendar alongside the availability grid so that capacity — who is free, and what they are
// already carrying — reads as one page. Extracted into its own file and wired straight to
// context (like TeamAvailabilityView) rather than prop-drilled, so the page that renders it
// stays a thin composition.
//
// The `useNow(60s)` tick MUST stay inside this component. It is what keeps "hours left in the
// week" live, and hoisting it into the page would re-render the availability grid every
// minute for nothing — the isolation is the whole reason this was a separate component when
// it lived on the Staff page, and it matters just as much next to the grid.
export function WorkloadCards() {
  const { filteredJobs: jobs, staff, calendar, holidays, activePeople } = useWorkshop();
  const { requestStatusChange } = useStatusPrompt();
  const { openJob } = useJobDrawer();

  const liveNow = useNow(60_000);
  // Keyed off the ISO DAY, not the Date: the 60s tick produces a new Date object every
  // minute, so memoising on it would rebuild the week set 1,440 times a day to get the same
  // five strings. The day string only changes at midnight.
  const todayISO = toISODate(liveNow);

  const groups = useMemo(() => makeGroups(jobs, (j) => j.alloc), [jobs]);

  // Who gets a card: every technician, plus whoever still holds one of the filtered jobs
  // (including "Unassigned", which is a real bucket of work). Not the provider's `people`
  // list — a demoted technician keeps their staff record so their calendar survives a change
  // of mind, and `people` would leave them here forever as an empty card.
  const people = useMemo(() => Array.from(new Set([...activePeople, ...Object.keys(groups)]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [activePeople, groups]);

  const staffByName = useMemo(() => new Map(staff.map((m) => [m.name, m])), [staff]);

  // A card's weekly capacity is the person's *available* hours this week (37.5h minus 7.5h
  // per leave/training/sick/holiday day), not a flat 37.5h — so the meter reflects the
  // calendar sitting directly above it.
  const entriesByKey = useMemo(() => indexEntries(calendar), [calendar]);
  const holidaySet = useMemo(() => holidayIndex(holidays).set, [holidays]);

  const thisWeekSet = useMemo(() => new Set(weekdaysOfWeek(todayISO)), [todayISO]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => {
        const items = groups[person] || [];
        const active = items.filter((j) => j.status !== "Complete");
        const closed = items.filter((j) => j.status === "Complete" && !isArchived(j, liveNow));
        const blocked = active.filter((j) => j.status === "Input Needed").length;
        const member = staffByName.get(person);
        const inactive = member && !member.active;

        const estimated = active
          .filter((j) => thisWeekSet.has(jobPeriodDate(j)))
          .reduce((s, j) => s + Number(j.hrs || 0), 0);
        const hrsLeft = member
          ? hoursLeftInWeek(member.id, liveNow, entriesByKey, holidaySet)
          : WEEK_CAPACITY;
        const hoursComplete = closed.reduce((s, j) => s + Number(j.actualHrs || 0), 0);

        return (
          <Card key={person} className={cx(inactive && "opacity-70")}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={person} size={42} />
                <div>
                  <div className="flex items-center gap-2 text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">{person}{inactive && <Chip>Inactive</Chip>}</div>
                  <div className="text-[0.72rem] text-[var(--ink-muted)] tnum">{formatHours(estimated)}h of {formatHours(hrsLeft)}h week</div>
                </div>
              </div>
              <StatusChip status={blocked ? "Input Needed" : active.length ? "In Progress" : "Complete"} size="sm" />
            </div>
            <Meter className="mb-3 h-2.5" value={(estimated / (hrsLeft || 1)) * 100} tone={estimated > hrsLeft ? "var(--danger)" : "var(--color-brand-500)"} />
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
                <strong className="block text-[0.95rem] font-extrabold text-[var(--ink)] tnum">
                  {active.length} <span className="text-[var(--ink-muted)]">/</span> {closed.length}
                </strong>
                <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Active / Closed</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
                <strong className={cx("block text-[0.95rem] font-extrabold tnum", estimated > hrsLeft ? "text-[var(--danger)]" : "text-[var(--ink)]")}>
                  {formatHours(estimated)} <span className="text-[var(--ink-muted)]">/</span> {formatHours(hrsLeft)}
                </strong>
                <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Est vs hrs left</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
                <strong className="block text-[0.95rem] font-extrabold text-[var(--ink)] tnum">{formatHours(hoursComplete)}h</strong>
                <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Hours complete</span>
              </div>
            </div>
            <div className="grid gap-2">
              {[...active, ...closed].length ? [...active, ...closed].map((job) => <MiniJob key={job.id} job={job} onSelect={openJob} onStatus={requestStatusChange} />) : <EmptyState text="No filtered work allocated." />}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
