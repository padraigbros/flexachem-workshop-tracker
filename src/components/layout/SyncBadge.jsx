import { supabase } from "../../lib/supabase";
import { cx } from "../ui/primitives";

const TONES = {
  ok: "#22c55e",
  issue: "#ef4444",
  working: "#f59e0b",
  local: "#94a3b8",
};

// All four sync states, not just jobs+staff — job types and customers used to set an error
// state that was never rendered anywhere, so those writes failed completely invisibly.
//
// The copy is deliberately blunt. "Sync issue / some changes may not be live yet" reads as a
// delay; on 29 Jul 2026 it was actually two jobs that never reached the database.
export function SyncBadge({ jobsState, staffState, jobTypeState, customerState }) {
  const states = [jobsState, staffState, jobTypeState, customerState].filter(Boolean);
  const hasIssue = states.some((s) => s === "error");
  const isSyncing = states.some((s) => s === "syncing");
  const localOnly = !supabase || states.every((s) => s === "local");
  const label = hasIssue ? "Not saved" : isSyncing ? "Syncing…" : localOnly ? "Saved locally" : "Data synced";
  const detail = hasIssue ? "Some changes did not reach the server."
    : isSyncing ? "Checking the latest workshop data."
      : localOnly ? "Changes are saved on this device."
        : "Latest workshop data is available.";
  const tone = hasIssue ? "issue" : isSyncing ? "working" : localOnly ? "local" : "ok";

  return (
    <div className="flex items-center gap-3">
      <span className={cx("h-3 w-3 shrink-0 rounded-full", isSyncing && "animate-pulse")} style={{ background: TONES[tone], boxShadow: `0 0 0 6px ${TONES[tone]}26` }} />
      <div>
        <div className="text-[0.82rem] font-bold text-white">{label}</div>
        <div className="mt-0.5 text-[0.66rem] leading-snug text-[#aec1d8]">{detail}</div>
      </div>
    </div>
  );
}
