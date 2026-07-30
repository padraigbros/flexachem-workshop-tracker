import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Search, Star, X, CalendarDays, Briefcase, Eye, EyeOff,
} from "lucide-react";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { useStatusPrompt } from "../../state/StatusPromptProvider";
import { WEEK_CAPACITY, DAY_HOURS } from "../../lib/constants";
import {
  CALENDAR_STATUS_META, indexEntries, holidayIndex, statusOn, weekAvailableHours,
  weekDates, monthDates, mondayOf, addDaysISO, availableHoursInRange, datesInRange, isWeekday,
} from "../../lib/calendar";
import { buildRoster, rosterRole, rosterActive } from "../../lib/staff";
import { today, toISODate, parseISODate, formatDate } from "../../lib/dates";
import { Button, Input, Select, Chip, EmptyState, Skeleton, cx } from "../ui/primitives";
import { Avatar, Meter } from "../ui/dataviz";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { StatusChip } from "../ui/StatusChip";
import { MiniJob } from "../jobs/JobBits";
import { STATUS_ICON, DayPicker, CalendarLegend } from "./calendarShared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Column geometry — fixed pixel widths keep the date header and every staff row aligned
// inside the horizontal scroll area (a month has ~31 columns, so the grid scrolls sideways).
const INFO_W = 224;
const HOURS_W = 96;

const WORKLOAD_FILTERS = {
  under: { label: "Under-utilised", test: (h) => h < 20 },
  at: { label: "At capacity", test: (h) => h >= 35 && h <= 40 },
  over: { label: "Over capacity", test: (h) => h > 40 },
};

// Human tooltip for a day cell: status + the capacity it costs that week.
function cellTooltip(status, isHoliday, holidayName, hasJob) {
  const job = hasJob ? " · has open job" : "";
  if (isHoliday) return `Public holiday${holidayName ? `: ${holidayName}` : ""} — ${DAY_HOURS}h deducted${job}`;
  if (status === "Available") return `Available${job}`;
  return `${status} — ${DAY_HOURS}h deducted${job}`;
}

