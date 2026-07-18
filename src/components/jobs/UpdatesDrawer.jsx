import { useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { UpdatesList } from "./JobBits";
import { Button, IconButton, cx } from "../ui/primitives";

export function UpdatesDrawer({ updates, open, onClose, onSelect }) {
  const [tab, setTab] = useState("all");
  const shown = tab === "all" ? updates : updates.filter((u) => u.kind !== "audit");

  const header = (
    <DrawerHeader>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[var(--color-brand-300)]">Complete audit trail</div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Recent updates</h2>
          <div className="mt-0.5 text-[0.82rem] text-[#c8daee]">Notes and automatic change history across all jobs.</div>
        </div>
        <IconButton label="Close" onClick={onClose} className="border-white/20 bg-white/10 text-white hover:bg-white/20"><X size={18} /></IconButton>
      </div>
    </DrawerHeader>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header}>
      <div className="p-4">
        <div className="mb-3 inline-flex rounded-lg bg-[var(--surface-sunken)] p-0.5">
          {["all", "notes"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1 text-[0.72rem] font-semibold transition-colors", tab === t ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-muted)]")}>
              {t === "all" ? "All activity" : "Notes only"}
            </button>
          ))}
        </div>
        <UpdatesList updates={shown} onSelect={onSelect} />
      </div>
    </Drawer>
  );
}
