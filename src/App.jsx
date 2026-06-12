import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
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
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const STATUS_ORDER = ["Not Started", "In Progress", "Input Needed", "Complete"];
const STATUS_META = {
  "Not Started": { label: "Not Started", short: "Queued", tone: "neutral", icon: "◌" },
  "In Progress": { label: "In Progress", short: "Active", tone: "blue", icon: "↗" },
  "Input Needed": { label: "Input Needed", short: "Blocked", tone: "amber", icon: "!" },
  Complete: { label: "Complete", short: "Done", tone: "green", icon: "✓" },
};
const JOB_TYPES = ["Valve Assembly", "Pump Assembly", "Valve Overhaul", "Pump Overhaul", "Mechanical Seal Refurb", "Testing", "Site Visit"];
const PEOPLE = ["Darragh", "Shauna", "Cathal", "Ross", "Dave", "Colin"];
const BUSINESS_UNITS = ["Pharma", "Industrial", "Engineering", "Mining", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const STORAGE_KEY = "flexachem_workshop_jobs_v2";
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
  const start = asISO(row.start || row.start_date || row.to_be_done || row.scheduled_start) || (due ? asISO(offsetDate(-Math.max(0, Math.ceil(Number(row.hrs || row.hours || 0) / 8)))) : "");
  return {
    id: row.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    asm: row.asm || row.assembly_no || row.assembly || row.tag || "",
    so: row.so || row.sales_order || row.sales_order_no || "",
    cust: row.cust || row.customer || row.customer_name || "",
    type: row.type || row.job_type || row.classification || JOB_TYPES[0],
    owner: row.owner || row.project_owner || row.contact || "",
    alloc: row.alloc || row.employee || row.allocated_to || row.assignee || "Unassigned",
    start,
    due,
    hrs: Number(row.hrs ?? row.hours ?? row.estimated_hours ?? row.hours_required ?? 0) || 0,
    actualHrs: Number(row.actualHrs ?? row.actual_hours ?? 0) || 0,
    status: normalizeStatus(row.status),
    bus: row.bus || row.business_unit || row.business_stream || "Other",
    priority: row.priority || "Normal",
    details: row.details || row.description || row.work_order || "",
    notes,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || notes[0]?.at || new Date().toISOString(),
  };
}

