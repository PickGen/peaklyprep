-- PeaklyPrep: TEST checkout ------------------------------------------------------------------
-- While real payments (Paddle) are not connected, "Choose plan" activates the plan immediately so the
-- whole flow can be tested. It is controlled by a setting, so it can be switched off before launch:
--
--     update public.app_settings set value = 'false'::jsonb where key = 'test_checkout';
--
-- With the setting off, test_purchase() refuses and students cannot give themselves plans.

create table if not exists public.app_settings (
  key    text primary key,
  value  jsonb not null
);

alter table public.app_settings enable row level security;

drop policy if exists "settings read"  on public.app_settings;
drop policy if exists "settings admin" on public.app_settings;
create policy "settings read"  on public.app_settings for select to authenticated using (true);
create policy "settings admin" on public.app_settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values ('test_checkout', 'true'::jsonb)
on conflict (key) do nothing;

create or replace function public.test_purchase(p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  v_months   int;
  v_base     timestamptz;
  v_expires  timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce((select value::text from public.app_settings where key = 'test_checkout'), 'false') <> 'true' then
    raise exception 'Test checkout is disabled';
  end if;

  v_months := case p_plan when '1m' then 1 when '3m' then 3 when '6m' then 6 when '12m' then 12 else null end;
  if v_months is null then
    raise exception 'Unknown plan';
  end if;

  -- extend from the end of the current plan if one is still active
  select greatest(now(), coalesce(max(expires_at), now())) into v_base
  from public.subscriptions
  where user_id = uid and expires_at > now();

  v_expires := v_base + make_interval(months => v_months);

  insert into public.subscriptions (user_id, plan, starts_at, expires_at, source)
  values (uid, p_plan, now(), v_expires, 'test');

  return jsonb_build_object('plan', p_plan, 'expires_at', v_expires);
end;
$$;

revoke all on function public.test_purchase(text) from public, anon;
grant execute on function public.test_purchase(text) to authenticated;
