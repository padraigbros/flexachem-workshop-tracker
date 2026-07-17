// localStorage persistence + demo seed data — moved verbatim from App.jsx.
import {
  STORAGE_KEY, STAFF_STORAGE_KEY, JOB_TYPE_STORAGE_KEY, USER_KEY,
  DEFAULT_STAFF, DEFAULT_JOB_TYPES,
} from "./constants";
import { normalizeJob } from "./jobs";
import { normalizeStaff, mergeStaffLists, normalizeJobType, mergeJobTypeLists } from "./staff";
import { offsetDate } from "./dates";

export const SEED_JOBS = [
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

export function loadStoredJobs() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored).map(normalizeJob) : SEED_JOBS.map(normalizeJob);
  } catch {
    return SEED_JOBS.map(normalizeJob);
  }
}

export function saveStoredJobs(jobs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

export function loadStoredStaff() {
  try {
    const stored = localStorage.getItem(STAFF_STORAGE_KEY);
    const base = stored ? JSON.parse(stored).map(normalizeStaff) : DEFAULT_STAFF.map(normalizeStaff);
    return mergeStaffLists(DEFAULT_STAFF.map(normalizeStaff), base);
  } catch {
    return DEFAULT_STAFF.map(normalizeStaff);
  }
}

export function saveStoredStaff(staff) {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

export function loadStoredJobTypes() {
  try {
    const stored = localStorage.getItem(JOB_TYPE_STORAGE_KEY);
    const base = stored ? JSON.parse(stored).map(normalizeJobType) : DEFAULT_JOB_TYPES.map(normalizeJobType);
    return mergeJobTypeLists(DEFAULT_JOB_TYPES.map(normalizeJobType), base);
  } catch {
    return DEFAULT_JOB_TYPES.map(normalizeJobType);
  }
}

export function saveStoredJobTypes(jobTypes) {
  try {
    localStorage.setItem(JOB_TYPE_STORAGE_KEY, JSON.stringify(jobTypes));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

export function getInitialUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}
