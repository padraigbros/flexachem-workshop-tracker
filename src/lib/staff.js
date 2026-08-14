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

// Unified team roster: one row per person, reconciling the staff record (assignable to
// jobs, has a calendar) with the login account (role, sign-in status), matched by
// email. Shared by the Staff list view and the Team Availability calendar so both agree on
// who exists, their role, and whether they're active. (Logic lifted from StaffView.)
export function buildRoster(staff, accounts) {
  const byEmail = new Map();
  const rows = [];
  (staff || []).forEach((m) => {
    const row = { key: m.id, staff: m, account: null, name: m.name, email: m.email || "" };
    const k = String(m.email || "").toLowerCase();
    if (k) byEmail.set(k, row);
    rows.push(row);
  });
  (accounts || []).forEach((p) => {
    const k = String(p.email || "").toLowerCase();
    const existing = k && byEmail.get(k);
    if (existing) existing.account = p;
    else rows.push({ key: `account-${p.id}`, staff: null, account: p, name: p.name || p.email, email: p.email || "" });
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// A person is only assignable to jobs and only has an availability calendar once they have a
// row in the staff table — a login account on its own is not enough. Build the
// staff record that should accompany a staff-role account.
export function staffRecordForAccount(account) {
  const name = String(account?.name || account?.email || "").trim();
  return normalizeStaff({
    id: `staff-${staffKey(name)}-${String(account?.id || "").slice(0, 8)}`,
    name,
    email: account?.email || "",
    role: "Workshop technician",
    active: account?.active !== false,
  });
}

// Technician accounts that have no matching staff record (matched by email, falling back to
// name for records with no email). These are the people who show up in the roster but can't
// be given work or a calendar. Only technicians qualify: admins manage the shop and staff
// (sales, managers) sign in without doing workshop work, so neither needs a staff record.
export function missingStaffAccounts(staff, accounts) {
  const emails = new Set((staff || []).map((m) => String(m.email || "").toLowerCase()).filter(Boolean));
  const names = new Set((staff || []).map((m) => staffKey(m.name)));
  return (accounts || [])
    .filter((p) => p.role === "technician" && p.active !== false && (p.name || p.email))
    .filter((p) => {
      const email = String(p.email || "").toLowerCase();
      return email ? !emails.has(email) : !names.has(staffKey(p.name));
    });
}

// The role that drives everything downstream. Note the DEFAULT is `technician`, not `staff`:
// a staff record with no login account at all (demo mode stores no `accounts` rows, and an
// admin can add a person before their invite is accepted) must stay assignable, or the app
// silently has nobody to give work to. Only an account explicitly marked admin or staff is
// treated as non-assignable.
export const rosterRole = (row) => {
  const role = row.account?.role;
  return role === "admin" || role === "staff" ? role : "technician";
};

// Assignable to jobs + has an availability calendar. The single question every caller asks.
export const isTechnicianRow = (row) => rosterRole(row) === "technician";
export const rosterActive = (row) => (row.account ? row.account.active !== false : row.staff ? row.staff.active : true);
export const rosterPending = (row) => row.account?.onboarded === false;

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
