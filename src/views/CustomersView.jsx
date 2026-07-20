import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkshop } from "../state/WorkshopProvider";
import { CUSTOMERS, STATUS_ORDER } from "../lib/constants";
import { Card, PanelHeader, Button, Input, Select, Chip, cx } from "../components/ui/primitives";
import { StatusChip } from "../components/ui/StatusChip";
import { ConfirmDialog } from "../components/ui/overlay";

const TONE = { queued: "var(--status-queued)", active: "var(--status-active)", blocked: "var(--status-blocked)", done: "var(--status-done)" };

// Mini stacked bar showing the status distribution of a customer's jobs.
function StatusBar({ jobs }) {
  if (!jobs.length) return null;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full">
      {STATUS_ORDER.map((s) => {
        const count = jobs.filter((j) => j.status === s).length;
        if (!count) return null;
        const meta = { "Not Started": "queued", "In Progress": "active", "Input Needed": "blocked", Complete: "done" }[s];
        return <span key={s} style={{ width: `${(count / jobs.length) * 100}%`, background: TONE[meta] }} />;
      })}
    </div>
  );
}

export function CustomersView() {
  const { activeJobs, customers, activeCustomers, addCustomer, updateCustomer, deleteCustomer, reassignCustomerJobs } = useWorkshop();
  const [newName, setNewName] = useState("");
  const [moveTargets, setMoveTargets] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const activeCount = customers.filter((c) => c.active).length;
  const inactiveCount = customers.filter((c) => !c.active).length;

  // Customer names that appear on jobs but aren't in the catalogue (legacy / PDF-imported).
  const uncatalogued = useMemo(() => {
    const known = new Set(customers.map((c) => c.name));
    const counts = new Map();
    activeJobs.forEach((job) => {
      const name = job.cust?.trim();
      if (!name || known.has(name)) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [activeJobs, customers]);

  const submit = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addCustomer({ name, active: true });
    setNewName("");
  };

  return (
    <div className="grid gap-4">
      <Card>
        <PanelHeader
          title="Customer management"
          subtitle="Add customers, batch-move jobs onto another customer, and deactivate or remove unused ones."
          action={<div className="flex gap-1.5"><Chip>{activeCount} active</Chip><Chip>{inactiveCount} inactive</Chip></div>}
        />
        <form className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New customer name" />
          <Button type="submit" variant="primary" className="gap-1.5"><Plus size={16} />Add customer</Button>
        </form>
        <div className="grid gap-2.5">
          {customers.map((customer) => {
            const custJobs = activeJobs.filter((j) => j.cust === customer.name);
            const openJobs = custJobs.filter((j) => j.status !== "Complete");
            const choices = activeCustomers.filter((n) => n !== customer.name);
            const target = moveTargets[customer.name] || choices[0] || "";
            const isDefault = CUSTOMERS.includes(customer.name);
            const canRemove = !isDefault && openJobs.length === 0;
            return (
              <div key={customer.id} className={cx("grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] p-3.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)] lg:items-center", !customer.active && "opacity-70")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-[0.9rem] text-[var(--ink)]">{customer.name}</strong>
                    <StatusChip status={customer.active ? "Complete" : "Not Started"} size="sm" />
                  </div>
                  <div className="mt-1 text-[0.72rem] text-[var(--ink-muted)]">{isDefault ? "Standard customer" : "Custom customer"} · {openJobs.length} open · {custJobs.length} total</div>
                  <div className="mt-2 max-w-[220px]"><StatusBar jobs={custJobs} /></div>
                </div>
                <div className="hidden lg:block" />
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Select className="w-auto min-w-[140px]" value={target} onChange={(e) => setMoveTargets((p) => ({ ...p, [customer.name]: e.target.value }))} disabled={!choices.length}>
                    {choices.length ? choices.map((n) => <option key={n}>{n}</option>) : <option value="">No other customer</option>}
                  </Select>
                  <Button size="sm" variant="ghost" disabled={!custJobs.length || !target} onClick={() => reassignCustomerJobs(customer.name, target)}>Move all</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateCustomer(customer.id, { active: !customer.active })}>{customer.active ? "Deactivate" : "Reactivate"}</Button>
                  {!isDefault && <Button size="sm" variant="danger" disabled={!canRemove} title={openJobs.length ? "Move or complete open jobs first" : undefined} onClick={() => setConfirmDelete(customer)} className="gap-1"><Trash2 size={13} />Remove</Button>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {uncatalogued.length > 0 && (
        <Card>
          <PanelHeader
            title="Uncatalogued customers"
            subtitle="These names appear on jobs but aren't in the catalogue. Add them so they're selectable and reportable."
          />
          <div className="flex flex-wrap gap-2">
            {uncatalogued.map(({ name, count }) => (
              <div key={name} className="flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-sunken)] py-1 pl-3 pr-1">
                <span className="text-[0.8rem] text-[var(--ink)]">{name}</span>
                <span className="text-[0.7rem] text-[var(--ink-muted)]">{count} job{count === 1 ? "" : "s"}</span>
                <Button size="sm" variant="primary" className="h-7 gap-1 px-2 text-[0.72rem]" onClick={() => addCustomer({ name, active: true })}><Plus size={12} />Add</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Remove "${confirmDelete?.name}"?`}
        message="This customer will be removed from the catalogue. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && deleteCustomer(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
