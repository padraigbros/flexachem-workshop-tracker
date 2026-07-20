// Customer catalogue domain helpers — mirrors the job-type quartet in staff.js.

export function customerKey(name) {
  return String(name || "customer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "customer";
}

export function normalizeCustomer(row) {
  const name = String(row?.name || row?.customer || row?.cust || row?.label || "").trim();
  return {
    id: row?.id || `customer-${customerKey(name || crypto.randomUUID?.() || Date.now())}`,
    name: name || "Unnamed customer",
    active: row?.active ?? row?.is_active ?? row?.enabled ?? true,
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
    updatedAt: row?.updatedAt || row?.updated_at || new Date().toISOString(),
  };
}

export function toCustomerDbPayload(customer) {
  return {
    id: customer.id,
    name: customer.name,
    active: Boolean(customer.active),
    updated_at: new Date().toISOString(),
  };
}

export function mergeCustomerLists(...lists) {
  const byName = new Map();
  lists.flat().filter(Boolean).map(normalizeCustomer).forEach((customer) => {
    const key = customerKey(customer.name);
    byName.set(key, { ...(byName.get(key) || {}), ...customer });
  });
  return Array.from(byName.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
