// Shared building blocks for the staff availability calendars — the per-status icons, the
// legend/grid swatch, and the inline status picker. Used by both the single-person modal
// (StaffCalendarModal) and the Team Availability timeline so the two read as one colour
// language and behave identically when setting a day's status.
import { X, GraduationCap, Palmtree, Thermometer, Landmark } from "lucide-react";
import { CALENDAR_STATUSES } from "../../lib/constants";
import { CALENDAR_STATUS_META } from "../../lib/calendar";
import { cx } from "../ui/primitives";

// Icon per non-available status (Available has no glyph — its tint carries the meaning).
export const STATUS_ICON = {
  Training: GraduationCap,
  Leave: Palmtree,
  Sick: Thermometer,
  "Public Holiday": Landmark,
};

// A swatch that mirrors a calendar day cell (pale fill + ink accent) so the legend, the
// picker, and the grid all read as the same colour language.
export function Swatch({ meta }) {
  return (
    <span
      className="grid h-4 w-4 place-items-center rounded-md"
      style={{ background: meta.bg, boxShadow: `inset 0 0 0 1px ${meta.ink}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.ink }} />
    </span>
  );
}

// Legend row — every status, swatches matching the grid's colour language.
export function CalendarLegend({ className }) {
  return (
    <div className={cx("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {Object.entries(CALENDAR_STATUS_META).map(([key, meta]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--ink-soft)]">
          <Swatch meta={meta} />
          {meta.label}
        </span>
      ))}
    </div>
  );
}

// Inline status picker shown when an editable day (or a bulk selection) is tapped. `title`
// lets the team view label it "Set 3 days" while the modal keeps the default "Set status".
export function DayPicker({ current, title = "Set status", onPick, onClose }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-2 shadow-[var(--shadow-float)]">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[0.62rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{title}</span>
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