function toDbPayload(job) {
  return {
    asm: job.asm,
    so: job.so,
    cust: job.cust,
    type: job.type,
    owner: job.owner,
    alloc: job.alloc,
    start: job.start || null,
    due: job.due || null,
    hrs: Number(job.hrs) || 0,
    actual_hours: Number(job.actualHrs) || 0,
    status: job.status,
    bus: job.bus,
    priority: job.priority,
    details: job.details,
    notes: job.notes,
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

function getInitialUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
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

function useWorkshopData() {
  const [jobs, setJobs] = useState(loadStoredJobs);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncState, setSyncState] = useState(supabase ? "Connecting to Supabase…" : "Local demo mode");

  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      if (!supabase) return;
      setLoading(true);
      const { data, error } = await supabase.from(SUPABASE_TABLE).select("*").order("due", { ascending: true });
      if (cancelled) return;
      if (error) {
        setSyncState(`Local fallback — Supabase read failed: ${error.message}`);
      } else if (Array.isArray(data) && data.length) {
        setJobs(data.map(normalizeJob));
        setSyncState(`Live Supabase: ${SUPABASE_TABLE}`);
      } else {
        setSyncState(`Live Supabase connected — no rows in ${SUPABASE_TABLE}; showing seeded layout`);
      }
      setLoading(false);
    }
    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveStoredJobs(jobs);
  }, [jobs]);

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
      setSyncState(error ? `Local change saved — Supabase update failed: ${error.message}` : "Synced just now");
    }
  }, []);

  const addJob = useCallback(async (fields) => {
    const localJob = normalizeJob({ ...fields, id: crypto.randomUUID?.() || `job-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: [] });
    setJobs((prev) => [localJob, ...prev]);
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_TABLE).insert(toDbPayload(localJob)).select("*").single();
      if (error) {
        setSyncState(`Local job added — Supabase insert failed: ${error.message}`);
      } else if (data) {
        const savedJob = normalizeJob(data);
        setJobs((prev) => prev.map((job) => (job.id === localJob.id ? savedJob : job)));
        setSyncState("Synced just now");
      }
    }
  }, []);

  const deleteJob = useCallback(async (id) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_TABLE).delete().eq("id", id);
      setSyncState(error ? `Local delete complete — Supabase delete failed: ${error.message}` : "Synced just now");
    }
  }, []);

  const addNote = useCallback(async (id, noteText, nextStatus, by) => {
    const current = jobs.find((job) => job.id === id);
    if (!current || !noteText.trim()) return;
    const note = { at: new Date().toISOString(), by: by || "Workshop", txt: noteText.trim(), status: nextStatus || current.status };
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

  return { jobs, setJobs, loading, syncState, patchJob, addNote, saveJob, deleteJob };
}

export default function App() {
  const { jobs, loading, syncState, patchJob, addNote, saveJob, deleteJob } = useWorkshopData();
  const [user, setUser] = useState(getInitialUser);
  const [view, setView] = useState("dashboard");
  const [filters, setFilters] = useState({ search: "", employee: "All", bus: "All", status: "All", horizon: "All" });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [allUpdatesOpen, setAllUpdatesOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, [user]);

  const people = useMemo(() => {
    const set = new Set(PEOPLE);
    jobs.forEach((job) => job.alloc && set.add(job.alloc));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const businessUnits = useMemo(() => {
    const set = new Set(BUSINESS_UNITS);
    jobs.forEach((job) => job.bus && set.add(job.bus));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return jobs.filter((job) => {
      const haystack = [job.asm, job.so, job.cust, job.type, job.owner, job.alloc, job.bus, job.details].join(" ").toLowerCase();
      const matchSearch = !term || haystack.includes(term);
      const matchEmployee = filters.employee === "All" || job.alloc === filters.employee;
      const matchBus = filters.bus === "All" || job.bus === filters.bus;
      const matchStatus = filters.status === "All" || job.status === filters.status;
      const matchHorizon = filters.horizon === "All" || dueBucket(job) === filters.horizon;
      return matchSearch && matchEmployee && matchBus && matchStatus && matchHorizon;
    }).sort((a, b) => (riskScore(b) - riskScore(a)) || ((parseISODate(a.due)?.getTime() || 0) - (parseISODate(b.due)?.getTime() || 0)));
  }, [jobs, filters]);

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

  const updates = useMemo(() => jobs.flatMap((job) => parseNotes(job.notes).map((note) => ({ ...note, job })))
    .sort((a, b) => (parseISODate(b.at)?.getTime() || 0) - (parseISODate(a.at)?.getTime() || 0)), [jobs]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters({ search: "", employee: "All", bus: "All", status: "All", horizon: "All" });

  const handleLogin = (profile) => setUser(profile);
  const handleLogout = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job) return;
    const targetStatus = over.data?.current?.status || (String(over.id).startsWith("status:") ? String(over.id).replace("status:", "") : null);
    if (targetStatus && targetStatus !== job.status) {
      await patchJob(job.id, { status: targetStatus });
    }
  };

  const handleDelete = async (job) => {
    if (window.confirm(`Delete ${job.asm || job.cust}?`)) {
      await deleteJob(job.id);
      if (selectedJobId === job.id) setSelectedJobId(null);
    }
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

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
            <NavButton active={view === "dashboard"} icon="◆" label="Dashboard" hint="Live command centre" onClick={() => setView("dashboard")} />
            <NavButton active={view === "board"} icon="▦" label="Kanban" hint="Drag status columns" onClick={() => setView("board")} />
            <NavButton active={view === "employees"} icon="☷" label="Staff" hint="Workload by workshop technician" onClick={() => setView("employees")} />
            <NavButton active={view === "business"} icon="◫" label="Business Units" hint="Pharma, mining, industrial" onClick={() => setView("business")} />
            <NavButton active={view === "due"} icon="◴" label="Due Dates" hint="Delivery windows" onClick={() => setView("due")} />
            <NavButton active={view === "list"} icon="≡" label="Master List" hint="Full job register" onClick={() => setView("list")} />
          </nav>

          <div className="sidebar-card">
            <div className="sidebar-card-label">Data source</div>
            <div className="sync-pill">{syncState}</div>
            <div className="sidebar-card-text">Designed for Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present.</div>
          </div>

          <div className="profile-card">
            <div className="avatar">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{user.name || "Workshop user"}</strong>
              <span>{user.email}</span>
            </div>
            <button className="ghost-button compact" onClick={handleLogout}>Exit</button>
          </div>
        </aside>

        <main className="workspace">
          <Topbar
            view={view}
            filters={filters}
            people={people}
            businessUnits={businessUnits}
            metrics={metrics}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            onNewJob={() => setEditingJob({})}
            onOpenUpdates={() => setAllUpdatesOpen(true)}
          />

          <section className="content-scroll">
            {loading ? <LoadingState /> : (
              <>
                {view === "dashboard" && <DashboardView jobs={filteredJobs} allJobs={jobs} metrics={metrics} updates={updates} people={people} onSelect={setSelectedJobId} onEdit={setEditingJob} onStatus={patchJob} onOpenUpdates={() => setAllUpdatesOpen(true)} />}
                {view === "board" && (
                  <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
                    <BoardView jobs={filteredJobs} onSelect={setSelectedJobId} onEdit={setEditingJob} onStatus={patchJob} />
                    <DragOverlay>{activeJob ? <JobCard job={activeJob} overlay onSelect={() => {}} onEdit={() => {}} onStatus={() => {}} /> : null}</DragOverlay>
                  </DndContext>
                )}
                {view === "employees" && <StaffView jobs={filteredJobs} people={people} onSelect={setSelectedJobId} onStatus={patchJob} />}
                {view === "business" && <BusinessUnitView jobs={filteredJobs} businessUnits={businessUnits} onSelect={setSelectedJobId} onStatus={patchJob} />}
                {view === "due" && <DueDateView jobs={filteredJobs} onSelect={setSelectedJobId} onStatus={patchJob} />}
                {view === "list" && <ListView jobs={filteredJobs} onSelect={setSelectedJobId} onEdit={setEditingJob} onStatus={patchJob} onDelete={handleDelete} />}
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
          onEdit={() => setEditingJob(selectedJob)}
          onStatus={patchJob}
          onAddNote={addNote}
        />
      )}

      {allUpdatesOpen && <UpdatesDrawer updates={updates} onClose={() => setAllUpdatesOpen(false)} onSelect={(id) => { setAllUpdatesOpen(false); setSelectedJobId(id); }} />}

      {editingJob && (
        <JobModal
          job={editingJob}
          people={people}
          businessUnits={businessUnits}
          onClose={() => setEditingJob(null)}
          onSave={async (fields) => {
            await saveJob(editingJob.id, fields);
            setEditingJob(null);
          }}
        />
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
      @media (max-width: 1180px) { .app-shell { grid-template-columns: 86px minmax(0, 1fr); } .brand-block, .sidebar-card, .profile-copy, .nav-text { display: none; } .sidebar { padding: 18px 12px; } .nav-button { justify-content: center; padding: 12px 8px; } .profile-card { justify-content: center; } .dashboard-grid { grid-template-columns: 1fr; } .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 760px) { .app-shell { display: block; height: auto; min-height: 100vh; } .sidebar { position: sticky; top: 0; z-index: 20; flex-direction: row; overflow-x: auto; border-radius: 0 0 24px 24px; } .nav-stack { display: flex; } .profile-card { margin-left: auto; } .workspace { min-height: 100vh; } .topbar-row { align-items: flex-start; flex-direction: column; } .filter-bar { border-radius: 18px; } .metric-grid, .form-grid, .detail-grid { grid-template-columns: 1fr; } .split-panel, .timeline-item, .login-panel { grid-template-columns: 1fr; } .content-scroll { padding: 16px; } .page-title { font-size: 24px; } .login-story, .login-form { padding: 28px; } }
    `}</style>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("workshop@flexachem.com");
  const [name, setName] = useState("Workshop Lead");
  const submit = (e) => {
    e.preventDefault();
    onLogin({ email: email.trim() || "workshop@flexachem.com", name: name.trim() || "Workshop Lead" });
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
          <form className="login-form" onSubmit={submit}>
            <div>
              <div className="eyebrow">Secure workshop entry</div>
              <h2>Continue to the dashboard</h2>
              <p className="page-subtitle">This keeps note authorship clean. Supabase auth can be wired in later without changing the interface.</p>
            </div>
            <div className="field">
              <label>Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="primary-button" type="submit">Enter workshop dashboard →</button>
          </form>
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

function Topbar({ view, filters, people, businessUnits, metrics, updateFilter, resetFilters, onNewJob, onOpenUpdates }) {
  const titles = {
    dashboard: ["Workshop Command Centre", "Live visibility across staff, business units and due-date risk."],
    board: ["Kanban Production Board", "Drag cards between status lanes or use the quick status controls."],
    employees: ["Staff Workload", "See exactly which workshop technician owns each job, hours and calendar window."],
    business: ["Business Unit Portfolio", "Roll up jobs by Pharma, Industrial, Engineering, Mining and Other."],
    due: ["Due Date Control", "Understand overdue work, delivery windows and small jobs that span multiple days."],
    list: ["Master Job Register", "Dense, searchable production list for admin and planning."],
  };
  const [title, subtitle] = titles[view] || titles.dashboard;
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
          <button className="primary-button" onClick={onNewJob}>+ Log new job</button>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-box">
          <span>⌕</span>
          <input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search assembly, SO, customer, notes…" />
        </label>
        <select className="select" value={filters.employee} onChange={(e) => updateFilter("employee", e.target.value)}>
          <option>All</option>{people.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="select" value={filters.bus} onChange={(e) => updateFilter("bus", e.target.value)}>
          <option>All</option>{businessUnits.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="select" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option>All</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={filters.horizon} onChange={(e) => updateFilter("horizon", e.target.value)}>
          <option>All</option>{["Overdue", "Due today", "Next 7 days", "Next 30 days", "Later", "No due date", "Complete"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="chip">{metrics.open} open</span>
        <span className="chip">{metrics.hours}h booked</span>
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
              <button className="ghost-button" onClick={() => onEdit({})}>Add job</button>
            </div>
            <div className="risk-list">
              {risky.length ? risky.map((job) => <RiskItem key={job.id} job={job} onSelect={onSelect} onStatus={onStatus} />) : <EmptyState text="No risk items in the current filter." />}
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-header">
              <div><h3 className="panel-title">Completion shape</h3><div className="panel-subtitle">Filtered completion ratio.</div></div>
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
              <div><h3 className="panel-title">People capacity</h3><div className="panel-subtitle">Open hours by staff member.</div></div>
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
          <h3 className="job-title">{job.asm || "No assembly"}</h3>
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
          <button className="icon-button" onClick={() => onEdit(job)} title="Edit">✎</button>
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

function StaffView({ jobs, people, onSelect, onStatus }) {
  const groups = makeGroups(jobs, (job) => job.alloc);
  return (
    <div className="lane-grid">
      {people.map((person) => {
        const items = groups[person] || [];
        const open = items.filter((j) => j.status !== "Complete");
        const hours = open.reduce((sum, j) => sum + Number(j.hrs || 0), 0);
        const blocked = open.filter((j) => j.status === "Input Needed").length;
        return (
          <section className="lane-card" key={person}>
            <div className="lane-header">
              <div className="lane-title"><span className="lane-avatar">{person.slice(0, 1)}</span>{person}</div>
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

function ListView({ jobs, onSelect, onEdit, onStatus, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Assembly</th><th>Customer / SO</th><th>BU</th><th>Staff</th><th>Work window</th><th>Hours</th><th>Status</th><th>Updates</th><th>Actions</th></tr></thead>
        <tbody>
          {jobs.map((job) => {
            const notes = parseNotes(job.notes);
            return (
              <tr key={job.id}>
                <td><button style={{ background: "transparent", border: 0, padding: 0, textAlign: "left" }} onClick={() => onSelect(job.id)}><div className="job-code">{job.asm || "No assembly"}</div><div className="job-subline">{job.type}</div></button></td>
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
  return <div className="updates-list">{updates.map((u, idx) => <button key={`${u.job.id}-${u.at}-${idx}`} className="update-item" style={{ textAlign: "left" }} onClick={() => onSelect(u.job.id)}><div className="note-meta"><strong>{u.by}</strong><span>{formatDateTime(u.at)}</span></div><div className="job-code">{u.job.asm} · {u.job.cust}</div><div className="job-subline">{u.txt}</div></button>)}</div>;
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function JobDrawer({ job, user, onClose, onEdit, onStatus, onAddNote }) {
  const [text, setText] = useState("");
  const [nextStatus, setNextStatus] = useState(job.status);
  useEffect(() => { setNextStatus(job.status); setText(""); }, [job.id, job.status]);
  const notes = parseNotes(job.notes);
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
          <section className="panel" style={{ boxShadow: "none" }}>
            <div className="panel-header"><div><h3 className="panel-title">Service notes</h3><div className="panel-subtitle">Updates from the floor, newest first.</div></div><button className="ghost-button" onClick={onEdit}>Edit job</button></div>
            <div className="updates-list">
              {notes.length ? notes.map((note, i) => <div className="note-card" key={`${note.at}-${i}`}><div className="note-meta"><strong>{note.by}</strong><span>{formatDateTime(note.at)}</span></div><div>{note.txt}</div>{note.status && <div style={{ marginTop: 8 }}><StatusChip status={note.status} /></div>}</div>) : <EmptyState text="No updates yet. Add the first workshop note below." />}
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
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-header"><div className="drawer-header-row"><div><div className="eyebrow">Complete audit trail</div><h2 className="drawer-title">Recent updates</h2><div style={{ color: "#c8daee" }}>All service notes across filtered and unfiltered jobs.</div></div><button className="icon-button" onClick={onClose}>×</button></div></div>
        <div className="drawer-body"><UpdatesList updates={updates} onSelect={onSelect} /></div>
        <div className="drawer-footer"><button className="secondary-button" onClick={onClose}>Close</button></div>
      </aside>
    </>
  );
}

function Detail({ label, value }) {
  return <div className="detail-cell"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function JobModal({ job, people, businessUnits, onClose, onSave }) {
  const [fields, setFields] = useState(() => ({
    asm: job.asm || "",
    so: job.so || "",
    cust: job.cust || "",
    type: job.type || JOB_TYPES[0],
    owner: job.owner || "",
    alloc: job.alloc || people[0] || "Unassigned",
    bus: job.bus || businessUnits[0] || "Other",
    start: job.start || offsetDate(0),
    due: job.due || offsetDate(7),
    hrs: job.hrs ?? 1,
    actualHrs: job.actualHrs ?? 0,
    status: job.status || "Not Started",
    priority: job.priority || "Normal",
    details: job.details || "",
  }));
  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...fields, hrs: Number(fields.hrs) || 0, actualHrs: Number(fields.actualHrs) || 0 });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-header"><div><div className="eyebrow">{job.id ? "Edit workshop job" : "New workshop job"}</div><h2>{job.id ? `${job.asm} · ${job.cust}` : "Create a production record"}</h2><div className="page-subtitle">Capture hours booked hours separately from the calendar start and due dates.</div></div><button className="icon-button" type="button" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Assembly / Tag"><input className="input" value={fields.asm} onChange={(e) => set("asm", e.target.value)} required /></Field>
            <Field label="Sales Order"><input className="input" value={fields.so} onChange={(e) => set("so", e.target.value)} /></Field>
            <Field label="Customer"><input className="input" value={fields.cust} onChange={(e) => set("cust", e.target.value)} required /></Field>
            <Field label="Job Type"><select className="select" value={fields.type} onChange={(e) => set("type", e.target.value)}>{JOB_TYPES.map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Project Owner"><input className="input" value={fields.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
            <Field label="Staff / Workshop technician"><select className="select" value={fields.alloc} onChange={(e) => set("alloc", e.target.value)}><option>Unassigned</option>{people.map((p) => <option key={p}>{p}</option>)}</select></Field>
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
