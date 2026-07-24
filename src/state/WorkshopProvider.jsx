import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  supabase, SUPABASE_TABLE, SUPABASE_STAFF_TABLE, SUPABASE_JOB_TYPES_TABLE, SUPABASE_CUSTOMERS_TABLE, SUPABASE_PROFILES_TABLE,
  SUPABASE_CALENDAR_TABLE, SUPABASE_HOLIDAYS_TABLE,
} from "../lib/supabase";
import {
  AUDIT_LABELS, BUSINESS_UNITS, DEFAULT_JOB_TYPES, DEFAULT_CUSTOMERS,
} from "../lib/constants";
import {
  normalizeCalendarEntry, toCalendarDbPayload, calendarEntryKey,
  normalizeHoliday, toHolidayDbPayload,
} from "../lib/calendar";
import {
  normalizeJob, jobSort, toDbPayload, parseNotes, dueBucket, jobCalendarSpan, riskScore, mergeNotes,
} from "../lib/jobs";
import {
  normalizeStaff, mergeStaffLists, staffKey,
  normalizeJobType, mergeJobTypeLists, jobTypeKey,
  toStaffDbPayload, toJobTypeDbPayload,
} from "../lib/staff";
import {
  normalizeCustomer, mergeCustomerLists, customerKey, toCustomerDbPayload,
} from "../lib/customers";
import { daysUntil, formatDate, parseISODate } from "../lib/dates";
import {
  loadStoredJobs, saveStoredJobs, loadStoredStaff, saveStoredStaff,
  loadStoredJobTypes, saveStoredJobTypes, loadStoredCustomers, saveStoredCustomers,
  loadStoredCalendar, saveStoredCalendar, loadStoredHolidays, saveStoredHolidays,
} from "../lib/storage";
import { isNative } from "../lib/native";
import { useAuthCtx } from "./AuthProvider";

const WorkshopContext = createContext(null);
const DEFAULT_FILTERS = { search: "", employee: "All", bus: "All", status: "All", horizon: "All" };

