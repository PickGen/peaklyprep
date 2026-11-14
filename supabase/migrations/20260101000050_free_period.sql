-- PeaklyPrep: a free period for the whole site -----------------------------------------------------
-- The setting app_settings.free_until holds the moment the free period ends (ISO date-time, set on the
-- admin Settings page). While it is in the future, every signed-in student counts as subscribed:
-- lessons, questions, submitting tests and the mistake bank all go through has_active_subscription().
-- When the moment passes (or the setting is emptied) the paywall is back by itself. Safe to re-run.

-- 1. When the free period ends; null when there is none or the value cannot be read as a date.
create or replace function public.free_period_until()
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  -- settings saved from the admin page are stored with extra quotes around the text
  select btrim(value #>> '{}', '" ') into v from public.app_settings where key = 'free_until';
  if v is null or v = '' then
    return null;
  end if;
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

revoke all on function public.free_period_until() from public, anon;
grant execute on function public.free_period_until() to authenticated;

-- 2. "May study" = the free period is running, or the student's own subscription has not expired.
create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.free_period_until() > now(), false)
      or exists (select 1 from public.subscriptions where user_id = auth.uid() and expires_at > now());
$$;

-- 3. Visitors who are not signed in may read this one setting (the landing page shows "free until ...").
--    Every other setting (e.g. the card number) stays for signed-in users only.
grant select on public.app_settings to anon;
drop policy if exists "settings read free period" on public.app_settings;
create policy "settings read free period" on public.app_settings
  for select to anon using (key = 'free_until');
