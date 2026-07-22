import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWorkshop } from "./WorkshopProvider";
import { ActualHoursModal } from "../components/jobs/ActualHoursModal";

const StatusPromptContext = createContext(null);

// Single funnel for status moves. Every entry point — board drag-drop, the segmented
// StatusSwitch on cards and list rows, and the job drawer — calls requestStatusChange
// instead of auditPatch directly, so the actual-hours prompt is unavoidable and behaves
// identically on the web app and the Capacitor native build.
export function StatusPromptProvider({ children }) {
  const { getJob, auditPatch } = useWorkshop();
  const [pending, setPending] = useState(null);

  const requestStatusChange = useCallback((id, patch, actionLabel) => {
    const job = getJob(id);
    const next = patch?.status;
    // Non-status edits and no-op moves fall straight through — the prompt is only about
    // capturing time against a real transition.
    if (!job || !next || next === job.status) return auditPatch(id, patch, actionLabel);
    setPending({ job, patch, actionLabel });
    return Promise.resolve();
  }, [getJob, auditPatch]);

  const close = useCallback(() => setPending(null), []);

  // Skip applies the move untouched; save folds the logged figure into the same patch so
  // the audit trail records the status change and the hours as one entry.
  const applySkip = useCallback(() => {
    if (!pending) return;
    const { job, patch, actionLabel } = pending;
    setPending(null);
    auditPatch(job.id, patch, actionLabel);
  }, [pending, auditPatch]);

  const applySave = useCallback((actualHrs) => {
    if (!pending) return;
    const { job, patch, actionLabel } = pending;
    setPending(null);
    auditPatch(job.id, { ...patch, actualHrs }, actionLabel);
  }, [pending, auditPatch]);

  const value = useMemo(() => ({ requestStatusChange }), [requestStatusChange]);

  return (
    <StatusPromptContext.Provider value={value}>
      {children}
      <ActualHoursModal pending={pending} onCancel={close} onSkip={applySkip} onSave={applySave} />
    </StatusPromptContext.Provider>
  );
}

export function useStatusPrompt() {
  const ctx = useContext(StatusPromptContext);
  if (!ctx) throw new Error("useStatusPrompt must be used within StatusPromptProvider");
  return ctx;
}
