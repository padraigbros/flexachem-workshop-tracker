import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip, Pencil, Download, ArrowUpRight } from "lucide-react";
import { parseNotes, jobCalendarSpan } from "../../lib/jobs";
import { formatDate, daysUntil, formatRelative } from "../../lib/dates";
import { openJobAttachment } from "../../lib/files";
import { wasRecentDrag } from "../../lib/dnd";
import { StatusChip, PriorityChip, StatusSwitch, statusTone } from "../ui/StatusChip";
import { Avatar } from "../ui/dataviz";
import { IconButton, cx } from "../ui/primitives";

const EDGE_COLOR = {
  queued: "var(--status-queued)", active: "var(--status-active)", blocked: "var(--status-blocked)", done: "var(--status-done)",
};

function dueTone(job) {
  if (job.status === "Complete") return "text-[var(--ink-muted)]";
  const d = daysUntil(job.due);
  if (d === null) return "text-[var(--ink-muted)]";
  if (d < 0) return "text-[var(--danger)] font-bold";
  if (d <= 2) return "text-[var(--status-blocked)] font-bold";
  return "text-[var(--ink-muted)]";
}

// A single kanban card. The whole card is draggable: PointerSensor (8px) drives mouse
// drags on desktop; TouchSensor (200ms hold) drives touch drags on mobile without
// blocking scroll. A plain click opens the drawer; double-click edits (admins).
export function JobCard({ job, overlay, onSelect, onEdit, onStatus }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, data: { type: "job", status: job.status } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const latest = parseNotes(job.notes)[0];

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cx(
        "group card relative cursor-pointer p-3.5 transition-shadow hover:shadow-[var(--shadow-pop)]",
        isDragging && "opacity-30",
        overlay && "w-[min(18rem,calc(100vw-2rem))] rotate-2 scale-[1.03] cursor-grabbing shadow-[var(--shadow-float)]",
      )}
      onClick={() => { if (!wasRecentDrag()) onSelect(job.id); }}
      onDoubleClick={() => { if (onEdit) onEdit(job); }}
    >
      {/* Status-coloured luminous edge */}
      <span
        aria-hidden="true"
        className="glow-current absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full"
        style={{ background: EDGE_COLOR[statusTone(job.status)], color: EDGE_COLOR[statusTone(job.status)] }}
      />
      <div className="flex items-start gap-2">
        {/* Drag affordance (visual only — the whole card drags). */}
        <span aria-hidden="true" className="-ml-1 mt-0.5 shrink-0 text-[var(--ink-muted)] opacity-40 transition-opacity group-hover:opacity-100">
          <GripVertical size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <StatusChip status={job.status} size="sm" />
            <PriorityChip priority={job.priority} />
          </div>
          <h3 className="code mt-2 flex min-w-0 items-center gap-1.5 text-[1rem] font-bold text-[var(--ink)]">
            <span className="truncate">{job.asm || "No assembly"}</span>
            {job.attachment && <Paperclip size={13} className="shrink-0 text-[var(--ink-muted)]" />}
          </h3>
          <div className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]"><span className="code">SO {job.so || "TBA"}</span> · {job.cust || "No customer"}</div>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-[0.78rem] leading-snug text-[var(--ink-soft)]">{job.type} · {job.details || "No extra details recorded."}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="chip inline-flex items-center gap-1"><Avatar name={job.alloc} size={16} />{job.alloc || "Unassigned"}</span>
        <span className="chip">{job.bus}</span>
        <span className={cx("chip tnum", dueTone(job))}>Due {formatDate(job.due)}</span>
      </div>

      {latest && (
        <div className="mt-3 rounded-xl bg-[var(--surface-sunken)] p-2.5">
          <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--ink-muted)]">
            <strong className="text-[var(--ink-soft)]">{latest.by}</strong>
            <span>{formatRelative(latest.at)}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-[0.75rem] text-[var(--ink-soft)]">{latest.txt}</div>
        </div>
      )}

      {/* Tap-to-change status — the reliable way to move a job on touch (drag is a bonus). */}
      {!overlay && (
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch className="mt-3 w-full" value={job.status} onChange={(status) => onStatus(job.id, { status })} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <span className="code text-[0.7rem] font-semibold text-[var(--ink-muted)]">{job.hrs}h / {jobCalendarSpan(job)}d</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {job.attachment && (
            <IconButton label={`Download ${job.attachment.name}`} className="h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10" onClick={() => openJobAttachment(job.attachment, { download: true })}>
              <Download size={14} />
            </IconButton>
          )}
          <IconButton label="Open notes" className="h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10" onClick={() => onSelect(job.id)}><ArrowUpRight size={14} /></IconButton>
          {onEdit && <IconButton label="Edit job" className="h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10" onClick={() => onEdit(job)}><Pencil size={14} /></IconButton>}
        </div>
      </div>
    </article>
  );
}
