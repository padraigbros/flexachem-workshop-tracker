// Core UI primitives built on the semantic design tokens.
import { forwardRef } from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const BUTTON_BASE = "inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius-field)] transition-[transform,background,box-shadow,color] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none";
const BUTTON_SIZES = { sm: "min-h-[34px] px-3 text-[0.78rem]", md: "min-h-[42px] px-4 text-[0.85rem]", icon: "h-10 w-10 p-0" };

const BUTTON_VARIANTS = {
  primary: "text-white shadow-[0_14px_30px_rgb(242_106_33/0.28)] bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-brand-400))] hover:brightness-105 hover:-translate-y-px",
  secondary: "text-white bg-[var(--ink)] hover:-translate-y-px",
  ghost: "text-[var(--ink)] bg-[var(--surface-card)] border border-[var(--line-strong)] hover:border-[var(--color-brand-500)]",
  subtle: "text-[var(--ink-soft)] bg-[var(--surface-sunken)] hover:bg-[var(--line)]",
  danger: "text-[var(--danger)] bg-[var(--danger-bg)] border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] hover:brightness-95",
};

export const Button = forwardRef(function Button(
  { as: Comp = "button", variant = "ghost", size = "md", className, ...props }, ref,
) {
  return <Comp ref={ref} className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)} {...props} />;
});

export function IconButton({ className, label, ...props }) {
  return (
    <Button size="icon" variant="ghost" aria-label={label} title={label} className={cx("rounded-xl", className)} {...props} />
  );
}

export function Chip({ className, icon: Icon, children, ...props }) {
  return (
    <span className={cx("chip", className)} {...props}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-[0.7rem] text-[var(--ink-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-[0.7rem] font-semibold text-[var(--danger)]">{error}</span>}
    </label>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx("field-input", className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx("field-input", className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={cx("field-input pr-8 cursor-pointer", className)} {...props}>{children}</select>;
});

export function Card({ className, children, ...props }) {
  return <section className={cx("card p-5", className)} {...props}>{children}</section>;
}

export function PanelHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[1.05rem] font-bold tracking-tight text-[var(--ink)]">{title}</h3>
        {subtitle && <p className="mt-1 text-[0.78rem] text-[var(--ink-muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] p-6 text-center">
      <div>
        {Icon && <Icon size={26} className="mx-auto mb-2 text-[var(--ink-muted)]" strokeWidth={1.75} />}
        {title && <p className="text-sm font-semibold text-[var(--ink-soft)]">{title}</p>}
        <p className="mx-auto max-w-xs text-[0.8rem] text-[var(--ink-muted)]">{text}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx("animate-pulse rounded-lg bg-[var(--surface-sunken)]", className)} />;
}

export { cx };
