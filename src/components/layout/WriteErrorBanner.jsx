import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useWorkshop } from "../../state/WorkshopProvider";
import { Button } from "../ui/primitives";

// Persistent, every-breakpoint banner for a write that did not reach the database.
//
// This replaces relying on SyncBadge alone, which lives in the desktop sidebar footer (hidden
// below `lg`) and inside the mobile account sheet you have to open to see. On 29 Jul 2026 a
// colleague read its "Sync issue — some changes may not be live yet" as "catching up" and kept
// working for hours on two jobs that were never saved. The wording here says what happened.
export function WriteErrorBanner() {
  const { lastWriteError, dismissWriteError, refetch } = useWorkshop();
  if (!lastWriteError) return null;

  return (
    <div
      role="alert"
      className="mx-[var(--spacing-gutter)] mt-3 flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-bg)] px-4 py-3"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--danger)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[0.85rem] font-bold text-[var(--danger)]">Your last change was not saved</div>
        <div className="mt-0.5 text-[0.78rem] leading-snug text-[var(--danger)]">{lastWriteError.message}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Only offer a reload when a retry could actually help. A schema or permission
            problem needs an admin, and a retry button there just wastes the user's time. */}
        {lastWriteError.retryable && (
          <Button type="button" variant="subtle" onClick={() => { refetch?.(); dismissWriteError(); }}>
            <RefreshCw size={14} /> Reload
          </Button>
        )}
        <button
          type="button"
          onClick={dismissWriteError}
          aria-label="Dismiss"
          className="grid h-9 w-9 place-items-center rounded-xl text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
