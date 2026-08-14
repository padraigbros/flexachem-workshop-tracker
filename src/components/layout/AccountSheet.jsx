import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuthCtx } from "../../state/AuthProvider";
import { useWorkshop } from "../../state/WorkshopProvider";
import { Avatar } from "../ui/dataviz";
import { Button, cx } from "../ui/primitives";
import { ACCOUNT_ROLE_META } from "../../lib/constants";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { SyncBadge } from "./SyncBadge";

// Mobile-only account menu. The desktop sidebar already carries the identity card and
// sign-out, but below lg there was no way to sign out at all — this fills that gap.
export function AccountSheet() {
  const { user, isAdmin, logout } = useAuthCtx();
  const { syncState, staffSyncState, jobTypeSyncState, customerSyncState } = useWorkshop();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account"
        title="Account"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl lg:hidden"
      >
        <Avatar name={user?.name || user?.email} size={34} />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        header={
          <DrawerHeader>
            <div className="flex items-center gap-3">
              <Avatar name={user?.name || user?.email} size={44} />
              <div className="min-w-0">
                <strong className="block truncate text-base">{user?.name || "Workshop user"}</strong>
                <span className="block truncate text-[0.72rem] text-[#b7c8dc]">{user?.email}</span>
                <span className={cx(
                  "mt-1 inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
                  isAdmin ? "bg-[#e3eefc] text-[#1c4d8f]" : "bg-white/15 text-[#cbd8e8]",
                )}>{ACCOUNT_ROLE_META[user?.role]?.label || "Staff"}</span>
              </div>
            </div>
          </DrawerHeader>
        }
      >
        <div className="grid gap-4 p-5">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3">
            <SyncBadge jobsState={syncState} staffState={staffSyncState} jobTypeState={jobTypeSyncState} customerState={customerSyncState} />
          </div>
          <Button variant="danger" size="md" onClick={logout} className="gap-2">
            <LogOut size={16} />Sign out
          </Button>
        </div>
      </Drawer>
    </>
  );
}