export function TeamAvailabilityView({ onOpenFullCalendar }) {
  const {
    staff, accounts, calendar, holidays, activeJobs, loading,
    setCalendarEntry, reassignStaffJobs, updateAccount, activePeople,
  } = useWorkshop();
  const { openJob } = useJobDrawer();
  const { requestStatusChange } = useStatusPrompt();

  const now = today();
  const todayISO = toISODate(now);
  const currentMonday = mondayOf(todayISO);

  const [mode, setMode] = useState("week"); // "week" | "month"
  const [anchor, setAnchor] = useState(todayISO); // any date within the shown period
  const [filters, setFilters] = useState({ search: "", role: "all", status: "all", workload: "all" });
  const [showInactive, setShowInactive] = useState(false);
  const [selection, setSelection] = useState(null); // { staffId, name, anchor, dates:[iso] }
  const [detail, setDetail] = useState(null); // roster row shown in the slide-out
  const [visibleCount, setVisibleCount] = useState(20);

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

  // Open-job workload per person (mirrors the Staff list cards): drives the workload filter,
  // the row's job overlay and the detail panel.
  const workloadByName = useMemo(() => {
    const map = new Map();
    activeJobs.forEach((job) => {
      if (job.status === "Complete" || !job.alloc) return;
      const cur = map.get(job.alloc) || { open: 0, hours: 0, actual: 0, blocked: 0, jobs: [] };
      cur.open += 1;
      cur.hours += Number(job.hrs || 0);
      cur.actual += Number(job.actualHrs || 0);
      if (job.status === "Input Needed") cur.blocked += 1;
      cur.jobs.push(job);
      map.set(job.alloc, cur);
    });
    return map;
  }, [activeJobs]);

  // Which visible days each person has an open job spanning (start..due) — the small job dot.
  const jobDaysByName = useMemo(() => {
    const daySet = new Set(days);
    const map = new Map();
    activeJobs.forEach((job) => {
      if (job.status === "Complete" || !job.alloc) return;
      const start = job.start || job.due;
      const end = job.due || job.start;
      if (!start && !end) return;
      datesInRange(start || end, end || start).forEach((d) => {
        if (!daySet.has(d)) return;
        if (!map.has(job.alloc)) map.set(job.alloc, new Set());
        map.get(job.alloc).add(d);
      });
    });
    return map;
  }, [activeJobs, days]);

  // Roster → only people with a staff record (they have a calendar), grouped Admins→Staff.
  const roster = useMemo(() => buildRoster(staff, accounts).filter((r) => r.staff), [staff, accounts]);

  const rows = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return roster.filter((row) => {
      if (!showInactive && !rosterActive(row)) return false;
      if (term && !row.name.toLowerCase().includes(term)) return false;
      if (filters.role !== "all" && rosterRole(row) !== filters.role) return false;
      if (filters.status !== "all") {
        const hit = days.some((d) => isWeekday(d) && statusOn(row.staff.id, d, entriesByKey, holidaySet) === filters.status);
        if (!hit) return false;
      }
      if (filters.workload !== "all") {
        const hours = workloadByName.get(row.name)?.hours || 0;
        if (!WORKLOAD_FILTERS[filters.workload].test(hours)) return false;
      }
      return true;
    });
  }, [roster, filters, showInactive, days, entriesByKey, holidaySet, workloadByName]);

  // Group into Admins then Staff, so the timeline reads role-first.
  const groups = useMemo(() => {
    const admins = rows.filter((r) => rosterRole(r) === "admin");
    const staffRows = rows.filter((r) => rosterRole(r) !== "admin");
    return [
      { key: "admin", label: "Admins", rows: admins },
      { key: "staff", label: "Staff", rows: staffRows },
    ].filter((g) => g.rows.length);
  }, [rows]);

  // Flatten to a render list (group headers + rows) so lazy-loading can slice a single list.
  const renderItems = useMemo(() => {
    const items = [];
    groups.forEach((g) => {
      items.push({ type: "group", key: `g-${g.key}`, label: g.label, count: g.rows.length });
      g.rows.forEach((row) => items.push({ type: "row", key: row.key, row }));
    });
    return items;
  }, [groups]);

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

  const activeFilterCount = (filters.role !== "all") + (filters.status !== "all") + (filters.workload !== "all") + Boolean(filters.search.trim());

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        showInactive={showInactive}
        setShowInactive={setShowInactive}
        activeFilterCount={activeFilterCount}
      />

      {/* Timeline card */}
      <div className="card overflow-hidden p-0">
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
          <EmptyState icon={CalendarDays} title="No staff yet" text="Add a staff member to start tracking team availability." />
        ) : !rows.length ? (
          <EmptyState icon={Search} title="No matches" text="No staff match the current filters. Clear a filter to see more." />
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
                if (item.type === "group") {
                  return (
                    <div key={item.key} className="flex border-b border-[var(--line)] bg-[var(--surface-sunken)]">
                      <div
                        className="sticky left-0 z-10 flex items-center gap-1.5 bg-[var(--surface-sunken)] px-3.5 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]"
                        style={{ width: INFO_W }}
                      >
                        {item.label === "Admins" && <Star size={11} />}{item.label}
                        <Chip className="ml-1">{item.count}</Chip>
                      </div>
                    </div>
                  );
                }
                const row = item.row;
                const staffId = row.staff.id;
                const active = rosterActive(row);
                const admin = rosterRole(row) === "admin";
                const { available, capacity } = availableHoursInRange(staffId, days, entriesByKey, holidaySet);
                const reduced = available < capacity;
                const jobDays = jobDaysByName.get(row.name);
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
                        <div className="flex items-center gap-1.5">
                          <strong className="block truncate text-[0.82rem] text-[var(--ink)]">{row.name}</strong>
                          {admin && <Star size={11} className="shrink-0 text-[var(--status-active)]" />}
                        </div>
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
                      const hasJob = jobDays?.has(date);
                      const tinted = !weekend; // weekends get no status tint
                      return (
                        <div key={date} className="flex items-center justify-center py-1" style={{ width: cellW }}>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={(e) => onDayClick(e, row, date, active)}
                            title={weekend ? "Weekend" : cellTooltip(status, isHoliday, holidayNames.get(date), hasJob)}
                            className={cx(
                              "relative flex items-center justify-center rounded-lg border text-[0.7rem] font-semibold transition-colors",
                              mode === "week" ? "h-9 w-[88px]" : "h-8 w-9",
                              weekend ? "border-transparent opacity-40" : "border-[var(--line)]",
                              editable ? "cursor-pointer hover:border-[var(--color-brand-500)]" : "cursor-default",
                              selected && "ring-2 ring-[var(--color-brand-500)] ring-offset-1 ring-offset-[var(--surface-card)]",
                            )}
                            style={available_
                              ? (tinted ? { background: meta.bg } : undefined)
                              : { color: meta.ink, background: meta.bg }}
                          >
                            {!available_ && Icon
                              ? <Icon size={mode === "week" ? 15 : 13} strokeWidth={2.4} style={{ color: meta.ink }} />
                              : mode === "week" && !weekend && <span className="text-[0.66rem] text-[var(--status-done)]">Available</span>}
                            {hasJob && (
                              <span
                                className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)]"
                                aria-hidden
                              />
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Sticky hours */}
                    <div
                      className={cx(
                        "sticky right-0 z-10 flex flex-col items-center justify-center border-l border-[var(--line)] bg-[var(--surface-card)] tnum",
                        reduced ? "text-[var(--danger)]" : "text-[var(--ink-soft)]",
                      )}
                      style={{ width: HOURS_W }}
                    >
                      <strong className="text-[0.82rem] font-bold">{available}h</strong>
                      <span className="text-[0.58rem] font-semibold text-[var(--ink-muted)]">of {capacity}h</span>
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
          <p className="flex items-center gap-1.5 text-[0.68rem] text-[var(--ink-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)]" />
            Job assigned that day · Each non-available weekday deducts {DAY_HOURS}h from that week&apos;s {WEEK_CAPACITY}h. Click a day to set status, shift-click to select a range. Past weeks are read-only.
          </p>
        </div>
      </div>

      {/* Bulk / single status action bar */}
      {selection && (
        <div className="fixed inset-x-0 bottom-4 z-[70] mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-2.5 pl-4 shadow-[var(--shadow-float)]">
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
        weekCapacity={detail?.staff ? weekAvailableHours(detail.staff.id, todayISO, entriesByKey, holidaySet) : WEEK_CAPACITY}
        moveTargets={detail ? activePeople.filter((n) => n !== detail.name) : []}
        onOpenFullCalendar={onOpenFullCalendar}
        onMoveJobs={reassignStaffJobs}
        onToggleRole={updateAccount}
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
          placeholder="Search staff…"
          className="pl-9"
        />
      </div>
      <Select className="w-auto min-w-[120px]" value={filters.role} onChange={(e) => set("role", e.target.value)}>
        <option value="all">All roles</option>
        <option value="admin">Admins</option>
        <option value="staff">Staff</option>
      </Select>
      <Select className="w-auto min-w-[130px]" value={filters.status} onChange={(e) => set("status", e.target.value)}>
        <option value="all">Any status</option>
        <option value="Training">On training</option>
        <option value="Leave">On leave</option>
        <option value="Sick">Off sick</option>
      </Select>
      <Select className="w-auto min-w-[150px]" value={filters.workload} onChange={(e) => set("workload", e.target.value)}>
        <option value="all">Any workload</option>
        <option value="under">Under-utilised (&lt;20h)</option>
        <option value="at">At capacity (35–40h)</option>
        <option value="over">Over capacity (&gt;40h)</option>
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
        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setFilters({ search: "", role: "all", status: "all", workload: "all" })}>
          <X size={13} />Clear
        </Button>
      )}
    </div>
  );
}

