import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Search, X, CalendarDays, Briefcase, Eye, EyeOff,
} from "lucide-react";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useAuthCtx } from "../../state/AuthProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { useStatusPrompt } from "../../state/StatusPromptProvider";
import { useNow } from "../../state/useNow";
import { WEEK_CAPACITY, DAY_HOURS, CALENDAR_STATUSES, ACCOUNT_ROLES, ACCOUNT_ROLE_META } from "../../lib/constants";
import { formatHours } from "../../lib/format";
import { bookedHoursByName, bookedHoursByNameAndDate, jobPeriodDate } from "../../lib/workload";
import { completedInstant, isArchived } from "../../lib/jobs";
import {
  CALENDAR_STATUS_META, indexEntries, holidayIndex, statusOn, weekAvailableHours,
  weekDates, monthDates, mondayOf, addDaysISO, availableHoursInRange, datesInRange, isWeekday,
  weekdaysOfWeek, hoursLeftInWeek,
} from "../../lib/calendar";
import { buildRoster, rosterRole, rosterActive, isTechnicianRow } from "../../lib/staff";
import { today, toISODate, parseISODate, formatDate, weekStart } from "../../lib/dates";
import { Button, Input, Select, EmptyState, Skeleton, cx } from "../ui/primitives";
import { Avatar, Meter } from "../ui/dataviz";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { StatusChip } from "../ui/StatusChip";
import { MiniJob } from "../jobs/JobBits";
import { STATUS_ICON, DayPicker, CalendarLegend, statusStyle } from "./calendarShared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Column geometry — fixed pixel widths keep the date header and every staff row aligned
// inside the horizontal scroll area (a month has ~31 columns, so the grid scrolls sideways).
const INFO_W = 224;
// Wide enough for the worst MONTH-mode line ("247.5h AVAIL" ≈ 73px of glyphs), not the
// week's. A month's capacity is weekdays × DAY_HOURS, so three digits plus ".5" is routine.
const HOURS_W = 116;

// Workload bands, derived from the week so a change to DAY_HOURS/WEEK_CAPACITY can never
// leave the thresholds and their labels disagreeing — they used to be two hardcoded copies
// of 20/35/40. Expressed in days of work rather than percentages of the week, because the
// literal ratio translation gives "<18.75h", which reads as noise in a dropdown.
const UNDER_MAX = DAY_HOURS * 2; // under two days of work booked
const AT_MIN = WEEK_CAPACITY - DAY_HOURS; // within one day of a full week

const WORKLOAD_FILTERS = {
  under: { label: `Under-utilised (<${formatHours(UNDER_MAX)}h)`, test: (h) => h < UNDER_MAX },
  at: { label: `At capacity (${formatHours(AT_MIN)}–${formatHours(WEEK_CAPACITY)}h)`, test: (h) => h >= AT_MIN && h <= WEEK_CAPACITY },
  over: { label: `Over capacity (>${formatHours(WEEK_CAPACITY)}h)`, test: (h) => h > WEEK_CAPACITY },
};

// Human tooltip for a day cell: status + the capacity it costs that week.
function cellTooltip(status, isHoliday, holidayName) {
  if (isHoliday) return `Public holiday${holidayName ? `: ${holidayName}` : ""} — ${formatHours(DAY_HOURS)}h deducted`;
  if (status === "Available") return "Available";
  return `${status} — ${formatHours(DAY_HOURS)}h deducted`;
}

