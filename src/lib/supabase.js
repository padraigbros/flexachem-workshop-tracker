import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_TABLE = import.meta.env.VITE_SUPABASE_JOBS_TABLE || "jobs";
export const SUPABASE_STAFF_TABLE = import.meta.env.VITE_SUPABASE_STAFF_TABLE || "staff";
export const SUPABASE_JOB_TYPES_TABLE = import.meta.env.VITE_SUPABASE_JOB_TYPES_TABLE || "job_types";
export const SUPABASE_CUSTOMERS_TABLE = import.meta.env.VITE_SUPABASE_CUSTOMERS_TABLE || "customers";
export const SUPABASE_START_COLUMN = import.meta.env.VITE_SUPABASE_START_COLUMN || "start_date";
export const SUPABASE_DUE_COLUMN = import.meta.env.VITE_SUPABASE_DUE_COLUMN || "due_date";
// Login accounts (the table formerly named `profiles`). One row per person who can sign in
// — admins and staff alike — carrying role, active and theme. Being *assignable to jobs* is
// the staff table's job, not this one. VITE_SUPABASE_PROFILES_TABLE is still honoured as a
// fallback so an environment that hasn't run the rename migration yet keeps working.
export const SUPABASE_ACCOUNTS_TABLE =
  import.meta.env.VITE_SUPABASE_ACCOUNTS_TABLE || import.meta.env.VITE_SUPABASE_PROFILES_TABLE || "accounts";
export const SUPABASE_CALENDAR_TABLE = import.meta.env.VITE_SUPABASE_CALENDAR_TABLE || "staff_calendar";
export const SUPABASE_HOLIDAYS_TABLE = import.meta.env.VITE_SUPABASE_HOLIDAYS_TABLE || "public_holidays";
export const PDF_BUCKET = import.meta.env.VITE_SUPABASE_PDF_BUCKET || "job-files";

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
