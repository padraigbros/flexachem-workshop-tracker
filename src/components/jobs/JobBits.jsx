import { ShieldAlert } from "lucide-react";
import { jobCalendarSpan } from "../../lib/jobs";
import { riskScore } from "../../state/WorkshopProvider";
import { formatDate, formatRelative } from "../../lib/dates";
import { StatusChip, PriorityChip, StatusSwitch, priorityColor } from "../ui/StatusChip";
import { Avatar, Meter } from "../ui/dataviz";
import { EmptyState, cx } from "../ui/primitives";

// Compact job row used in Staff and Business-Unit lanes.
export function MiniJob({ job, onSelect, onStatus }) {
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(job.id)}>
          <div className="truncate font-bold text-[var(--ink)]">{job.asm} · {job.cust}</div>
          <div className="mt-0.5 truncate text-[0.72rem] text-[var(--ink-muted)]">{job.type} · due {formatDate(job.due)} · {job.hrs}h / {jobCalendarSpan(job)}d</div>
        </button>
        <StatusChip status={job.status} size="sm" />
      </div>
      <StatusSwitch className="mt-2.5 w-full" value={job.status} onChange={(status) => onStatus(job.id, { status })} />
    </div>
  );
}

// Dashboard high-risk queue item.
export function RiskItem({ job, onSelect, onStatus }) {
  const score = riskScore(job);
  return (
    <div
      className="card cursor-pointer border-l-[3px] p-3 transition-shadow hover:shadow-[var(--shadow-card)]"
      style={{ borderLeftColor: priorityColor(job.priority) }}
      onClick={() => onSelect(job.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold text-[var(--ink)]">{job.asm || "No assembly"} · {job.cust}</div>
          <div className="mt-0.5 truncate text-[0.72rem] text-[var(--ink-muted)]">{job.type} · {job.alloc} · due {formatDate(job.due)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[0.66rem] font-bold text-[var(--danger)] tnum" title="Risk score">
            <ShieldAlert size={11} />{score}
          </span>
          <StatusChip status={job.status} size="sm" />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityChip priority={job.priority} />
        <span className="chip tnum">{job.hrs}h booked</span>
        <span className="chip tnum">{jobCalendarSpan(job)}d window</span>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <StatusSwitch className="mt-2.5 w-full" value={job.status} onChange={(status) => onStatus(job.id, { status })} />
      </div>
    </div>
  );
}

// Due-dates timeline row.
export function TimelineJob({ job, onSelect, onStatus }) {
  const span = jobCalendarSpan(job);
  const width = Math.min(100, Math.max(16, span * 9));
  return (
    <div className="card grid gap-3 p-3.5 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="font-bold text-[var(--ink)] tnum">{formatDate(job.due, { year: "numeric" })}</div>
        <div className="text-[0.72rem] text-[var(--ink-muted)]">Start {formatDate(job.start)}</div>
      </div>
      <button className="min-w-0 text-left" onClick={() => onSelect(job.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-bold text-[var(--ink)]">{job.asm} · {job.cust}</div>
            <div className="mt-0.5 truncate text-[0.72rem] text-[var(--ink-muted)]">{job.alloc} · {job.type} · {job.hrs}h across {span} day{span === 1 ? "" : "s"}</div>
          </div>
          <StatusChip status={job.status} size="sm" />
        </div>
        <Meter className="mt-2" value={width} />
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} />
      </div>
    </div>
  );
}

// Shared activity feed (notes + audit entries).
export function UpdatesList({ updates, onSelect }) {
  if (!updates.length) return <EmptyState text="No service updates have been recorded yet." />;
  return (
    <div className="grid gap-2">
      {updates.map((u, idx) => (
        <button
          key={`${u.job.id}-${u.at}-${idx}`}
          onClick={() => onSelect(u.job.id)}
          className={cx("card p-3 text-left transition-shadow hover:shadow-[var(--shadow-card)]", u.kind === "audit" && "border-dashed bg-[var(--surface-sunken)]")}
        >
          <div className="flex items-center gap-2 text-[0.68rem] text-[var(--ink-muted)]">
            <strong className="text-[var(--ink-soft)]">{u.by}</strong>
            {u.kind === "audit" && <span className="rounded border border-[var(--line-strong)] px-1 py-px text-[0.56rem] font-bold tracking-wider text-[var(--ink-muted)]">AUDIT</span>}
            <span className="ml-auto">{formatRelative(u.at)}</span>
          </div>
          <div className="mt-1 font-bold text-[var(--ink)]">{u.job.asm} · {u.job.cust}</div>
          <div className="mt-0.5 text-[0.78rem] text-[var(--ink-soft)]">{u.txt}</div>
        </button>
      ))}
    </div>
  );
}
