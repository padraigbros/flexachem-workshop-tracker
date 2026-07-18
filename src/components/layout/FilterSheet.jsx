import { X, RotateCcw } from "lucide-react";
import { useWorkshop } from "../../state/WorkshopProvider";
import { STATUS_ORDER, DUE_BUCKETS } from "../../lib/constants";
import { Drawer, DrawerHeader } from "../ui/overlay";
import { Button, IconButton, Select, Field } from "../ui/primitives";

// The four job filters — reused inline on desktop and inside the bottom sheet on mobile.
export function FilterControls({ layout = "grid" }) {
  const { filters, updateFilter, people, businessUnits, metrics } = useWorkshop();
  const wrap = layout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid gap-3";
  return (
    <div className={wrap}>
      <Field label={layout === "sheet" ? "Staff" : undefined}>
        <Select value={filters.employee} onChange={(e) => updateFilter("employee", e.target.value)}>
          <option value="All">All staff</option>{people.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label={layout === "sheet" ? "Business unit" : undefined}>
        <Select value={filters.bus} onChange={(e) => updateFilter("bus", e.target.value)}>
          <option value="All">All units</option>{businessUnits.map((b) => <option key={b}>{b}</option>)}
        </Select>
      </Field>
      <Field label={layout === "sheet" ? "Status" : undefined}>
        <Select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="All">All statuses</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label={layout === "sheet" ? "Due window" : undefined}>
        <Select value={filters.horizon} onChange={(e) => updateFilter("horizon", e.target.value)}>
          <option value="All">All dates</option>{DUE_BUCKETS.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </Field>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
        <span className="chip">{metrics.open} open</span>
        <span className="chip tnum">{metrics.hours}h booked</span>
      </div>
    </div>
  );
}

// Mobile bottom-sheet wrapping the same controls, with a Reset action in the footer.
export function FilterSheet({ open, onClose }) {
  const { resetFilters } = useWorkshop();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      header={(
        <DrawerHeader>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-tight">Filters</h2>
            <IconButton label="Close" onClick={onClose} className="border-white/20 bg-white/10 text-white hover:bg-white/20"><X size={18} /></IconButton>
          </div>
        </DrawerHeader>
      )}
      footer={(
        <div className="flex gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <Button variant="subtle" onClick={resetFilters} className="flex-1 gap-1.5"><RotateCcw size={15} />Reset</Button>
          <Button variant="primary" onClick={onClose} className="flex-1">Show results</Button>
        </div>
      )}
    >
      <div className="p-4">
        <FilterControls layout="sheet" />
      </div>
    </Drawer>
  );
}
