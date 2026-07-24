import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CALENDAR_STATUSES, WEEK_CAPACITY } from "../../lib/constants";
import {
  CALENDAR_STATUS_META, WEEKDAY_LABELS, monthGrid, indexEntries, holidayIndex,
  statusOn, weekAvailableHours, weekdaysOfWeek,
} from "../../lib/calendar";
import { today, toISODate } from "../../lib/dates";
import { Modal, ModalHeader } from "../ui/overlay";
import { Button, cx } from "../ui/primitives";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Small inline status picker shown when an editable day is tapped.
function DayPicker({ current, onPick, onClose }) {
  return (
    <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-2 shadow-[var(--shadow-float)]">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[0.62rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Set status</span>
        <button type="button" aria-label="Close picker" onClick={onClose} className="text-[var(--ink-muted)]"><X size={13} /></button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {CALENDAR_STATUSES.map((status) => {
          const meta = CALENDAR_STATUS_META[status];
          const active = current === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onPick(status)}
              className={cx(
                "rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold transition-colors",
                active ? "ring-1 ring-inset" : "hover:brightness-95",
              )}
              style={{ color: meta.ink, background: meta.bg, ...(active ? { boxShadow: `inset 0 0 0 1px ${meta.ink}` } : null) }}
            >
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

          {/* Weekday header: 5 weekday columns + weekend + a trailing hours column. */}
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="pb-1 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
            ))}
            <div className="pb-1 pl-1 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Hours</div>

            {weeks.map((week) => {
              const weekHours = weekAvailableHours(staffId, week[0].date, entriesByKey, holidaySet);
              const reduced = weekHours < WEEK_CAPACITY;
              return week.map((cell, ci) => {
                const status = statusOn(staffId, cell.date, entriesByKey, holidaySet);
                const meta = CALENDAR_STATUS_META[status];
                const isHoliday = status === "Public Holiday";
                const dayNum = Number(cell.date.slice(8, 10));
                const isWeekend = ci >= 5;
                const editable = cell.inMonth && !isHoliday && !isWeekend;
                const isToday = cell.date === todayISO;
                return (
                  <div key={cell.date} className="relative">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => editable && setPicking((p) => (p === cell.date ? null : cell.date))}
                      title={isHoliday ? holidayNames.get(cell.date) : (status !== "Available" ? status : undefined)}
                      className={cx(
                        "flex aspect-square w-full flex-col items-center justify-center rounded-xl border text-[0.8rem] font-semibold transition-colors",
                        cell.inMonth ? "border-[var(--line)]" : "border-transparent opacity-35",
                        editable ? "cursor-pointer hover:border-[var(--color-brand-500)]" : "cursor-default",
                        isWeekend && cell.inMonth && status === "Available" && "opacity-55",
                        isToday && "ring-1 ring-[var(--color-brand-500)]",
                      )}
                      style={status === "Available"
                        ? { color: "var(--ink)" }
                        : { color: meta.ink, background: meta.bg }}
                    >
                      <span>{dayNum}</span>
                      {status !== "Available" && (
                        <span className="mt-0.5 text-[0.5rem] font-bold uppercase leading-none tracking-wide">
                          {isHoliday ? "Hol" : status.slice(0, 4)}
                        </span>
                      )}
                    </button>
                    {picking === cell.date && (
                      <div className="absolute left-1/2 top-full z-10 w-44 -translate-x-1/2">
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
                <div key={`${week[0].date}-hrs`} className={cx("flex items-center justify-center rounded-xl px-2 text-[0.72rem] font-bold tnum", reduced ? "text-[var(--danger)]" : "text-[var(--ink-muted)]")}>
                  {weekHours}h
                </div>,
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
            {Object.entries(CALENDAR_STATUS_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--ink-soft)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.ink }} />
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
