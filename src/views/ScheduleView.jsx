import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useWorkshop } from "../state/WorkshopProvider";
import { useAuthCtx } from "../state/AuthProvider";
import { useJobDrawer } from "../state/useJobDrawer";
import { useShell } from "../components/layout/AppShell";
import { STATUS_ORDER, STATUS_META } from "../lib/constants";
import { impact } from "../lib/native";
import { markDragEnd } from "../lib/dnd";
import { JobCard } from "../components/jobs/JobCard";
import { StatusChip } from "../components/ui/StatusChip";
import { EmptyState } from "../components/ui/primitives";

const TONE_COLOR = {
  queued: "var(--status-queued)", active: "var(--status-active)", blocked: "var(--status-blocked)", done: "var(--status-done)",
};

// Drop resolves to whatever the pointer is actually inside. closestCorners (the old
// default) biases toward SHORT columns — its corner distances penalise tall columns —
// so a drop centred over "In Progress" could land one column over. Fall back to
// closestCorners only when the pointer is outside every droppable (e.g. keyboard).
function collisionDetection(args) {
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
}

function Column({ status, jobs, onSelect, onEdit, onStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}`, data: { type: "column", status } });
  const meta = STATUS_META[status];
  return (
    <section
      ref={setNodeRef}
      className={`relative flex max-h-[calc(100dvh-13rem)] snap-center flex-col overflow-hidden rounded-[1.4rem] border p-3 pt-4 transition-colors sm:max-h-[calc(100dvh-11rem)] ${isOver ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/6" : "border-[var(--line)] bg-[var(--surface-sunken)]/60"}`}
    >
      {/* Luminous status hairline across the column top */}
      <span
        aria-hidden="true"
        className="glow-current absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${TONE_COLOR[meta.tone]}, transparent 85%)`, color: TONE_COLOR[meta.tone] }}
      />
      {/* Header stays put while the card list below scrolls (Trello-style). */}
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="glow-current h-2.5 w-2.5 rounded-full" style={{ background: TONE_COLOR[meta.tone], color: TONE_COLOR[meta.tone] }} />
          <span className="text-[0.85rem] font-bold text-[var(--ink)]">{meta.label}</span>
        </div>
        <span className="code rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[0.7rem] font-bold text-[var(--ink-muted)]">{jobs.length}</span>
      </div>
      <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
        <div className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto pr-0.5">
          {jobs.length
            ? jobs.map((job) => <JobCard key={job.id} job={job} onSelect={onSelect} onEdit={onEdit} onStatus={onStatus} />)
            : <EmptyState text={`Drop jobs here to mark them ${status.toLowerCase()}.`} />}
        </div>
      </SortableContext>
    </section>
  );
}

export function ScheduleView() {
  const { filteredJobs, auditPatch, getJob } = useWorkshop();
  const { isAdmin } = useAuthCtx();
  const { openJob } = useJobDrawer();
  const shell = useShell();
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    markDragEnd();
    if (!over) return;
    const job = getJob(active.id);
    if (!job) return;
    const targetStatus = over.data?.current?.status || (String(over.id).startsWith("status:") ? String(over.id).replace("status:", "") : null);
    if (targetStatus && targetStatus !== job.status) {
      impact("medium");
      await auditPatch(job.id, { status: targetStatus });
    }
  };

  const activeJob = activeId ? getJob(activeId) : null;
  const columns = STATUS_ORDER.map((status) => ({ status, jobs: filteredJobs.filter((j) => j.status === status) }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); markDragEnd(); }}
    >
      <div className="-mx-[var(--spacing-gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--spacing-gutter)] pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {columns.map((col) => (
          <div key={col.status} className="w-[88vw] max-w-[21rem] shrink-0 sm:w-auto sm:max-w-none">
            <Column
              status={col.status}
              jobs={col.jobs}
              onSelect={openJob}
              onEdit={isAdmin ? shell.editJob : null}
              onStatus={auditPatch}
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeJob ? <JobCard job={activeJob} overlay onSelect={() => {}} onEdit={null} onStatus={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
