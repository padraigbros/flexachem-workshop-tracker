# Flexachem Workshop Tracker

React + Vite single-page app for tracking workshop jobs, with optional Supabase cloud sync.

## Running locally

```bash
npm install
npm run dev
```

With no Supabase environment variables the app runs in **local demo mode**: data lives in the browser's localStorage and the login screen grants full admin access.

## Supabase setup (cloud mode)

Environment variables (e.g. in `.env.local` or your host's settings):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> **Upgrading an existing project?** The table formerly called `profiles` is now `accounts`.
> Run [`supabase/migrations/001-rename-profiles-to-accounts.sql`](supabase/migrations/001-rename-profiles-to-accounts.sql)
> once, before deploying this build. It backs both tables up, renames in place (no data moves),
> and gives every staff-role account the staff record that makes them assignable to jobs.

Then, **one-time setup** for auth, the audit-friendly schema and PDF attachments:

1. **Run [`supabase-setup.sql`](supabase-setup.sql)** in the Supabase SQL editor. It creates the `accounts` table — one row per login account, admins and staff alike — (+ signup trigger), adds `attachment`/`deleted` columns to `jobs`, creates the private `job-files` storage bucket, and enables Row Level Security on all tables.
2. **Enable the Email provider** under Authentication → Providers. For an internal tool, consider disabling "Confirm email"; if you keep it on, set the Site URL (Authentication → URL Configuration) to your deployed app URL so confirmation/reset links come back to the app.
3. **Sign up in the app**, then bootstrap your admin account in the SQL editor:
   ```sql
   update public.accounts set role = 'admin' where email = 'you@example.com';
   ```
   (Refresh the app afterwards.) From then on, admins can promote/disable accounts from **Staff → Login accounts**.

### Roles

| | Admin | Staff |
|---|---|---|
| Dashboard + Schedule | ✓ | ✓ |
| Update job status / drag cards / post notes | ✓ | ✓ |
| Create, edit, delete jobs | ✓ | — |
| Staff, Job Types, Business Units, Due Dates, Master List | ✓ | — |
| Manage login accounts | ✓ | — |

New signups start as **staff**. Security note: the table-level rules (who can insert/delete jobs, who can write staff/job types/accounts/storage) are enforced by RLS in the database; the finer "staff can only change status/notes" rule is enforced in the app UI.

### Audit trail

Every change is recorded automatically on the job's activity feed: creation, field edits (old → new), status changes (including drag-and-drop on the Schedule), batch reassignments, deletion and restore — stamped with who and when. Deleting a job is a **soft delete**: it disappears from all views but keeps its history, and admins can restore it from Master List → Deleted jobs.

### PDF job import & attachments

Admins can drag-and-drop a Business Central **Assembly Order PDF** at the top of the "Log new job" form. The app reads the PDF locally (nothing leaves the browser until save) and auto-fills: assembly no, sales order, due/start dates, description + quantity, owner (printed-by name), customer (best-effort) and a job-type guess. On save the PDF is uploaded to the private `job-files` bucket and is viewable/downloadable from the job drawer. If cloud upload isn't available the PDF is kept in browser storage instead.
