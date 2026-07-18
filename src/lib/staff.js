// Staff and job-type domain helpers — moved verbatim from App.jsx.

export function staffKey(name) {
  return String(name || "staff").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "staff";
}

export function normalizeStaff(row) {
  const name = String(row?.name || row?.staff || row?.employee || row?.full_name || "").trim();
  const id = row?.id || `staff-${staffKey(name || crypto.randomUUID?.() || Date.now())}`;
  return {
    id,
    name: name || "Unnamed staff member",
    role: row?.role || row?.job_title || "Workshop technician",
    active: row?.active ?? row?.is_active ?? row?.enabled ?? true,
    email: row?.email || "",
    phone: row?.phone || "",
    notes: row?.notes || "",
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
    updatedAt: row?.updatedAt || row?.updated_at || new Date().toISOString(),
  };
}

export function toStaffDbPayload(member) {
  return {
    id: member.id,
    name: member.name,
    role: member.role || "Workshop technician",
    active: Boolean(member.active),
    email: member.email || null,
    phone: member.phone || null,
    notes: member.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mergeStaffLists(...lists) {
  const byName = new Map();
  lists.flat().filter(Boolean).map(normalizeStaff).forEach((member) => {
    const key = staffKey(member.name);
    byName.set(key, { ...(byName.get(key) || {}), ...member });
  });
  return Array.from(byName.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function jobTypeKey(name) {
  return String(name || "job-type").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "job-type";
}

export function normalizeJobType(row) {
  const name = String(row?.name || row?.job_type || row?.type || row?.label || "").trim();
  return {
    id: row?.id || `jobtype-${jobTypeKey(name || crypto.randomUUID?.() || Date.now())}`,
    name: name || "Unnamed job type",
    active: row?.active ?? row?.is_active ?? row?.enabled ?? true,
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
    updatedAt: row?.updatedAt || row?.updated_at || new Date().toISOString(),
  };
}

export function toJobTypeDbPayload(jobType) {
  return {
    id: jobType.id,
    name: jobType.name,
    active: Boolean(jobType.active),
    updated_at: new Date().toISOString(),
  };
}

export function mergeJobTypeLists(...lists) {
  const byName = new Map();
  lists.flat().filter(Boolean).map(normalizeJobType).forEach((jobType) => {
    const key = jobTypeKey(jobType.name);
    byName.set(key, { ...(byName.get(key) || {}), ...jobType });
  });
  return Array.from(byName.values()).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
