import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Button, IconButton, cx } from "./primitives";

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Backdrop({ onClick }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] bg-[rgb(6_16_29/0.45)] backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
    />
  );
}

const SPRING = { type: "spring", stiffness: 400, damping: 34 };

// Right-side drawer on desktop; bottom-sheet with drag-to-dismiss on mobile.
export function Drawer({ open, onClose, children, header, footer, mobileSheet = true, desktopCentered = false }) {
  useEscape(onClose);
  const reduce = useReducedMotion();
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClick={onClose} />
          <motion.aside
            className={cx(
              "fixed z-[90] flex flex-col overflow-hidden bg-[var(--surface-page)] shadow-[var(--shadow-float)]",
              desktopCentered
                ? "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2.5rem)] sm:w-[min(560px,calc(100vw-2rem))] sm:rounded-[1.6rem]"
                : "sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[min(520px,calc(100vw-2rem))] sm:rounded-[1.6rem]",
              mobileSheet
                ? "inset-x-0 bottom-0 top-[12vh] rounded-t-[1.6rem]"
                : "inset-0 pt-safe sm:pt-0",
            )}
            initial={reduce ? { opacity: 0 } : desktopCentered ? { opacity: 0, scale: 0.96, y: 12 } : { x: "8%", opacity: 0, y: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : desktopCentered ? { opacity: 0, scale: 0.97, y: 8 } : { x: "8%", opacity: 0 }}
            transition={SPRING}
            drag={mobileSheet ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120) onClose?.(); }}
          >
            {mobileSheet && <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[var(--line-strong)] sm:hidden" />}
            {header}
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DrawerHeader({ children }) {
  return (
    <div className="relative bg-[linear-gradient(135deg,var(--color-navy-900),var(--color-navy-700))] px-5 py-5 text-white">
      {children}
    </div>
  );
}

// Centered modal (scale-fade), full-screen on mobile.
export function Modal({ open, onClose, children, className, size = "lg" }) {
  useEscape(onClose);
  const reduce = useReducedMotion();
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center sm:p-5">
          <Backdrop onClick={onClose} />
          <motion.div
            className={cx(
              "relative z-[96] flex max-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--surface-page)] shadow-[var(--shadow-float)] pt-safe sm:pt-0",
              "sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[1.6rem]",
              widths[size], className,
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ModalHeader({ eyebrow, title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-card)] px-6 py-5">
      <div className="min-w-0">
        {eyebrow && <div className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-[var(--color-brand-500)]">{eyebrow}</div>}
        <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        {subtitle && <p className="mt-1 text-[0.78rem] text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
      <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
    </div>
  );
}

// Promise-free confirm dialog controlled by parent state.
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "danger", onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-6">
        <h2 className="text-lg font-bold text-[var(--ink)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={() => { onConfirm?.(); onClose?.(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
