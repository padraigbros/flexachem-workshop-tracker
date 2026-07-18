// Static catalogue data, enums, and localStorage keys — moved verbatim from the original App.jsx.

// Views a non-admin (staff) account may open.
export const STAFF_VIEWS = ["dashboard", "board"];

// Fields tracked by the audit trail (null = tracked via explicit action label only).
export const AUDIT_LABELS = {
  status: "Status",
  alloc: "Staff",
  due: "Due date",
  start: "Start date",
  hrs: "Hours booked",
  actualHrs: "Actual hours",
  cust: "Customer",
  asm: "Assembly",
  so: "Sales order",
  type: "Job type",
  bus: "Business unit",
  priority: "Priority",
  owner: "Owner",
  details: "Details",
  deleted: null,
};

export const STATUS_ORDER = ["Not Started", "In Progress", "Input Needed", "Complete"];

// tone maps to a semantic token family (queued / active / blocked / done).
export const STATUS_META = {
  "Not Started": { label: "Not Started", short: "Queued", tone: "queued", icon: "circle-dashed" },
  "In Progress": { label: "In Progress", short: "Active", tone: "active", icon: "arrow-up-right" },
  "Input Needed": { label: "Input Needed", short: "Blocked", tone: "blocked", icon: "alert-triangle" },
  Complete: { label: "Complete", short: "Done", tone: "done", icon: "check" },
};

export const JOB_TYPES = ["Valve Assembly", "Pump Assembly", "Valve Overhaul", "Pump Overhaul", "Mechanical Seal Refurb", "Testing", "Site Visit"];
export const DEFAULT_JOB_TYPES = JOB_TYPES.map((name) => ({
  id: `jobtype-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  active: true,
}));

export const PEOPLE = ["Darragh", "Shauna", "Cathal", "Ross", "Dave", "Colin"];
export const DEFAULT_STAFF = PEOPLE.map((name) => ({
  id: `staff-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  role: "Workshop technician",
  active: true,
  email: "",
  phone: "",
  notes: "",
}));

export const BUSINESS_UNITS = ["Pharma", "Industrial", "Engineering", "Mining", "Other"];
export const PRIORITIES = ["Low", "Normal", "High", "Critical"];

export const DUE_BUCKETS = ["Overdue", "Due today", "Next 7 days", "Next 30 days", "Later", "No due date", "Complete"];

export const STORAGE_KEY = "flexachem_workshop_jobs_v2";
export const STAFF_STORAGE_KEY = "flexachem_workshop_staff_v1";
export const JOB_TYPE_STORAGE_KEY = "flexachem_workshop_job_types_v1";
export const USER_KEY = "flexachem_workshop_user_v2";
export const THEME_KEY = "flexachem_theme_v3";
export const THEMES = ["light", "dark", "system"];
