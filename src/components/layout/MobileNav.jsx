import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { NAV_ITEMS } from "./nav";
import { useAuthCtx } from "../../state/AuthProvider";
import { cx } from "../ui/primitives";

// Glassy bottom tab bar (mobile only). Active tab gets a shared-layout pill.
export function MobileNav() {
  const { isAdmin } = useAuthCtx();
  // Keep the bar readable: primary items plus admin ones, capped to 5.
  const items = NAV_ITEMS.filter((item) => !item.admin || isAdmin).slice(0, 5);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] flex items-stretch gap-1 border-t border-[var(--line)] bg-[var(--surface-card)]/85 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))", boxShadow: "0 -12px 40px rgb(6 24 44 / 0.14)" }}
    >
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5">
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-2xl bg-[var(--color-brand-500)]/12"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <item.icon
                size={21}
                strokeWidth={isActive ? 2.5 : 2}
                className={cx("relative z-10 transition-colors", isActive ? "text-[var(--color-brand-500)]" : "text-[var(--ink-muted)]")}
              />
              <span className={cx("relative z-10 text-[0.6rem] font-bold", isActive ? "text-[var(--color-brand-600)]" : "text-[var(--ink-muted)]")}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
