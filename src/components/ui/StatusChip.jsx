import { CircleDashed, ArrowUpRight, TriangleAlert, Check } from "lucide-react";
import { STATUS_META } from "../../lib/constants";
import { cx } from "./primitives";

const ICONS = {
  "circle-dashed": CircleDashed,
  "arrow-up-right": ArrowUpRight,
  "alert-triangle": TriangleAlert,
  check: Check,
};

const TONE_STYLE = {
  queued: { color: "var(--status-queued)", background: "var(--status-queued-bg)" },
  active: { color: "var(--status-active)", background: "var(--status-active-bg)" },
  blocked: { color: "var(--status-blocked)", background: "var(--status-blocked-bg)" },
  done: { color: "var(--status-done)", background: "var(--status-done-bg)" },
};

export function statusTone(status) {
  return (STATUS_META[status] || STATUS_META["Not Started"]).tone;
}

export function StatusChip({ status, className, size = "md" }) {
  const meta = STATUS_META[status] || STATUS_META["Not Started"];
  const Icon = ICONS[meta.icon];
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[0.66rem]" : "px-2.5 py-1 text-[0.7rem]", className)}
      style={TONE_STYLE[meta.tone]}
    >
      <Icon size={size === "sm" ? 11 : 12} strokeWidth={2.75} />
      {meta.short}
    </span>
  );
}

const PRIORITY_STYLE = {
  Critical: { color: "var(--prio-critical)", background: "var(--prio-critical-bg)" },
  High: { color: "var(--prio-high)", background: "var(--prio-high-bg)" },
  Normal: { color: "var(--prio-normal)", background: "var(--prio-normal-bg)" },
  Low: { color: "var(--prio-low)", background: "var(--prio-low-bg)" },
};

export function PriorityChip({ priority, className }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold", className)} style={PRIORITY_STYLE[priority] || PRIORITY_STYLE.Normal}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
      {priority}
    </span>
  );
}

export function priorityColor(priority) {
  return (PRIORITY_STYLE[priority] || PRIORITY_STYLE.Normal).color;
}

const STATUS_ACTIVE_BG = {
  "In Progress": "var(--status-active)",
  "Input Needed": "var(--status-blocked)",
  Complete: "var(--status-done)",
};

// Segmented quick-status control used on cards, drawers and list rows.
export function StatusSwitch({ value, onChange, className }) {
  const options = ["In Progress", "Input Needed", "Complete"];
  return (
    <div className={cx("inline-flex gap-1 rounded-full bg-[var(--surface-sunken)] p-1", className)} onClick={(e) => e.stopPropagation()}>
      {options.map((status) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={cx(
              "flex-1 rounded-full px-2.5 py-1 text-[0.68rem] font-bold transition-colors",
              active ? "text-white shadow-sm" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
            )}
            style={active ? { background: STATUS_ACTIVE_BG[status], color: "#fff" } : undefined}
          >
            {STATUS_META[status].short}
          </button>
        );
      })}
    </div>
  );
}
