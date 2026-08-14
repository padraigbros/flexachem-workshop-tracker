-- 007 - Migrate 'Blocked' rows to 'Booked' and drop the old value (step 2 of the rename)
--
-- APPLY THIS ONLY ONCE THE RENAMING FRONTEND IS LIVE. See 006 for why: until the deployed
-- build knows 'Booked', rewriting these rows hands it a status its CALENDAR_STATUS_META has no
-- entry for. metaFor() (src/lib/calendar.js) now degrades to a muted swatch instead of throwing,
-- but that guard shipped WITH this rename - it does not protect builds older than it.
--
-- 23 rows existed at the time of writing (Chris Sheeran 9, Evan Twomey 9, David O Connell 5),
-- forward planning into Sept/Oct 2026. Real data, not test rows.

do $$
declare
  cname text;
  moved integer := 0;
begin
  if to_regclass('backup.staff_calendar_007') is null then
    execute 'create table backup.staff_calendar_007 as select * from public.staff_calendar';
  end if;

  update public.staff_calendar set status = 'Booked', updated_at = now() where status = 'Blocked';
  get diagnostics moved = row_count;
  raise notice 'migration 007: renamed % calendar row(s) from Blocked to Booked', moved;

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
      check (status in ('Training', 'Leave', 'Sick', 'Booked'))
  $ddl$;
end $$;
