import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { cx } from "../ui/primitives";

export function ThemeToggle({ className }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cx(
        "grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface-card)] text-[var(--ink-soft)] transition-colors hover:text-[var(--color-brand-500)]",
        className,
      )}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
