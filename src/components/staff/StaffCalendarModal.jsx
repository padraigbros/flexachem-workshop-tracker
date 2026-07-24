import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, GraduationCap, Palmtree, Thermometer, Landmark } from "lucide-react";
import { CALENDAR_STATUSES, WEEK_CAPACITY } from "../../lib/constants";
import {
  CALENDAR_STATUS_META, WEEKDAY_LABELS, monthGrid, indexEntries, holidayIndex,
  statusOn, weekAvailableHours,
} from "../../lib/calendar";
import { today, toISODate } from "../../lib/dates";
import { Modal, ModalHeader } from "../ui/overlay";
import { Button, cx } from "../ui/primitives";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Icon per non-available status (Available has no glyph — its tint carries the meaning).
const STATUS_ICON = {
  Training: GraduationCap,
  Leave: Palmtree,
  Sick: Thermometer,
  "Public Holiday": Landmark,
};

// A swatch that mirrors a calendar day cell (pale fill + ink accent) so the legend, the
// picker, and the grid all read as the same colour language.
function Swatch({ meta }) {
  return (
    <span
      className="grid h-4 w-4 place-items-center rounded-md"
      style={{ background: meta.bg, boxShadow: `inset 0 0 0 1px ${meta.ink}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.ink }} />
    </span>
  );
}

// Small inline status picker shown when an editable day is tapped.
function DayPicker({ current, onPick, onClose }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-2 shadow-[var(--shadow-float)]">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[0.62rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Set status</span>
        <button type="button" aria-label="Close picker" onClick={onClose} className="text-[var(--ink-muted)]"><X size={13} /></button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {CALENDAR_STATUSES.map((status) => {
          const meta = CALENDAR_STATUS_META[status];
          const Icon = STATUS_ICON[status];
          const active = current === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onPick(status)}
              className={cx(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold transition-[filter]",
                active ? "" : "hover:brightness-95",
              )}
              style={{ color: meta.ink, background: meta.bg, ...(active ? { boxShadow: `inset 0 0 0 1.5px ${meta.ink}` } : null) }}
            >
              {Icon ? <Icon size={13} /> : <span className="h-2 w-2 rounded-full" style={{ background: meta.ink }} />}
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StaffCalendarModal({ member, open, calendar, holidays, onSetEntry, onClose }) {
  const now = today();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [picking, setPicking] = useState(null); // ISO date currently being edited

  const entriesByKey = useMemo(() => indexEntries(calendar), [calendar]);
  const { set: holidaySet, names: holidayNames } = useMemo(() => holidayIndex(holidays), [holidays]);
  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const todayISO = toISODate(now);

  if (!member) return null;
  const staffId = member.id;

  const step = (delta) => {
    setPicking(null);
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const goToday = () => { setPicking(null); setView({ year: now.getFullYear(), month: now.getMonth() }); };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex max-h-[100dvh] flex-col sm:max-h-[calc(100dvh-2.5rem)]">
        <ModalHeader
          eyebrow="Availability calendar"
          title={member.name}
          subtitle="Set Training, Leave or Sick days. Public holidays apply automatically."
          onClose={onClose}
        />

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[1rem] font-bold text-[var(--ink)]">{MONTHS[view.month]} {view.year}</div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="subtle" onClick={goToday}>Today</Button>
              <Button size="icon" variant="ghost" aria-label="Previous month" className="h-9 w-9 rounded-xl" onClick={() => step(-1)}><ChevronLeft size={16} /></Button>
              <Button size="icon" variant="ghost" aria-label="Next month" className="h-9 w-9 rounded-xl" onClick={() => step(1)}><ChevronRight size={16} /></Button>
            </div>
          </div>

          {/* Weekday header: 5 weekday columns + weekend + a set-apart weekly hours column. */}
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="pb-1 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
            ))}
            <div className="ml-1 border-l border-[var(--line)] pb-1 pl-2 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Hours</div>

            {weeks.map((week, wi) => {
              const weekHours = weekAvailableHours(staffId, week[0].date, entriesByKey, holidaySet);
              const reduced = weekHours < WEEK_CAPACITY;
              const flipUp = wi >= weeks.length - 2; // open the picker upward for the bottom rows
              return week.map((cell, ci) => {
                const status = statusOn(staffId, cell.date, entriesByKey, holidaySet);
                const meta = CALENDAR_STATUS_META[status];
                const Icon = STATUS_ICON[status];
                const isHoliday = status === "Public Holiday";
                const dayNum = Number(cell.date.slice(8, 10));
                const isWeekend = ci >= 5;
                const editable = cell.inMonth && !isHoliday && !isWeekend;
                const isToday = cell.date === todayISO;
                const isSelected = picking === cell.date;
                const available = status === "Available";
                // Weekends/out-of-month get no status tint; available in-month weekdays get a
                // faint green so "available" reads as a positive state, not just blank.
                const tinted = cell.inMonth && !isWeekend;
                return (
                  <div key={cell.date} className="relative">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => editable && setPicking((p) => (p === cell.date ? null : cell.date))}
                      title={isHoliday ? holidayNames.get(cell.date) : (available ? undefined : status)}
                      className={cx(
                        "flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl border text-[0.8rem] font-semibold transition-colors",
                        cell.inMonth ? "border-[var(--line)]" : "border-transparent opacity-35",
                        editable ? "cursor-pointer hover:border-[var(--color-brand-500)]" : "cursor-default",
                        isWeekend && cell.inMonth && "opacity-55",
                        isSelected && "ring-2 ring-[var(--color-brand-500)]",
                      )}
                      style={available
                        ? (tinted ? { background: meta.bg, color: "var(--ink)" } : { color: "var(--ink)" })
                        : { color: meta.ink, background: meta.bg }}
                    >
                      <span
                        className={cx("grid h-6 w-6 place-items-center rounded-full", isToday && "bg-[var(--color-brand-500)] font-extrabold text-white")}
                      >
                        {dayNum}
                      </span>
                      {!available && Icon && <Icon size={13} strokeWidth={2.4} />}
                    </button>
                    {isSelected && (
                      <div className={cx(
                        "absolute z-30 w-44",
                        flipUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
                        ci <= 1 ? "left-0" : ci >= 5 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}>
                        <DayPicker
                          current={status}
                          onPick={(next) => { onSetEntry(staffId, cell.date, next); setPicking(null); }}
                          onClose={() => setPicking(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              }).concat(
                <div key={`${week[0].date}-hrs`} className={cx("ml-1 flex items-center justify-center rounded-xl border-l border-[var(--line)] bg-[var(--surface-sunken)] px-2 text-[0.72rem] font-bold tnum", reduced ? "text-[var(--danger)]" : "text-[var(--ink-muted)]")}>
                  {weekHours}h
                </div>,
              );
            })}
          </div>

          {/* Legend — every status, swatches matching the grid's colour language. */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] pt-3">
            {Object.entries(CALENDAR_STATUS_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--ink-soft)]">
                <Swatch meta={meta} />
                {meta.label}
              </span>
            ))}
          </div>
          <p className="text-[0.7rem] text-[var(--ink-muted)]">
            Each non-available weekday deducts {WEEK_CAPACITY / 5}h from that week&apos;s {WEEK_CAPACITY}h capacity. Public holidays are read-only.
          </p>
        </div>
      </div>
    </Modal>
  );
}
