import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { HOURS_STEP, QUICK_HOURS } from "../../lib/constants";
import { roundHours } from "../../lib/jobs";
import { Modal, ModalHeader } from "../ui/overlay";
import { Button, Field, Input } from "../ui/primitives";
import { StatusChip } from "../ui/StatusChip";

// Prompt shown on every status move so time actually spent gets recorded while the job
// is in front of the person who did the work. Completing a job REQUIRES a figure — that
// transition is the measurement point for the estimate-vs-actual gap on the dashboard.
export function ActualHoursModal({ pending, onCancel, onSkip, onSave }) {
  const job = pending?.job || null;
  const nextStatus = pending?.patch?.status || null;
  const [value, setValue] = useState("");

  useEffect(() => {
    if (job) setValue(job.actualHrs ? String(job.actualHrs) : "");
  }, [job]);

  const estimate = Number(job?.hrs) || 0;
  const hours = roundHours(value);
  const mustLog = nextStatus === "Complete";
  const canSave = !mustLog || hours > 0;

  const variance = useMemo(() => {
    if (!estimate || !hours) return null;
    const delta = hours - estimate;
    return { delta, pct: Math.round((delta / estimate) * 100) };
  }, [estimate, hours]);

  if (!pending || !job) return null;

  const bump = (by) => setValue(String(roundHours(Math.max(0, hours + by))));
  const submit = (e) => {
    e.preventDefault();
    if (canSave) onSave(hours);
  };

  return (
    <Modal open onClose={onCancel} size="sm">
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <ModalHeader
          eyebrow="Status update"
          title="Log actual hours"
          subtitle={`${job.asm || job.cust || "This job"} is moving to ${nextStatus}.`}
          onClose={onCancel}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.11em] text-[var(--ink-muted)]">Estimated</div>
              <div className="code mt-0.5 text-lg font-extrabold text-[var(--ink)] tnum">{estimate || 0}h</div>
            </div>
            <StatusChip status={nextStatus} />
          </div>

          <Field
            label="Actual hours worked"
            className="mt-4"
            hint={mustLog ? "Required before a job can be marked complete." : "Leave as is and press Skip if nothing changed."}
            error={mustLog && !hours && value !== "" ? "Enter more than 0 hours." : undefined}
          >
            <div className="flex items-center gap-2">
              <Button type="button" variant="subtle" size="icon" aria-label="Subtract half an hour" onClick={() => bump(-HOURS_STEP)}><Minus size={16} /></Button>
              <Input
                type="number"
                inputMode="decimal"
                step={HOURS_STEP}
                min="0"
                autoFocus
                aria-label="Actual hours worked"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-center"
                placeholder="0"
              />
              <Button type="button" variant="subtle" size="icon" aria-label="Add half an hour" onClick={() => bump(HOURS_STEP)}><Plus size={16} /></Button>
            </div>
          </Field>

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_HOURS.map((inc) => (
              <Button key={inc} type="button" variant="ghost" size="sm" onClick={() => bump(inc)}>+{inc}h</Button>
            ))}
          </div>

          {variance && (
            <p className="mt-4 text-[0.78rem] font-semibold" style={{ color: variance.delta > 0 ? "var(--danger)" : "var(--status-done)" }}>
              {variance.delta === 0
                ? "Bang on the estimate."
                : `${Math.abs(variance.delta)}h ${variance.delta > 0 ? "over" : "under"} estimate (${variance.pct > 0 ? "+" : ""}${variance.pct}%).`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-6 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="subtle" onClick={onCancel}>Cancel</Button>
          {/* Skipping still applies the status move — only completion is gated on a figure. */}
          {!mustLog && <Button type="button" variant="ghost" onClick={onSkip}>Skip</Button>}
          <Button type="submit" variant="primary" disabled={!canSave}>
            {mustLog ? "Save & complete" : "Save hours"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
