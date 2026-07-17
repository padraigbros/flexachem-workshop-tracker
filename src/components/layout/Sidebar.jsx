import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useAuthCtx } from "../../state/AuthProvider";
import { useWorkshop } from "../../state/WorkshopProvider";
import { SyncBadge } from "./SyncBadge";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "../ui/dataviz";
import { cx } from "../ui/primitives";

// Desktop sidebar (hidden < lg — the mobile tab bar takes over).
export function Sidebar() {
  const { user, isAdmin, logout } = useAuthCtx();
  const { syncState, staffSyncState } = useWorkshop();
  const items = NAV_ITEMS.filter((item) => !item.admin || isAdmin);

  return (
    <aside className="relative hidden h-full flex-col gap-4 overflow-hidden bg-[linear-gradient(165deg,var(--color-navy-950),var(--color-navy-800)_55%,var(--color-navy-700))] px-4 py-5 text-white lg:flex">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgb(242_106_33/0.20)] blur-md" />

      <div className="relative flex items-center gap-3 border-b border-white/10 px-2 pb-4">
        <BrandMark />
        <div>
          <div className="text-sm font-black uppercase tracking-[0.12em]">Flexachem</div>
          <div className="mt-0.5 text-[0.7rem] text-[#b7c8dc]">Workshop Control Tower</div>
        </div>
      </div>

      <nav className="relative grid gap-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx(
              "group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-[#d9e7f7] transition-all hover:translate-x-0.5 hover:bg-white/[0.08]",
              isActive && "border-white/15 bg-white/[0.14] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cx(
                  "grid h-8 w-8 place-items-center rounded-xl bg-white/[0.09] transition-colors",
                  isActive && "bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-300))]",
                )}>
                  <item.icon size={17} strokeWidth={2.25} />
                </span>
                <span className="grid gap-0.5">
                  <strong className="text-[0.82rem] font-semibold">{item.label}</strong>
                  <span className="text-[0.66rem] text-[#9fb4cd]">{item.hint}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-auto grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <SyncBadge jobsState={syncState} staffState={staffSyncState} />
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-black/20 p-3">
          <Avatar name={user?.name || user?.email} size={36} />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[0.78rem]">{user?.name || "Workshop user"}</strong>
            <span className="block truncate text-[0.66rem] text-[#a9bad0]">{user?.email}</span>
            <span className={cx(
              "mt-1 inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
              isAdmin ? "bg-[#e3eefc] text-[#1c4d8f]" : "bg-white/15 text-[#cbd8e8]",
            )}>{isAdmin ? "Admin" : "Staff"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <ThemeToggle className="h-8 w-8 border-white/15 bg-white/10 text-white" />
            <button onClick={logout} aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function BrandMark({ size = 46 }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl font-black text-white shadow-[0_18px_40px_rgb(242_106_33/0.34)]"
      style={{ width: size, height: size, fontSize: size * 0.5, background: "linear-gradient(135deg, var(--color-brand-500), var(--color-brand-300))" }}
    >
      F
    </div>
  );
}
