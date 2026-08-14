-- 005 — Technician role + Blocked calendar status
--
-- Adds a third account role, `technician` (the Service & Assembly team), and moves the two
-- capabilities that used to key off "isn't an admin" — assignable to jobs, has an availability
-- calendar — onto that role instead. Every existing non-admin account is promoted to
-- technician so the app behaves identically on day one; admins then demote the sales people
-- and managers to `staff` from the Team roster. Promoting rather than guessing is deliberate:
-- only 7 of the 16 had ever held a job, and demoting the other 9 on that evidence would have
-- silently removed real technicians from the assignment dropdown and the calendar.
--
-- Also widens staff_calendar to accept a `Blocked` day. Blocked is a HARD status — it costs
-- 7.5h of that week's capacity and disables the person in the assignment dropdown, exactly
-- like Leave/Sick. Nothing in the app branches on the individual status names (every helper
-- tests `<> 'Available'`), so no application logic depends on this list beyond the check.
--
-- `private.is_admin()` is deliberately untouched: a technician is not an admin, so every RLS
-- policy keeps working unchanged. That is what keeps this migration small.
--
-- Constraint names are read from pg_constraint, never guessed. The role check on `accounts` is
-- STILL called `profiles_role_check` after the 001 rename, and hardcoding the Postgres default
-- (`accounts_role_check`) aborted a migration mid-run on 30 Jul 2026 — CLAUDE.md §1.

do $$
declare
  -- One-shot marker. The bulk promotion must not re-run later and undo a demotion an admin
  -- has since made in the UI; the backup table's absence is what "this is the first run" means.
  first_run boolean := to_regclass('backup.accounts_005') is null;
  cname text;
  moved integer := 0;
begin
  -- 1. Back up before anything is touched (CLAUDE.md §2).
  create schema if not exists backup;
  if first_run then
    execute 'create table backup.accounts_005 as select * from public.accounts';
  end if;
  if to_regclass('backup.staff_calendar_005') is null then
    execute 'create table backup.staff_calendar_005 as select * from public.staff_calendar';
  end if;

  -- 2. Widen the role check. Dropping every check constraint that covers the `role` column
  --    (by catalog lookup) also makes a re-run idempotent: it removes whatever this migration
  --    added last time before adding it again.
  for cname in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.accounts'::regclass
      and con.contype = 'c'
      and att.attname = 'role'
  loop
    execute format('alter table public.accounts drop constraint %I', cname);
  end loop;

  execute $ddl$
    alter table public.accounts
      add constraint accounts_role_check check (role in ('admin', 'staff', 'technician'))
  $ddl$;

  -- 3. Promote every existing non-admin account. Expected: 16 rows.
  if first_run then
    update public.accounts set role = 'technician', updated_at = now() where role = 'staff';
    get diagnostics moved = row_count;
    raise notice 'migration 005: promoted % account(s) from staff to technician', moved;
  else
    raise notice 'migration 005: backup.accounts_005 already exists — skipping the bulk promotion';
  end if;

  -- 4. Same treatment for the calendar status check.
  for cname in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.staff_calendar'::regclass
      and con.contype = 'c'
      and att.attname = 'status'
  loop
    execute format('alter table public.staff_calendar drop constraint %I', cname);
  end loop;

  execute $ddl$
    alter table public.staff_calendar
      add constraint staff_calendar_status_check
      check (status in ('Training', 'Leave', 'Sick', 'Blocked'))
  $ddl$;
end $$;

-- 5. The signup trigger carries its own copy of the allowed roles — a new role that is not
--    added here is silently downgraded at signup. The fallback stays 'staff' on purpose: a
--    self-signup must never land on a role that makes it assignable to workshop jobs.
--    `security definer set search_path = public` is not optional (migration 002 exists because
--    a dashboard-authored function skipped it).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  meta_role text := new.raw_user_meta_data->>'role';
  was_invited boolean := coalesce((new.raw_user_meta_data->>'invited')::boolean, false);
begin
  insert into public.accounts (id, email, name, role, onboarded)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when meta_role in ('admin', 'staff', 'technician') then meta_role else 'staff' end,
    not was_invited
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
