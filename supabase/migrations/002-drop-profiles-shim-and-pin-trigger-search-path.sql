-- ===========================================================================
-- Applied to production 30 Jul 2026 via the Supabase MCP connector
-- (migration name: drop_profiles_shim_and_pin_trigger_search_path).
-- Recorded here so the repo matches the live database.
-- ===========================================================================

-- 1. Retire the deploy-window compatibility shim created by migration 001.
--    Preconditions verified before running:
--      - Vercel dpl_3ZH7qTyE9xeVEDEZoDLqsVXumLSh (commit 938bc9b) READY in production,
--        i.e. the frontend queries `accounts` directly.
--      - invite-user edge function redeployed (v3) against `accounts`.
--      - notify-job-event, notify-push and sweep-job-errors each read and confirmed to
--        contain no reference to `profiles`.
drop view if exists public.profiles;

-- 2. Pin search_path on the two hand-written job/staff sync triggers.
--    Flagged by the Supabase security advisor (0011_function_search_path_mutable): without a
--    fixed search_path the calling role's schema resolution applies, which is how a
--    search_path attack gets a SECURITY DEFINER-adjacent function to call the wrong table.
--    Both bodies already schema-qualify public.staff, so this changes no behaviour.
--
--    NOTE: these two functions and the `jobs.staff_id` column they maintain exist ONLY in the
--    live database — they were authored in the dashboard and appear in no other repo file.
--    See CLAUDE.md §5.
alter function public.flexachem_sync_job_columns() set search_path = public;
alter function public.flexachem_sync_job_staff() set search_path = public;

-- Post-conditions confirmed: profiles shim gone, 8 accounts, 4 staff, both functions pinned,
-- and both function_search_path_mutable advisories cleared.
