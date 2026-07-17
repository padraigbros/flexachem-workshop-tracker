import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Paperclip, Pencil, Download, ArrowUpRight } from "lucide-react";
import { parseNotes, jobCalendarSpan } from "../../lib/jobs";
import { formatDate, daysUntil, formatRelative } from "../../lib/dates";
import { openJobAttachment } from "../../lib/files";
import { StatusChip, PriorityChip } from "../ui/StatusChip";
import { Avatar } from "../ui/dataviz";
import { IconButton, cx } from "../ui/primitives";

function dueTone(job) {
  if (job.status === "Complete") return "text-[var(--ink-muted)]";
  const d = daysUntil(job.due);
  if (d === null) return "text-[var(--ink-muted)]";
  if (d < 0) return "text-[var(--danger)] font-bold";
  if (d <= 2) return "text-[var(--status-blocked)] font-bold";
  return "text-[var(--ink-muted)]";
}

// A single kanban card. Only the grip handle drags; the body opens the drawer.
export function JobCard({ job, overlay, onSelect, onEdit, onStatus }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, data: { type: "job", status: job.status } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const latest = parseNotes(job.notes)[0];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cx(
        "group card relative cursor-pointer p-3.5 transition-shadow hover:shadow-[var(--shadow-pop)]",
        isDragging && "opacity-30",
        overlay && "w-72 rotate-2 scale-[1.03] shadow-[var(--shadow-float)]",
      )}
      onClick={() => onSelect(job.id)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
          className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-0.5 text-[var(--ink-muted)] opacity-40 transition-opacity hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <StatusChip status={job.status} size="sm" />
            <PriorityChip priority={job.priority} />
          </div>
          <h3 className="mt-2 flex items-center gap-1.5 text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">
            {job.asm || "No assembly"}
            {job.attachment && <Paperclip size={13} className="text-[var(--ink-muted)]" />}
          </h3>
          <div className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">SO {job.so || "TBA"} · {job.cust || "No customer"}</div>
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

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <span className="text-[0.7rem] font-semibold text-[var(--ink-muted)] tnum">{job.hrs}h / {jobCalendarSpan(job)}d</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {job.attachment && (
            <IconButton label={`Download ${job.attachment.name}`} className="h-8 w-8" onClick={() => openJobAttachment(job.attachment, { download: true })}>
              <Download size={14} />
            </IconButton>
          )}
          <IconButton label="Open notes" className="h-8 w-8" onClick={() => onSelect(job.id)}><ArrowUpRight size={14} /></IconButton>
          {onEdit && <IconButton label="Edit job" className="h-8 w-8" onClick={() => onEdit(job)}><Pencil size={14} /></IconButton>}
        </div>
      </div>
    </article>
  );
}
