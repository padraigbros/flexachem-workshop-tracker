-- ============================================================================
-- Restrict account creation to approved email domains.
--
-- Supabase has NO built-in setting for this on email/password auth — the
-- Dashboard can only turn signup on or off wholesale. This enforces it in the
-- database, which means it applies to EVERY route in: the signup form, the
-- invite edge function, the Dashboard's "Add user", and the admin API. There is
-- no way around it, which is the point.
--
-- Run this whole file in the SQL editor. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The allow-list.
--    A table rather than a hardcoded string so you can add a domain without a
--    migration — e.g. taking on a contractor, or a second company domain.
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_email_domains (
  domain text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_email_domains enable row level security;

drop policy if exists "allowed_domains select admin" on public.allowed_email_domains;
create policy "allowed_domains select admin" on public.allowed_email_domains
  for select to authenticated using (private.is_admin());

-- >>> CHECK THIS BEFORE RUNNING <<<
-- The codebase only ever references @flexachem.com (seed data). If staff actually
-- use flexachem.ie or anything else, add it here or nobody on that domain can be
-- given an account. Confirm against a real colleague's address first.
insert into public.allowed_email_domains (domain, note)
values ('flexachem.com', 'Primary company domain')
on conflict (domain) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Enforce it.
--
--    SAFETY, given the 29 Jul outage: this trigger CAN block account creation —
--    that is its job — so it is written to fail in the least damaging direction.
--    If the allow-list is empty it permits everything, because an unconfigured
--    table silently locking every route to a new account (including invites and
--    your own Dashboard) would be far worse than no restriction at all.
--    Deleting every row disables the check; it does not lock you out.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  addr_domain text := lower(split_part(new.email, '@', 2));
  allowed_count int;
begin
  select count(*) into allowed_count from public.allowed_email_domains;
  if allowed_count = 0 then
    return new;  -- not configured: do not block anything
  end if;

  if not exists (select 1 from public.allowed_email_domains where domain = addr_domain) then
    raise exception 'Accounts are limited to approved company email domains.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_email_domain() from public, anon, authenticated;

drop trigger if exists enforce_email_domain_on_signup on auth.users;
create trigger enforce_email_domain_on_signup
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- ---------------------------------------------------------------------------
-- 3. Verify — do this immediately, do not assume.
-- ---------------------------------------------------------------------------
-- Existing accounts are untouched. Check whether any current user would now be
-- refused (they keep working; this is only about NEW accounts):
--
--   select u.email
--   from auth.users u
--   where lower(split_part(u.email, '@', 2)) not in (select domain from public.allowed_email_domains);
--
-- Then test both directions in the live app:
--   - an @flexachem.com address       -> account is created
--   - a @gmail.com address            -> refused
--
-- Roll back instantly if anything is wrong:
--   drop trigger if exists enforce_email_domain_on_signup on auth.users;
--
-- Add another domain later:
--   insert into public.allowed_email_domains (domain, note) values ('flexachem.ie', 'IE domain');