export function TeamAvailabilityView({ onOpenFullCalendar }) {
  const {
    staff, accounts, calendar, holidays, activeJobs, loading,
    setCalendarEntry, reassignStaffJobs, setPersonRole, activePeople,
  } = useWorkshop();
  const { isAdmin } = useAuthCtx();
  const { openJob } = useJobDrawer();
  const { requestStatusChange } = useStatusPrompt();

  const now = today();
  const todayISO = toISODate(now);
  const currentMonday = mondayOf(todayISO);

  const [mode, setMode] = useState("week"); // "week" | "month"
  const [anchor, setAnchor] = useState(todayISO); // any date within the shown period
  const [filters, setFilters] = useState({ search: "", status: "all", workload: "all" });
  const [showInactive, setShowInactive] = useState(false);
  const [selection, setSelection] = useState(null); // { staffId, name, anchor, dates:[iso] }
  const [detail, setDetail] = useState(null); // roster row shown in the slide-out
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedDay, setSelectedDay] = useState(todayISO);

  const entriesByKey = useMemo(() => indexEntries(calendar), [calendar]);
  const { set: holidaySet, names: holidayNames } = useMemo(() => holidayIndex(holidays), [holidays]);

  const anchorDate = parseISODate(anchor) || now;
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  // Visible day columns for the current period.
  const days = useMemo(
    () => (mode === "week" ? weekDates(anchor) : monthDates(year, month)),
    [mode, anchor, year, month],
  );
  const cellW = mode === "week" ? 104 : 46;
  const rowW = INFO_W + days.length * cellW + HOURS_W;

  const periodLabel = mode === "week"
    ? `${formatDate(days[0])} – ${formatDate(days[6], { year: "numeric" })}`
    : `${MONTHS[month]} ${year}`;

  // Per-person tile data: active jobs, closed-this-week, estimated-this-week, hours-complete.
  // Mirrors the StaffView card tiles so the drawer and cards agree. Uses todayISO (stable
  // within a day) — the live hoursLeft countdown is computed in the drawer via useNow.
  const thisWeekDays = useMemo(() => weekdaysOfWeek(todayISO), [todayISO]);
  const thisWeekSet = useMemo(() => new Set(thisWeekDays), [thisWeekDays]);
  const workloadByName = useMemo(() => {
    const ws = weekStart(now);
    const map = new Map();
    activeJobs.forEach((job) => {
      if (!job.alloc) return;
      const cur = map.get(job.alloc) || { active: 0, closed: 0, estimatedThisWeek: 0, hoursComplete: 0, blocked: 0, jobs: [] };
      if (job.status === "Complete") {
        const ci = completedInstant(job);
        if (ci && ci.getTime() >= ws.getTime() && !job.archived) {
          cur.closed += 1;
          cur.hoursComplete += Number(job.actualHrs || 0);
        }
      } else {
        cur.active += 1;
        if (job.status === "Input Needed") cur.blocked += 1;
        cur.jobs.push(job);
        const anchor = jobPeriodDate(job);
        if (anchor && thisWeekSet.has(anchor)) {
          cur.estimatedThisWeek += Number(job.hrs || 0);
        }
      }
      map.set(job.alloc, cur);
    });
    return map;
  }, [activeJobs, thisWeekSet, todayISO]);

  // Hours booked against each person in the shown period — the Hours column's top line, the
  // workload filter's input, and today's per-cell figure. Unlike workloadByName above this
  // COUNTS completed jobs (at their actual hours): the column reports what a period held, not
  // what is still outstanding. Safe from unbounded growth because bookedHoursByName anchors
  // every job to exactly one period. `activeJobs` is all non-deleted jobs, Complete included.
  const bookedByName = useMemo(() => bookedHoursByName(activeJobs, days), [activeJobs, days]);
  const bookedByNameDate = useMemo(() => bookedHoursByNameAndDate(activeJobs, days), [activeJobs, days]);

  const mobileWeek = useMemo(() => weekDates(anchor), [anchor]);
  const mobileBookedByNameDate = useMemo(
    () => bookedHoursByNameAndDate(activeJobs, mobileWeek),
    [activeJobs, mobileWeek],
  );

  // Roster → technicians only. A calendar answers "who can take this job and when", so the
  // people who can never hold a job do not belong on it: admins manage the shop and staff
  // (sales, managers) sign in without doing workshop work. Both halves of the test matter —
  // the role decides whether they SHOULD appear, the staff record is what they'd be keyed by
  // (statusOn, bookedHoursByNameAndDate and isEditable all take a staff id).
  const roster = useMemo(
    () => buildRoster(staff, accounts).filter((r) => r.staff && isTechnicianRow(r)),
    [staff, accounts],
  );

  const rows = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return roster.filter((row) => {
      if (!showInactive && !rosterActive(row)) return false;
      if (term && !row.name.toLowerCase().includes(term)) return false;
      if (filters.status !== "all") {
        const hit = days.some((d) => isWeekday(d) && statusOn(row.staff.id, d, entriesByKey, holidaySet) === filters.status);
        if (!hit) return false;
      }
      if (filters.workload !== "all") {
        // Tests the same period-scoped figure the row displays. Testing the all-time open
        // estimate instead (what this used to do) meant "At capacity (30–37.5h)" could match
        // a row reading 12h — the filter and the column disagreeing about what "booked" means.
        const hours = bookedByName.get(row.name) || 0;
        if (!WORKLOAD_FILTERS[filters.workload].test(hours)) return false;
      }
      return true;
    });
  }, [roster, filters, showInactive, days, entriesByKey, holidaySet, bookedByName]);

  // A flat render list. There used to be Admins/Staff group headers here, but every row is a
  // technician now, so the only heading the grid could show would say the same thing on every
  // row. Kept as a list of items rather than plain `rows` because the lazy slice below works
  // on it.
  const renderItems = useMemo(
    () => rows.map((row) => ({ type: "row", key: row.key, row })),
    [rows],
  );

  const lazy = rows.length > 20;
  const shownItems = lazy ? renderItems.slice(0, visibleCount) : renderItems;
  useEffect(() => { setVisibleCount(20); }, [filters, showInactive, mode]);

  // ---- Navigation --------------------------------------------------------
  const step = (delta) => {
    setSelection(null);
    if (mode === "week") setAnchor((a) => addDaysISO(a, delta * 7));
    else setAnchor(toISODate(new Date(year, month + delta, 1)));
  };
  const goToday = () => { setSelection(null); setAnchor(todayISO); };
  const stepWeek = (delta) => { setSelection(null); setAnchor((a) => addDaysISO(a, delta * 7)); };

  useEffect(() => {
    const mon = mobileWeek[0];
    const fri = mobileWeek[4];
    setSelectedDay((prev) => {
      if (prev >= mon && prev <= fri) return prev;
      if (todayISO >= mon && todayISO <= fri) return todayISO;
      return mon;
    });
  }, [mobileWeek, todayISO]);

  const applyPreset = (preset) => {
    setSelection(null);
    if (preset === "this-week") { setMode("week"); setAnchor(todayISO); }
    else if (preset === "next-week") { setMode("week"); setAnchor(addDaysISO(todayISO, 7)); }
    else if (preset === "this-month") { setMode("month"); setAnchor(todayISO); }
  };

  // A day is editable when the person is active, it's a weekday, not a public holiday, and
  // its week hasn't already ended (past weeks are read-only to prevent backdated changes).
  const isEditable = useCallback((staffId, date, active) => {
    if (!active || !isWeekday(date)) return false;
    if (holidaySet.has(date)) return false;
    return mondayOf(date) >= currentMonday;
  }, [holidaySet, currentMonday]);

  // ---- Selection (click = 1 day, shift-click = range) --------------------
  const onDayClick = (e, row, date, active) => {
    if (!isEditable(row.staff.id, date, active)) return;
    const staffId = row.staff.id;
    if (e.shiftKey && selection && selection.staffId === staffId) {
      const range = datesInRange(selection.anchor, date)
        .filter((d) => isEditable(staffId, d, active));
      setSelection({ ...selection, dates: range });
    } else {
      setSelection({ staffId, name: row.name, anchor: date, dates: [date] });
    }
  };

  const applySelection = async (status) => {
    if (!selection) return;
    const { staffId, dates } = selection;
    setSelection(null);
    for (const d of dates) await setCalendarEntry(staffId, d, status);
  };

  const selectedSet = selection ? new Set(selection.dates) : null;

  // ---- Lazy rows (teams > 20) --------------------------------------------
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!lazy) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => Math.min(c + 20, renderItems.length));
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, renderItems.length]);

  const activeFilterCount = (filters.status !== "all") + (filters.workload !== "all") + Boolean(filters.search.trim());

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        showInactive={showInactive}
        setShowInactive={setShowInactive}
        activeFilterCount={activeFilterCount}
      />

      {/* Mobile: day-focused vertical list (week strip + per-day staff rows) */}
      <div className="card overflow-hidden p-0 lg:hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-3">
          <div className="text-[0.95rem] font-bold text-[var(--ink)]">
            {formatDate(mobileWeek[0])} – {formatDate(mobileWeek[4], { year: "numeric" })}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="subtle" onClick={goToday}>Today</Button>
            <Button size="icon" variant="ghost" aria-label="Previous week" className="h-9 w-9 rounded-xl" onClick={() => stepWeek(-1)}><ChevronLeft size={16} /></Button>
            <Button size="icon" variant="ghost" aria-label="Next week" className="h-9 w-9 rounded-xl" onClick={() => stepWeek(1)}><ChevronRight size={16} /></Button>
          </div>
        </div>

        <div className="flex border-b border-[var(--line)] bg-[var(--surface-sunken)]">
          {mobileWeek.slice(0, 5).map((d) => {
            const wd = (parseISODate(d).getDay() + 6) % 7;
            const dayNum = Number(d.slice(8, 10));
            const isToday = d === todayISO;
            const isSelected = d === selectedDay;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
              >
                <span className={cx("text-[0.6rem] font-bold uppercase tracking-wider", isSelected ? "text-[var(--color-brand-500)]" : "text-[var(--ink-muted)]")}>{DOW[wd]}</span>
                <span className={cx(
                  "grid h-8 w-8 place-items-center rounded-full text-[0.82rem] font-bold transition-colors",
                  isSelected && isToday && "bg-[var(--color-brand-500)] text-white",
                  isSelected && !isToday && "bg-[var(--surface-sunken)] ring-2 ring-[var(--color-brand-500)] text-[var(--ink)]",
                  !isSelected && isToday && "font-extrabold text-[var(--color-brand-500)]",
                  !isSelected && !isToday && "text-[var(--ink-soft)]",
                )}>
                  {dayNum}
                </span>
              </button>
            );
          })}
        </div>

        {loading && !roster.length ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !roster.length ? (
          <EmptyState icon={CalendarDays} title="No technicians yet" text="Add someone with the Technician role to start tracking team availability." />
        ) : !rows.length ? (
          <EmptyState icon={Search} title="No matches" text="No technicians match the current filters." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {renderItems.map((item) => {
              const row = item.row;
              const staffId = row.staff.id;
              const active = rosterActive(row);
              const status = statusOn(staffId, selectedDay, entriesByKey, holidaySet);
              const meta = CALENDAR_STATUS_META[status];
              const Icon = STATUS_ICON[status];
              const editable = isEditable(staffId, selectedDay, active);
              const dayHours = mobileBookedByNameDate.get(row.name)?.get(selectedDay) || 0;
              const selected = selectedSet?.has(selectedDay) && selection?.staffId === staffId;
              return (
                <div key={row.key} className={cx("flex items-center gap-3 px-3.5 py-2.5", !active && "opacity-55")}>
                  <button type="button" onClick={() => setDetail(row)} className="flex flex-1 items-center gap-2.5 min-w-0 text-left">
                    <Avatar name={row.name} size={36} />
                    <div className="min-w-0">
                      <span className="block truncate text-[0.85rem] font-semibold text-[var(--ink)]">{row.name}</span>
                      {dayHours > 0 && (
                        <span className="text-[0.7rem] font-semibold text-[var(--color-brand-500)] tnum">{formatHours(dayHours)}h booked</span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={(e) => editable && onDayClick(e, row, selectedDay, active)}
                    className={cx(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[0.72rem] font-semibold transition-transform",
                      editable && "active:scale-95",
                      selected && "ring-2 ring-[var(--color-brand-500)] ring-offset-1 ring-offset-[var(--surface-card)]",
                    )}
                    style={statusStyle(meta)}
                  >
                    {Icon && <Icon size={14} />}
                    {meta.label}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-[var(--line)] p-3">
          <CalendarLegend />
        </div>
      </div>

      {/* Desktop: horizontal timeline */}
      <div className="hidden card overflow-hidden p-0 lg:block">
        {/* Toolbar: period label, presets, week/month toggle, navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-3.5">
          <div className="flex items-center gap-2">
            <div className="text-[1rem] font-bold text-[var(--ink)]">{periodLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="hidden items-center gap-1 sm:flex">
              {[["this-week", "This week"], ["next-week", "Next week"], ["this-month", "This month"]].map(([id, label]) => (
                <Button key={id} size="sm" variant="subtle" onClick={() => applyPreset(id)}>{label}</Button>
              ))}
              <span className="mx-1 h-5 w-px bg-[var(--line)]" />
            </div>
            <div className="inline-flex rounded-[var(--radius-field)] bg-[var(--surface-sunken)] p-0.5">
              {["week", "month"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setSelection(null); }}
                  className={cx(
                    "rounded-[calc(var(--radius-field)-2px)] px-3 py-1 text-[0.78rem] font-semibold capitalize transition-colors",
                    mode === m ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-[var(--shadow-card)]" : "text-[var(--ink-muted)]",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button size="sm" variant="subtle" onClick={goToday}>Today</Button>
            <Button size="icon" variant="ghost" aria-label="Previous" className="h-9 w-9 rounded-xl" onClick={() => step(-1)}><ChevronLeft size={16} /></Button>
            <Button size="icon" variant="ghost" aria-label="Next" className="h-9 w-9 rounded-xl" onClick={() => step(1)}><ChevronRight size={16} /></Button>
          </div>
        </div>

        {loading && !roster.length ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !roster.length ? (
          <EmptyState icon={CalendarDays} title="No technicians yet" text="Add someone with the Technician role to start tracking team availability." />
        ) : !rows.length ? (
          <EmptyState icon={Search} title="No matches" text="No technicians match the current filters. Clear a filter to see more." />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: rowW }}>
              {/* Date header */}
              <div className="flex border-b border-[var(--line)] bg-[var(--surface-card)]">
                <div
                  className="sticky left-0 z-20 flex items-center bg-[var(--surface-card)] px-3.5 py-2 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                  style={{ width: INFO_W }}
                >
                  Team member
                </div>
                {days.map((d) => {
                  const wd = (parseISODate(d).getDay() + 6) % 7;
                  const isToday = d === todayISO;
                  return (
                    <div key={d} className="flex flex-col items-center justify-center py-2" style={{ width: cellW }}>
                      <span className="text-[0.58rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{DOW[wd]}</span>
                      <span className={cx(
                        "mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[0.72rem] font-bold tnum",
                        isToday ? "bg-[var(--color-brand-500)] text-white" : "text-[var(--ink-soft)]",
                      )}>
                        {Number(d.slice(8, 10))}
                      </span>
                    </div>
                  );
                })}
                <div
                  className="sticky right-0 z-20 flex items-center justify-center border-l border-[var(--line)] bg-[var(--surface-card)] text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]"
                  style={{ width: HOURS_W }}
                >
                  Hours
                </div>
              </div>

              {/* Rows */}
              {shownItems.map((item) => {
                const row = item.row;
                const staffId = row.staff.id;
                const active = rosterActive(row);
                const { available, capacity } = availableHoursInRange(staffId, days, entriesByKey, holidaySet);
                const booked = bookedByName.get(row.name) || 0;
                // Two INDEPENDENT red conditions: booked can exceed available on a full week,
                // and available can be short of capacity with nothing booked at all.
                const reduced = available < capacity;
                const over = booked > available;
                return (
                  <div key={row.key} className={cx("flex border-b border-[var(--line)] last:border-b-0", !active && "opacity-55")}>
                    {/* Sticky staff info — click opens the detail panel */}
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="sticky left-0 z-10 flex items-center gap-2.5 bg-[var(--surface-card)] px-3.5 py-2 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                      style={{ width: INFO_W }}
                    >
                      <Avatar name={row.name} size={34} />
                      <div className="min-w-0">
                        <strong className="block truncate text-[0.82rem] text-[var(--ink)]">{row.name}</strong>
                        <span className="block truncate text-[0.68rem] text-[var(--ink-muted)]">{row.email || "Workshop technician"}</span>
                      </div>
                    </button>

                    {/* Day cells */}
                    {days.map((date) => {
                      const status = statusOn(staffId, date, entriesByKey, holidaySet);
                      const meta = CALENDAR_STATUS_META[status];
                      const Icon = STATUS_ICON[status];
                      const isHoliday = status === "Public Holiday";
                      const weekend = !isWeekday(date);
                      const editable = isEditable(staffId, date, active);
                      const available_ = status === "Available";
                      const selected = selectedSet?.has(date) && selection.staffId === staffId;
                      const tinted = !weekend; // weekends get no status tint
                      const dayHours = bookedByNameDate.get(row.name)?.get(date) || 0;
                      const showBooked = mode === "week" && !weekend && dayHours > 0;
                      return (
                        <div key={date} className="flex items-center justify-center py-1" style={{ width: cellW }}>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={(e) => onDayClick(e, row, date, active)}
                            title={weekend ? "Weekend" : cellTooltip(status, isHoliday, holidayNames.get(date))}
                            className={cx(
                              "relative flex items-center justify-center rounded-lg border text-[0.7rem] font-semibold transition-colors",
                              // h-11 (44px) leaves room for the booked line under "Available"
                              // and meets the touch-target floor these cells always needed.
                              mode === "week" ? "h-11 w-[88px]" : "h-8 w-9",
                              weekend ? "border-transparent opacity-40" : "border-[var(--line)]",
                              editable ? "cursor-pointer hover:border-[var(--color-brand-500)]" : "cursor-default",
                              selected && "ring-2 ring-[var(--color-brand-500)] ring-offset-1 ring-offset-[var(--surface-card)]",
                            )}
                            style={available_
                              ? (tinted ? { backgroundColor: meta.bg } : undefined)
                              : statusStyle(meta)}
                          >
                            {!available_ && Icon
                              ? <Icon size={mode === "week" ? 15 : 13} strokeWidth={2.4} style={{ color: meta.ink }} />
                              : mode === "week" && !weekend && <span className="text-[0.66rem] text-[var(--status-done)]">Available</span>}
                            {showBooked && (
                              <span className="absolute inset-x-0 bottom-0.5 text-center text-[0.56rem] font-bold leading-none text-[var(--color-brand-500)] tnum">
                                {formatHours(dayHours)}h assigned
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Sticky hours: work booked over hours available. The title carries the
                        full derivation including capacity, which the two lines don't show. */}
                    <div
                      className="sticky right-0 z-10 flex flex-col items-center justify-center gap-0.5 border-l border-[var(--line)] bg-[var(--surface-card)] tnum"
                      style={{ width: HOURS_W }}
                      title={`${formatHours(booked)}h booked · ${formatHours(available)}h available of ${formatHours(capacity)}h capacity`}
                    >
                      <span className={cx("text-[0.78rem] font-bold", over ? "text-[var(--danger)]" : "text-[var(--ink)]")}>
                        {formatHours(booked)}h <span className="text-[0.52rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">bkd</span>
                      </span>
                      <span className={cx("text-[0.78rem] font-bold", reduced ? "text-[var(--danger)]" : "text-[var(--ink-soft)]")}>
                        {formatHours(available)}h <span className="text-[0.52rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">avail</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {lazy && visibleCount < renderItems.length && <div ref={sentinelRef} className="h-4" />}
            </div>
          </div>
        )}

        {/* Legend + rule */}
        <div className="space-y-2 border-t border-[var(--line)] p-3.5">
          <CalendarLegend />
          <p className="text-[0.68rem] text-[var(--ink-muted)]">
            Hours column: <strong>bkd</strong> = hours on jobs <em>starting</em> in this period (a completed
            job counts its actual hours), <strong>avail</strong> = {formatHours(WEEK_CAPACITY)}h a week less{" "}
            {formatHours(DAY_HOURS)}h for each non-available weekday. In week view each weekday cell shows
            the hours assigned to it. Click a day to set status, shift-click to select a range. Past
            weeks are read-only.
          </p>
        </div>
      </div>

      {/* Bulk / single status action bar */}
      {selection && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-2.5 pl-4 shadow-[var(--shadow-float)] lg:bottom-4">
          <div className="text-[0.78rem] font-semibold text-[var(--ink)]">
            {selection.name} · {selection.dates.length === 1 ? formatDate(selection.dates[0], { year: "numeric" }) : `${selection.dates.length} days`}
          </div>
          <div className="w-[190px]">
            <DayPicker
              title={selection.dates.length === 1 ? "Set status" : `Set ${selection.dates.length} days`}
              onPick={applySelection}
              onClose={() => setSelection(null)}
            />
          </div>
        </div>
      )}

      <StaffDetailDrawer
        row={detail}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        workload={detail ? workloadByName.get(detail.name) : null}
        entriesByKey={entriesByKey}
        holidaySet={holidaySet}
        isAdmin={isAdmin}
        moveTargets={detail ? activePeople.filter((n) => n !== detail.name) : []}
        onOpenFullCalendar={onOpenFullCalendar}
        onMoveJobs={reassignStaffJobs}
        onSetRole={setPersonRole}
        openJob={openJob}
        onStatus={requestStatusChange}
      />
    </div>
  );
}

// ---- Filter bar ----------------------------------------------------------
function FilterBar({ filters, setFilters, showInactive, setShowInactive, activeFilterCount }) {
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <div className="relative min-w-[180px] flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search technicians…"
          className="pl-9"
        />
      </div>
      {/* No role filter: every row on this grid is a technician by construction. */}
      {/* Derived from CALENDAR_STATUSES, not a hand-written list — these options were the one
          place a new status did not reach on its own, so Blocked would have been settable but
          not filterable. "Available" is excluded: it is the absence of an entry, so filtering
          on it would mean "has no status", which the workload filter already covers better. */}
      <Select className="w-auto min-w-[130px]" value={filters.status} onChange={(e) => set("status", e.target.value)}>
        <option value="all">Any status</option>
        {CALENDAR_STATUSES.filter((status) => status !== "Available").map((status) => (
          <option key={status} value={status}>{CALENDAR_STATUS_META[status]?.reason || status}</option>
        ))}
      </Select>
      <Select className="w-auto min-w-[150px]" value={filters.workload} onChange={(e) => set("workload", e.target.value)}>
        <option value="all">Any workload</option>
        {Object.entries(WORKLOAD_FILTERS).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
      </Select>
      <Button
        size="sm"
        variant={showInactive ? "secondary" : "subtle"}
        className="gap-1.5"
        onClick={() => setShowInactive((s) => !s)}
      >
        {showInactive ? <Eye size={14} /> : <EyeOff size={14} />}
        {showInactive ? "Showing inactive" : "Hide inactive"}
      </Button>
      {activeFilterCount > 0 && (
        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setFilters({ search: "", status: "all", workload: "all" })}>
          <X size={13} />Clear
        </Button>
      )}
    </div>
  );
}

// ---- Detail slide-out ----------------------------------------------------
function StaffDetailDrawer({ row, open, onClose, workload, entriesByKey, holidaySet, isAdmin, moveTargets, onOpenFullCalendar, onMoveJobs, onSetRole, openJob, onStatus }) {
  const [moveTarget, setMoveTarget] = useState("Unassigned");
  useEffect(() => { setMoveTarget("Unassigned"); }, [row]);
  const liveNow = useNow(60_000);
  if (!row) return null;

  const member = row.staff;
  const role = rosterRole(row);
  const activeCount = workload?.active || 0;
  const closedCount = workload?.closed || 0;
  const estimated = workload?.estimatedThisWeek || 0;
  const hoursComplete = workload?.hoursComplete || 0;
  const blocked = workload?.blocked || 0;
  const jobs = workload?.jobs || [];
  const hasAccount = Boolean(row.account);
  const hrsLeft = member ? hoursLeftInWeek(member.id, liveNow, entriesByKey, holidaySet) : WEEK_CAPACITY;

  const header = (
    <DrawerHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size={46} />
          <div className="min-w-0">
            <div className="text-[1.05rem] font-bold tracking-tight">{row.name}</div>
            <div className="truncate text-[0.75rem] text-white/70">{row.email || "Workshop technician"}</div>
          </div>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-white/80 hover:bg-white/10"><X size={18} /></button>
      </div>
    </DrawerHeader>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header}>
      <div className="space-y-5 p-5">
        {/* Weekly capacity */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">This week</span>
            <span className={cx("text-[0.8rem] font-bold tnum", estimated > hrsLeft ? "text-[var(--danger)]" : "text-[var(--ink-soft)]")}>{formatHours(estimated)}h of {formatHours(hrsLeft)}h</span>
          </div>
          <Meter className="h-2.5" value={(estimated / (hrsLeft || 1)) * 100} tone={estimated > hrsLeft ? "var(--danger)" : "var(--color-brand-500)"} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
              <strong className="block text-[0.95rem] font-extrabold text-[var(--ink)] tnum">
                {activeCount} <span className="text-[var(--ink-muted)]">/</span> {closedCount}
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
        </div>

        {/* Quick actions */}
        <div className="grid gap-2">
          <Button variant="primary" className="w-full gap-1.5" onClick={() => { onOpenFullCalendar?.(member); onClose(); }}>
            <CalendarDays size={16} />Open full calendar
          </Button>
          {isAdmin && <>
            <div className="flex gap-2">
              <Select className="flex-1" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                <option>Unassigned</option>
                {moveTargets.map((n) => <option key={n}>{n}</option>)}
              </Select>
              <Button variant="ghost" className="gap-1.5" disabled={!activeCount} onClick={() => onMoveJobs?.(row.name, moveTarget)}>
                <Briefcase size={15} />Move jobs
              </Button>
            </div>
            {/* Demoting from here removes the person from this very grid — that is the point,
                and it is reversible: their staff record and calendar entries are kept. */}
            <Select
              aria-label={`Role for ${row.name}`}
              value={role}
              disabled={!hasAccount}
              title={hasAccount ? undefined : "This person has no login account yet"}
              onChange={(e) => onSetRole?.(row, e.target.value)}
            >
              {ACCOUNT_ROLES.map((key) => (
                <option key={key} value={key}>{ACCOUNT_ROLE_META[key].label}</option>
              ))}
            </Select>
          </>}
        </div>

        {/* Open jobs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Open jobs</span>
            {activeCount > 0 && <StatusChip status={blocked ? "Input Needed" : "In Progress"} size="sm" />}
          </div>
          <div className="grid gap-2">
            {jobs.length
              ? jobs.map((job) => <MiniJob key={job.id} job={job} onSelect={(j) => { openJob(j); onClose(); }} onStatus={onStatus} />)
              : <EmptyState text="No open jobs assigned." />}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
