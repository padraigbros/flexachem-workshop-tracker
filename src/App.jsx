import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseAssemblyOrderText } from "./assemblyOrderParse";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || "jobs";
const SUPABASE_STAFF_TABLE = import.meta.env.VITE_SUPABASE_STAFF_TABLE || "staff";
const SUPABASE_JOB_TYPES_TABLE = import.meta.env.VITE_SUPABASE_JOB_TYPES_TABLE || "job_types";
const SUPABASE_START_COLUMN = import.meta.env.VITE_SUPABASE_START_COLUMN || "start_date";
const SUPABASE_DUE_COLUMN = import.meta.env.VITE_SUPABASE_DUE_COLUMN || "due_date";
const SUPABASE_PROFILES_TABLE = import.meta.env.VITE_SUPABASE_PROFILES_TABLE || "profiles";
const PDF_BUCKET = import.meta.env.VITE_SUPABASE_PDF_BUCKET || "job-files";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Views a non-admin (staff) account may open.
const STAFF_VIEWS = ["dashboard", "board"];
// Fields tracked by the audit trail (null = tracked via explicit action label only).
const AUDIT_LABELS = {
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

const STATUS_ORDER = ["Not Started", "In Progress", "Input Needed", "Complete"];
const STATUS_META = {
  "Not Started": { label: "Not Started", short: "Queued", tone: "neutral", icon: "◌" },
  "In Progress": { label: "In Progress", short: "Active", tone: "blue", icon: "↗" },
  "Input Needed": { label: "Input Needed", short: "Blocked", tone: "amber", icon: "!" },
  Complete: { label: "Complete", short: "Done", tone: "green", icon: "✓" },
};
const JOB_TYPES = ["Valve Assembly", "Pump Assembly", "Valve Overhaul", "Pump Overhaul", "Mechanical Seal Refurb", "Testing", "Site Visit"];
const DEFAULT_JOB_TYPES = JOB_TYPES.map((name) => ({
  id: `jobtype-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  active: true,
}));
const PEOPLE = ["Darragh", "Shauna", "Cathal", "Ross", "Dave", "Colin"];
const DEFAULT_STAFF = PEOPLE.map((name) => ({
  id: `staff-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  role: "Workshop technician",
  active: true,
  email: "",
  phone: "",
  notes: "",
}));
const BUSINESS_UNITS = ["Pharma", "Industrial", "Engineering", "Mining", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const STORAGE_KEY = "flexachem_workshop_jobs_v2";
const STAFF_STORAGE_KEY = "flexachem_workshop_staff_v1";
const JOB_TYPE_STORAGE_KEY = "flexachem_workshop_job_types_v1";
const USER_KEY = "flexachem_workshop_user_v2";

const today = () => new Date();
const toISODate = (date) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};
const offsetDate = (days) => {
  const d = today();
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const SEED_JOBS = [
  { id: "demo-1", asm: "A007563", so: "296767", cust: "MSD", type: "Valve Assembly", owner: "Darragh", alloc: "Darragh", start: offsetDate(-2), due: offsetDate(3), hrs: 18, status: "In Progress", bus: "Pharma", priority: "High", details: "Actuator installation and pressure test", notes: [{ at: new Date().toISOString(), by: "Darragh", txt: "Valve bodies machined. Actuator installation next.", status: "In Progress" }] },
  { id: "demo-2", asm: "A007584", so: "297516", cust: "BMD", type: "Testing", owner: "Shauna", alloc: "Shauna", start: offsetDate(-4), due: offsetDate(-1), hrs: 3, status: "Input Needed", bus: "Pharma", priority: "Critical", details: "Test cert pending", notes: [{ at: new Date(Date.now() - 86400000).toISOString(), by: "Shauna", txt: "Test specification not yet received from BMD. Three hours of bench time, but waiting on customer input.", status: "Input Needed" }] },
  { id: "demo-3", asm: "A007528", so: "296966", cust: "Busch Ire", type: "Pump Assembly", owner: "Darragh", alloc: "Darragh", start: offsetDate(-7), due: offsetDate(-2), hrs: 10, status: "Complete", bus: "Industrial", priority: "Normal", details: "Final inspection complete", notes: [{ at: new Date(Date.now() - 172800000).toISOString(), by: "Darragh", txt: "Completed ahead of schedule. Passed all tests.", status: "Complete" }] },
  { id: "demo-4", asm: "A007445", so: "296987", cust: "Aughinish", type: "Pump Overhaul", owner: "Darragh", alloc: "Colin", start: offsetDate(1), due: offsetDate(7), hrs: 4, status: "Not Started", bus: "Mining", priority: "Normal", details: "Awaiting strip-down slot", notes: [] },
  { id: "demo-5", asm: "A007582", so: "297516", cust: "BMD", type: "Mechanical Seal Refurb", owner: "Shauna", alloc: "Shauna", start: offsetDate(-1), due: offsetDate(5), hrs: 6, status: "In Progress", bus: "Pharma", priority: "High", details: "Seal lapping complete; test bench next", notes: [{ at: new Date(Date.now() - 3600000 * 6).toISOString(), by: "Shauna", txt: "Seal lapping complete. Awaiting test bench slot.", status: "In Progress" }] },
  { id: "demo-6", asm: "A007471", so: "296754", cust: "BCD Engineering", type: "Valve Overhaul", owner: "Shauna", alloc: "Dave", start: offsetDate(0), due: offsetDate(2), hrs: 4, status: "In Progress", bus: "Engineering", priority: "Normal", details: "Strip, clean, rebuild", notes: [] },
  { id: "demo-7", asm: "A07427", so: "297068", cust: "European Refresh", type: "Valve Assembly", owner: "Shauna", alloc: "Ross", start: offsetDate(2), due: offsetDate(11), hrs: 2, status: "Not Started", bus: "Industrial", priority: "Low", details: "Small job, wide delivery window", notes: [] },
  { id: "demo-8", asm: "SITE-004", so: "TBA", cust: "Eli Lilly Limerick", type: "Site Visit", owner: "Cathal", alloc: "Colin", start: offsetDate(6), due: offsetDate(12), hrs: 4, status: "Not Started", bus: "Pharma", priority: "High", details: "Site support visit", notes: [] },
  { id: "demo-9", asm: "A007618", so: "297155", cust: "MSD Ballydine", type: "Pump Overhaul", owner: "Darragh", alloc: "Dave", start: offsetDate(-9), due: offsetDate(1), hrs: 4, status: "Input Needed", bus: "Pharma", priority: "Critical", details: "Customer scope confirmation missing", notes: [{ at: new Date(Date.now() - 3600000 * 30).toISOString(), by: "Dave", txt: "Customer has not confirmed scope. No more workshop time should be booked until clarified.", status: "Input Needed" }] },
  { id: "demo-10", asm: "A007623", so: "297080", cust: "EES", type: "Mechanical Seal Refurb", owner: "Ross", alloc: "Ross", start: offsetDate(-1), due: offsetDate(0), hrs: 0.5, status: "Complete", bus: "Industrial", priority: "Normal", details: "Collected by customer", notes: [{ at: new Date(Date.now() - 3600000 * 3).toISOString(), by: "Ross", txt: "Customer collected. Close out complete.", status: "Complete" }] },
  { id: "demo-11", asm: "SITE-001", so: "TBA", cust: "Aughinish", type: "Site Visit", owner: "Darragh", alloc: "Colin", start: offsetDate(14), due: offsetDate(21), hrs: 8, status: "Not Started", bus: "Mining", priority: "High", details: "Planned maintenance support", notes: [] },
  { id: "demo-12", asm: "A007405", so: "296889", cust: "Eli Lilly", type: "Valve Overhaul", owner: "Darragh", alloc: "Colin", start: offsetDate(-3), due: offsetDate(4), hrs: 6, status: "In Progress", bus: "Pharma", priority: "Normal", details: "Rebuild kit available", notes: [] },
];

function parseISODate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + value);
    return new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [y, m, d] = text.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asISO(value) {
  const parsed = parseISODate(value);
  return parsed ? toISODate(parsed) : "";
}

function daysBetween(a, b) {
  const start = parseISODate(a);
  const end = parseISODate(b);
  if (!start || !end) return 0;
  const ms = end.setHours(12, 0, 0, 0) - start.setHours(12, 0, 0, 0);
  return Math.round(ms / 86400000);
}

function daysUntil(value) {
  const due = parseISODate(value);
  if (!due) return null;
  const now = today();
  now.setHours(12, 0, 0, 0);
  return Math.round((due.setHours(12, 0, 0, 0) - now.getTime()) / 86400000);
}

function formatDate(value, options = {}) {
  const parsed = parseISODate(value);
  if (!parsed) return "TBA";
  return parsed.toLocaleDateString("en-IE", { day: "2-digit", month: "short", ...options });
}

function formatDateTime(value) {
  const parsed = parseISODate(value);
  if (!parsed) return "Just now";
  return parsed.toLocaleString("en-IE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function parseNotes(notes) {
  if (!notes) return [];
  if (Array.isArray(notes)) return notes.filter(Boolean);
  if (typeof notes === "string") {
    try {
      const parsed = JSON.parse(notes);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return notes.trim() ? [{ at: new Date().toISOString(), by: "System", txt: notes.trim() }] : [];
    }
  }
  return [];
}

function normalizeStatus(status) {
  const found = STATUS_ORDER.find((s) => s.toLowerCase() === String(status || "").toLowerCase());
  return found || "Not Started";
}

function normalizeJob(row) {
  const notes = parseNotes(row.notes || row.updates || row.comments);
  const due = asISO(row.due || row.due_date || row.target_completion || row.target_date);
  const estimatedHours = Number(row.est_hours ?? row.estimated_hours ?? row.hours_required ?? row.hours ?? 0) || 0;
  const bookedHours = Number(row.hrs ?? 0) || estimatedHours;
  const start = asISO(row.start || row.start_date || row.to_be_done || row.scheduled_start) || (due ? asISO(offsetDate(-Math.max(0, Math.ceil(Number(bookedHours || 0) / 8)))) : "");
  const allocatedTo = String(row.allocated_to || row.employee || row.assignee || "").trim();
  const allocValue = String(row.alloc || "").trim();
  const allocation = allocatedTo || (allocValue && allocValue.toLowerCase() !== "unassigned" ? allocValue : "") || "Unassigned";
  return {
    id: row.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    asm: row.asm || row.assembly_no || row.assembly || row.tag || "",
    so: row.so || row.sales_order || row.sales_order_no || "",
    cust: row.cust || row.customer || row.customer_name || "",
    type: row.type || row.job_type || row.classification || JOB_TYPES[0],
    owner: row.owner || row.project_owner || row.contact || "",
    alloc: allocation,
    start,
    due,
    hrs: bookedHours,
    actualHrs: Number(row.actualHrs ?? row.actual_hours ?? 0) || 0,
    status: normalizeStatus(row.status),
    bus: row.bus || row.business_unit || row.business_stream || "Other",
    priority: row.priority || "Normal",
    details: row.details || row.description || row.work_order || "",
    notes,
    attachment: row.attachment || null,
    deleted: Boolean(row.deleted),
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || notes[0]?.at || new Date().toISOString(),
  };
}

function jobSort(a, b) {
  return (riskScore(b) - riskScore(a)) || ((parseISODate(a.due)?.getTime() || 0) - (parseISODate(b.due)?.getTime() || 0));
}

function toDbPayload(job) {
  const payload = {
    asm: job.asm,
    so: job.so,
    cust: job.cust,
    type: job.type,
    owner: job.owner,
    alloc: job.alloc,
    hrs: Number(job.hrs) || 0,
    actual_hours: Number(job.actualHrs) || 0,
    status: job.status,
    bus: job.bus,
    priority: job.priority,
    details: job.details,
    notes: job.notes,
    attachment: job.attachment || null,
    deleted: Boolean(job.deleted),
    updated_at: new Date().toISOString(),
  };
  payload[SUPABASE_START_COLUMN] = job.start || null;
  payload[SUPABASE_DUE_COLUMN] = job.due || null;
  return payload;
}

function staffKey(name) {
  return String(name || "staff").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "staff";
}

function normalizeStaff(row) {
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

function toStaffDbPayload(member) {
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

function loadStoredJobs() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored).map(normalizeJob) : SEED_JOBS.map(normalizeJob);
  } catch {
    return SEED_JOBS.map(normalizeJob);
  }
}

function saveStoredJobs(jobs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

function loadStoredStaff() {
  try {
    const stored = localStorage.getItem(STAFF_STORAGE_KEY);
    const base = stored ? JSON.parse(stored).map(normalizeStaff) : DEFAULT_STAFF.map(normalizeStaff);
    return mergeStaffLists(DEFAULT_STAFF.map(normalizeStaff), base);
  } catch {
    return DEFAULT_STAFF.map(normalizeStaff);
  }
}

function saveStoredStaff(staff) {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

function mergeStaffLists(...lists) {
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

function jobTypeKey(name) {
  return String(name || "job-type").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "job-type";
}

function normalizeJobType(row) {
  const name = String(row?.name || row?.job_type || row?.type || row?.label || "").trim();
  return {
    id: row?.id || `jobtype-${jobTypeKey(name || crypto.randomUUID?.() || Date.now())}`,
    name: name || "Unnamed job type",
    active: row?.active ?? row?.is_active ?? row?.enabled ?? true,
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
    updatedAt: row?.updatedAt || row?.updated_at || new Date().toISOString(),
  };
}

function toJobTypeDbPayload(jobType) {
  return {
    id: jobType.id,
    name: jobType.name,
    active: Boolean(jobType.active),
    updated_at: new Date().toISOString(),
  };
}

function mergeJobTypeLists(...lists) {
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

function loadStoredJobTypes() {
  try {
    const stored = localStorage.getItem(JOB_TYPE_STORAGE_KEY);
    const base = stored ? JSON.parse(stored).map(normalizeJobType) : DEFAULT_JOB_TYPES.map(normalizeJobType);
    return mergeJobTypeLists(DEFAULT_JOB_TYPES.map(normalizeJobType), base);
  } catch {
    return DEFAULT_JOB_TYPES.map(normalizeJobType);
  }
}

function saveStoredJobTypes(jobTypes) {
  try {
    localStorage.setItem(JOB_TYPE_STORAGE_KEY, JSON.stringify(jobTypes));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

function getInitialUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

async function importAssemblyOrderPdf(file, opts) {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    return parseAssemblyOrderText(text, opts);
  } finally {
    loadingTask.destroy().catch(() => {});
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

async function uploadJobPdf(file, by) {
  const base = { name: file.name, size: file.size, uploadedAt: new Date().toISOString(), by: by || "" };
  if (supabase) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `jobs/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}/${safeName}`;
    const { error } = await supabase.storage.from(PDF_BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (!error) return { ...base, path };
    window.alert(`PDF upload to cloud storage failed (${error.message}). The PDF will be kept in this browser only.`);
  }
  // Local fallback: base64 data URL stored with the job (large — cloud storage preferred).
  return { ...base, data: await fileToDataUrl(file) };
}

async function openJobAttachment(att, { download = false } = {}) {
  const openUrl = (url) => {
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = att.name || "attachment.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, "_blank", "noopener");
    }
  };
  try {
    if (att.path && supabase) {
      const options = download ? { download: att.name || true } : undefined;
      const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(att.path, 3600, options);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL returned");
      openUrl(data.signedUrl);
      return;
    }
    if (att.data) {
      const blob = await (await fetch(att.data)).blob();
      const url = URL.createObjectURL(blob);
      openUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
    window.alert("Attachment is not available on this device.");
  } catch (err) {
    window.alert(`Could not open attachment: ${err?.message || err}`);
  }
}

function useAuth() {
  const [user, setUser] = useState(() => {
    if (supabase) return null;
    const stored = getInitialUser();
    return stored ? { ...stored, role: "admin" } : null;
  });
  const [checking, setChecking] = useState(Boolean(supabase));
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function applySession(session) {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setChecking(false);
        }
        return;
      }
      const { data: profile } = await supabase.from(SUPABASE_PROFILES_TABLE).select("*").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      if (profile && profile.active === false) {
        setUser(null);
        setChecking(false);
        await supabase.auth.signOut();
        window.alert("This account has been deactivated. Contact an administrator.");
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.user_metadata?.name || session.user.email,
        role: profile?.role || "staff",
      });
      setChecking(false);
    }
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      applySession(session);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loginLocal = useCallback((profile) => setUser({ ...profile, role: "admin" }), []);
  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return { user, checking, recovery, setRecovery, loginLocal, logout };
}

function makeGroups(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item) || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function jobCalendarSpan(job) {
  if (!job.start || !job.due) return Math.max(1, Math.ceil((Number(job.hrs) || 1) / 8));
  return Math.max(1, daysBetween(job.start, job.due) + 1);
}

function riskScore(job) {
  if (job.status === "Complete") return 0;
  const due = daysUntil(job.due);
  const blocked = job.status === "Input Needed" ? 25 : 0;
  const priority = job.priority === "Critical" ? 25 : job.priority === "High" ? 12 : 0;
  const dueRisk = due === null ? 8 : due < 0 ? 40 + Math.min(20, Math.abs(due) * 2) : due <= 2 ? 28 : due <= 7 ? 14 : 0;
  return dueRisk + blocked + priority;
}

function dueBucket(job) {
  if (job.status === "Complete") return "Complete";
  const delta = daysUntil(job.due);
  if (delta === null) return "No due date";
  if (delta < 0) return "Overdue";
  if (delta === 0) return "Due today";
  if (delta <= 7) return "Next 7 days";
  if (delta <= 30) return "Next 30 days";
  return "Later";
}

function useWorkshopData(user) {
  const [jobs, setJobs] = useState(loadStoredJobs);
  const [staff, setStaff] = useState(loadStoredStaff);
  const [jobTypes, setJobTypes] = useState(loadStoredJobTypes);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncState, setSyncState] = useState(supabase ? "syncing" : "local");
  const [staffSyncState, setStaffSyncState] = useState(supabase ? "syncing" : "local");
  const [jobTypeSyncState, setJobTypeSyncState] = useState(supabase ? "syncing" : "local");
  // With RLS enabled, queries only return rows for an authenticated session — wait for login.
  const userId = user?.id || (user ? "local" : null);

  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      if (!supabase || !userId) return;
      setLoading(true);
      const { data, error } = await supabase.from(SUPABASE_TABLE).select("*");
      if (cancelled) return;
      if (error) {
        setSyncState("error");
      } else if (Array.isArray(data) && data.length) {
        setJobs(data.map(normalizeJob).sort(jobSort));
        setSyncState("synced");
      } else {
        setSyncState("synced");
      }
      setLoading(false);
    }
    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchStaff() {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_STAFF_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setStaffSyncState("error");
      } else if (Array.isArray(data) && data.length) {
        setStaff(mergeStaffLists(DEFAULT_STAFF, data));
        setStaffSyncState("synced");
      } else {
        setStaffSyncState("synced");
      }
    }
    fetchStaff();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchJobTypes() {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_JOB_TYPES_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setJobTypeSyncState("error");
      } else if (Array.isArray(data) && data.length) {
        setJobTypes(mergeJobTypeLists(DEFAULT_JOB_TYPES, data));
        setJobTypeSyncState("synced");
      } else {
        setJobTypeSyncState("synced");
      }
    }
    fetchJobTypes();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfiles() {
      if (!supabase || !userId || user?.role !== "admin") return;
      const { data, error } = await supabase.from(SUPABASE_PROFILES_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (!error && Array.isArray(data)) setProfiles(data);
    }
    fetchProfiles();
    return () => {
      cancelled = true;
    };
  }, [userId, user?.role]);

  useEffect(() => {
    saveStoredJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    saveStoredStaff(staff);
  }, [staff]);

  useEffect(() => {
    saveStoredJobTypes(jobTypes);
  }, [jobTypes]);

  const patchJob = useCallback(async (id, patch) => {
    const updatedAt = new Date().toISOString();
    let nextJob = null;
    setJobs((prev) => prev.map((job) => {
      if (job.id !== id) return job;
      nextJob = normalizeJob({ ...job, ...patch, updatedAt });
      return nextJob;
    }));
    if (supabase && nextJob) {
      const { error } = await supabase.from(SUPABASE_TABLE).update(toDbPayload(nextJob)).eq("id", id);
      setSyncState(error ? "error" : "synced");
    }
  }, []);

  const addJob = useCallback(async (fields) => {
    const localJob = normalizeJob({ ...fields, id: crypto.randomUUID?.() || `job-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: Array.isArray(fields.notes) ? fields.notes : [] });
    setJobs((prev) => [localJob, ...prev]);
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_TABLE).insert(toDbPayload(localJob)).select("*").single();
      if (error) {
        setSyncState("error");
      } else if (data) {
        const savedJob = normalizeJob(data);
        setJobs((prev) => prev.map((job) => (job.id === localJob.id ? savedJob : job)));
        setSyncState("synced");
      }
    }
  }, []);

  const deleteJob = useCallback(async (id) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_TABLE).delete().eq("id", id);
      setSyncState(error ? "error" : "synced");
    }
  }, []);

  const addNote = useCallback(async (id, noteText, nextStatus, by) => {
    const current = jobs.find((job) => job.id === id);
    if (!current || !noteText.trim()) return;
    const note = { at: new Date().toISOString(), by: by || "Workshop", kind: "note", txt: noteText.trim(), status: nextStatus || current.status };
    const patch = {
      notes: [note, ...parseNotes(current.notes)],
      status: nextStatus || current.status,
      updatedAt: note.at,
    };
    await patchJob(id, patch);
  }, [jobs, patchJob]);

  const saveJob = useCallback(async (jobId, fields) => {
    if (jobId) await patchJob(jobId, fields);
    else await addJob(fields);
  }, [addJob, patchJob]);

  const addStaffMember = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return;
    const existing = staff.find((member) => staffKey(member.name) === staffKey(name));
    const localMember = normalizeStaff({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `staff-${staffKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    setStaff((prev) => mergeStaffLists(prev.filter((member) => member.id !== localMember.id), [localMember]));
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_STAFF_TABLE).upsert(toStaffDbPayload(localMember)).select("*").single();
      if (error) {
        setStaffSyncState("error");
      } else if (data) {
        setStaff((prev) => mergeStaffLists(prev.filter((member) => member.id !== localMember.id), [data]));
        setStaffSyncState("synced");
      }
    }
  }, [staff]);

  const updateStaffMember = useCallback(async (id, patch) => {
    let nextMember = null;
    setStaff((prev) => mergeStaffLists(prev.map((member) => {
      if (member.id !== id) return member;
      nextMember = normalizeStaff({ ...member, ...patch, updatedAt: new Date().toISOString() });
      return nextMember;
    })));
    if (supabase && nextMember) {
      const { error } = await supabase.from(SUPABASE_STAFF_TABLE).update(toStaffDbPayload(nextMember)).eq("id", id);
      setStaffSyncState(error ? "error" : "synced");
    }
  }, []);

  const deleteStaffMember = useCallback(async (id) => {
    const member = staff.find((item) => item.id === id);
    setStaff((prev) => prev.filter((item) => item.id !== id));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_STAFF_TABLE).delete().eq("id", id);
      setStaffSyncState(error ? "error" : "synced");
    }
    if (member) {
      setJobs((prev) => prev.map((job) => (job.alloc === member.name ? normalizeJob({ ...job, alloc: "Unassigned", updatedAt: new Date().toISOString() }) : job)));
    }
  }, [staff]);

  const addJobType = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return;
    const existing = jobTypes.find((jobType) => jobTypeKey(jobType.name) === jobTypeKey(name));
    const localJobType = normalizeJobType({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `jobtype-${jobTypeKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    setJobTypes((prev) => mergeJobTypeLists(prev.filter((jobType) => jobType.id !== localJobType.id), [localJobType]));
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_JOB_TYPES_TABLE).upsert(toJobTypeDbPayload(localJobType)).select("*").single();
      if (error) {
        setJobTypeSyncState("error");
      } else if (data) {
        setJobTypes((prev) => mergeJobTypeLists(prev.filter((jobType) => jobType.id !== localJobType.id), [data]));
        setJobTypeSyncState("synced");
      }
    }
  }, [jobTypes]);

  const updateJobType = useCallback(async (id, patch) => {
    let nextJobType = null;
    setJobTypes((prev) => mergeJobTypeLists(prev.map((jobType) => {
      if (jobType.id !== id) return jobType;
      nextJobType = normalizeJobType({ ...jobType, ...patch, updatedAt: new Date().toISOString() });
      return nextJobType;
    })));
    if (supabase && nextJobType) {
      const { error } = await supabase.from(SUPABASE_JOB_TYPES_TABLE).update(toJobTypeDbPayload(nextJobType)).eq("id", id);
      setJobTypeSyncState(error ? "error" : "synced");
    }
  }, []);

  const deleteJobType = useCallback(async (id) => {
    setJobTypes((prev) => prev.filter((jobType) => jobType.id !== id));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_JOB_TYPES_TABLE).delete().eq("id", id);
      setJobTypeSyncState(error ? "error" : "synced");
    }
  }, []);

  const updateProfile = useCallback(async (id, patch) => {
    setProfiles((prev) => prev.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_PROFILES_TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) window.alert(`Could not update account: ${error.message}`);
    }
  }, []);

  return {
    jobs,
    setJobs,
    staff,
    jobTypes,
    profiles,
    loading,
    syncState,
    staffSyncState,
    jobTypeSyncState,
    patchJob,
    addNote,
    addJob,
    saveJob,
    deleteJob,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
    addJobType,
    updateJobType,
    deleteJobType,
    updateProfile,
  };
}

export default function App() {
  const { user, checking, recovery, setRecovery, loginLocal, logout } = useAuth();
  const {
    jobs,
    staff,
    jobTypes,
    profiles,
    loading,
    syncState,
    staffSyncState,
    jobTypeSyncState,
    patchJob,
    addNote,
    addJob,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
    addJobType,
    updateJobType,
    deleteJobType,
    updateProfile,
  } = useWorkshopData(user);
  const [view, setView] = useState("dashboard");
  const [filters, setFilters] = useState({ search: "", employee: "All", bus: "All", status: "All", horizon: "All" });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [allUpdatesOpen, setAllUpdatesOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!supabase && user) localStorage.setItem(USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
  }, [user]);

  const activeJobs = useMemo(() => jobs.filter((job) => !job.deleted), [jobs]);
  const deletedJobs = useMemo(() => jobs.filter((job) => job.deleted), [jobs]);

  const people = useMemo(() => {
    const set = new Set(staff.map((member) => member.name));
    activeJobs.forEach((job) => job.alloc && set.add(job.alloc));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [activeJobs, staff]);

  const activePeople = useMemo(() => (staff.length ? staff : DEFAULT_STAFF)
    .filter((member) => member.active)
    .map((member) => member.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [staff]);

  const businessUnits = useMemo(() => {
    const set = new Set(BUSINESS_UNITS);
    activeJobs.forEach((job) => job.bus && set.add(job.bus));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeJobs]);

  const activeJobTypes = useMemo(() => (jobTypes.length ? jobTypes : DEFAULT_JOB_TYPES)
    .filter((jobType) => jobType.active)
    .map((jobType) => jobType.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [jobTypes]);

  const filteredJobs = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return activeJobs.filter((job) => {
      const haystack = [job.asm, job.so, job.cust, job.type, job.owner, job.alloc, job.bus, job.details].join(" ").toLowerCase();
      const matchSearch = !term || haystack.includes(term);
      const matchEmployee = filters.employee === "All" || job.alloc === filters.employee;
      const matchBus = filters.bus === "All" || job.bus === filters.bus;
      const matchStatus = filters.status === "All" || job.status === filters.status;
      const matchHorizon = filters.horizon === "All" || dueBucket(job) === filters.horizon;
      return matchSearch && matchEmployee && matchBus && matchStatus && matchHorizon;
    }).sort(jobSort);
  }, [activeJobs, filters]);

  const metrics = useMemo(() => {
    const open = filteredJobs.filter((j) => j.status !== "Complete");
    const complete = filteredJobs.filter((j) => j.status === "Complete").length;
    const dueSoon = filteredJobs.filter((j) => j.status !== "Complete" && daysUntil(j.due) !== null && daysUntil(j.due) <= 7).length;
    const overdue = filteredJobs.filter((j) => j.status !== "Complete" && daysUntil(j.due) !== null && daysUntil(j.due) < 0).length;
    const blocked = filteredJobs.filter((j) => j.status === "Input Needed").length;
    const hours = filteredJobs.reduce((sum, j) => sum + (Number(j.hrs) || 0), 0);
    const calendarDays = open.reduce((sum, j) => sum + jobCalendarSpan(j), 0);
    const progress = filteredJobs.length ? Math.round((complete / filteredJobs.length) * 100) : 0;
    return { open: open.length, complete, dueSoon, overdue, blocked, hours, calendarDays, progress };
  }, [filteredJobs]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const activeJob = jobs.find((job) => job.id === activeId) || null;

  const updates = useMemo(() => activeJobs.flatMap((job) => parseNotes(job.notes).map((note) => ({ ...note, job })))
    .sort((a, b) => (parseISODate(b.at)?.getTime() || 0) - (parseISODate(a.at)?.getTime() || 0)), [activeJobs]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters({ search: "", employee: "All", bus: "All", status: "All", horizon: "All" });

  const auditBy = user?.name || user?.email || "Workshop";

  // Central audited mutation: computes field diffs and prepends an audit entry to the job's notes.
  const auditPatch = useCallback(async (id, patch, actionLabel) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const changes = [];
    Object.entries(patch).forEach(([key, after]) => {
      if (!(key in AUDIT_LABELS) || AUDIT_LABELS[key] === null) return;
      const before = job[key];
      if (String(before ?? "") === String(after ?? "")) return;
      if (key === "details") {
        changes.push("Details updated");
        return;
      }
      const fmt = (v) => (key === "due" || key === "start"
        ? (v ? formatDate(v, { year: "numeric" }) : "—")
        : (v === "" || v == null ? "—" : String(v)));
      changes.push(`${AUDIT_LABELS[key]}: ${fmt(before)} → ${fmt(after)}`);
    });
    const parts = [actionLabel, ...changes].filter(Boolean);
    if (!parts.length) return patchJob(id, patch);
    const entry = { at: new Date().toISOString(), by: auditBy, kind: "audit", txt: parts.join(" · "), status: patch.status || job.status };
    return patchJob(id, { ...patch, notes: [entry, ...parseNotes(job.notes)] });
  }, [jobs, patchJob, auditBy]);

  const createJob = useCallback(async (fields, sourcePdfName) => {
    const entry = {
      at: new Date().toISOString(),
      by: auditBy,
      kind: "audit",
      txt: sourcePdfName ? `Job created · imported from ${sourcePdfName}` : "Job created",
      status: fields.status || "Not Started",
    };
    await addJob({ ...fields, notes: [entry] });
  }, [addJob, auditBy]);

  const reassignStaffJobs = async (fromName, toName) => {
    const target = toName || "Unassigned";
    const affected = jobs.filter((job) => job.alloc === fromName && job.status !== "Complete");
    for (const job of affected) {
      await auditPatch(job.id, { alloc: target }, "Batch reassignment");
    }
  };

  const reassignJobTypeJobs = async (fromType, toType) => {
    if (!toType || toType === fromType) return;
    const affected = jobs.filter((job) => job.type === fromType);
    for (const job of affected) {
      await auditPatch(job.id, { type: toType }, "Batch job-type move");
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job) return;
    const targetStatus = over.data?.current?.status || (String(over.id).startsWith("status:") ? String(over.id).replace("status:", "") : null);
    if (targetStatus && targetStatus !== job.status) {
      await auditPatch(job.id, { status: targetStatus });
    }
  };

  const handleDelete = async (job) => {
    if (window.confirm(`Delete ${job.asm || job.cust}? It will be archived with its history and can be restored from the Master List.`)) {
      await auditPatch(job.id, { deleted: true }, "Job deleted");
      if (selectedJobId === job.id) setSelectedJobId(null);
    }
  };

  const handleRestore = (job) => auditPatch(job.id, { deleted: false }, "Job restored");

  if (checking) {
    return (
      <>
        <DesignSystem />
        <div className="login-shell"><div className="panel" style={{ padding: 28 }}><div className="panel-title">Checking session…</div><div className="panel-subtitle">Restoring your workshop login.</div></div></div>
      </>
    );
  }

  if (!user) return <LoginScreen onLocalLogin={loginLocal} />;

  const effectiveView = isAdmin || STAFF_VIEWS.includes(view) ? view : "dashboard";

  return (
    <>
      <DesignSystem />
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-title">Flexachem</div>
              <div className="brand-subtitle">Workshop Control Tower</div>
            </div>
          </div>

          <nav className="nav-stack">
            <NavButton active={effectiveView === "dashboard"} icon="◆" label="Dashboard" hint="Live command centre" onClick={() => setView("dashboard")} />
            <NavButton active={effectiveView === "board"} icon="▦" label="Schedule" hint="Drag status columns" onClick={() => setView("board")} />
            {isAdmin && (
              <>
                <NavButton active={effectiveView === "employees"} icon="☷" label="Staff" hint="Manage active staff and workload" onClick={() => setView("employees")} />
                <NavButton active={effectiveView === "jobtypes"} icon="◵" label="Job Types" hint="Maintain job type catalogue" onClick={() => setView("jobtypes")} />
                <NavButton active={effectiveView === "business"} icon="◫" label="Business Units" hint="Pharma, mining, industrial" onClick={() => setView("business")} />
                <NavButton active={effectiveView === "due"} icon="◴" label="Due Dates" hint="Delivery windows" onClick={() => setView("due")} />
                <NavButton active={effectiveView === "list"} icon="≡" label="Master List" hint="Full job register" onClick={() => setView("list")} />
              </>
            )}
          </nav>

          <div className="sidebar-card">
            <DataSyncStatus jobsState={syncState} staffState={staffSyncState} />
          </div>

          <div className="profile-card">
            <div className="avatar">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{user.name || "Workshop user"}</strong>
              <span>{user.email}</span>
              <span className={`role-chip ${isAdmin ? "admin" : ""}`}>{isAdmin ? "Admin" : "Staff"}</span>
            </div>
            <button className="ghost-button compact" onClick={logout}>Exit</button>
          </div>
        </aside>

        <main className="workspace">
          <Topbar
            view={effectiveView}
            filters={filters}
            people={people}
            businessUnits={businessUnits}
            metrics={metrics}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            onNewJob={isAdmin ? () => setEditingJob({}) : null}
            onOpenUpdates={() => setAllUpdatesOpen(true)}
          />

          <section className="content-scroll">
            {loading ? <LoadingState /> : (
              <>
                {effectiveView === "dashboard" && <DashboardView jobs={filteredJobs} allJobs={activeJobs} metrics={metrics} updates={updates} people={people} onSelect={setSelectedJobId} onEdit={isAdmin ? setEditingJob : null} onStatus={auditPatch} onOpenUpdates={() => setAllUpdatesOpen(true)} />}
                {effectiveView === "board" && (
                  <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
                    <BoardView jobs={filteredJobs} onSelect={setSelectedJobId} onEdit={isAdmin ? setEditingJob : null} onStatus={auditPatch} />
                    <DragOverlay>{activeJob ? <JobCard job={activeJob} overlay onSelect={() => {}} onEdit={null} onStatus={() => {}} /> : null}</DragOverlay>
                  </DndContext>
                )}
                {effectiveView === "employees" && isAdmin && (
                  <StaffView
                    jobs={filteredJobs}
                    allJobs={activeJobs}
                    staff={staff}
                    people={people}
                    activePeople={activePeople}
                    profiles={profiles}
                    currentUserId={user.id}
                    onSelect={setSelectedJobId}
                    onStatus={auditPatch}
                    onAddStaff={addStaffMember}
                    onUpdateStaff={updateStaffMember}
                    onDeleteStaff={deleteStaffMember}
                    onReassignStaff={reassignStaffJobs}
                    onUpdateProfile={updateProfile}
                  />
                )}
                {effectiveView === "jobtypes" && isAdmin && (
                  <JobTypesView
                    allJobs={activeJobs}
                    jobTypes={jobTypes}
                    activeJobTypes={activeJobTypes}
                    onAddJobType={addJobType}
                    onUpdateJobType={updateJobType}
                    onDeleteJobType={deleteJobType}
                    onReassignJobType={reassignJobTypeJobs}
                  />
                )}
                {effectiveView === "business" && isAdmin && <BusinessUnitView jobs={filteredJobs} businessUnits={businessUnits} onSelect={setSelectedJobId} onStatus={auditPatch} />}
                {effectiveView === "due" && isAdmin && <DueDateView jobs={filteredJobs} onSelect={setSelectedJobId} onStatus={auditPatch} />}
                {effectiveView === "list" && isAdmin && <ListView jobs={filteredJobs} deletedJobs={deletedJobs} onSelect={setSelectedJobId} onEdit={setEditingJob} onStatus={auditPatch} onDelete={handleDelete} onRestore={handleRestore} />}
              </>
            )}
          </section>
        </main>
      </div>

      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          user={user}
          onClose={() => setSelectedJobId(null)}
          onEdit={isAdmin ? () => setEditingJob(selectedJob) : null}
          onStatus={auditPatch}
          onAddNote={addNote}
        />
      )}

      {allUpdatesOpen && <UpdatesDrawer updates={updates} onClose={() => setAllUpdatesOpen(false)} onSelect={(id) => { setAllUpdatesOpen(false); setSelectedJobId(id); }} />}

      {editingJob && isAdmin && (
        <JobModal
          job={editingJob}
          people={activePeople}
          jobTypes={activeJobTypes}
          businessUnits={businessUnits}
          onClose={() => setEditingJob(null)}
          onSave={async (fieldsIn) => {
            const { attachmentFile, attachment: keptAttachment, ...rest } = fieldsIn;
            let attachment = keptAttachment || null;
            let label;
            if (attachmentFile) {
              attachment = await uploadJobPdf(attachmentFile, auditBy);
              label = `Attached ${attachmentFile.name}`;
            } else if (editingJob.id && editingJob.attachment && !attachment) {
              label = "Attachment removed";
            }
            if (editingJob.id) await auditPatch(editingJob.id, { ...rest, attachment }, label);
            else await createJob({ ...rest, attachment }, attachmentFile?.name);
            setEditingJob(null);
          }}
        />
      )}

      {recovery && user && supabase && (
        <div className="modal-backdrop">
          <form
            className="modal-card"
            style={{ maxWidth: 440 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const pw = e.target.elements.newpw.value;
              const { error } = await supabase.auth.updateUser({ password: pw });
              if (error) window.alert(error.message);
              else {
                window.alert("Password updated. You are signed in.");
                setRecovery(false);
              }
            }}
          >
            <div className="modal-header"><div><div className="eyebrow">Password recovery</div><h2>Set a new password</h2></div><button className="icon-button" type="button" onClick={() => setRecovery(false)}>×</button></div>
            <div className="modal-body"><Field label="New password (min 8 characters)"><input name="newpw" type="password" className="input" minLength={8} required /></Field></div>
            <div className="modal-footer"><button className="ghost-button" type="button" onClick={() => setRecovery(false)}>Cancel</button><button className="primary-button" type="submit">Update password</button></div>
          </form>
        </div>
      )}
    </>
  );
}

function DesignSystem() {
  return (
    <style>{`
      :root {
        --ink: #071b33;
        --navy: #0a1f3d;
        --navy-2: #0d2a52;
        --navy-3: #12345f;
        --orange: #f26a21;
        --orange-2: #ff8a4c;
        --paper: #f7f9fc;
        --card: rgba(255,255,255,0.92);
        --muted: #667085;
        --soft: #e7eef7;
        --line: rgba(15, 36, 64, 0.11);
        --shadow: 0 20px 60px rgba(6, 24, 44, 0.13);
        --shadow-soft: 0 10px 30px rgba(6, 24, 44, 0.08);
        --green: #16875f;
        --green-bg: #e8fff4;
        --amber: #b7791f;
        --amber-bg: #fff7db;
        --red: #c2413b;
        --red-bg: #fff0ee;
        --blue: #2563eb;
        --blue-bg: #ecf4ff;
        --neutral-bg: #eef2f7;
      }
      * { box-sizing: border-box; }
      html, body, #root { width: 100%; min-height: 100%; margin: 0; }
      body { background: radial-gradient(circle at top left, #eaf2ff 0, #f8fafc 34%, #eff4f9 100%); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button, input, select, textarea { font: inherit; }
      button { cursor: pointer; }
      .app-shell { width: 100vw; height: 100vh; display: grid; grid-template-columns: 288px minmax(0, 1fr); overflow: visible; }
      .sidebar { position: relative; overflow: visible; padding: 22px 16px; background: linear-gradient(165deg, #06172d 0%, #092447 55%, #0a2d59 100%); color: #fff; display: flex; flex-direction: column; gap: 18px; }
      .sidebar:before { content: ""; position: absolute; inset: -120px -160px auto auto; width: 320px; height: 320px; border-radius: 999px; background: rgba(242,106,33,0.20); filter: blur(4px); }
      .brand-block { position: relative; display: flex; gap: 12px; align-items: center; padding: 10px 8px 18px; border-bottom: 1px solid rgba(255,255,255,0.10); }
      .brand-mark { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; font-weight: 900; font-size: 24px; background: linear-gradient(135deg, var(--orange), #ffbc84); color: #fff; box-shadow: 0 18px 40px rgba(242,106,33,0.34); }
      .brand-title { text-transform: uppercase; letter-spacing: 0.12em; font-weight: 900; font-size: 14px; }
      .brand-subtitle { margin-top: 4px; color: #b7c8dc; font-size: 12px; }
      .nav-stack { position: relative; display: grid; gap: 8px; }
      .nav-button { width: 100%; border: 1px solid transparent; color: #d9e7f7; background: transparent; border-radius: 18px; display: flex; gap: 12px; align-items: center; padding: 12px; text-align: left; transition: 180ms ease; }
      .nav-button:hover { background: rgba(255,255,255,0.08); transform: translateX(2px); }
      .nav-button.active { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.18); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12); }
      .nav-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 12px; background: rgba(255,255,255,0.09); color: #fff; font-weight: 900; }
      .nav-button.active .nav-icon { background: linear-gradient(135deg, var(--orange), #ffb16d); }
      .nav-text { display: grid; gap: 2px; }
      .nav-text strong { font-size: 13px; }
      .nav-text span { font-size: 11px; color: #9fb4cd; }
      .sidebar-card { position: relative; padding: 16px; border-radius: 22px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13); margin-top: auto; }
      .sidebar-card-label { color: #b7c8dc; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; font-weight: 800; }
      .sync-pill { display: inline-flex; margin-top: 10px; padding: 7px 9px; border-radius: 999px; background: rgba(22,135,95,0.18); color: #bbf7d0; font-size: 11px; max-width: 100%; word-break: break-word; }
      .sidebar-card-text { margin-top: 10px; color: #aec1d8; font-size: 11px; line-height: 1.45; }
      .data-sync-card { display: flex; align-items: center; gap: 11px; padding: 3px 0; }
      .data-sync-dot { width: 12px; height: 12px; border-radius: 999px; flex: 0 0 auto; background: #22c55e; box-shadow: 0 0 0 6px rgba(34,197,94,0.14); }
      .data-sync-card.issue .data-sync-dot { background: #ef4444; box-shadow: 0 0 0 6px rgba(239,68,68,0.15); }
      .data-sync-card.working .data-sync-dot { background: #f59e0b; box-shadow: 0 0 0 6px rgba(245,158,11,0.16); }
      .data-sync-card.local .data-sync-dot { background: #94a3b8; box-shadow: 0 0 0 6px rgba(148,163,184,0.15); }
      .data-sync-label { font-weight: 900; font-size: 14px; color: #fff; letter-spacing: -0.01em; }
      .data-sync-detail { margin-top: 3px; color: #aec1d8; font-size: 11px; line-height: 1.35; }
      .profile-card { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 20px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.10); }
      .avatar { width: 36px; height: 36px; border-radius: 12px; background: #fff; color: var(--navy); display: grid; place-items: center; font-weight: 900; }
      .profile-copy { min-width: 0; display: grid; gap: 2px; flex: 1; }
      .profile-copy strong { font-size: 12px; white-space: nowrap; overflow: visible; text-overflow: ellipsis; }
      .profile-copy span { color: #a9bad0; font-size: 10px; white-space: nowrap; overflow: visible; text-overflow: ellipsis; }
      .workspace { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); background: linear-gradient(180deg, rgba(255,255,255,0.68), rgba(247,249,252,0.90)); }
      .topbar { padding: 18px 26px 16px; display: grid; gap: 14px; border-bottom: 1px solid var(--line); backdrop-filter: blur(16px); background: rgba(255,255,255,0.64); }
      .topbar-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .eyebrow { color: var(--orange); text-transform: uppercase; letter-spacing: 0.18em; font-size: 11px; font-weight: 900; }
      .page-title { margin: 2px 0 0; font-size: 28px; line-height: 1.05; letter-spacing: -0.04em; color: var(--ink); }
      .page-subtitle { margin-top: 5px; color: var(--muted); font-size: 13px; }
      .top-actions, .filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .filter-bar { background: rgba(255,255,255,0.74); border: 1px solid var(--line); border-radius: 22px; padding: 9px; box-shadow: var(--shadow-soft); }
      .filter-summary, .filter-controls { display: contents; }
      .filter-toggle { display: none; }
      .search-box { position: relative; min-width: min(360px, 100%); flex: 1; }
      .search-box input { width: 100%; height: 40px; border: 1px solid var(--line); border-radius: 15px; padding: 0 14px 0 38px; background: #fff; outline: none; color: var(--ink); }
      .search-box span { position: absolute; left: 14px; top: 10px; color: var(--muted); }
      .select, .input, .textarea { border: 1px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink); outline: none; }
      .select { height: 40px; padding: 0 12px; }
      .input { min-height: 40px; padding: 0 12px; }
      .textarea { width: 100%; min-height: 92px; padding: 12px; resize: vertical; }
      .primary-button, .secondary-button, .ghost-button { border: 0; border-radius: 14px; min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; transition: 180ms ease; }
      .primary-button { background: linear-gradient(135deg, var(--orange), #ff9c5f); color: #fff; box-shadow: 0 16px 30px rgba(242,106,33,0.25); }
      .primary-button:hover, .secondary-button:hover, .ghost-button:hover { transform: translateY(-1px); }
      .secondary-button { background: var(--ink); color: #fff; }
      .ghost-button { background: #fff; color: var(--ink); border: 1px solid var(--line); }
      .ghost-button.compact { min-height: 30px; padding: 0 10px; font-size: 11px; background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.14); }
      .content-scroll { overflow: auto; padding: 22px 26px 32px; }
      .dashboard-grid { display: grid; grid-template-columns: 1.36fr 0.84fr; gap: 20px; }
      .panel, .metric-card, .lane-card, .column, .drawer, .modal-card, .login-panel { background: var(--card); border: 1px solid rgba(255,255,255,0.74); box-shadow: var(--shadow); backdrop-filter: blur(18px); }
      .bu-stat { padding: 14px; border-radius: 20px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); }
      .bu-stat strong { display: block; font-size: 26px; letter-spacing: -0.05em; }
      .bu-stat span { color: #bdd0e6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; font-weight: 800; }
      .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 0; }
      .metric-card { border-radius: 24px; padding: 18px; box-shadow: var(--shadow-soft); }
      .metric-label { display: flex; justify-content: space-between; color: var(--muted); text-transform: uppercase; letter-spacing: 0.11em; font-size: 10px; font-weight: 900; }
      .metric-value { margin-top: 10px; font-size: 32px; letter-spacing: -0.06em; font-weight: 900; color: var(--ink); }
      .metric-detail { margin-top: 5px; color: var(--muted); font-size: 12px; }
      .panel { border-radius: 28px; padding: 20px; box-shadow: var(--shadow-soft); }
      .panel + .panel { margin-top: 18px; }
      .panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      .panel-title { margin: 0; font-size: 17px; letter-spacing: -0.03em; }
      .panel-subtitle { color: var(--muted); font-size: 12px; margin-top: 4px; }
      .progress-ring { width: 126px; height: 126px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--orange) calc(var(--progress) * 1%), #e7eef7 0); position: relative; }
      .progress-ring:after { content: ""; width: 92px; height: 92px; border-radius: 50%; background: #fff; position: absolute; }
      .progress-ring strong { position: relative; z-index: 1; font-size: 28px; letter-spacing: -0.06em; }
      .split-panel { display: grid; grid-template-columns: 146px minmax(0, 1fr); gap: 18px; align-items: center; }
      .bar-list { display: grid; gap: 12px; }
      .bar-row { display: grid; gap: 7px; }
      .bar-meta { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; }
      .bar-track { height: 9px; border-radius: 999px; background: #e8edf4; overflow: visible; }
      .bar-fill { height: 100%; width: var(--width); background: linear-gradient(90deg, var(--orange), #ffb27a); border-radius: inherit; }
      .risk-list, .updates-list, .job-list { display: grid; gap: 10px; }
      .risk-item, .update-item, .mini-job, .timeline-item { border: 1px solid var(--line); background: #fff; border-radius: 18px; padding: 12px; transition: 160ms ease; }
      .risk-item:hover, .update-item:hover, .mini-job:hover, .timeline-item:hover { transform: translateY(-1px); box-shadow: var(--shadow-soft); }
      .risk-top, .mini-top, .timeline-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
      .job-code { font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
      .job-subline { color: var(--muted); font-size: 12px; margin-top: 3px; }
      .chip, .status-chip, .priority-chip { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 8px; font-weight: 900; font-size: 11px; white-space: nowrap; }
      .chip { background: #eef2f7; color: var(--muted); }
      .status-chip.neutral { background: var(--neutral-bg); color: #475467; }
      .status-chip.blue { background: var(--blue-bg); color: var(--blue); }
      .status-chip.amber { background: var(--amber-bg); color: var(--amber); }
      .status-chip.green { background: var(--green-bg); color: var(--green); }
      .priority-chip.Low { background: #eef2f7; color: #475467; }
      .priority-chip.Normal { background: #ecf4ff; color: #2563eb; }
      .priority-chip.High { background: #fff7db; color: #b7791f; }
      .priority-chip.Critical { background: #fff0ee; color: #c2413b; }
      .status-switch { display: flex; gap: 5px; flex-wrap: wrap; }
      .status-button { border: 1px solid var(--line); background: #fff; border-radius: 999px; min-height: 30px; padding: 0 10px; font-size: 11px; font-weight: 900; color: var(--muted); }
      .status-button.active { border-color: transparent; color: #fff; background: var(--ink); }
      .board { display: grid; grid-template-columns: repeat(4, minmax(270px, 1fr)); gap: 16px; align-items: start; min-width: 1120px; }
      .column { min-height: calc(100vh - 218px); border-radius: 26px; padding: 12px; box-shadow: var(--shadow-soft); background: rgba(255,255,255,0.72); }
      .column.over { outline: 3px solid rgba(242,106,33,0.28); }
      .column-header { padding: 8px 8px 14px; display: flex; justify-content: space-between; align-items: center; }
      .column-title { display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 900; }
      .column-count { color: var(--muted); font-size: 12px; }
      .column-body { min-height: 260px; display: grid; gap: 11px; align-content: start; }
      .job-card { position: relative; border: 1px solid var(--line); background: #fff; border-radius: 22px; padding: 15px; box-shadow: 0 8px 24px rgba(6,24,44,0.06); transition: 160ms ease; }
      .job-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-soft); }
      .job-card.dragging { opacity: 0.3; }
      .job-card.overlay { width: 292px; transform: rotate(1deg); box-shadow: 0 24px 70px rgba(6,24,44,0.24); }
      .job-accent { position: absolute; left: 0; top: 16px; bottom: 16px; width: 4px; border-radius: 999px; background: var(--orange); }
      .job-card-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      .job-title { margin: 8px 0 0; font-size: 17px; letter-spacing: -0.04em; }
      .job-details { margin-top: 5px; color: var(--muted); font-size: 12px; line-height: 1.35; }
      .job-footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; }
      .job-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .card-actions { display: flex; gap: 6px; align-items: center; }
      .icon-button { width: 32px; height: 32px; border: 1px solid var(--line); border-radius: 12px; background: #fff; color: var(--ink); font-weight: 900; display: grid; place-items: center; }
      .empty-state { min-height: 240px; border: 1px dashed rgba(15,36,64,0.24); border-radius: 22px; display: grid; place-items: center; color: var(--muted); font-size: 13px; padding: 18px; text-align: center; }
      .staff-page { display: grid; gap: 18px; }
      .staff-management-panel { overflow: visible; }
      .staff-kpi-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .staff-add-form { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.8fr) auto; gap: 10px; margin-bottom: 14px; }
      .staff-table { display: grid; gap: 10px; }
      .staff-row { display: grid; grid-template-columns: minmax(220px, 1fr) auto minmax(420px, 1.2fr); gap: 12px; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
      .staff-row.inactive, .lane-card.inactive { opacity: 0.74; }
      .staff-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .staff-main strong { display: block; font-size: 14px; }
      .staff-main span { color: var(--muted); font-size: 12px; }
      .staff-status-block { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .staff-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .ghost-button.danger { color: var(--red); border-color: rgba(194,65,59,0.22); }
      .ghost-button:disabled, .primary-button:disabled, .secondary-button:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
      .lane-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
      .lane-card { border-radius: 26px; padding: 18px; box-shadow: var(--shadow-soft); }
      .lane-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
      .lane-title { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 900; letter-spacing: -0.04em; }
      .lane-avatar { width: 42px; height: 42px; border-radius: 16px; background: linear-gradient(135deg, var(--navy), var(--navy-3)); color: #fff; display: grid; place-items: center; font-weight: 900; }
      .lane-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .summary-cell { background: #f8fafc; border: 1px solid var(--line); border-radius: 16px; padding: 10px; }
      .summary-cell strong { display: block; font-size: 20px; letter-spacing: -0.05em; }
      .summary-cell span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 900; }
      .business-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
      .bu-card { border-radius: 28px; overflow: visible; background: #fff; border: 1px solid var(--line); box-shadow: var(--shadow-soft); }
      .bu-hero { padding: 20px; color: #fff; background: linear-gradient(135deg, var(--navy), #21578f); display: flex; justify-content: space-between; gap: 14px; }
      .bu-hero h3 { margin: 0; font-size: 24px; letter-spacing: -0.05em; }
      .bu-body { padding: 14px; display: grid; gap: 10px; }
      .due-stack { display: grid; gap: 18px; }
      .due-section { border-radius: 28px; background: rgba(255,255,255,0.74); border: 1px solid rgba(255,255,255,0.78); box-shadow: var(--shadow-soft); padding: 16px; }
      .due-heading { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 12px; }
      .due-heading h3 { margin: 0; letter-spacing: -0.04em; }
      .timeline-item { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; gap: 14px; align-items: center; }
      .timeline-date { font-weight: 900; color: var(--ink); }
      .window-bar { margin-top: 8px; height: 8px; border-radius: 999px; background: #edf2f7; overflow: visible; }
      .window-fill { height: 100%; width: var(--width); min-width: 16%; border-radius: inherit; background: linear-gradient(90deg, var(--orange), #ffc59b); }
      .table-wrap { overflow: auto; border-radius: 26px; border: 1px solid var(--line); background: #fff; box-shadow: var(--shadow-soft); }
      table { width: 100%; border-collapse: collapse; min-width: 1040px; }
      th { background: #f8fafc; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; text-align: left; padding: 14px 16px; border-bottom: 1px solid var(--line); }
      td { padding: 14px 16px; border-bottom: 1px solid var(--line); font-size: 13px; vertical-align: top; }
      tr:hover td { background: #fbfdff; }
      .drawer-backdrop, .modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(6, 16, 29, 0.32); backdrop-filter: blur(8px); }
      .drawer { position: fixed; right: 18px; top: 18px; bottom: 18px; width: min(520px, calc(100vw - 36px)); z-index: 90; border-radius: 30px; overflow: visible; display: grid; grid-template-rows: auto minmax(0,1fr) auto; }
      .drawer-header { padding: 22px; color: #fff; background: linear-gradient(135deg, var(--navy), var(--navy-3)); }
      .drawer-header-row { display: flex; justify-content: space-between; gap: 16px; }
      .drawer-title { margin: 8px 0 0; font-size: 30px; letter-spacing: -0.06em; }
      .drawer-body { overflow: auto; padding: 18px; display: grid; gap: 16px; background: #f7f9fc; }
      .drawer-footer { padding: 16px; background: #fff; border-top: 1px solid var(--line); }
      .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .detail-cell { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 12px; }
      .detail-cell span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 900; }
      .detail-cell strong { display: block; margin-top: 5px; font-size: 14px; }
      .note-card { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 12px; }
      .note-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 11px; margin-bottom: 6px; }
      .modal-backdrop { display: grid; place-items: center; padding: 20px; }
      .modal-card { width: min(900px, 100%); max-height: min(860px, calc(100vh - 40px)); overflow: visible; border-radius: 30px; display: grid; grid-template-rows: auto minmax(0,1fr) auto; }
      .modal-header { padding: 22px; background: linear-gradient(135deg, #fff, #f8fafc); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .modal-header h2 { margin: 0; letter-spacing: -0.05em; }
      .modal-body { padding: 22px; overflow: auto; display: grid; gap: 18px; }
      .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .field { display: grid; gap: 7px; }
      .field label { color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-weight: 900; }
      .modal-footer { padding: 16px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px; background: #fff; }
      .login-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 20% 0%, rgba(242,106,33,0.22), transparent 28%), linear-gradient(135deg, #06172d 0%, #0b2d55 100%); }
      .login-panel { width: min(960px, 100%); display: grid; grid-template-columns: 1.1fr 0.9fr; overflow: visible; border-radius: 34px; }
      .login-story { padding: 44px; background: linear-gradient(135deg, rgba(7,27,51,0.96), rgba(18,61,112,0.96)); color: #fff; }
      .login-story h1 { margin: 18px 0 0; font-size: clamp(38px, 5vw, 68px); line-height: 0.92; letter-spacing: -0.08em; }
      .login-story p { color: #cadaec; line-height: 1.6; max-width: 520px; }
      .login-form { padding: 44px; background: rgba(255,255,255,0.94); display: grid; align-content: center; gap: 18px; }
      .login-form h2 { margin: 0; font-size: 28px; letter-spacing: -0.05em; }
      .login-kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 24px; }
      .login-kpis div { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16); border-radius: 18px; padding: 14px; }
      .login-kpis strong { display: block; font-size: 22px; }
      .login-kpis span { color: #b7c8dc; font-size: 11px; }
      .auth-tabs { display: flex; gap: 6px; }
      .auth-tabs button { flex: 1; padding: 9px 10px; border-radius: 9px; border: 1px solid #d5e1ee; background: #fff; cursor: pointer; font-weight: 600; color: #5b6b7c; font-size: 13px; }
      .auth-tabs button.active { background: #123a66; border-color: #123a66; color: #fff; }
      .auth-message { font-size: 12.5px; padding: 8px 10px; border-radius: 8px; }
      .auth-message.error { background: #fdeeee; color: #a33a3a; border: 1px solid #f2c8c8; }
      .auth-message.info { background: #ebf4fd; color: #1c4d8f; border: 1px solid #c9def5; }
      .link-button { background: none; border: 0; color: #2f80ed; cursor: pointer; font-size: 12.5px; padding: 0; text-decoration: underline; align-self: flex-start; }
      .role-chip { display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5b6b7c; background: #eef2f7; border-radius: 5px; padding: 2px 7px; width: fit-content; }
      .role-chip.admin { color: #1c4d8f; background: #e3eefc; }
      .dropzone { border: 1.5px dashed #b9cbdf; border-radius: 12px; padding: 14px 16px; background: #f8fbff; color: #5b6b7c; font-size: 13px; cursor: pointer; text-align: center; transition: border-color .15s ease, background .15s ease; margin-bottom: 14px; }
      .dropzone.drag { border-color: #2f80ed; background: #eaf3ff; color: #1c4d8f; }
      .dropzone strong { color: #22384f; }
      .import-summary { margin: -6px 0 14px; font-size: 12px; color: #1f7a43; background: #ebf8f0; border: 1px solid #bfe8cf; border-radius: 8px; padding: 6px 10px; }
      .note-card.audit { padding: 8px 12px; background: #f6f8fb; border-style: dashed; }
      .update-item.audit { background: #f6f8fb; border-style: dashed; }
      .audit-tag { font-size: 9px; letter-spacing: .08em; font-weight: 700; color: #7a8aa0; border: 1px solid #cbd6e4; border-radius: 4px; padding: 1px 5px; }
      .attachment-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #dbe5f0; border-radius: 10px; background: #f8fbff; margin-top: 14px; }
      .attachment-row .attachment-copy { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .attachment-row .attachment-copy strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .attachment-row .attachment-copy span { font-size: 11px; color: #5b6b7c; }
      .mini-toggle { display: inline-flex; gap: 4px; }
      .mini-toggle button { font-size: 11px; padding: 4px 8px; border-radius: 6px; border: 1px solid #d5e1ee; background: #fff; cursor: pointer; color: #5b6b7c; }
      .mini-toggle button.active { background: #eef4fb; border-color: #9db9d8; color: #123a66; }
      @media (max-width: 1180px) {
        .app-shell { grid-template-columns: 86px minmax(0, 1fr); }
        .brand-block, .sidebar-card, .profile-copy, .nav-text { display: none; }
        .sidebar { padding: 18px 12px; }
        .nav-button { justify-content: center; padding: 12px 8px; }
        .profile-card { justify-content: center; }
        .dashboard-grid { grid-template-columns: 1fr; }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 760px) {
        html, body, #root { min-height: 100dvh; }
        body { overflow-x: hidden; }
        input, select, textarea { font-size: 16px; }
        .app-shell { display: block; height: auto; min-height: 100dvh; padding-bottom: 84px; overflow: visible; }
        .sidebar { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 110; height: 76px; padding: 8px max(8px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-right)); flex-direction: row; align-items: center; overflow-x: auto; border-radius: 24px 24px 0 0; box-shadow: 0 -18px 45px rgba(6,24,44,0.28); }
        .sidebar:before, .brand-block, .sidebar-card, .profile-card { display: none; }
        .nav-stack { width: 100%; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(70px, 1fr); gap: 6px; overflow-x: auto; }
        .nav-button { min-width: 70px; min-height: 58px; padding: 7px 6px; border-radius: 17px; flex-direction: column; justify-content: center; gap: 4px; }
        .nav-icon { width: 28px; height: 28px; border-radius: 11px; font-size: 12px; }
        .nav-text { display: block; }
        .nav-text strong { display: block; font-size: 10px; line-height: 1.1; text-align: center; }
        .nav-text span { display: none; }
        .workspace { min-height: 100dvh; display: block; }
        .topbar { position: sticky; top: 0; z-index: 60; padding: 10px 12px 8px; gap: 8px; box-shadow: 0 8px 30px rgba(6,24,44,0.08); }
        .topbar-row { align-items: flex-start; flex-direction: column; gap: 8px; }
        .eyebrow { font-size: 10px; letter-spacing: 0.14em; }
        .page-title { font-size: 22px; letter-spacing: -0.05em; }
        .page-subtitle { display: none; }
        .top-actions { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
        .top-actions .ghost-button, .top-actions .secondary-button, .top-actions .primary-button { width: 100%; min-height: 36px; padding: 0 6px; font-size: 11px; border-radius: 13px; box-shadow: none; }
        .filter-bar { display: block; border-radius: 18px; padding: 6px; box-shadow: none; }
        .filter-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
        .filter-toggle { display: inline-flex; align-items: center; justify-content: center; min-width: 86px; height: 38px; border: 1px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink); font-weight: 900; font-size: 12px; }
        .filter-toggle.active { background: var(--ink); color: #fff; border-color: var(--ink); }
        .filter-controls { display: none; margin-top: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .filter-bar.open .filter-controls { display: grid; }
        .search-box { grid-column: auto; min-width: 0; }
        .search-box input { height: 38px; border-radius: 14px; }
        .select { width: 100%; min-width: 0; height: 38px; }
        .filter-controls .chip { display: none; }
        .content-scroll { overflow: visible; padding: 14px 12px 104px; }
        .dashboard-grid, .split-panel, .timeline-item, .login-panel { grid-template-columns: 1fr; }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .metric-card, .panel, .lane-card, .due-section { border-radius: 22px; padding: 14px; }
        .metric-value { font-size: 26px; }
        .panel-header { align-items: flex-start; flex-direction: column; gap: 8px; }
        .board { min-width: 0; grid-template-columns: 1fr; gap: 12px; }
        .column { min-height: auto; border-radius: 22px; }
        .column-body { min-height: 120px; }
        .job-card { border-radius: 20px; padding: 14px; }
        .job-footer, .risk-top, .mini-top, .timeline-top, .due-heading { align-items: flex-start; flex-direction: column; }
        .status-switch { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .status-button { min-height: 36px; padding: 0 8px; }
        .lane-grid, .business-grid { grid-template-columns: 1fr; gap: 12px; }
        .business-grid { min-width: 0; }
        .bu-hero { flex-direction: column; padding: 16px; }
        .staff-add-form, .staff-row { grid-template-columns: 1fr; }
        .staff-row { padding: 12px; border-radius: 20px; }
        .staff-status-block, .staff-actions { justify-content: flex-start; }
        .staff-actions .select, .staff-actions button { width: 100%; }
        .timeline-item { align-items: stretch; }
        .table-wrap { border-radius: 22px; margin: 0 -2px; }
        .drawer { inset: 0; width: 100%; border-radius: 0; }
        .drawer-header { padding: 18px; }
        .drawer-title { font-size: 26px; }
        .drawer-body { padding: 14px; }
        .drawer-footer { padding: 14px; padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
        .modal-backdrop { padding: 0; align-items: stretch; }
        .modal-card { width: 100%; min-height: 100dvh; max-height: 100dvh; border-radius: 0; }
        .modal-header, .modal-body, .modal-footer { padding-left: 16px; padding-right: 16px; }
        .modal-footer { padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
        .form-grid, .detail-grid { grid-template-columns: 1fr; }
        .login-shell { padding: 12px; }
        .login-story, .login-form { padding: 24px; }
        .login-story h1 { font-size: 36px; }
        .login-kpis { grid-template-columns: 1fr; }
      }
      @media (max-width: 420px) {
        .metric-grid { grid-template-columns: 1fr; }
        .top-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .top-actions .ghost-button, .top-actions .secondary-button, .top-actions .primary-button { font-size: 10px; }
        .nav-stack { grid-auto-columns: minmax(66px, 1fr); }
      }
    `}</style>
  );
}

function LoginScreen({ onLocalLogin }) {
  const cloud = Boolean(supabase);
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [localName, setLocalName] = useState("Workshop Lead");
  const [localEmail, setLocalEmail] = useState("workshop@flexachem.com");

  const submit = async (e) => {
    e.preventDefault();
    if (!cloud) {
      onLocalLogin({ email: localEmail.trim() || "workshop@flexachem.com", name: localName.trim() || "Workshop Lead" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMessage({ tone: "info", text: "Account created. Check your email to confirm, then sign in." });
      }
    } catch (err) {
      setMessage({ tone: "error", text: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setMessage({ tone: "error", text: "Enter your email above first, then press “Forgot password?”." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
      setMessage({ tone: "info", text: "Password reset link sent — check your email." });
    } catch (err) {
      setMessage({ tone: "error", text: err?.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DesignSystem />
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-story">
            <div className="brand-block" style={{ padding: 0, border: 0 }}>
              <div className="brand-mark">F</div>
              <div>
                <div className="brand-title">Flexachem</div>
                <div className="brand-subtitle">Workshop Control Tower</div>
              </div>
            </div>
            <h1>Service jobs, dates and blockers in one premium dashboard.</h1>
            <p>Built for the real workshop: a three-hour job can sit open for days while parts, customers, testing slots and service updates move around it.</p>
            <div className="login-kpis">
              <div><strong>3</strong><span>core statuses</span></div>
              <div><strong>BU</strong><span>business unit views</span></div>
              <div><strong>Live</strong><span>notes from workshop technicians</span></div>
            </div>
          </div>
          {cloud ? (
            <form className="login-form" onSubmit={submit}>
              <div>
                <div className="eyebrow">Secure workshop entry</div>
                <h2>{mode === "signin" ? "Sign in" : "Create your account"}</h2>
                <p className="page-subtitle">{mode === "signin" ? "Use your workshop email and password." : "New accounts start with staff access — an admin can upgrade you."}</p>
              </div>
              <div className="auth-tabs">
                <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(null); }}>Sign in</button>
                <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(null); }}>Create account</button>
              </div>
              {mode === "signup" && (
                <div className="field">
                  <label>Your name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Darragh" />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
              </div>
              {message && <div className={`auth-message ${message.tone}`}>{message.text}</div>}
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in →" : "Create account →"}</button>
              {mode === "signin" && <button type="button" className="link-button" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
            </form>
          ) : (
            <form className="login-form" onSubmit={submit}>
              <div>
                <div className="eyebrow">Local demo mode</div>
                <h2>Continue to the dashboard</h2>
                <p className="page-subtitle">No Supabase configured — data stays in this browser and you get full admin access.</p>
              </div>
              <div className="field">
                <label>Your name</label>
                <input className="input" value={localName} onChange={(e) => setLocalName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} />
              </div>
              <button className="primary-button" type="submit">Enter workshop dashboard →</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function NavButton({ active, icon, label, hint, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-text"><strong>{label}</strong><span>{hint}</span></span>
    </button>
  );
}

function DataSyncStatus({ jobsState, staffState }) {
  const states = [jobsState, staffState];
  const hasIssue = states.some((state) => state === "error");
  const isSyncing = states.some((state) => state === "syncing");
  const localOnly = !supabase || states.every((state) => state === "local");
  const label = hasIssue ? "Sync Issue" : isSyncing ? "Syncing…" : localOnly ? "Saved Locally" : "Data Synced";
  const detail = hasIssue
    ? "Some changes may not be live yet."
    : isSyncing
      ? "Checking the latest workshop data."
      : localOnly
        ? "Changes are saved on this device."
        : "Latest workshop data is available.";
  const tone = hasIssue ? "issue" : isSyncing ? "working" : localOnly ? "local" : "ok";

  return (
    <div className={`data-sync-card ${tone}`}>
      <div className="data-sync-dot" />
      <div>
        <div className="data-sync-label">{label}</div>
        <div className="data-sync-detail">{detail}</div>
      </div>
    </div>
  );
}

function Topbar({ view, filters, people, businessUnits, metrics, updateFilter, resetFilters, onNewJob, onOpenUpdates }) {
  const titles = {
    dashboard: ["Workshop Command Centre", "Live visibility across staff, business units and due-date risk."],
    board: ["Schedule Production Board", "Drag cards between status lanes or use the quick status controls."],
    employees: ["Staff Management", "Add staff, deactivate leavers, reassign open jobs and monitor workload."],
    jobtypes: ["Job Type Management", "Add job types, batch-move jobs to another type, deactivate or remove unused types."],
    business: ["Business Unit Portfolio", "Roll up jobs by Pharma, Industrial, Engineering, Mining and Other."],
    due: ["Due Date Control", "Understand overdue work, delivery windows and small jobs that span multiple days."],
    list: ["Master Job Register", "Dense, searchable production list for admin and planning."],
  };
  const [title, subtitle] = titles[view] || titles.dashboard;
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = [
    filters.search.trim(),
    filters.employee !== "All",
    filters.bus !== "All",
    filters.status !== "All",
    filters.horizon !== "All",
  ].filter(Boolean).length;
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div>
          <div className="eyebrow">Flexachem workshop</div>
          <h1 className="page-title">{title}</h1>
          <div className="page-subtitle">{subtitle}</div>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={onOpenUpdates}>Recent updates</button>
          <button className="secondary-button" onClick={resetFilters}>Reset filters</button>
          {onNewJob && <button className="primary-button" onClick={onNewJob}>+ Log new job</button>}
        </div>
      </div>
      <div className={`filter-bar ${filterOpen ? "open" : ""}`}>
        <div className="filter-summary">
          <label className="search-box">
            <span>⌕</span>
            <input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search jobs…" />
          </label>
          <button className={`filter-toggle ${filterOpen ? "active" : ""}`} type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
        <div className="filter-controls">
          <select className="select" value={filters.employee} onChange={(e) => updateFilter("employee", e.target.value)}>
            <option value="All">All staff</option>{people.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="select" value={filters.bus} onChange={(e) => updateFilter("bus", e.target.value)}>
            <option value="All">All units</option>{businessUnits.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="select" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="All">All statuses</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={filters.horizon} onChange={(e) => updateFilter("horizon", e.target.value)}>
            <option value="All">All dates</option>{["Overdue", "Due today", "Next 7 days", "Next 30 days", "Later", "No due date", "Complete"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="chip">{metrics.open} open</span>
          <span className="chip">{metrics.hours}h booked</span>
        </div>
      </div>
    </header>
  );
}

function LoadingState() {
  return <div className="panel"><div className="panel-title">Loading workshop jobs…</div><div className="panel-subtitle">Fetching rows and preparing the control tower.</div></div>;
}

function DashboardView({ jobs, allJobs, metrics, updates, people, onSelect, onEdit, onStatus, onOpenUpdates }) {
  const risky = jobs.filter((j) => j.status !== "Complete").sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 5);
  return (
    <div>
      <div className="dashboard-grid">
        <div>
          <div className="metric-grid">
            <Metric label="Overdue" value={metrics.overdue} detail="Requires attention" tone="red" />
            <Metric label="Hours booked" value={`${metrics.hours}h`} detail="Filtered allocation" />
            <Metric label="Complete" value={metrics.complete} detail={`${metrics.progress}% done`} tone="green" />
            <Metric label="Total jobs" value={jobs.length} detail={`${allJobs.length} in database/cache`} />
          </div>
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-header">
              <div><h3 className="panel-title">High-risk queue</h3><div className="panel-subtitle">Sorted by due date, blocker status and priority.</div></div>
              {onEdit && <button className="ghost-button" onClick={() => onEdit({})}>Add job</button>}
            </div>
            <div className="risk-list">
              {risky.length ? risky.map((job) => <RiskItem key={job.id} job={job} onSelect={onSelect} onStatus={onStatus} />) : <EmptyState text="No risk items in the current filter." />}
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-header">
              <div><h3 className="panel-title">Job Status</h3><div className="panel-subtitle">Filtered completion ratio.</div></div>
            </div>
            <div className="split-panel">
              <div className="progress-ring" style={{ "--progress": metrics.progress }}><strong>{metrics.progress}%</strong></div>
              <div className="bar-list">
                {STATUS_ORDER.map((status) => {
                  const count = jobs.filter((j) => j.status === status).length;
                  const width = jobs.length ? Math.max(4, (count / jobs.length) * 100) : 0;
                  return <BarRow key={status} label={status} value={`${count} jobs`} width={width} />;
                })}
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h3 className="panel-title">Staff Availability</h3><div className="panel-subtitle">Open hours by staff member.</div></div>
            </div>
            <div className="bar-list">
              {people.map((person) => {
                const hours = jobs.filter((j) => j.alloc === person && j.status !== "Complete").reduce((sum, j) => sum + Number(j.hrs || 0), 0);
                const max = Math.max(1, ...people.map((p) => jobs.filter((j) => j.alloc === p && j.status !== "Complete").reduce((sum, j) => sum + Number(j.hrs || 0), 0)));
                return <BarRow key={person} label={person} value={`${hours}h`} width={(hours / max) * 100} />;
              })}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h3 className="panel-title">Recent workshop updates</h3><div className="panel-subtitle">Latest notes across the floor.</div></div>
              <button className="ghost-button" onClick={onOpenUpdates}>View all</button>
            </div>
            <UpdatesList updates={updates.slice(0, 5)} onSelect={onSelect} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return <div className="metric-card"><div className="metric-label"><span>{label}</span><span>●</span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function BarRow({ label, value, width }) {
  return <div className="bar-row"><div className="bar-meta"><strong>{label}</strong><span>{value}</span></div><div className="bar-track"><div className="bar-fill" style={{ "--width": `${Math.min(100, Math.max(0, width))}%` }} /></div></div>;
}

function RiskItem({ job, onSelect, onStatus }) {
  return (
    <button className="risk-item" style={{ textAlign: "left" }} onClick={() => onSelect(job.id)}>
      <div className="risk-top">
        <div><div className="job-code">{job.asm || "No assembly"} · {job.cust}</div><div className="job-subline">{job.type} · {job.alloc} · due {formatDate(job.due)}</div></div>
        <StatusChip status={job.status} />
      </div>
      <div className="job-meta">
        <span className={`priority-chip ${job.priority}`}>{job.priority}</span>
        <span className="chip">{job.hrs}h hours booked</span>
        <span className="chip">{jobCalendarSpan(job)} day window</span>
      </div>
      <div style={{ marginTop: 10 }}><StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} /></div>
    </button>
  );
}

function BoardView({ jobs, onSelect, onEdit, onStatus }) {
  const columns = STATUS_ORDER.map((status) => ({ status, jobs: jobs.filter((job) => job.status === status) }));
  return (
    <div className="board">
      {columns.map((column) => <BoardColumn key={column.status} status={column.status} jobs={column.jobs} onSelect={onSelect} onEdit={onEdit} onStatus={onStatus} />)}
    </div>
  );
}

function BoardColumn({ status, jobs, onSelect, onEdit, onStatus }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}`, data: { type: "column", status } });
  const meta = STATUS_META[status];
  return (
    <section ref={setNodeRef} className={`column ${isOver ? "over" : ""}`}>
      <div className="column-header">
        <div className="column-title"><StatusChip status={status} /> <span>{meta.label}</span></div>
        <div className="column-count">{jobs.length} jobs</div>
      </div>
      <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
        <div className="column-body">
          {jobs.length ? jobs.map((job) => <JobCard key={job.id} job={job} onSelect={onSelect} onEdit={onEdit} onStatus={onStatus} />) : <EmptyState text={`Drop jobs here to mark them ${status.toLowerCase()}.`} />}
        </div>
      </SortableContext>
    </section>
  );
}

function JobCard({ job, overlay, onSelect, onEdit, onStatus }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, data: { type: "job", status: job.status } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const latest = parseNotes(job.notes)[0];
  return (
    <article ref={setNodeRef} style={style} className={`job-card ${overlay ? "overlay" : ""} ${isDragging ? "dragging" : ""}`}>
      <div className="job-accent" />
      <div className="job-card-header" {...attributes} {...listeners}>
        <div>
          <StatusChip status={job.status} />
          <h3 className="job-title">{job.asm || "No assembly"}{job.attachment && <span title={job.attachment.name} style={{ marginLeft: 6, fontSize: 13 }}>📎</span>}</h3>
          <div className="job-subline">SO {job.so || "TBA"} · {job.cust || "No customer"}</div>
        </div>
        <span className={`priority-chip ${job.priority}`}>{job.priority}</span>
      </div>
      <p className="job-details">{job.type} · {job.details || "No extra details recorded."}</p>
      <div className="job-meta">
        <span className="chip">{job.alloc || "Unassigned"}</span>
        <span className="chip">{job.bus}</span>
        <span className="chip">{job.hrs}h / {jobCalendarSpan(job)} days</span>
        <span className="chip">Due {formatDate(job.due)}</span>
      </div>
      {latest && <div className="note-card" style={{ marginTop: 12, padding: 10 }}><div className="note-meta"><span>{latest.by}</span><span>{formatDateTime(latest.at)}</span></div><div style={{ fontSize: 12, color: "var(--muted)" }}>{latest.txt}</div></div>}
      <div className="job-footer">
        <StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} />
        <div className="card-actions">
          <button className="icon-button" onClick={() => onSelect(job.id)} title="Open notes">↗</button>
          {onEdit && <button className="icon-button" onClick={() => onEdit(job)} title="Edit">✎</button>}
        </div>
      </div>
    </article>
  );
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META["Not Started"];
  return <span className={`status-chip ${meta.tone}`}><span>{meta.icon}</span>{meta.short}</span>;
}

function StatusSwitch({ value, onChange }) {
  return (
    <div className="status-switch" onClick={(e) => e.stopPropagation()}>
      {["In Progress", "Input Needed", "Complete"].map((status) => (
        <button key={status} className={`status-button ${value === status ? "active" : ""}`} onClick={() => onChange(status)}>{STATUS_META[status].short}</button>
      ))}
    </div>
  );
}

function StaffView({ jobs, allJobs, staff, people, activePeople, profiles = [], currentUserId, onSelect, onStatus, onAddStaff, onUpdateStaff, onDeleteStaff, onReassignStaff, onUpdateProfile }) {
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("Workshop technician");
  const [reassignTargets, setReassignTargets] = useState({});
  const groups = makeGroups(jobs, (job) => job.alloc);
  const staffByName = useMemo(() => new Map(staff.map((member) => [member.name, member])), [staff]);
  const activeCount = staff.filter((member) => member.active).length;
  const inactiveCount = staff.filter((member) => !member.active).length;

  const submit = (e) => {
    e.preventDefault();
    const name = newStaffName.trim();
    if (!name) return;
    onAddStaff({ name, role: newStaffRole.trim() || "Workshop technician", active: true });
    setNewStaffName("");
    setNewStaffRole("Workshop technician");
  };

  return (
    <div className="staff-page">
      <section className="panel staff-management-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Staff management</h3>
            <div className="panel-subtitle">Deactivate leavers to remove them from future job assignment, or add new technicians here.</div>
          </div>
          <div className="staff-kpi-row">
            <span className="chip">{activeCount} active</span>
            <span className="chip">{inactiveCount} inactive</span>
          </div>
        </div>
        <form className="staff-add-form" onSubmit={submit}>
          <input className="input" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="New staff member name" />
          <input className="input" value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)} placeholder="Role" />
          <button className="primary-button" type="submit">+ Add staff</button>
        </form>
        <div className="staff-table">
          {staff.map((member) => {
            const openJobs = allJobs.filter((job) => job.alloc === member.name && job.status !== "Complete");
            const activeChoices = activePeople.filter((name) => name !== member.name);
            const selectedTarget = reassignTargets[member.name] || "Unassigned";
            return (
              <div className={`staff-row ${member.active ? "" : "inactive"}`} key={member.id}>
                <div className="staff-main">
                  <div className="lane-avatar">{member.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.role || "Workshop technician"}</span>
                  </div>
                </div>
                <div className="staff-status-block">
                  <span className={`status-chip ${member.active ? "green" : "neutral"}`}><span>{member.active ? "✓" : "–"}</span>{member.active ? "Active" : "Inactive"}</span>
                  <span className="chip">{openJobs.length} open jobs</span>
                </div>
                <div className="staff-actions">
                  <select className="select" value={selectedTarget} onChange={(e) => setReassignTargets((prev) => ({ ...prev, [member.name]: e.target.value }))}>
                    <option>Unassigned</option>
                    {activeChoices.map((name) => <option key={name}>{name}</option>)}
                  </select>
                  <button className="ghost-button" type="button" disabled={!openJobs.length} onClick={() => onReassignStaff(member.name, selectedTarget)}>Move open jobs</button>
                  <button className="secondary-button" type="button" onClick={() => onUpdateStaff(member.id, { active: !member.active })}>{member.active ? "Deactivate" : "Reactivate"}</button>
                  {!PEOPLE.includes(member.name) && <button className="ghost-button danger" type="button" onClick={() => window.confirm(`Remove ${member.name} from the staff list? Open jobs will be set to Unassigned.`) && onDeleteStaff(member.id)}>Remove</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {supabase && (
        <section className="panel staff-management-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Login accounts</h3>
              <div className="panel-subtitle">Admins get every section; staff see the Dashboard and Schedule and can post progress updates. New signups start as staff.</div>
            </div>
            <span className="chip">{profiles.length} account{profiles.length === 1 ? "" : "s"}</span>
          </div>
          <div className="staff-table">
            {profiles.length ? profiles.map((profile) => (
              <div className={`staff-row ${profile.active === false ? "inactive" : ""}`} key={profile.id}>
                <div className="staff-main">
                  <div className="lane-avatar">{(profile.name || profile.email || "?").slice(0, 1).toUpperCase()}</div>
                  <div><strong>{profile.name || "—"}</strong><span>{profile.email}</span></div>
                </div>
                <div className="staff-status-block">
                  <span className={`status-chip ${profile.role === "admin" ? "blue" : "neutral"}`}><span>{profile.role === "admin" ? "★" : "–"}</span>{profile.role === "admin" ? "Admin" : "Staff"}</span>
                  <span className={`status-chip ${profile.active === false ? "neutral" : "green"}`}><span>{profile.active === false ? "–" : "✓"}</span>{profile.active === false ? "Disabled" : "Active"}</span>
                </div>
                <div className="staff-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      if (profile.id === currentUserId && !window.confirm("Change your own role? You will lose admin access immediately.")) return;
                      onUpdateProfile(profile.id, { role: profile.role === "admin" ? "staff" : "admin" });
                    }}
                  >
                    {profile.role === "admin" ? "Make staff" : "Make admin"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={profile.id === currentUserId}
                    title={profile.id === currentUserId ? "You cannot disable your own account" : undefined}
                    onClick={() => onUpdateProfile(profile.id, { active: profile.active === false })}
                  >
                    {profile.active === false ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            )) : <EmptyState text="No login accounts found yet. Accounts appear here after people sign up." />}
          </div>
        </section>
      )}

      <div className="lane-grid">
        {people.map((person) => {
          const items = groups[person] || [];
          const open = items.filter((j) => j.status !== "Complete");
          const hours = open.reduce((sum, j) => sum + Number(j.hrs || 0), 0);
          const blocked = open.filter((j) => j.status === "Input Needed").length;
          const member = staffByName.get(person);
          const inactive = member && !member.active;
          return (
            <section className={`lane-card ${inactive ? "inactive" : ""}`} key={person}>
              <div className="lane-header">
                <div className="lane-title"><span className="lane-avatar">{person.slice(0, 1)}</span>{person}{inactive && <span className="chip">Inactive</span>}</div>
                <StatusChip status={blocked ? "Input Needed" : open.length ? "In Progress" : "Complete"} />
              </div>
              <div className="lane-summary">
                <div className="summary-cell"><strong>{open.length}</strong><span>Open</span></div>
                <div className="summary-cell"><strong>{hours}h</strong><span>Hours booked</span></div>
                <div className="summary-cell"><strong>{blocked}</strong><span>Blocked</span></div>
              </div>
              <div className="job-list">
                {items.length ? items.map((job) => <MiniJob key={job.id} job={job} onSelect={onSelect} onStatus={onStatus} />) : <EmptyState text="No filtered work allocated." />}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function JobTypesView({ allJobs, jobTypes, activeJobTypes, onAddJobType, onUpdateJobType, onDeleteJobType, onReassignJobType }) {
  const [newTypeName, setNewTypeName] = useState("");
  const [moveTargets, setMoveTargets] = useState({});
  const activeCount = jobTypes.filter((jobType) => jobType.active).length;
  const inactiveCount = jobTypes.filter((jobType) => !jobType.active).length;

  const submit = (e) => {
    e.preventDefault();
    const name = newTypeName.trim();
    if (!name) return;
    onAddJobType({ name, active: true });
    setNewTypeName("");
  };

  return (
    <div className="staff-page">
      <section className="panel staff-management-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Job type management</h3>
            <div className="panel-subtitle">Add new job types, batch-move existing jobs onto a different type, and deactivate or remove types that are no longer used.</div>
          </div>
          <div className="staff-kpi-row">
            <span className="chip">{activeCount} active</span>
            <span className="chip">{inactiveCount} inactive</span>
          </div>
        </div>
        <form className="staff-add-form" onSubmit={submit}>
          <input className="input" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="New job type name" />
          <button className="primary-button" type="submit">+ Add job type</button>
        </form>
        <div className="staff-table">
          {jobTypes.map((jobType) => {
            const typeJobs = allJobs.filter((job) => job.type === jobType.name);
            const openJobs = typeJobs.filter((job) => job.status !== "Complete");
            const moveChoices = activeJobTypes.filter((name) => name !== jobType.name);
            const selectedTarget = moveTargets[jobType.name] || moveChoices[0] || "";
            const isDefault = JOB_TYPES.includes(jobType.name);
            const canRemove = !isDefault && openJobs.length === 0;
            return (
              <div className={`staff-row ${jobType.active ? "" : "inactive"}`} key={jobType.id}>
                <div className="staff-main">
                  <div className="lane-avatar">{jobType.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{jobType.name}</strong>
                    <span>{isDefault ? "Standard job type" : "Custom job type"}</span>
                  </div>
                </div>
                <div className="staff-status-block">
                  <span className={`status-chip ${jobType.active ? "green" : "neutral"}`}><span>{jobType.active ? "✓" : "–"}</span>{jobType.active ? "Active" : "Inactive"}</span>
                  <span className="chip">{openJobs.length} open · {typeJobs.length} total</span>
                </div>
                <div className="staff-actions">
                  <select className="select" value={selectedTarget} onChange={(e) => setMoveTargets((prev) => ({ ...prev, [jobType.name]: e.target.value }))} disabled={!moveChoices.length}>
                    {moveChoices.length ? moveChoices.map((name) => <option key={name}>{name}</option>) : <option value="">No other active type</option>}
                  </select>
                  <button className="ghost-button" type="button" disabled={!typeJobs.length || !selectedTarget} onClick={() => onReassignJobType(jobType.name, selectedTarget)}>Move all jobs</button>
                  <button className="secondary-button" type="button" onClick={() => onUpdateJobType(jobType.id, { active: !jobType.active })}>{jobType.active ? "Deactivate" : "Reactivate"}</button>
                  {!isDefault && <button className="ghost-button danger" type="button" disabled={!canRemove} title={openJobs.length ? "Move or complete open jobs before removing this type" : undefined} onClick={() => canRemove && window.confirm(`Remove the "${jobType.name}" job type? This cannot be undone.`) && onDeleteJobType(jobType.id)}>Remove</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BusinessUnitView({ jobs, businessUnits, onSelect, onStatus }) {
  const groups = makeGroups(jobs, (job) => job.bus);
  return (
    <div className="business-grid">
      {businessUnits.map((unit) => {
        const items = groups[unit] || [];
        const open = items.filter((j) => j.status !== "Complete");
        const hours = open.reduce((sum, j) => sum + Number(j.hrs || 0), 0);
        return (
          <section className="bu-card" key={unit}>
            <div className="bu-hero">
              <div><h3>{unit}</h3><div className="panel-subtitle" style={{ color: "#d8e8fb" }}>{open.length} open · {hours}h booked</div></div>
              <div className="bu-stat" style={{ minWidth: 95 }}><strong>{items.length}</strong><span>Total</span></div>
            </div>
            <div className="bu-body">
              {items.length ? items.map((job) => <MiniJob key={job.id} job={job} onSelect={onSelect} onStatus={onStatus} />) : <EmptyState text="No filtered jobs for this business unit." />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DueDateView({ jobs, onSelect, onStatus }) {
  const order = ["Overdue", "Due today", "Next 7 days", "Next 30 days", "Later", "No due date", "Complete"];
  const groups = makeGroups(jobs, dueBucket);
  return (
    <div className="due-stack">
      {order.map((bucket) => {
        const items = (groups[bucket] || []).sort((a, b) => (parseISODate(a.due)?.getTime() || 0) - (parseISODate(b.due)?.getTime() || 0));
        return (
          <section className="due-section" key={bucket}>
            <div className="due-heading"><h3>{bucket}</h3><span className="chip">{items.length} jobs</span></div>
            <div className="job-list">
              {items.length ? items.map((job) => <TimelineJob key={job.id} job={job} onSelect={onSelect} onStatus={onStatus} />) : <EmptyState text="No jobs in this due-date bucket." />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimelineJob({ job, onSelect, onStatus }) {
  const span = jobCalendarSpan(job);
  const width = Math.min(100, Math.max(16, span * 9));
  return (
    <div className="timeline-item">
      <div><div className="timeline-date">{formatDate(job.due, { year: "numeric" })}</div><div className="job-subline">Start {formatDate(job.start)}</div></div>
      <button style={{ textAlign: "left", background: "transparent", border: 0, padding: 0 }} onClick={() => onSelect(job.id)}>
        <div className="timeline-top"><div><div className="job-code">{job.asm} · {job.cust}</div><div className="job-subline">{job.alloc} · {job.type} · {job.hrs} hours booked hours across {span} calendar day{span === 1 ? "" : "s"}</div></div><StatusChip status={job.status} /></div>
        <div className="window-bar"><div className="window-fill" style={{ "--width": `${width}%` }} /></div>
      </button>
      <StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} />
    </div>
  );
}

function ListView({ jobs, deletedJobs = [], onSelect, onEdit, onStatus, onDelete, onRestore }) {
  const [showDeleted, setShowDeleted] = useState(false);
  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Assembly</th><th>Customer / SO</th><th>BU</th><th>Staff</th><th>Work window</th><th>Hours</th><th>Status</th><th>Updates</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map((job) => {
              const notes = parseNotes(job.notes);
              return (
                <tr key={job.id}>
                  <td><button style={{ background: "transparent", border: 0, padding: 0, textAlign: "left" }} onClick={() => onSelect(job.id)}><div className="job-code">{job.asm || "No assembly"}{job.attachment && <span title={job.attachment.name} style={{ marginLeft: 5 }}>📎</span>}</div><div className="job-subline">{job.type}</div></button></td>
                  <td><strong>{job.cust}</strong><div className="job-subline">SO {job.so || "TBA"}</div></td>
                  <td>{job.bus}</td>
                  <td>{job.alloc}</td>
                  <td>{formatDate(job.start)} → {formatDate(job.due)}<div className="job-subline">{jobCalendarSpan(job)} calendar days</div></td>
                  <td>{job.hrs}h<div className="job-subline">Actual {job.actualHrs || 0}h</div></td>
                  <td><StatusChip status={job.status} /><div style={{ marginTop: 8 }}><StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} /></div></td>
                  <td>{notes[0] ? <div><strong>{notes[0].by}</strong><div className="job-subline">{notes[0].txt}</div></div> : <span className="job-subline">No notes</span>}</td>
                  <td><div className="card-actions"><button className="icon-button" onClick={() => onSelect(job.id)}>↗</button><button className="icon-button" onClick={() => onEdit(job)}>✎</button><button className="icon-button" onClick={() => onDelete(job)}>×</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {onRestore && deletedJobs.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div><h3 className="panel-title">Deleted jobs</h3><div className="panel-subtitle">Archived with full history — restore to bring a job back to the register.</div></div>
            <button className="ghost-button" type="button" onClick={() => setShowDeleted((v) => !v)}>{showDeleted ? "Hide" : `Show deleted (${deletedJobs.length})`}</button>
          </div>
          {showDeleted && (
            <div className="staff-table">
              {deletedJobs.map((job) => {
                const audit = parseNotes(job.notes).find((n) => n.kind === "audit" && /deleted/i.test(n.txt));
                return (
                  <div className="staff-row inactive" key={job.id}>
                    <div className="staff-main">
                      <div className="lane-avatar">{(job.asm || "?").slice(0, 1).toUpperCase()}</div>
                      <div><strong>{job.asm || "No assembly"} · {job.cust}</strong><span>{job.type} · {audit ? `Deleted by ${audit.by} · ${formatDateTime(audit.at)}` : "Deleted"}</span></div>
                    </div>
                    <div className="staff-actions">
                      <button className="secondary-button" type="button" onClick={() => onRestore(job)}>Restore</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MiniJob({ job, onSelect, onStatus }) {
  return (
    <div className="mini-job">
      <div className="mini-top">
        <button style={{ textAlign: "left", background: "transparent", border: 0, padding: 0 }} onClick={() => onSelect(job.id)}>
          <div className="job-code">{job.asm} · {job.cust}</div>
          <div className="job-subline">{job.type} · due {formatDate(job.due)} · {job.hrs}h / {jobCalendarSpan(job)} days</div>
        </button>
        <StatusChip status={job.status} />
      </div>
      <div style={{ marginTop: 10 }}><StatusSwitch value={job.status} onChange={(status) => onStatus(job.id, { status })} /></div>
    </div>
  );
}

function UpdatesList({ updates, onSelect }) {
  if (!updates.length) return <EmptyState text="No service updates have been recorded yet." />;
  return <div className="updates-list">{updates.map((u, idx) => <button key={`${u.job.id}-${u.at}-${idx}`} className={`update-item ${u.kind === "audit" ? "audit" : ""}`} style={{ textAlign: "left" }} onClick={() => onSelect(u.job.id)}><div className="note-meta"><strong>{u.by}</strong>{u.kind === "audit" && <span className="audit-tag">AUDIT</span>}<span>{formatDateTime(u.at)}</span></div><div className="job-code">{u.job.asm} · {u.job.cust}</div><div className="job-subline">{u.txt}</div></button>)}</div>;
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function JobDrawer({ job, user, onClose, onEdit, onStatus, onAddNote }) {
  const [text, setText] = useState("");
  const [nextStatus, setNextStatus] = useState(job.status);
  const [activityFilter, setActivityFilter] = useState("all");
  useEffect(() => { setNextStatus(job.status); setText(""); }, [job.id, job.status]);
  const allNotes = parseNotes(job.notes);
  const notes = activityFilter === "all" ? allNotes : allNotes.filter((note) => note.kind !== "audit");
  const submit = async (e) => {
    e.preventDefault();
    await onAddNote(job.id, text, nextStatus, user.name || user.email);
    setText("");
  };
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-header">
          <div className="drawer-header-row">
            <div><StatusChip status={job.status} /><h2 className="drawer-title">{job.asm || "No assembly"}</h2><div style={{ color: "#c8daee" }}>{job.cust} · SO {job.so || "TBA"}</div></div>
            <button className="icon-button" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="drawer-body">
          <div className="detail-grid">
            <Detail label="Staff" value={job.alloc} />
            <Detail label="Business unit" value={job.bus} />
            <Detail label="Work type" value={job.type} />
            <Detail label="Priority" value={job.priority} />
            <Detail label="Hours booked" value={`${job.hrs}h`} />
            <Detail label="Calendar window" value={`${jobCalendarSpan(job)} day${jobCalendarSpan(job) === 1 ? "" : "s"}`} />
            <Detail label="Start" value={formatDate(job.start, { year: "numeric" })} />
            <Detail label="Due" value={formatDate(job.due, { year: "numeric" })} />
          </div>
          {job.attachment && (
            <div className="attachment-row">
              <span style={{ fontSize: 18 }}>📎</span>
              <div className="attachment-copy">
                <strong>{job.attachment.name}</strong>
                <span>{formatBytes(job.attachment.size)}{job.attachment.by ? ` · uploaded by ${job.attachment.by}` : ""}</span>
              </div>
              <div className="card-actions">
                <button className="ghost-button compact" type="button" onClick={() => openJobAttachment(job.attachment)}>View</button>
                <button className="ghost-button compact" type="button" onClick={() => openJobAttachment(job.attachment, { download: true })}>Download</button>
              </div>
            </div>
          )}
          <section className="panel" style={{ boxShadow: "none" }}>
            <div className="panel-header">
              <div><h3 className="panel-title">Activity & audit trail</h3><div className="panel-subtitle">Notes and automatic change history, newest first.</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="mini-toggle">
                  <button type="button" className={activityFilter === "all" ? "active" : ""} onClick={() => setActivityFilter("all")}>All activity</button>
                  <button type="button" className={activityFilter === "notes" ? "active" : ""} onClick={() => setActivityFilter("notes")}>Notes only</button>
                </div>
                {onEdit && <button className="ghost-button" onClick={onEdit}>Edit job</button>}
              </div>
            </div>
            <div className="updates-list">
              {notes.length ? notes.map((note, i) => (
                note.kind === "audit" ? (
                  <div className="note-card audit" key={`${note.at}-${i}`}>
                    <div className="note-meta"><strong>{note.by}</strong><span className="audit-tag">AUDIT</span><span>{formatDateTime(note.at)}</span></div>
                    <div style={{ fontSize: 12.5 }}>{note.txt}</div>
                  </div>
                ) : (
                  <div className="note-card" key={`${note.at}-${i}`}>
                    <div className="note-meta"><strong>{note.by}</strong><span>{formatDateTime(note.at)}</span></div>
                    <div>{note.txt}</div>
                    {note.status && <div style={{ marginTop: 8 }}><StatusChip status={note.status} /></div>}
                  </div>
                )
              )) : <EmptyState text="No activity yet. Add the first workshop note below." />}
            </div>
          </section>
        </div>
        <form className="drawer-footer" onSubmit={submit}>
          <div className="field"><label>Add note / status update</label><textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Example: Waiting on customer spec. Job is only 3 hours booked hours but will remain open until Friday." /></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select className="select" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="primary-button" disabled={!text.trim()} type="submit">Post update</button>
          </div>
        </form>
      </aside>
    </>
  );
}

function UpdatesDrawer({ updates, onClose, onSelect }) {
  const [activityFilter, setActivityFilter] = useState("all");
  const shown = activityFilter === "all" ? updates : updates.filter((u) => u.kind !== "audit");
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-header"><div className="drawer-header-row"><div><div className="eyebrow">Complete audit trail</div><h2 className="drawer-title">Recent updates</h2><div style={{ color: "#c8daee" }}>Notes and automatic change history across all jobs.</div></div><button className="icon-button" onClick={onClose}>×</button></div></div>
        <div className="drawer-body">
          <div className="mini-toggle" style={{ marginBottom: 12 }}>
            <button type="button" className={activityFilter === "all" ? "active" : ""} onClick={() => setActivityFilter("all")}>All activity</button>
            <button type="button" className={activityFilter === "notes" ? "active" : ""} onClick={() => setActivityFilter("notes")}>Notes only</button>
          </div>
          <UpdatesList updates={shown} onSelect={onSelect} />
        </div>
        <div className="drawer-footer"><button className="secondary-button" onClick={onClose}>Close</button></div>
      </aside>
    </>
  );
}

function Detail({ label, value }) {
  return <div className="detail-cell"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function JobModal({ job, people, jobTypes, businessUnits, onClose, onSave }) {
  const assignablePeople = useMemo(() => {
    const set = new Set(people);
    if (job.alloc) set.add(job.alloc);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [people, job.alloc]);

  const [fields, setFields] = useState(() => ({
    asm: job.asm || "",
    so: job.so || "",
    cust: job.cust || "",
    type: job.type || jobTypes?.[0] || JOB_TYPES[0],
    owner: job.owner || "",
    alloc: job.alloc || assignablePeople[0] || "Unassigned",
    bus: job.bus || businessUnits[0] || "Other",
    start: job.start || offsetDate(0),
    due: job.due || offsetDate(7),
    hrs: job.hrs ?? 1,
    actualHrs: job.actualHrs ?? 0,
    status: job.status || "Not Started",
    priority: job.priority || "Normal",
    details: job.details || "",
  }));
  const touchedRef = useRef(new Set());
  const fileInputRef = useRef(null);
  const [attachment, setAttachment] = useState(job.attachment || null);
  const [pdfFile, setPdfFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const set = (key, value) => {
    touchedRef.current.add(key);
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handlePdfFile = async (file) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      window.alert("Please choose a PDF file.");
      return;
    }
    setImportBusy(true);
    try {
      const { fields: parsed, found } = await importAssemblyOrderPdf(file, { staffNames: people, jobTypes });
      // Only prefill defaults on brand-new jobs; on edit, only genuinely empty fields.
      const allowDefaults = !job.id;
      setFields((prev) => {
        const next = { ...prev };
        Object.entries(parsed).forEach(([key, value]) => {
          if (!value || touchedRef.current.has(key)) return;
          const isEmpty = next[key] === "" || next[key] == null;
          const hasDefault = ["type", "start", "due"].includes(key);
          if (isEmpty || (allowDefaults && hasDefault)) next[key] = value;
        });
        return next;
      });
      setPdfFile(file);
      setImportSummary(found.length ? `Auto-filled from ${file.name}: ${found.join(", ")}` : `No recognisable fields in ${file.name} — it will be attached without auto-fill.`);
    } catch (err) {
      window.alert(`Could not read PDF: ${err?.message || err}`);
    } finally {
      setImportBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...fields, hrs: Number(fields.hrs) || 0, actualHrs: Number(fields.actualHrs) || 0, attachment, attachmentFile: pdfFile });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-header"><div><div className="eyebrow">{job.id ? "Edit workshop job" : "New workshop job"}</div><h2>{job.id ? `${job.asm} · ${job.cust}` : "Create a production record"}</h2><div className="page-subtitle">Capture hours booked hours separately from the calendar start and due dates.</div></div><button className="icon-button" type="button" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div
            className={`dropzone ${dragActive ? "drag" : ""}`}
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handlePdfFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
          >
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => { handlePdfFile(e.target.files?.[0]); e.target.value = ""; }} />
            {importBusy ? (
              <span>Reading PDF…</span>
            ) : pdfFile ? (
              <span><strong>📎 {pdfFile.name}</strong> will be attached on save · drop another PDF to replace <button type="button" className="ghost-button compact" onClick={(e) => { e.stopPropagation(); setPdfFile(null); setImportSummary(null); }}>Remove</button></span>
            ) : attachment ? (
              <span><strong>📎 {attachment.name}</strong> attached · drop a new PDF to replace <button type="button" className="ghost-button compact" onClick={(e) => { e.stopPropagation(); setAttachment(null); }}>Remove</button></span>
            ) : (
              <span><strong>Drag & drop an Assembly Order PDF here</strong> — or click to browse. Job details auto-fill and the PDF is saved on the job.</span>
            )}
          </div>
          {importSummary && <div className="import-summary">{importSummary}</div>}
          <div className="form-grid">
            <Field label="Assembly / Tag"><input className="input" value={fields.asm} onChange={(e) => set("asm", e.target.value)} required /></Field>
            <Field label="Sales Order"><input className="input" value={fields.so} onChange={(e) => set("so", e.target.value)} /></Field>
            <Field label="Customer"><input className="input" value={fields.cust} onChange={(e) => set("cust", e.target.value)} required /></Field>
            <Field label="Job Type"><select className="select" value={fields.type} onChange={(e) => set("type", e.target.value)}>{Array.from(new Set([...(jobTypes && jobTypes.length ? jobTypes : JOB_TYPES), fields.type].filter(Boolean))).map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Project Owner"><input className="input" value={fields.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
            <Field label="Staff / Workshop technician"><select className="select" value={fields.alloc} onChange={(e) => set("alloc", e.target.value)}><option>Unassigned</option>{assignablePeople.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Business Unit"><select className="select" value={fields.bus} onChange={(e) => set("bus", e.target.value)}>{businessUnits.map((b) => <option key={b}>{b}</option>)}</select></Field>
            <Field label="Priority"><select className="select" value={fields.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Start / To be done"><input className="input" type="date" value={fields.start} onChange={(e) => set("start", e.target.value)} /></Field>
            <Field label="Due date"><input className="input" type="date" value={fields.due} onChange={(e) => set("due", e.target.value)} /></Field>
            <Field label="Estimated hours booked hours"><input className="input" type="number" step="0.25" min="0" value={fields.hrs} onChange={(e) => set("hrs", e.target.value)} /></Field>
            <Field label="Actual hours"><input className="input" type="number" step="0.25" min="0" value={fields.actualHrs} onChange={(e) => set("actualHrs", e.target.value)} /></Field>
            <Field label="Status"><select className="select" value={fields.status} onChange={(e) => set("status", e.target.value)}>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Calendar interpretation"><div className="detail-cell" style={{ background: "#f8fafc" }}><span>Planned span</span><strong>{Math.max(1, daysBetween(fields.start, fields.due) + 1)} day window for {fields.hrs || 0}h work</strong></div></Field>
          </div>
          <Field label="Details / scope"><textarea className="textarea" value={fields.details} onChange={(e) => set("details", e.target.value)} placeholder="Scope, work order path, testing notes, customer blockers…" /></Field>
        </div>
        <div className="modal-footer"><button className="ghost-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save job</button></div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