// ---- Detail slide-out ----------------------------------------------------
function StaffDetailDrawer({ row, open, onClose, workload, weekCapacity = WEEK_CAPACITY, moveTargets, onOpenFullCalendar, onMoveJobs, onToggleRole, openJob, onStatus }) {
  const [moveTarget, setMoveTarget] = useState("Unassigned");
  useEffect(() => { setMoveTarget("Unassigned"); }, [row]);
  if (!row) return null;

  const member = row.staff;
  const admin = rosterRole(row) === "admin";
  const estimated = workload?.hours || 0;
  const actual = workload?.actual || 0;
  const openCount = workload?.open || 0;
  const blocked = workload?.blocked || 0;
  const jobs = workload?.jobs || [];
  const hasAccount = Boolean(row.account);

  const header = (
    <DrawerHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size={46} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[1.05rem] font-bold tracking-tight">{row.name}{admin && <Star size={14} />}</div>
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
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">This week&apos;s workload</span>
            <span className={cx("text-[0.8rem] font-bold tnum", estimated > weekCapacity ? "text-[var(--danger)]" : "text-[var(--ink-soft)]")}>{estimated}h of {weekCapacity}h</span>
          </div>
          <Meter className="h-2.5" value={(estimated / (weekCapacity || 1)) * 100} tone={estimated > weekCapacity ? "var(--danger)" : "var(--color-brand-500)"} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[["Assigned", openCount], ["Estimated", `${estimated}h`], ["Actual", `${actual}h`]].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-[var(--surface-sunken)] p-2.5 text-center">
                <strong className="block text-lg font-extrabold text-[var(--ink)] tnum">{val}</strong>
                <span className="text-[0.58rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid gap-2">
          <Button variant="primary" className="w-full gap-1.5" onClick={() => { onOpenFullCalendar?.(member); onClose(); }}>
            <CalendarDays size={16} />Open full calendar
          </Button>
          <div className="flex gap-2">
            <Select className="flex-1" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
              <option>Unassigned</option>
              {moveTargets.map((n) => <option key={n}>{n}</option>)}
            </Select>
            <Button variant="ghost" className="gap-1.5" disabled={!openCount} onClick={() => onMoveJobs?.(row.name, moveTarget)}>
              <Briefcase size={15} />Move jobs
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!hasAccount}
            title={hasAccount ? undefined : "This person has no login account yet"}
            onClick={() => row.account && onToggleRole?.(row.account.id, { role: admin ? "staff" : "admin" })}
          >
            {admin ? "Make staff" : "Make admin"}
          </Button>
        </div>

        {/* Open jobs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Open jobs</span>
            {openCount > 0 && <StatusChip status={blocked ? "Input Needed" : "In Progress"} size="sm" />}
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
