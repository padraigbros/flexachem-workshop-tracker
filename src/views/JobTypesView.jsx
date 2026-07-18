import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { JOB_TYPES, STATUS_ORDER } from "../lib/constants";
import { Card, PanelHeader, Button, Input, Select, Chip, cx } from "../components/ui/primitives";
import { StatusChip } from "../components/ui/StatusChip";
import { ConfirmDialog } from "../components/ui/overlay";

const TONE = { queued: "var(--status-queued)", active: "var(--status-active)", blocked: "var(--status-blocked)", done: "var(--status-done)" };

// Mini stacked bar showing the status distribution of a job type's jobs.
function StatusBar({ jobs }) {
  if (!jobs.length) return null;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full">
      {STATUS_ORDER.map((s) => {
        const count = jobs.filter((j) => j.status === s).length;
        if (!count) return null;
        const meta = { "Not Started": "queued", "In Progress": "active", "Input Needed": "blocked", Complete: "done" }[s];
        return <span key={s} style={{ width: `${(count / jobs.length) * 100}%`, background: TONE[meta] }} />;
      })}
    </div>
  );
}

export function JobTypesView() {
  const { activeJobs, jobTypes, activeJobTypes, addJobType, updateJobType, deleteJobType, reassignJobTypeJobs } = useWorkshop();
  const [newName, setNewName] = useState("");
  const [moveTargets, setMoveTargets] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const activeCount = jobTypes.filter((t) => t.active).length;
  const inactiveCount = jobTypes.filter((t) => !t.active).length;

  const submit = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addJobType({ name, active: true });
    setNewName("");
  };

  return (
    <Card>
      <PanelHeader
        title="Job type management"
        subtitle="Add new job types, batch-move jobs onto another type, and deactivate or remove unused types."
        action={<div className="flex gap-1.5"><Chip>{activeCount} active</Chip><Chip>{inactiveCount} inactive</Chip></div>}
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New job type name" />
        <Button type="submit" variant="primary" className="gap-1.5"><Plus size={16} />Add job type</Button>
      </form>
      <div className="grid gap-2.5">
        {jobTypes.map((jobType) => {
          const typeJobs = activeJobs.filter((j) => j.type === jobType.name);
          const openJobs = typeJobs.filter((j) => j.status !== "Complete");
          const choices = activeJobTypes.filter((n) => n !== jobType.name);
          const target = moveTargets[jobType.name] || choices[0] || "";
          const isDefault = JOB_TYPES.includes(jobType.name);
          const canRemove = !isDefault && openJobs.length === 0;
          return (
            <div key={jobType.id} className={cx("grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 sm:grid-cols-[minmax(220px,1fr)_auto_minmax(320px,1.1fr)] sm:items-center", !jobType.active && "opacity-70")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <strong className="truncate text-[0.9rem] text-[var(--ink)]">{jobType.name}</strong>
                  <StatusChip status={jobType.active ? "Complete" : "Not Started"} size="sm" />
                </div>
                <div className="mt-1 text-[0.72rem] text-[var(--ink-muted)]">{isDefault ? "Standard type" : "Custom type"} · {openJobs.length} open · {typeJobs.length} total</div>
                <div className="mt-2 max-w-[220px]"><StatusBar jobs={typeJobs} /></div>
              </div>
              <div className="hidden sm:block" />
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Select className="w-auto min-w-[140px]" value={target} onChange={(e) => setMoveTargets((p) => ({ ...p, [jobType.name]: e.target.value }))} disabled={!choices.length}>
                  {choices.length ? choices.map((n) => <option key={n}>{n}</option>) : <option value="">No other type</option>}
                </Select>
                <Button size="sm" variant="ghost" disabled={!typeJobs.length || !target} onClick={() => reassignJobTypeJobs(jobType.name, target)}>Move all</Button>
                <Button size="sm" variant="secondary" onClick={() => updateJobType(jobType.id, { active: !jobType.active })}>{jobType.active ? "Deactivate" : "Reactivate"}</Button>
                {!isDefault && <Button size="sm" variant="danger" disabled={!canRemove} title={openJobs.length ? "Move or complete open jobs first" : undefined} onClick={() => setConfirmDelete(jobType)} className="gap-1"><Trash2 size={13} />Remove</Button>}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Remove "${confirmDelete?.name}"?`}
        message="This job type will be removed from the catalogue. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && deleteJobType(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </Card>
  );
}
