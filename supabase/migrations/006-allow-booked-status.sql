-- 006 - Accept 'Booked' alongside 'Blocked' (step 1 of the rename)
--
-- "Blocked" collided with the Input Needed job status, whose short label is also "Blocked",
-- so the calendar status is being renamed to "Booked". This migration ONLY widens the check
-- constraint; it deliberately changes no rows.
--
-- ORDER MATTERS, and this is why the rename is three steps rather than one:
--
--   1. (here) allow BOTH values. The running frontend still writes 'Blocked' and is unaffected.
--   2. deploy the frontend that sets 'Booked' and can render an unknown status without dying.
--   3. (007) migrate the existing 'Blocked' rows to 'Booked' and drop 'Blocked' from the check.
--
-- Migrating the rows here instead would hand the LIVE frontend a status its
-- CALENDAR_STATUS_META has no entry for; it reads meta.bg unguarded, so the Team Availability
-- view would throw for every user until the new build landed. 23 real rows already exist
-- (forward planning into Sept/Oct), so this is not a hypothetical.
--
-- Constraint name read from the catalog, never guessed - CLAUDE.md §1.

do $$
declare
  cname text;
begin
  if to_regclass('backup.staff_calendar_006') is null then
    execute 'create table backup.staff_calendar_006 as select * from public.staff_calendar';
  end if;

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
      check (status in ('Training', 'Leave', 'Sick', 'Blocked', 'Booked'))
  $ddl$;
end $$;
