-- ===========================================================================
-- Migration: profiles -> accounts, and give every staff-role person a staff row.
--
-- WHAT THIS DOES
--   1. Snapshots both tables into a `backup` schema first. Nothing is dropped
--      or deleted anywhere in this script — the only writes are a table RENAME
--      and INSERTs.
--   2. Renames public.profiles -> public.accounts. A rename carries its rows,
--      primary key, foreign keys (notifications.user_id, push_tokens.user_id),
--      indexes and RLS policies with it — no data moves, no FK is broken.
--   3. Recreates the five SECURITY DEFINER functions whose bodies name
--      `public.profiles` as text. Postgres does NOT rewrite function bodies on
--      rename, so skipping this would break login, RLS and @-mentions.
--   4. Backfills a public.staff row for every non-admin account that lacks one,
--      so everyone on the team is assignable to jobs and has a calendar.
--      Admins deliberately get no staff record.
--   5. Leaves a `public.profiles` VIEW over accounts so the currently-deployed
--      frontend keeps working until you ship the new build. Drop it once the
--      new build is live (statement at the bottom, commented out).
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and run it in one go.
--   It is wrapped in a transaction: any error rolls the entire thing back.
--   Then run the verification queries at the bottom.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Backup. Plain copies, kept until you're satisfied. Re-running the script
--    will not overwrite an existing backup (that would destroy the good copy).
-- ---------------------------------------------------------------------------
create schema if not exists backup;

do $$
begin
  if to_regclass('backup.profiles_pre_rename') is null then
    execute 'create table backup.profiles_pre_rename as select * from public.profiles';
  end if;
  if to_regclass('backup.staff_pre_rename') is null then
    execute 'create table backup.staff_pre_rename as select * from public.staff';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. The rename itself.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Guard so the script is safe to re-run after a partial attempt.
  if to_regclass('public.accounts') is null then
    alter table public.profiles rename to accounts;
  end if;
end $$;

-- Cosmetic: bring the constraint and policy names in line with the table name.
-- These are pure renames; the rules they enforce do not change. Both blocks look the real
-- names up in the catalog rather than assuming Postgres' default naming — a table that has
-- been renamed before keeps its original constraint names, so guessing here is how you
-- abort an otherwise good migration on a purely cosmetic step.
do $$
declare pk_name text;
begin
  select conname into pk_name
    from pg_constraint
   where conrelid = 'public.accounts'::regclass and contype = 'p';
  if pk_name is not null and pk_name <> 'accounts_pkey' then
    execute format('alter table public.accounts rename constraint %I to accounts_pkey', pk_name);
  end if;
end $$;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'accounts' and policyname like 'profiles %'
  loop
    execute format(
      'alter policy %I on public.accounts rename to %I',
      pol.policyname,
      replace(pol.policyname, 'profiles ', 'accounts ')
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Recreate every function that names the table in its body.
--    Same logic as before, only the table name changes.
-- ---------------------------------------------------------------------------

-- Auto-create an account row when someone signs up OR is invited.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data->>'role';
  was_invited boolean := coalesce((new.raw_user_meta_data->>'invited')::boolean, false);
begin
  insert into public.accounts (id, email, name, role, onboarded)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when meta_role in ('admin', 'staff') then meta_role else 'staff' end,
    not was_invited
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The helper behind every RLS policy in the database.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and role = 'admin' and active
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Per-account theme, scoped to the caller's own row.
create or replace function public.set_my_theme(new_theme text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if new_theme is null or new_theme not in ('light', 'dark', 'system') then
    raise exception 'invalid theme: %', new_theme;
  end if;
  update public.accounts
     set theme = new_theme, updated_at = now()
   where id = auth.uid();
end;
$$;

revoke all on function public.set_my_theme(text) from public;
grant execute on function public.set_my_theme(text) to authenticated;

-- Invited user flips their OWN account to onboarded after setting a password.
create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.accounts set onboarded = true, updated_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.complete_onboarding() from public;
grant execute on function public.complete_onboarding() to authenticated;

-- @-mention notifications.
create or replace function public.notify_mentions(target_ids uuid[], p_job_id text, p_job_label text, p_excerpt text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare actor_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(name, email, 'Workshop') into actor_name from public.accounts where id = auth.uid();
  insert into public.notifications (user_id, actor, job_id, job_label, excerpt)
  select distinct t, actor_name, p_job_id, p_job_label, left(coalesce(p_excerpt, ''), 200)
  from unnest(target_ids) as t
  where t <> auth.uid()
    and exists (select 1 from public.accounts a where a.id = t and a.active);
end;
$$;

revoke all on function public.notify_mentions(uuid[], text, text, text) from public;
grant execute on function public.notify_mentions(uuid[], text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Backfill: every non-admin account gets a staff record.
--    Insert-only and idempotent — matches on email, skips anyone already there.
-- ---------------------------------------------------------------------------
insert into public.staff (id, name, role, active, email, created_at, updated_at)
select
  'staff-' || regexp_replace(lower(trim(coalesce(nullif(trim(a.name), ''), a.email))), '[^a-z0-9]+', '-', 'g')
    || '-' || left(a.id::text, 8),
  coalesce(nullif(trim(a.name), ''), a.email),
  'Workshop technician',
  true,
  a.email,
  now(),
  now()
from public.accounts a
where a.role <> 'admin'
  and a.active is not false
  and a.email is not null
  and not exists (
    select 1 from public.staff s where lower(s.email) = lower(a.email)
  );

-- ---------------------------------------------------------------------------
-- 4. Compatibility view, so the deployed frontend keeps working mid-deploy.
--    security_invoker = true means the caller's own RLS on public.accounts
--    applies — the view grants nobody any access they didn't already have.
-- ---------------------------------------------------------------------------
create or replace view public.profiles with (security_invoker = true) as
  select * from public.accounts;

grant select, update on public.profiles to authenticated;

commit;

-- ===========================================================================
-- VERIFICATION — run these after the migration and read the output.
-- ===========================================================================

-- a) Row counts match the backup exactly (nothing lost in the rename).
select
  (select count(*) from backup.profiles_pre_rename) as accounts_before,
  (select count(*) from public.accounts)            as accounts_after,
  (select count(*) from backup.staff_pre_rename)    as staff_before,
  (select count(*) from public.staff)               as staff_after;

-- b) Every person, and whether they can now be assigned work.
select
  a.name,
  a.email,
  a.role                                             as account_role,
  a.active,
  s.id                                               as staff_id,
  case
    when a.role = 'admin' then 'admin — not assignable by design'
    when s.id is not null then 'assignable + has calendar'
    else 'PROBLEM: staff with no staff record'
  end                                                as status
from public.accounts a
left join public.staff s on lower(s.email) = lower(a.email)
order by a.role, a.name;

-- c) No orphaned foreign keys (both should return zero rows).
select 'notification orphan' as issue, n.id from public.notifications n
  left join public.accounts a on a.id = n.user_id where a.id is null
union all
select 'push token orphan', t.token from public.push_tokens t
  left join public.accounts a on a.id = t.user_id where a.id is null;

-- d) No calendar entry lost its owner.
select c.id from public.staff_calendar c
  left join public.staff s on s.id = c.staff_id where s.id is null;

-- ===========================================================================
-- AFTER the new frontend build is deployed and verified, retire the shim:
--
--   drop view public.profiles;
--
-- And once you are happy, months from now, the backup schema can go:
--
--   drop schema backup cascade;
-- ===========================================================================
