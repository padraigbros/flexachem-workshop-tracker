import { useEffect } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { Search, Plus, Moon, LogOut, CornerDownLeft } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useAuthCtx } from "../../state/AuthProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { useTheme } from "../../state/ThemeProvider";
import { StatusChip } from "../ui/StatusChip";
import "./command-palette.css";

export function CommandPalette({ open, onOpenChange, onNewJob }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { activeJobs } = useWorkshop();
  const { isAdmin, logout } = useAuthCtx();
  const { openJob } = useJobDrawer();
  const { toggle } = useTheme();
  const items = NAV_ITEMS.filter((item) => !item.admin || isAdmin);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn) => { onOpenChange(false); fn(); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-[rgb(6_16_29/0.5)] backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] shadow-[var(--shadow-float)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Command label="Command palette" className="flex flex-col" loop>
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
                <Search size={17} className="text-[var(--ink-muted)]" />
                <Command.Input autoFocus placeholder="Search jobs, navigate, or run an action…" className="h-12 flex-1 bg-transparent text-[0.9rem] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]" />
                <kbd className="hidden items-center gap-1 rounded border border-[var(--line)] px-1.5 py-0.5 text-[0.6rem] text-[var(--ink-muted)] sm:inline-flex"><CornerDownLeft size={10} />to select</kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-[var(--ink-muted)]">No results found.</Command.Empty>

                <Command.Group heading="Jobs">
                  {activeJobs.slice(0, 40).map((job) => (
                    <Command.Item key={job.id} value={`job ${job.asm} ${job.so} ${job.cust} ${job.alloc}`} onSelect={() => run(() => openJob(job.id))} className="cmd-item">
                      <StatusChip status={job.status} size="sm" />
                      <span className="flex-1 truncate"><strong>{job.asm || "No assembly"}</strong> · {job.cust}</span>
                      <span className="text-[0.72rem] text-[var(--ink-muted)]">{job.alloc}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Go to">
                  {items.map((item) => (
                    <Command.Item key={item.to} value={`go ${item.label}`} onSelect={() => run(() => navigate(item.to))} className="cmd-item">
                      <item.icon size={16} className="text-[var(--ink-muted)]" />
                      <span className="flex-1">{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Actions">
                  {isAdmin && (
                    <Command.Item value="action new job create" onSelect={() => run(onNewJob)} className="cmd-item">
                      <Plus size={16} className="text-[var(--ink-muted)]" /><span className="flex-1">Log new job</span>
                    </Command.Item>
                  )}
                  <Command.Item value="action toggle theme dark light" onSelect={() => run(toggle)} className="cmd-item">
                    <Moon size={16} className="text-[var(--ink-muted)]" /><span className="flex-1">Toggle dark mode</span>
                  </Command.Item>
                  <Command.Item value="action sign out logout" onSelect={() => run(logout)} className="cmd-item">
                    <LogOut size={16} className="text-[var(--ink-muted)]" /><span className="flex-1">Sign out</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
