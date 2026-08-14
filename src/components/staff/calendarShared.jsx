// Shared building blocks for the staff availability calendars — the per-status icons, the
// legend/grid swatch, and the inline status picker. Used by both the single-person modal
// (StaffCalendarModal) and the Team Availability timeline so the two read as one colour
// language and behave identically when setting a day's status.
import { X, GraduationCap, Palmtree, Thermometer, Landmark, Ban } from "lucide-react";
import { CALENDAR_STATUSES } from "../../lib/constants";
import { CALENDAR_STATUS_META } from "../../lib/calendar";
import { cx } from "../ui/primitives";

// Icon per non-available status (Available has no glyph — its tint carries the meaning).
export const STATUS_ICON = {
  Training: GraduationCap,
  Leave: Palmtree,
  Sick: Thermometer,
  Blocked: Ban,
  "Public Holiday": Landmark,
};

// Every calendar surface paints its own background inline, so a status with a `pattern`
// (currently only Blocked's 45° chevron) has to layer it over `bg` at each site. One helper
// keeps the swatch, the picker, the grid cell and the mobile pill from drifting apart.
//
// Uses the `backgroundColor` LONGHAND deliberately. With the `background` shorthand alongside
// `backgroundImage`, React expands the shorthand into its longhands and then writes
// background-image separately — which left `background-color: ` EMPTY on the element, so a
// Blocked cell rendered the chevron over the previous status's fill. A var() in a shorthand
// becomes a pending-substitution value, which is what makes the two orders disagree.
export const statusStyle = (meta, extra) => ({
  color: meta.ink,
  backgroundColor: meta.bg,
  ...(meta.pattern ? { backgroundImage: meta.pattern } : null),
  ...extra,
});

// A swatch that mirrors a calendar day cell (pale fill + ink accent) so the legend, the
// picker, and the grid all read as the same colour language.
export function Swatch({ meta }) {
  return (
    <span
      className="grid h-4 w-4 place-items-center rounded-md"
      style={statusStyle(meta, { boxShadow: `inset 0 0 0 1px ${meta.ink}` })}
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
              // "Blocked" on its own is ambiguous app-wide — the Input Needed job status
              // renders a chip with exactly that text — so name the action, not just the
              // status. The visible label stays inside the accessible name.
              aria-label={`Set ${meta.label}`}
              onClick={() => onPick(status)}
              className={cx(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.72rem] font-semibold transition-[filter]",
                active ? "" : "hover:brightness-95",
              )}
              style={statusStyle(meta, active ? { boxShadow: `inset 0 0 0 1.5px ${meta.ink}` } : null)}
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
