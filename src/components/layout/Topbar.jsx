import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, SlidersHorizontal, Plus, History, RotateCcw, Command } from "lucide-react";
import { PAGE_META } from "./nav";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useAuthCtx } from "../../state/AuthProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { useIsDesktop } from "../../lib/useMediaQuery";
import { Button } from "../ui/primitives";
import { ThemeToggle } from "./ThemeToggle";
import { AccountSheet } from "./AccountSheet";
import { NotificationsBell } from "./NotificationsBell";
import { FilterControls, FilterSheet } from "./FilterSheet";

export function Topbar({ onNewJob, onOpenPalette }) {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { isAdmin } = useAuthCtx();
  const { filters, updateFilter, resetFilters } = useWorkshop();
  const { openUpdates } = useJobDrawer();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [title, subtitle] = PAGE_META[location.pathname] || PAGE_META["/"];

  const activeFilterCount = [
    filters.search.trim(), filters.employee !== "All", filters.bus !== "All",
    filters.status !== "All", filters.horizon !== "All",
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-[60] border-b border-[var(--line)] bg-[var(--surface-page)]/80 px-[var(--spacing-gutter)] pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:pb-4 sm:pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="hidden text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-[var(--color-brand-500)] sm:block">Flexachem workshop</div>
          <h1 className="text-[length:var(--text-title)] font-bold leading-tight tracking-tight text-[var(--ink)] sm:mt-0.5">{title}</h1>
          <p className="mt-1 hidden text-[0.8rem] text-[var(--ink-muted)] sm:block">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={openUpdates} className="gap-1.5">
            <History size={15} /><span className="hidden sm:inline">Recent updates</span><span className="sm:hidden">Updates</span>
          </Button>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={onNewJob} className="gap-1.5">
              <Plus size={16} /><span className="hidden sm:inline">Log new job</span><span className="sm:hidden">New</span>
            </Button>
          )}
          <NotificationsBell />
          <ThemeToggle className="h-9 w-9 lg:hidden" />
          <AccountSheet />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative flex h-10 min-w-[220px] flex-1 items-center">
          <Search size={15} className="absolute left-3 text-[var(--ink-muted)]" />
          <input
            className="field-input h-10 pl-9 pr-14"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Filter jobs by assembly, customer, staff…"
          />
          <button
            type="button"
            onClick={onOpenPalette}
            title="Search jobs, navigate & run actions (Ctrl+K)"
            className="absolute right-2 inline-flex items-center gap-0.5 rounded-md border border-[var(--line)] bg-[var(--surface-sunken)] px-1.5 py-1 text-[0.62rem] font-bold text-[var(--ink-muted)] transition-colors hover:border-[var(--color-brand-500)] hover:text-[var(--ink)]"
          >
            <Command size={10} />K
          </button>
        </label>

        <Button
          variant={filtersOpen ? "secondary" : "ghost"}
          size="md"
          onClick={() => setFiltersOpen((o) => !o)}
          className="h-10 gap-1.5"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={15} />Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="subtle" size="md" onClick={resetFilters} className="h-10 gap-1.5">
            <RotateCcw size={14} /><span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>

      {/* Desktop: inline expandable grid. Mobile: the same controls in a bottom sheet. */}
      {isDesktop && filtersOpen && (
        <div className="mt-3">
          <FilterControls layout="grid" />
        </div>
      )}
      <FilterSheet open={!isDesktop && filtersOpen} onClose={() => setFiltersOpen(false)} />
    </header>
  );
}
