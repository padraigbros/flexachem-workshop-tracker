import { useMemo, useState } from "react";
import { ArrowUpRight, Pencil, Trash2, Paperclip, ArrowUpDown, RotateCcw } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { useShell } from "../components/layout/AppShell";
import { parseNotes, jobCalendarSpan } from "../lib/jobs";
import { formatDate, formatDateTime, parseISODate } from "../lib/dates";
import { Card, PanelHeader, Button, IconButton, EmptyState, cx } from "../components/ui/primitives";
import { Avatar } from "../components/ui/dataviz";
import { StatusChip, StatusSwitch } from "../components/ui/StatusChip";

const COLUMNS = [
  { key: "asm", label: "Assembly" },
  { key: "cust", label: "Customer / SO" },
  { key: "bus", label: "BU" },
  { key: "alloc", label: "Staff" },
  { key: "due", label: "Work window" },
  { key: "hrs", label: "Hours" },
  { key: "status", label: "Status" },
];

export function MasterListView() {
  const { filteredJobs: jobs, deletedJobs, auditPatch } = useWorkshop();
  const { openJob } = useJobDrawer();
  const shell = useShell();
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [showArchive, setShowArchive] = useState(false);

  const sorted = useMemo(() => {
    if (!sort.key) return jobs;
    const val = (j) => {
      if (sort.key === "due") return parseISODate(j.due)?.getTime() || 0;
      if (sort.key === "hrs") return Number(j.hrs) || 0;
      return String(j[sort.key] || "").toLowerCase();
    };
    return [...jobs].sort((a, b) => {
      const va = val(a), vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [jobs, sort]);

  const toggleSort = (key) => setSort((prev) => ({ key, dir: prev.key === key ? -prev.dir : 1 }));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    <button className="inline-flex items-center gap-1 hover:text-[var(--ink)]" onClick={() => toggleSort(col.key)}>
                      {col.label}<ArrowUpDown size={11} className={cx(sort.key === col.key ? "text-[var(--color-brand-500)]" : "opacity-40")} />
                    </button>
                  </th>
                ))}
                <th className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">Updates</th>
                <th className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => {
                const notes = parseNotes(job.notes);
                return (
                  <tr key={job.id} className="border-b border-[var(--line)] transition-colors hover:bg-[var(--surface-sunken)]/50">
                    <td className="px-4 py-3 align-top">
                      <button className="text-left" onClick={() => openJob(job.id)}>
                        <div className="flex items-center gap-1 font-bold text-[var(--ink)]">{job.asm || "No assembly"}{job.attachment && <Paperclip size={12} className="text-[var(--ink-muted)]" />}</div>
                        <div className="text-[0.72rem] text-[var(--ink-muted)]">{job.type}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top"><strong className="text-[var(--ink)]">{job.cust}</strong><div className="text-[0.72rem] text-[var(--ink-muted)]">SO {job.so || "TBA"}</div></td>
                    <td className="px-4 py-3 align-top text-[0.82rem] text-[var(--ink-soft)]">{job.bus}</td>
                    <td className="px-4 py-3 align-top"><span className="inline-flex items-center gap-1.5 text-[0.82rem] text-[var(--ink-soft)]"><Avatar name={job.alloc} size={20} />{job.alloc}</span></td>
                    <td className="px-4 py-3 align-top text-[0.82rem] text-[var(--ink-soft)] tnum">{formatDate(job.start)} → {formatDate(job.due)}<div className="text-[0.7rem] text-[var(--ink-muted)]">{jobCalendarSpan(job)} days</div></td>
                    <td className="px-4 py-3 align-top text-[0.82rem] text-[var(--ink-soft)] tnum">{job.hrs}h<div className="text-[0.7rem] text-[var(--ink-muted)]">Act {job.actualHrs || 0}h</div></td>
                    <td className="px-4 py-3 align-top"><StatusChip status={job.status} size="sm" /><StatusSwitch className="mt-2" value={job.status} onChange={(status) => auditPatch(job.id, { status })} /></td>
                    <td className="px-4 py-3 align-top">{notes[0] ? <div className="max-w-[200px]"><strong className="text-[0.78rem] text-[var(--ink)]">{notes[0].by}</strong><div className="truncate text-[0.72rem] text-[var(--ink-muted)]">{notes[0].txt}</div></div> : <span className="text-[0.72rem] text-[var(--ink-muted)]">No notes</span>}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1">
                        <IconButton label="Open" className="h-8 w-8" onClick={() => openJob(job.id)}><ArrowUpRight size={14} /></IconButton>
                        <IconButton label="Edit" className="h-8 w-8" onClick={() => shell.editJob(job)}><Pencil size={14} /></IconButton>
                        <IconButton label="Delete" className="h-8 w-8" onClick={() => shell.askDelete(job)}><Trash2 size={14} /></IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!sorted.length && <div className="p-6"><EmptyState text="No jobs match the current filter." /></div>}
        </div>
      </Card>

      {deletedJobs.length > 0 && (
        <Card>
          <PanelHeader
            title="Archive"
            subtitle="Deleted jobs are kept with full history — restore to bring one back to the register."
            action={<Button size="sm" variant="ghost" onClick={() => setShowArchive((v) => !v)}>{showArchive ? "Hide" : `Show (${deletedJobs.length})`}</Button>}
          />
          {showArchive && (
            <div className="grid gap-2.5">
              {deletedJobs.map((job) => {
                const audit = parseNotes(job.notes).find((n) => n.kind === "audit" && /deleted/i.test(n.txt));
                return (
                  <div key={job.id} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 opacity-80">
                    <Avatar name={job.asm || "?"} size={38} />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[0.88rem] text-[var(--ink)]">{job.asm || "No assembly"} · {job.cust}</strong>
                      <span className="text-[0.72rem] text-[var(--ink-muted)]">{job.type} · {audit ? `Deleted by ${audit.by} · ${formatDateTime(audit.at)}` : "Deleted"}</span>
                    </div>
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => auditPatch(job.id, { deleted: false }, "Job restored")}><RotateCcw size={13} />Restore</Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
