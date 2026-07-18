import { useEffect, useState } from "react";
import { X, Paperclip, Download, Pencil, Send } from "lucide-react";
import { parseNotes, jobCalendarSpan } from "../../lib/jobs";
import { formatDate, formatDateTime, formatRelative } from "../../lib/dates";
import { formatBytes, openJobAttachment } from "../../lib/files";
import { STATUS_ORDER } from "../../lib/constants";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { StatusChip } from "../ui/StatusChip";
import { Button, IconButton, Select, Textarea, EmptyState, cx } from "../ui/primitives";

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-3">
      <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[var(--ink-muted)]">{label}</span>
      <strong className="mt-1 block text-[0.85rem] text-[var(--ink)]">{value || "—"}</strong>
    </div>
  );
}

export function JobDrawer({ job, user, open, onClose, onEdit, onStatus, onAddNote }) {
  const [text, setText] = useState("");
  const [nextStatus, setNextStatus] = useState(job?.status);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (job) { setNextStatus(job.status); setText(""); }
  }, [job?.id, job?.status]);

  if (!job) return null;
  const allNotes = parseNotes(job.notes);
  const notes = tab === "all" ? allNotes : allNotes.filter((n) => n.kind !== "audit");

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAddNote(job.id, text, nextStatus, user.name || user.email);
    setText("");
  };

  const header = (
    <DrawerHeader>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <StatusChip status={job.status} size="sm" />
          <h2 className="mt-2 truncate text-2xl font-extrabold tracking-tight">{job.asm || "No assembly"}</h2>
          <div className="mt-0.5 truncate text-[0.82rem] text-[#c8daee]">{job.cust} · SO {job.so || "TBA"}</div>
        </div>
        <IconButton label="Close" onClick={onClose} className="border-white/20 bg-white/10 text-white hover:bg-white/20"><X size={18} /></IconButton>
      </div>
    </DrawerHeader>
  );

  const footer = (
    <form onSubmit={submit} className="border-t border-[var(--line)] bg-[var(--surface-card)] p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      <label className="field-label">Add note / status update</label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e); }}
        placeholder="Example: Waiting on customer spec — job stays open until Friday."
        className="min-h-[76px]"
      />
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <Select className="w-auto min-w-[150px]" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
          {STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Button type="submit" variant="primary" disabled={!text.trim()} className="gap-1.5"><Send size={15} />Post update</Button>
      </div>
    </form>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header} footer={footer}>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Detail label="Staff" value={job.alloc} />
          <Detail label="Business unit" value={job.bus} />
          <Detail label="Work type" value={job.type} />
          <Detail label="Priority" value={job.priority} />
          <Detail label="Hours booked" value={`${job.hrs}h`} />
          <Detail label="Calendar window" value={`${jobCalendarSpan(job)} day${jobCalendarSpan(job) === 1 ? "" : "s"}`} />
          <Detail label="Start" value={formatDate(job.start, { year: "numeric" })} />
          <Detail label="Due" value={formatDate(job.due, { year: "numeric" })} />
        </div>

        {job.attachment && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-sunken)] p-3">
            <Paperclip size={18} className="text-[var(--ink-muted)]" />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[0.82rem] text-[var(--ink)]">{job.attachment.name}</strong>
              <span className="text-[0.7rem] text-[var(--ink-muted)]">{formatBytes(job.attachment.size)}{job.attachment.by ? ` · ${job.attachment.by}` : ""}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => openJobAttachment(job.attachment)}>View</Button>
            <Button size="sm" variant="secondary" onClick={() => openJobAttachment(job.attachment, { download: true })} className="gap-1"><Download size={14} />Get</Button>
          </div>
        )}

        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-[var(--ink)]">Activity &amp; audit trail</h3>
              <p className="text-[0.72rem] text-[var(--ink-muted)]">Notes and automatic change history, newest first.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-[var(--surface-sunken)] p-0.5">
                {["all", "notes"].map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-2.5 py-1 text-[0.7rem] font-semibold capitalize transition-colors", tab === t ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-muted)]")}>
                    {t === "all" ? "All" : "Notes"}
                  </button>
                ))}
              </div>
              {onEdit && <Button size="sm" variant="ghost" onClick={onEdit} className="gap-1"><Pencil size={13} />Edit</Button>}
            </div>
          </div>
          <div className="grid gap-2">
            {notes.length ? notes.map((note, i) => (
              note.kind === "audit" ? (
                <div key={`${note.at}-${i}`} className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3 py-2">
                  <div className="flex items-center gap-2 text-[0.66rem] text-[var(--ink-muted)]">
                    <strong className="text-[var(--ink-soft)]">{note.by}</strong>
                    <span className="rounded border border-[var(--line-strong)] px-1 py-px text-[0.56rem] font-bold tracking-wider">AUDIT</span>
                    <span className="ml-auto">{formatRelative(note.at)}</span>
                  </div>
                  <div className="mt-1 text-[0.78rem] text-[var(--ink-soft)]">{note.txt}</div>
                </div>
              ) : (
                <div key={`${note.at}-${i}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-3">
                  <div className="flex items-center justify-between gap-2 text-[0.66rem] text-[var(--ink-muted)]">
                    <strong className="text-[var(--ink-soft)]">{note.by}</strong>
                    <span title={formatDateTime(note.at)}>{formatRelative(note.at)}</span>
                  </div>
                  <div className="mt-1 text-[0.85rem] text-[var(--ink)]">{note.txt}</div>
                  {note.status && <div className="mt-2"><StatusChip status={note.status} size="sm" /></div>}
                </div>
              )
            )) : <EmptyState text="No activity yet. Add the first workshop note below." />}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
