import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, SlidersHorizontal, Plus, History, RotateCcw, Command } from "lucide-react";
import { PAGE_META } from "./nav";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useAuthCtx } from "../../state/AuthProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { STATUS_ORDER, DUE_BUCKETS } from "../../lib/constants";
import { Button, Select, cx } from "../ui/primitives";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({ onNewJob, onOpenPalette }) {
  const location = useLocation();
  const { isAdmin } = useAuthCtx();
  const { filters, updateFilter, resetFilters, people, businessUnits, metrics } = useWorkshop();
  const { openUpdates } = useJobDrawer();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [title, subtitle] = PAGE_META[location.pathname] || PAGE_META["/"];

  const activeFilterCount = [
    filters.search.trim(), filters.employee !== "All", filters.bus !== "All",
    filters.status !== "All", filters.horizon !== "All",
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-[60] border-b border-[var(--line)] bg-[var(--surface-page)]/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-[var(--color-brand-500)]">Flexachem workshop</div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">{title}</h1>
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
          <ThemeToggle className="h-9 w-9 lg:hidden" />
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

      <div className={cx("grid gap-2 overflow-hidden transition-all", filtersOpen ? "mt-2 grid-cols-2 sm:grid-cols-4" : "h-0")}>
        {filtersOpen && (
          <>
            <Select value={filters.employee} onChange={(e) => updateFilter("employee", e.target.value)}>
              <option value="All">All staff</option>{people.map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Select value={filters.bus} onChange={(e) => updateFilter("bus", e.target.value)}>
              <option value="All">All units</option>{businessUnits.map((b) => <option key={b}>{b}</option>)}
            </Select>
            <Select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <option value="All">All statuses</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select value={filters.horizon} onChange={(e) => updateFilter("horizon", e.target.value)}>
              <option value="All">All dates</option>{DUE_BUCKETS.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
              <span className="chip">{metrics.open} open</span>
              <span className="chip tnum">{metrics.hours}h booked</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
