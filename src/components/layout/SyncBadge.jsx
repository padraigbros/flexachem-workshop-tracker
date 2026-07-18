import { supabase } from "../../lib/supabase";
import { cx } from "../ui/primitives";

const TONES = {
  ok: "#22c55e",
  issue: "#ef4444",
  working: "#f59e0b",
  local: "#94a3b8",
};

export function SyncBadge({ jobsState, staffState }) {
  const states = [jobsState, staffState];
  const hasIssue = states.some((s) => s === "error");
  const isSyncing = states.some((s) => s === "syncing");
  const localOnly = !supabase || states.every((s) => s === "local");
  const label = hasIssue ? "Sync issue" : isSyncing ? "Syncing…" : localOnly ? "Saved locally" : "Data synced";
  const detail = hasIssue ? "Some changes may not be live yet."
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