export function WorkshopProvider({ children }) {
  const { user } = useAuthCtx();

  const [jobs, setJobs] = useState(loadStoredJobs);
  const [staff, setStaff] = useState(loadStoredStaff);
  const [jobTypes, setJobTypes] = useState(loadStoredJobTypes);
  const [customers, setCustomers] = useState(loadStoredCustomers);
  const [calendar, setCalendar] = useState(loadStoredCalendar);
  const [holidays, setHolidays] = useState(loadStoredHolidays);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncState, setSyncState] = useState(supabase ? "syncing" : "local");
  const [staffSyncState, setStaffSyncState] = useState(supabase ? "syncing" : "local");
  const [jobTypeSyncState, setJobTypeSyncState] = useState(supabase ? "syncing" : "local");
  const [customerSyncState, setCustomerSyncState] = useState(supabase ? "syncing" : "local");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // With RLS enabled, queries only return rows for an authenticated session — wait for login.
  const userId = user?.id || (user ? "local" : null);

  const fetchJobs = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setSyncState("syncing");
    const { data, error } = await supabase.from(SUPABASE_TABLE).select("*");
    if (error) {
      setSyncState("error");
    } else if (Array.isArray(data)) {
      // Reflect the DB exactly, including a genuinely empty result — otherwise a
      // wiped table would leave stale cached jobs showing indefinitely.
      setJobs(data.map(normalizeJob).sort(jobSort));
      setSyncState("synced");
    } else {
      setSyncState("synced");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      setLoading(true);
      const { data, error } = await supabase.from(SUPABASE_TABLE).select("*");
      if (cancelled) return;
      if (error) setSyncState("error");
      // Reflect the DB exactly, including empty (see fetchJobs above for why).
      else if (Array.isArray(data)) { setJobs(data.map(normalizeJob).sort(jobSort)); setSyncState("synced"); }
      else setSyncState("synced");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_STAFF_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (error) setStaffSyncState("error");
      // Reflect the DB exactly, including empty (see fetchJobs above for why).
      // Deliberately does NOT fold in DEFAULT_STAFF here — once cloud data is
      // fetched, an empty table means genuinely no staff, not "show the demo six."
      // (DEFAULT_STAFF is still used for the local/demo-mode seed in storage.js.)
      else if (Array.isArray(data)) { setStaff(mergeStaffLists(data)); setStaffSyncState("synced"); }
      else setStaffSyncState("synced");
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_JOB_TYPES_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (error) setJobTypeSyncState("error");
      // Reflect the DB exactly, including empty (see fetchJobs above for why).
      else if (Array.isArray(data)) { setJobTypes(mergeJobTypeLists(DEFAULT_JOB_TYPES, data)); setJobTypeSyncState("synced"); }
      else setJobTypeSyncState("synced");
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_CUSTOMERS_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (error) setCustomerSyncState("error");
      // Reflect the DB exactly, including empty (see fetchJobs above for why).
      else if (Array.isArray(data)) { setCustomers(mergeCustomerLists(DEFAULT_CUSTOMERS, data)); setCustomerSyncState("synced"); }
      else setCustomerSyncState("synced");
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Staff availability calendar entries (Training/Leave/Sick). Reflect the table exactly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_CALENDAR_TABLE).select("*");
      if (cancelled || error) return;
      if (Array.isArray(data)) setCalendar(data.map(normalizeCalendarEntry));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Public holidays. Falls back to the local seed if the cloud table is empty, so calendars
  // are never blank for a fresh project that hasn't run the SQL seed yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_HOLIDAYS_TABLE).select("*").order("date", { ascending: true });
      if (cancelled || error) return;
      if (Array.isArray(data) && data.length) setHolidays(data.map(normalizeHoliday));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // All authenticated users load profiles — needed for @-mention suggestions, not just admins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !userId) return;
      const { data, error } = await supabase.from(SUPABASE_PROFILES_TABLE).select("*").order("name", { ascending: true });
      if (cancelled) return;
      if (!error && Array.isArray(data)) setProfiles(data);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => { saveStoredJobs(jobs); }, [jobs]);
  useEffect(() => { saveStoredStaff(staff); }, [staff]);
  useEffect(() => { saveStoredJobTypes(jobTypes); }, [jobTypes]);
  useEffect(() => { saveStoredCustomers(customers); }, [customers]);
  useEffect(() => { saveStoredCalendar(calendar); }, [calendar]);
  useEffect(() => { saveStoredHolidays(holidays); }, [holidays]);

  // Realtime: keep the board live across devices. Incoming rows win for scalar fields
  // only if newer (updated_at); notes are always unioned so no note is dropped.
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel("jobs-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: SUPABASE_TABLE }, (payload) => {
        if (payload.eventType === "DELETE") {
          setJobs((prev) => prev.filter((j) => j.id !== payload.old.id));
          return;
        }
        const incoming = normalizeJob(payload.new);
        setJobs((prev) => {
          const existing = prev.find((j) => j.id === incoming.id);
          if (!existing) return [incoming, ...prev].sort(jobSort);
          const incomingNewer = (parseISODate(incoming.updatedAt)?.getTime() || 0) >= (parseISODate(existing.updatedAt)?.getTime() || 0);
          const base = incomingNewer ? incoming : existing;
          const merged = { ...base, notes: mergeNotes(existing.notes, incoming.notes) };
          return prev.map((j) => (j.id === incoming.id ? merged : j));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Refetch when the app returns to the foreground (tab re-shown, or native resume),
  // rate-limited so we don't hammer on every focus.
  useEffect(() => {
    if (!supabase || !userId) return;
    let lastFetch = Date.now();
    let removeResume = () => {};
    const doRefetch = () => { lastFetch = Date.now(); fetchJobs(); };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > 60000) doRefetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    if (isNative) {
      import("@capacitor/app")
        .then(({ App }) => { const p = App.addListener("resume", doRefetch); removeResume = () => p.then((h) => h.remove()); })
        .catch(() => {});
    }
    return () => { document.removeEventListener("visibilitychange", onVisible); removeResume(); };
  }, [userId, fetchJobs]);

  // ---- Mutations -------------------------------------------------------
  const patchJob = useCallback(async (id, patch) => {
    const updatedAt = new Date().toISOString();
    let nextJob = null;
    setJobs((prev) => prev.map((job) => {
      if (job.id !== id) return job;
      const merged = { ...job, ...patch, updatedAt };
      // Stamp/clear the completion time as the job crosses into or out of "Complete".
      // Re-completing (status unchanged) leaves completed_at stable so the weekly window
      // measures from the original completion, and reopening returns it to the board.
      if ("status" in patch && patch.status !== job.status) {
        if (patch.status === "Complete") { merged.completedAt = updatedAt; merged.archived = false; }
        else { merged.completedAt = null; merged.archived = false; }
      }
      nextJob = normalizeJob(merged);
      return nextJob;
    }));
    if (supabase && nextJob) {
      let payload = toDbPayload(nextJob);
      // Notes are an array column written whole-row. Before overwriting, union with
      // the row's current notes so a note another device added concurrently isn't lost.
      if ("notes" in patch) {
        const { data: current } = await supabase.from(SUPABASE_TABLE).select("notes").eq("id", id).maybeSingle();
        if (current) {
          const merged = mergeNotes(nextJob.notes, current.notes);
          payload = { ...payload, notes: merged };
          setJobs((prev) => prev.map((job) => (job.id === id ? normalizeJob({ ...job, notes: merged, updatedAt }) : job)));
        }
      }
      const { error } = await supabase.from(SUPABASE_TABLE).update(payload).eq("id", id);
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
      if (error) setStaffSyncState("error");
      else if (data) { setStaff((prev) => mergeStaffLists(prev.filter((member) => member.id !== localMember.id), [data])); setStaffSyncState("synced"); }
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
    // Drop the person's calendar entries locally (the DB cascades via the FK).
    setCalendar((prev) => prev.filter((e) => e.staffId !== id));
  }, [staff]);

  // Set (or clear) a staff member's status on a date. "Available" removes the row entirely —
  // Available is the absence of an entry. Public holidays are not user-settable here.
  const setCalendarEntry = useCallback(async (staffId, date, status) => {
    const iso = String(date).slice(0, 10);
    if (!staffId || !iso) return;
    const id = calendarEntryKey(staffId, iso);
    if (status === "Available") {
      setCalendar((prev) => prev.filter((e) => e.id !== id));
      if (supabase) {
        const { error } = await supabase.from(SUPABASE_CALENDAR_TABLE).delete().eq("id", id);
        if (error) toast.error("Could not update calendar", { description: error.message });
      }
      return;
    }
    const entry = normalizeCalendarEntry({ id, staffId, date: iso, status, updatedAt: new Date().toISOString() });
    setCalendar((prev) => [...prev.filter((e) => e.id !== id), entry]);
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_CALENDAR_TABLE).upsert(toCalendarDbPayload(entry));
      if (error) toast.error("Could not update calendar", { description: error.message });
    }
  }, []);

  const addHoliday = useCallback(async (fields) => {
    const holiday = normalizeHoliday(fields);
    if (!holiday.date) return;
    setHolidays((prev) => [...prev.filter((h) => h.date !== holiday.date), holiday].sort((a, b) => a.date.localeCompare(b.date)));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_HOLIDAYS_TABLE).upsert(toHolidayDbPayload(holiday));
      if (error) toast.error("Could not save holiday", { description: error.message });
    }
  }, []);

  const deleteHoliday = useCallback(async (date) => {
    const iso = String(date).slice(0, 10);
    setHolidays((prev) => prev.filter((h) => h.date !== iso));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_HOLIDAYS_TABLE).delete().eq("date", iso);
      if (error) toast.error("Could not remove holiday", { description: error.message });
    }
  }, []);

  // Send a Supabase invite email via the invite-user edge function (admin-only, service role).
  // No-op with a message in demo mode (no Supabase configured).
  const inviteStaff = useCallback(async ({ email, name, role }) => {
    if (!supabase) {
      toast.info("Invitations need a connected Supabase project", { description: "The staff record was still added." });
      return { ok: false, skipped: true };
    }
    const { data, error } = await supabase.functions.invoke("invite-user", { body: { email, name, role } });
    if (error || data?.error) {
      toast.error("Could not send invitation", { description: error?.message || data?.error });
      return { ok: false };
    }
    toast.success(`Invitation sent to ${email}`);
    return { ok: true };
  }, []);

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
      if (error) setJobTypeSyncState("error");
      else if (data) { setJobTypes((prev) => mergeJobTypeLists(prev.filter((jobType) => jobType.id !== localJobType.id), [data])); setJobTypeSyncState("synced"); }
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

  const addCustomer = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return;
    const existing = customers.find((customer) => customerKey(customer.name) === customerKey(name));
    const localCustomer = normalizeCustomer({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `customer-${customerKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    setCustomers((prev) => mergeCustomerLists(prev.filter((customer) => customer.id !== localCustomer.id), [localCustomer]));
    if (supabase) {
      const { data, error } = await supabase.from(SUPABASE_CUSTOMERS_TABLE).upsert(toCustomerDbPayload(localCustomer)).select("*").single();
      if (error) setCustomerSyncState("error");
      else if (data) { setCustomers((prev) => mergeCustomerLists(prev.filter((customer) => customer.id !== localCustomer.id), [data])); setCustomerSyncState("synced"); }
    }
  }, [customers]);

  const updateCustomer = useCallback(async (id, patch) => {
    let nextCustomer = null;
    setCustomers((prev) => mergeCustomerLists(prev.map((customer) => {
      if (customer.id !== id) return customer;
      nextCustomer = normalizeCustomer({ ...customer, ...patch, updatedAt: new Date().toISOString() });
      return nextCustomer;
    })));
    if (supabase && nextCustomer) {
      const { error } = await supabase.from(SUPABASE_CUSTOMERS_TABLE).update(toCustomerDbPayload(nextCustomer)).eq("id", id);
      setCustomerSyncState(error ? "error" : "synced");
    }
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_CUSTOMERS_TABLE).delete().eq("id", id);
      setCustomerSyncState(error ? "error" : "synced");
    }
  }, []);

  const updateProfile = useCallback(async (id, patch) => {
    setProfiles((prev) => prev.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)));
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_PROFILES_TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) toast.error("Could not update account", { description: error.message });
    }
  }, []);

  // ---- Derived data (moved verbatim from App) --------------------------
  const activeJobs = useMemo(() => jobs.filter((job) => !job.deleted), [jobs]);
  const deletedJobs = useMemo(() => jobs.filter((job) => job.deleted), [jobs]);

  const people = useMemo(() => {
    const set = new Set(staff.map((member) => member.name));
    activeJobs.forEach((job) => job.alloc && set.add(job.alloc));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [activeJobs, staff]);

  // No DEFAULT_STAFF fallback here — cloud staff state (see fetch effect above) is
  // now the source of truth, including when it's genuinely empty.
  const activePeople = useMemo(() => staff
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

  const activeCustomers = useMemo(() => (customers.length ? customers : DEFAULT_CUSTOMERS)
    .filter((customer) => customer.active)
    .map((customer) => customer.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [customers]);

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

  const updates = useMemo(() => activeJobs.flatMap((job) => parseNotes(job.notes).map((note) => ({ ...note, job })))
    .sort((a, b) => (parseISODate(b.at)?.getTime() || 0) - (parseISODate(a.at)?.getTime() || 0)), [activeJobs]);

  const updateFilter = useCallback((key, value) => setFilters((prev) => ({ ...prev, [key]: value })), []);
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

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
      if (key === "details") { changes.push("Details updated"); return; }
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

  const reassignStaffJobs = useCallback(async (fromName, toName) => {
    const target = toName || "Unassigned";
    const affected = jobs.filter((job) => job.alloc === fromName && job.status !== "Complete");
    for (const job of affected) await auditPatch(job.id, { alloc: target }, "Batch reassignment");
  }, [jobs, auditPatch]);

  const reassignJobTypeJobs = useCallback(async (fromType, toType) => {
    if (!toType || toType === fromType) return;
    const affected = jobs.filter((job) => job.type === fromType);
    for (const job of affected) await auditPatch(job.id, { type: toType }, "Batch job-type move");
  }, [jobs, auditPatch]);

  const reassignCustomerJobs = useCallback(async (fromName, toName) => {
    if (!toName || toName === fromName) return;
    const affected = jobs.filter((job) => job.cust === fromName);
    for (const job of affected) await auditPatch(job.id, { cust: toName }, "Batch customer move");
  }, [jobs, auditPatch]);

  // Manual close-out: archive a completed job off the board early (or return it).
  const setJobArchived = useCallback((id, archived) => (
    auditPatch(id, { archived }, archived ? "Job archived" : "Job returned to board")
  ), [auditPatch]);

  const value = useMemo(() => ({
    jobs, staff, jobTypes, customers, calendar, holidays, profiles, loading,
    syncState, staffSyncState, jobTypeSyncState, customerSyncState,
    activeJobs, deletedJobs, people, activePeople, businessUnits, activeJobTypes, activeCustomers,
    filters, filteredJobs, metrics, updates, auditBy,
    updateFilter, resetFilters, refetch: fetchJobs,
    patchJob, addNote, addJob, createJob,
    addStaffMember, updateStaffMember, deleteStaffMember, reassignStaffJobs,
    setCalendarEntry, addHoliday, deleteHoliday, inviteStaff,
    addJobType, updateJobType, deleteJobType, reassignJobTypeJobs,
    addCustomer, updateCustomer, deleteCustomer, reassignCustomerJobs,
    setJobArchived, updateProfile, auditPatch,
    getJob: (id) => jobs.find((j) => j.id === id) || null,
  }), [
    jobs, staff, jobTypes, customers, calendar, holidays, profiles, loading, syncState, staffSyncState, jobTypeSyncState, customerSyncState,
    activeJobs, deletedJobs, people, activePeople, businessUnits, activeJobTypes, activeCustomers,
    filters, filteredJobs, metrics, updates, auditBy,
    updateFilter, resetFilters, fetchJobs, patchJob, addNote, addJob, createJob,
    addStaffMember, updateStaffMember, deleteStaffMember, reassignStaffJobs,
    setCalendarEntry, addHoliday, deleteHoliday, inviteStaff,
    addJobType, updateJobType, deleteJobType, reassignJobTypeJobs,
    addCustomer, updateCustomer, deleteCustomer, reassignCustomerJobs, setJobArchived, updateProfile, auditPatch,
  ]);

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop() {
  const ctx = useContext(WorkshopContext);
  if (!ctx) throw new Error("useWorkshop must be used within WorkshopProvider");
  return ctx;
}

export { riskScore };
