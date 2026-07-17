-- ============================================================================
-- Flexachem Workshop Tracker — Supabase setup for auth, audit & PDF attachments
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: statements are idempotent where possible.
--
-- Also required in the Dashboard (not SQL):
--   1. Authentication → Providers → Email: ENABLE.
--      For an internal tool, consider disabling "Confirm email" so people can
--      sign in immediately. If you keep confirmation on, set Authentication →
--      URL Configuration → Site URL to your deployed app URL.
--   2. After YOUR first signup in the app, run the "bootstrap first admin"
--      statement at the bottom of this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles: one row per login account, carrying the app role.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when someone signs up (name comes from the signup form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by RLS policies. SECURITY DEFINER so it can read profiles
-- without recursing through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Jobs table: new columns for PDF attachments and soft delete.
--    (The jobs table is created by the app's normal use; we only add columns.)
-- ---------------------------------------------------------------------------
alter table public.jobs add column if not exists attachment jsonb;
alter table public.jobs add column if not exists deleted boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2b. Staff & job-type catalogues.
--     These may only have existed in browser storage until now. Created here
--     (if missing) with the exact columns the app writes, so cloud sync works
--     and the RLS section below has real tables to secure. Ids are text
--     (e.g. 'staff-darragh', 'jobtype-valve-assembly') — not uuids.
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text,
  active boolean not null default true,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_types (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Storage bucket for job PDFs (private; the app uses signed URLs).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security.
--    THE HARD BOUNDARY: signed-in users can read everything and update jobs
--    (staff move statuses / post notes); only admins can create or delete
--    jobs and manage staff, job types and accounts.
--    NOTE: "staff may only change status/notes" is enforced by the app UI,
--    not by RLS — column-level rules aren't practical here. Acceptable for an
--    internal tool; the table-level rules below are the real security line.
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;
alter table public.staff enable row level security;
alter table public.job_types enable row level security;
alter table public.profiles enable row level security;

-- jobs
drop policy if exists "jobs select authenticated" on public.jobs;
create policy "jobs select authenticated" on public.jobs for select to authenticated using (true);
drop policy if exists "jobs update authenticated" on public.jobs;
create policy "jobs update authenticated" on public.jobs for update to authenticated using (true) with check (true);
drop policy if exists "jobs insert admin" on public.jobs;
create policy "jobs insert admin" on public.jobs for insert to authenticated with check (public.is_admin());
drop policy if exists "jobs delete admin" on public.jobs;
create policy "jobs delete admin" on public.jobs for delete to authenticated using (public.is_admin());

-- staff
drop policy if exists "staff select authenticated" on public.staff;
create policy "staff select authenticated" on public.staff for select to authenticated using (true);
drop policy if exists "staff write admin" on public.staff;
create policy "staff write admin" on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- job_types
drop policy if exists "job_types select authenticated" on public.job_types;
create policy "job_types select authenticated" on public.job_types for select to authenticated using (true);
drop policy if exists "job_types write admin" on public.job_types;
create policy "job_types write admin" on public.job_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles
drop policy if exists "profiles select authenticated" on public.profiles;
create policy "profiles select authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- storage: job-files bucket (read for signed-in users, writes for admins)
drop policy if exists "job files read" on storage.objects;
create policy "job files read" on storage.objects for select to authenticated using (bucket_id = 'job-files');
drop policy if exists "job files insert admin" on storage.objects;
create policy "job files insert admin" on storage.objects for insert to authenticated with check (bucket_id = 'job-files' and public.is_admin());
drop policy if exists "job files update admin" on storage.objects;
create policy "job files update admin" on storage.objects for update to authenticated using (bucket_id = 'job-files' and public.is_admin());
drop policy if exists "job files delete admin" on storage.objects;
create policy "job files delete admin" on storage.objects for delete to authenticated using (bucket_id = 'job-files' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Bootstrap the first admin AFTER signing up in the app.
--    Replace the email if needed, then run:
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'padraigbrosnan@gmail.com';
