-- ===========================================================================
-- Applied to production 31 Jul 2026 via the Supabase MCP connector
-- (migration name: unschedule_sweep_job_errors). Recorded here so the repo
-- matches the live database.
--
-- REVERSES the cron schedule added in 003. The table and extension stay.
-- ===========================================================================

-- Why this was necessary, not just tidy-up:
--
-- sweep-job-errors reads SUPABASE_MGMT_TOKEN and SUPABASE_PROJECT_REF. Supabase REJECTS any
-- Edge Function secret whose name begins with SUPABASE_ — the dashboard answers
-- "Name must not start with the SUPABASE_ prefix", and the CLI refuses the same. Both names
-- are therefore unsettable, which means the function has returned
--   500 {"error":"SUPABASE_MGMT_TOKEN / SUPABASE_PROJECT_REF not set"}
-- on every invocation since it was written and could never have done otherwise. This was not
-- a missed configuration step; the function's own variable names made it impossible.
--
-- An hourly cron that cannot succeed is worse than no cron: it reports nothing about itself
-- (the only trace is net._http_response), so it reads as working monitoring while covering
-- nothing. That is the exact failure shape behind the 29 Jul 2026 incident.

do $$
begin
  perform cron.unschedule('sweep-job-errors');
exception when others then null;   -- already gone; nothing to do
end $$;

-- Deliberately KEPT, so this is cheap to reverse:
--   * the sweep-job-errors Edge Function (still deployed)
--   * public.job_alerts (notify-job-event writes to it and its rate cap counts it)
--   * the pg_cron extension
--
-- TO BRING IT BACK, fix the function first — a re-scheduled cron against the current code
-- would just resume failing hourly:
--   1. Drop SUPABASE_PROJECT_REF entirely; derive the ref from the platform-provided
--      SUPABASE_URL:  new URL(Deno.env.get("SUPABASE_URL")).hostname.split(".")[0]
--   2. Rename SUPABASE_MGMT_TOKEN -> ALERT_MGMT_TOKEN (any name without the reserved
--      prefix) and set it under Edge Functions -> Secrets. NOTE: a Supabase personal access
--      token is account-wide and full-access — weigh that against what the sweeper covers.
--   3. Add an x-alert-secret check like notify-job-event has; the function is deployed with
--      verify_jwt = false and currently authenticates nobody.
--   4. Re-run the cron.schedule block from 003-failure-only-alerting.sql.
--
-- Post-conditions confirmed: cron.job empty, pg_cron still installed, job_alerts intact.
