// Static catalogue data, enums, and localStorage keys — moved verbatim from the original App.jsx.

// Views a non-admin (staff) account may open.
export const STAFF_VIEWS = ["dashboard", "board"];

// Account roles. The split that matters is TECHNICIAN vs everyone else: a technician is the
// Service & Assembly team — assignable to jobs and given an availability calendar — while
// staff (sales, managers) and admins are neither. Route and nav access is a separate axis and
// still keys off `admin` alone, so promoting someone to technician grants no extra access.
// Ordered technician-first because that is the common case when adding a person.
export const ACCOUNT_ROLES = ["technician", "staff", "admin"];
export const ACCOUNT_ROLE_META = {
  technician: { label: "Technician", hint: "Assignable to jobs, has an availability calendar" },
  staff: { label: "Staff", hint: "Sales and managers — signs in, not assignable to jobs" },
  admin: { label: "Admin", hint: "Manages the shop, not assignable to jobs" },
};

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
  archived: null,
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

// Intentionally empty — no staff are seeded by default (demo or cloud). Add real
// technicians via the Staff view.
export const PEOPLE = [];
export const DEFAULT_STAFF = PEOPLE.map((name) => ({
  id: `staff-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  role: "Workshop technician",
  active: true,
  email: "",
  phone: "",
  notes: "",
}));

export const CUSTOMERS = [
  "GE Whitegate", "ITW Performance Polymers", "BMS", "Shannon Bridge", "HA O Neil",
  "Eli Lilly", "PM Group", "Radleys", "Regeneron", "MSD Ballydine", "Paciv / Eli Lilly",
];
export const DEFAULT_CUSTOMERS = CUSTOMERS.map((name) => ({
  id: `customer-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  name,
  active: true,
}));

export const BUSINESS_UNITS = ["Pumps", "Valves", "Mechanical Seals", "Process", "Venting"];

// Staff availability calendar. "Available" is the absence of an entry; "Public Holiday"
// is derived from the holidays catalogue (never stored per-staff). A standard work week is
// 5 weekdays × 7.5 hours = 37.5 hours; each non-available weekday deducts 7.5h from that
// week. Both figures are fractional — render every SUM of them through formatHours()
// (src/lib/format.js) so a capacity never surfaces as "37.5000000001".
export const WEEK_CAPACITY = 37.5;
export const DAY_HOURS = 7.5;
// Statuses a user can set on a day (Public Holiday is auto-applied, not user-settable).
// Booked is a HARD status like Leave/Sick — it costs the day's hours and blocks assignment.
// It exists for time that is spoken for without being absence (cover, stocktake, a site day
// that isn't a job yet), which is why it reads as neutral rather than as a reason.
//
// It was briefly called "Blocked", which collided with the Input Needed job status whose short
// label is also "Blocked" (STATUS_META above). Note "Booked" is not collision-free either — the
// Team Availability hours column calls job hours "bkd" — so keep the two apart in any copy:
// a booked DAY is availability, booked HOURS are work.
export const CALENDAR_STATUSES = ["Available", "Training", "Leave", "Sick", "Booked"];

// Irish public holidays, auto-applied to every staff calendar. Mirrored by the seed in
// supabase-setup.sql; also the demo-mode seed (no Supabase configured). ISO 'YYYY-MM-DD'.
export const DEFAULT_HOLIDAYS = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-02-02", name: "February Bank Holiday" },
  { date: "2026-03-17", name: "St Patrick's Day" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-04", name: "May Bank Holiday" },
  { date: "2026-06-01", name: "June Bank Holiday" },
  { date: "2026-08-03", name: "August Bank Holiday" },
  { date: "2026-10-26", name: "October Bank Holiday" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "St Stephen's Day" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-02-01", name: "February Bank Holiday" },
  { date: "2027-03-17", name: "St Patrick's Day" },
  { date: "2027-03-29", name: "Easter Monday" },
  { date: "2027-05-03", name: "May Bank Holiday" },
  { date: "2027-06-07", name: "June Bank Holiday" },
  { date: "2027-08-02", name: "August Bank Holiday" },
  { date: "2027-10-25", name: "October Bank Holiday" },
  { date: "2027-12-25", name: "Christmas Day" },
  { date: "2027-12-26", name: "St Stephen's Day" },
];

// Estimated and actual hours are booked in half-hour (30 minute) increments — the
// smallest unit the workshop actually records against a job.
export const HOURS_STEP = 0.5;
export const QUICK_HOURS = [0.5, 1, 2, 4];
export const PRIORITIES = ["Low", "Normal", "High", "Critical"];

export const DUE_BUCKETS = ["Overdue", "Due today", "Next 7 days", "Next 30 days", "Later", "No due date", "Complete"];

export const STORAGE_KEY = "flexachem_workshop_jobs_v2";
export const STAFF_STORAGE_KEY = "flexachem_workshop_staff_v1";
export const JOB_TYPE_STORAGE_KEY = "flexachem_workshop_job_types_v1";
export const CUSTOMER_STORAGE_KEY = "flexachem_workshop_customers_v1";
export const CALENDAR_STORAGE_KEY = "flexachem_workshop_calendar_v1";
export const HOLIDAY_STORAGE_KEY = "flexachem_workshop_holidays_v1";
export const NOTIFICATIONS_STORAGE_KEY = "flexachem_workshop_notifications_v1";
export const USER_KEY = "flexachem_workshop_user_v2";
export const THEME_KEY = "flexachem_theme_v3";
export const THEMES = ["light", "dark", "system"];
