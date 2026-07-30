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
import { daysUntil, formatDate, parseISODate, parseInstant } from "../lib/dates";
import { runWrite, LOCAL_OK, reportWriteFailure } from "../lib/writes";
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
  // Reason for the most recent failed write, surfaced by WriteErrorBanner. Null when the last
  // write succeeded — a stale red banner trains people to ignore it.
  const [lastWriteError, setLastWriteError] = useState(null);
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
          // Compare full ISO instants (parseInstant), not parseISODate — the latter noon-anchors
          // to the day, so same-day edits tie and a stale echo could clobber a fresh write.
          const incomingNewer = (parseInstant(incoming.updatedAt)?.getTime() || 0) >= (parseInstant(existing.updatedAt)?.getTime() || 0);
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
  //
  // Every mutation below returns { ok, error, message } and UNDOES its optimistic update when
  // the write fails. Do not add a write that returns undefined — a caller with no way to know
  // it failed is how two jobs were silently lost on 29 Jul 2026. See lib/writes.js.
  //
  // `fail` records the reason for the app-wide banner AND emails an admin. The email is the
  // only way a rejected write becomes visible to anyone not sitting at the screen it happened
  // on — a failed insert leaves no row for the database to trigger on. Fire-and-forget.
  const fail = useCallback((result, context = {}) => {
    setLastWriteError({ message: result.message, at: Date.now(), retryable: result.retryable });
    reportWriteFailure(supabase, {
      action: context.action || "write",
      jobLabel: context.label || "",
      result,
      user: user?.name || user?.email || "unknown",
    });
    return result;
  }, [user?.name, user?.email]);

  const dismissWriteError = useCallback(() => setLastWriteError(null), []);

  const patchJob = useCallback(async (id, patch) => {
    const updatedAt = new Date().toISOString();
    let nextJob = null;
    // Snapshot the row as it was so a rejected write can put it back exactly.
    let priorJob = null;
    setJobs((prev) => prev.map((job) => {
      if (job.id !== id) return job;
      priorJob = job;
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
      const result = await runWrite(() => supabase.from(SUPABASE_TABLE).update(payload).eq("id", id));
      if (!result.ok) {
        // Put the job back the way it was — a board showing an edit the database rejected is
        // worse than no edit at all.
        if (priorJob) setJobs((prev) => prev.map((job) => (job.id === id ? priorJob : job)));
        setSyncState("error");
        return fail(result, { action: "edit", label: priorJob?.asm || `#${id}` });
      }
      setSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  const addJob = useCallback(async (fields) => {
    const localJob = normalizeJob({ ...fields, id: crypto.randomUUID?.() || `job-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: Array.isArray(fields.notes) ? fields.notes : [] });
    setJobs((prev) => [localJob, ...prev]);
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_TABLE).insert(toDbPayload(localJob)).select("*").single());
      if (!result.ok) {
        // Drop the optimistic card. Because `jobs` state drives the localStorage mirror, this
        // also stops the phantom surviving a reload and looking saved.
        setJobs((prev) => prev.filter((job) => job.id !== localJob.id));
        setSyncState("error");
        return fail(result, { action: "create", label: localJob.asm || "new job" });
      }
      if (result.data) {
        const savedJob = normalizeJob(result.data);
        setJobs((prev) => prev.map((job) => (job.id === localJob.id ? savedJob : job)));
      }
      setSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  const addNote = useCallback(async (id, noteText, nextStatus, by) => {
    const current = jobs.find((job) => job.id === id);
    if (!current || !noteText.trim()) return LOCAL_OK;
    const note = { at: new Date().toISOString(), by: by || "Workshop", kind: "note", txt: noteText.trim(), status: nextStatus || current.status };
    const patch = {
      notes: [note, ...parseNotes(current.notes)],
      status: nextStatus || current.status,
      updatedAt: note.at,
    };
    return patchJob(id, patch);
  }, [jobs, patchJob]);

  const addStaffMember = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return LOCAL_OK;
    const existing = staff.find((member) => staffKey(member.name) === staffKey(name));
    const localMember = normalizeStaff({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `staff-${staffKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    const priorStaff = staff;
    setStaff((prev) => mergeStaffLists(prev.filter((member) => member.id !== localMember.id), [localMember]));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_STAFF_TABLE).upsert(toStaffDbPayload(localMember)).select("*").single());
      if (!result.ok) {
        setStaff(priorStaff);
        setStaffSyncState("error");
        toast.error("Could not add that person", { description: result.message });
        return fail(result);
      }
      if (result.data) setStaff((prev) => mergeStaffLists(prev.filter((member) => member.id !== localMember.id), [result.data]));
      setStaffSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [staff, fail]);

  const updateStaffMember = useCallback(async (id, patch) => {
    let nextMember = null;
    let priorMember = null;
    setStaff((prev) => mergeStaffLists(prev.map((member) => {
      if (member.id !== id) return member;
      priorMember = member;
      nextMember = normalizeStaff({ ...member, ...patch, updatedAt: new Date().toISOString() });
      return nextMember;
    })));
    if (supabase && nextMember) {
      const result = await runWrite(() => supabase.from(SUPABASE_STAFF_TABLE).update(toStaffDbPayload(nextMember)).eq("id", id));
      if (!result.ok) {
        if (priorMember) setStaff((prev) => mergeStaffLists(prev.map((member) => (member.id === id ? priorMember : member))));
        setStaffSyncState("error");
        toast.error("Could not update that person", { description: result.message });
        return fail(result);
      }
      setStaffSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  const deleteStaffMember = useCallback(async (id) => {
    const member = staff.find((item) => item.id === id);
    // Snapshot the open jobs to unassign BEFORE removing the staff record.
    const affected = member ? jobs.filter((job) => job.alloc === member.name && job.status !== "Complete") : [];
    setStaff((prev) => prev.filter((item) => item.id !== id));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_STAFF_TABLE).delete().eq("id", id));
      if (!result.ok) {
        // Put the person back, and DON'T unassign their jobs or prune their calendar — those
        // used to run even when the delete failed, quietly mangling data around a no-op.
        if (member) setStaff((prev) => mergeStaffLists(prev, [member]));
        setStaffSyncState("error");
        toast.error("Could not remove that person", { description: result.message });
        return fail(result);
      }
      setStaffSyncState("synced");
      setLastWriteError(null);
    }
    // Unassign their open jobs through patchJob so the change is PERSISTED to the DB — a
    // local-only edit would be resurrected by the next refetch/realtime sync.
    for (const job of affected) await patchJob(job.id, { alloc: "Unassigned" });
    // Drop the person's calendar entries locally (the DB cascades via the FK).
    setCalendar((prev) => prev.filter((e) => e.staffId !== id));
    return LOCAL_OK;
  }, [staff, jobs, patchJob, fail]);

  // Set (or clear) a staff member's status on a date. "Available" removes the row entirely —
  // Available is the absence of an entry. Public holidays are not user-settable here.
  const setCalendarEntry = useCallback(async (staffId, date, status) => {
    const iso = String(date).slice(0, 10);
    if (!staffId || !iso) return LOCAL_OK;
    const id = calendarEntryKey(staffId, iso);
    const priorEntry = calendar.find((e) => e.id === id) || null;
    if (status === "Available") {
      setCalendar((prev) => prev.filter((e) => e.id !== id));
      if (supabase) {
        const result = await runWrite(() => supabase.from(SUPABASE_CALENDAR_TABLE).delete().eq("id", id));
        if (!result.ok) {
          if (priorEntry) setCalendar((prev) => [...prev.filter((e) => e.id !== id), priorEntry]);
          toast.error("Could not update calendar", { description: result.message });
          return fail(result);
        }
        setLastWriteError(null);
        return result;
      }
      return LOCAL_OK;
    }
    const entry = normalizeCalendarEntry({ id, staffId, date: iso, status, updatedAt: new Date().toISOString() });
    setCalendar((prev) => [...prev.filter((e) => e.id !== id), entry]);
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_CALENDAR_TABLE).upsert(toCalendarDbPayload(entry)));
      if (!result.ok) {
        setCalendar((prev) => (priorEntry ? [...prev.filter((e) => e.id !== id), priorEntry] : prev.filter((e) => e.id !== id)));
        toast.error("Could not update calendar", { description: result.message });
        return fail(result);
      }
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [calendar, fail]);

  const addHoliday = useCallback(async (fields) => {
    const holiday = normalizeHoliday(fields);
    if (!holiday.date) return LOCAL_OK;
    const priorHolidays = holidays;
    setHolidays((prev) => [...prev.filter((h) => h.date !== holiday.date), holiday].sort((a, b) => a.date.localeCompare(b.date)));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_HOLIDAYS_TABLE).upsert(toHolidayDbPayload(holiday)));
      if (!result.ok) {
        setHolidays(priorHolidays);
        toast.error("Could not save holiday", { description: result.message });
        return fail(result);
      }
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [holidays, fail]);

  const deleteHoliday = useCallback(async (date) => {
    const iso = String(date).slice(0, 10);
    const priorHolidays = holidays;
    setHolidays((prev) => prev.filter((h) => h.date !== iso));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_HOLIDAYS_TABLE).delete().eq("date", iso));
      if (!result.ok) {
        setHolidays(priorHolidays);
        toast.error("Could not remove holiday", { description: result.message });
        return fail(result);
      }
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [holidays, fail]);

  // Send a Supabase invite email via the invite-user edge function (admin-only, service role).
  // No-op with a message in demo mode (no Supabase configured).
  const inviteStaff = useCallback(async ({ email, name, role }) => {
    if (!supabase) {
      toast.info("Invitations need a connected Supabase project", { description: "The staff record was still added." });
      return { ok: false, skipped: true };
    }
    const { data, error } = await supabase.functions.invoke("invite-user", { body: { email, name, role } });
    // A non-2xx from the function surfaces as a FunctionsHttpError whose `.message` is the
    // generic "Edge Function returned a non-2xx status code" — the real reason is in the
    // response body (error.context). Dig it out so failures are actually diagnosable.
    let reason = data?.error || null;
    if (error) {
      reason = error.message;
      try {
        const body = await error.context?.json?.();
        if (body?.error) reason = body.error;
      } catch { /* body wasn't JSON */ }
    }
    if (reason) {
      const already = /already been registered|already registered/i.test(reason);
      toast.error(already ? "That email already has an account" : "Could not send invitation", {
        description: already ? "They can sign in directly (or reset their password) — no new invite needed." : reason,
      });
      return { ok: false, reason };
    }
    toast.success(`Invitation sent to ${email}`);
    return { ok: true };
  }, []);

  const addJobType = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return LOCAL_OK;
    const existing = jobTypes.find((jobType) => jobTypeKey(jobType.name) === jobTypeKey(name));
    const localJobType = normalizeJobType({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `jobtype-${jobTypeKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    const priorJobTypes = jobTypes;
    setJobTypes((prev) => mergeJobTypeLists(prev.filter((jobType) => jobType.id !== localJobType.id), [localJobType]));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_JOB_TYPES_TABLE).upsert(toJobTypeDbPayload(localJobType)).select("*").single());
      if (!result.ok) {
        setJobTypes(priorJobTypes);
        setJobTypeSyncState("error");
        toast.error("Could not save that job type", { description: result.message });
        return fail(result);
      }
      if (result.data) setJobTypes((prev) => mergeJobTypeLists(prev.filter((jobType) => jobType.id !== localJobType.id), [result.data]));
      setJobTypeSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [jobTypes, fail]);

  const updateJobType = useCallback(async (id, patch) => {
    let nextJobType = null;
    let priorJobType = null;
    setJobTypes((prev) => mergeJobTypeLists(prev.map((jobType) => {
      if (jobType.id !== id) return jobType;
      priorJobType = jobType;
      nextJobType = normalizeJobType({ ...jobType, ...patch, updatedAt: new Date().toISOString() });
      return nextJobType;
    })));
    if (supabase && nextJobType) {
      const result = await runWrite(() => supabase.from(SUPABASE_JOB_TYPES_TABLE).update(toJobTypeDbPayload(nextJobType)).eq("id", id));
      if (!result.ok) {
        if (priorJobType) setJobTypes((prev) => mergeJobTypeLists(prev.map((jobType) => (jobType.id === id ? priorJobType : jobType))));
        setJobTypeSyncState("error");
        toast.error("Could not update that job type", { description: result.message });
        return fail(result);
      }
      setJobTypeSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  const deleteJobType = useCallback(async (id) => {
    const priorJobType = jobTypes.find((jobType) => jobType.id === id) || null;
    setJobTypes((prev) => prev.filter((jobType) => jobType.id !== id));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_JOB_TYPES_TABLE).delete().eq("id", id));
      if (!result.ok) {
        if (priorJobType) setJobTypes((prev) => mergeJobTypeLists(prev, [priorJobType]));
        setJobTypeSyncState("error");
        toast.error("Could not remove that job type", { description: result.message });
        return fail(result);
      }
      setJobTypeSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [jobTypes, fail]);

  const addCustomer = useCallback(async (fields) => {
    const name = String(fields.name || "").trim();
    if (!name) return LOCAL_OK;
    const existing = customers.find((customer) => customerKey(customer.name) === customerKey(name));
    const localCustomer = normalizeCustomer({
      ...(existing || {}),
      ...fields,
      id: existing?.id || `customer-${customerKey(name)}-${Date.now().toString(36)}`,
      name,
      active: fields.active ?? true,
      updatedAt: new Date().toISOString(),
    });
    const priorCustomers = customers;
    setCustomers((prev) => mergeCustomerLists(prev.filter((customer) => customer.id !== localCustomer.id), [localCustomer]));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_CUSTOMERS_TABLE).upsert(toCustomerDbPayload(localCustomer)).select("*").single());
      if (!result.ok) {
        setCustomers(priorCustomers);
        setCustomerSyncState("error");
        toast.error("Could not save that customer", { description: result.message });
        return fail(result);
      }
      if (result.data) setCustomers((prev) => mergeCustomerLists(prev.filter((customer) => customer.id !== localCustomer.id), [result.data]));
      setCustomerSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [customers, fail]);

  const updateCustomer = useCallback(async (id, patch) => {
    let nextCustomer = null;
    let priorCustomer = null;
    setCustomers((prev) => mergeCustomerLists(prev.map((customer) => {
      if (customer.id !== id) return customer;
      priorCustomer = customer;
      nextCustomer = normalizeCustomer({ ...customer, ...patch, updatedAt: new Date().toISOString() });
      return nextCustomer;
    })));
    if (supabase && nextCustomer) {
      const result = await runWrite(() => supabase.from(SUPABASE_CUSTOMERS_TABLE).update(toCustomerDbPayload(nextCustomer)).eq("id", id));
      if (!result.ok) {
        if (priorCustomer) setCustomers((prev) => mergeCustomerLists(prev.map((customer) => (customer.id === id ? priorCustomer : customer))));
        setCustomerSyncState("error");
        toast.error("Could not update that customer", { description: result.message });
        return fail(result);
      }
      setCustomerSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  const deleteCustomer = useCallback(async (id) => {
    const priorCustomer = customers.find((customer) => customer.id === id) || null;
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_CUSTOMERS_TABLE).delete().eq("id", id));
      if (!result.ok) {
        if (priorCustomer) setCustomers((prev) => mergeCustomerLists(prev, [priorCustomer]));
        setCustomerSyncState("error");
        toast.error("Could not remove that customer", { description: result.message });
        return fail(result);
      }
      setCustomerSyncState("synced");
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [customers, fail]);

  const updateProfile = useCallback(async (id, patch) => {
    let priorProfile = null;
    setProfiles((prev) => prev.map((profile) => {
      if (profile.id !== id) return profile;
      priorProfile = profile;
      return { ...profile, ...patch };
    }));
    if (supabase) {
      const result = await runWrite(() => supabase.from(SUPABASE_PROFILES_TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
      if (!result.ok) {
        if (priorProfile) setProfiles((prev) => prev.map((profile) => (profile.id === id ? priorProfile : profile)));
        toast.error("Could not update account", { description: result.message });
        return fail(result);
      }
      setLastWriteError(null);
      return result;
    }
    return LOCAL_OK;
  }, [fail]);

  // ---- Derived data (moved verbatim from App) --------------------------
  const activeJobs = useMemo(() => jobs.filter((job) => !job.deleted), [jobs]);
  const deletedJobs = useMemo(() => jobs.filter((job) => job.deleted), [jobs]);

  const people = useMemo(() => {
    const set = new Set(staff.map((member) => member.name));
    activeJobs.forEach((job) => job.alloc && set.add(job.alloc));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [activeJobs, staff]);

  // Emails of accounts with the admin role — admins manage the shop but are NOT assignable
  // to jobs (only staff-role people are). Matched to staff records by email.
  const adminEmails = useMemo(
    () => new Set(profiles.filter((p) => p.role === "admin").map((p) => String(p.email || "").toLowerCase()).filter(Boolean)),
    [profiles],
  );

  // No DEFAULT_STAFF fallback here — cloud staff state (see fetch effect above) is
  // now the source of truth, including when it's genuinely empty. Admin-role accounts are
  // excluded so they never appear in the job-assignment dropdown.
  const activePeople = useMemo(() => staff
    .filter((member) => member.active && !(member.email && adminEmails.has(String(member.email).toLowerCase())))
    .map((member) => member.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b)), [staff, adminEmails]);

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
    .sort((a, b) => (parseInstant(b.at)?.getTime() || 0) - (parseInstant(a.at)?.getTime() || 0)), [activeJobs]);

  const updateFilter = useCallback((key, value) => setFilters((prev) => ({ ...prev, [key]: value })), []);
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const auditBy = user?.name || user?.email || "Workshop";

  // Central audited mutation: computes field diffs and prepends an audit entry to the job's notes.
  const auditPatch = useCallback(async (id, patch, actionLabel) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return LOCAL_OK;
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
    return addJob({ ...fields, notes: [entry] });
  }, [addJob, auditBy]);

  // Batch moves run job-by-job. A failure partway through used to be invisible, leaving some
  // jobs moved and some not with nothing said — report the tally instead.
  const runBatch = useCallback(async (affected, apply, what) => {
    const failures = [];
    for (const job of affected) {
      const result = await apply(job);
      if (result && !result.ok) failures.push({ job, result });
    }
    if (failures.length) {
      toast.error(`${failures.length} of ${affected.length} jobs could not be ${what}`, {
        description: failures[0].result.message,
      });
      return { ok: false, failures, message: failures[0].result.message };
    }
    return LOCAL_OK;
  }, []);

  const reassignStaffJobs = useCallback(async (fromName, toName) => {
    const target = toName || "Unassigned";
    const affected = jobs.filter((job) => job.alloc === fromName && job.status !== "Complete");
    return runBatch(affected, (job) => auditPatch(job.id, { alloc: target }, "Batch reassignment"), "reassigned");
  }, [jobs, auditPatch, runBatch]);

  const reassignJobTypeJobs = useCallback(async (fromType, toType) => {
    if (!toType || toType === fromType) return LOCAL_OK;
    const affected = jobs.filter((job) => job.type === fromType);
    return runBatch(affected, (job) => auditPatch(job.id, { type: toType }, "Batch job-type move"), "moved");
  }, [jobs, auditPatch, runBatch]);

  const reassignCustomerJobs = useCallback(async (fromName, toName) => {
    if (!toName || toName === fromName) return LOCAL_OK;
    const affected = jobs.filter((job) => job.cust === fromName);
    return runBatch(affected, (job) => auditPatch(job.id, { cust: toName }, "Batch customer move"), "moved");
  }, [jobs, auditPatch, runBatch]);

  // Manual close-out: archive a completed job off the board early (or return it).
  const setJobArchived = useCallback((id, archived) => (
    auditPatch(id, { archived }, archived ? "Job archived" : "Job returned to board")
  ), [auditPatch]);

  const value = useMemo(() => ({
    jobs, staff, jobTypes, customers, calendar, holidays, profiles, loading,
    syncState, staffSyncState, jobTypeSyncState, customerSyncState,
    lastWriteError, dismissWriteError,
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
    lastWriteError, dismissWriteError,
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
