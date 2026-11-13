-- PeaklyPrep: visit counter for the admin "Statistics" page -------------------------------------------
-- The site calls log_visit() once when it is opened; the admin page reads the totals with visit_stats().
-- No IP address and no name is stored: only a random id kept in the visitor's browser, the signed-in
-- student (if any) and the first page that was opened. Safe to re-run.

create table if not exists public.site_visits (
  id         bigint generated always as identity primary key,
  visitor_id text not null check (length(visitor_id) between 8 and 64),
  user_id    uuid references public.profiles (id) on delete set null,
  path       text not null default '/' check (length(path) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists site_visits_created_idx on public.site_visits (created_at);
create index if not exists site_visits_visitor_idx on public.site_visits (visitor_id, created_at desc);

-- Nobody writes to the table directly (there is no insert policy); rows are added only by log_visit().
alter table public.site_visits enable row level security;

drop policy if exists "visits admin read" on public.site_visits;
create policy "visits admin read" on public.site_visits for select to authenticated using (public.is_admin());

-- 1. Count a visit. Called by every visitor, signed in or not.
--    A visit = the site was opened; the same browser is counted again only after 30 minutes.
--    Admins are not counted, so the owners' own work does not inflate the numbers.
create or replace function public.log_visit(p_visitor text, p_path text default '/')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitor text := left(trim(coalesce(p_visitor, '')), 64);
  v_user    uuid;
begin
  if length(v_visitor) < 8 then
    return;
  end if;
  if public.is_admin() then
    return;
  end if;
  if exists (
    select 1 from public.site_visits
    where visitor_id = v_visitor and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  select id into v_user from public.profiles where id = auth.uid();

  insert into public.site_visits (visitor_id, user_id, path)
  values (v_visitor, v_user, left(coalesce(nullif(trim(p_path), ''), '/'), 200));
end;
$$;

revoke all on function public.log_visit(text, text) from public;
grant execute on function public.log_visit(text, text) to anon, authenticated;

-- 2. Totals for the admin page. Days are counted in Almaty time, like the weekly leaderboard.
--    "week" = the last 7 days including today, "month" = the last 30 days including today.
create or replace function public.visit_stats(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days   int  := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today  date := (now() at time zone 'Asia/Almaty')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  with v as (
    select visitor_id, (created_at at time zone 'Asia/Almaty')::date as vday
    from public.site_visits
  ),
  per_day as (
    select vday, count(*) as visits, count(distinct visitor_id) as visitors
    from v
    where vday > v_today - v_days
    group by vday
  ),
  days as (
    select v_today - g as vday from generate_series(0, v_days - 1) as g
  )
  select jsonb_build_object(
    'today',        (select count(*) from v where vday = v_today),
    'today_unique', (select count(distinct visitor_id) from v where vday = v_today),
    'week',         (select count(*) from v where vday > v_today - 7),
    'week_unique',  (select count(distinct visitor_id) from v where vday > v_today - 7),
    'month',        (select count(*) from v where vday > v_today - 30),
    'month_unique', (select count(distinct visitor_id) from v where vday > v_today - 30),
    'total',        (select count(*) from v),
    'total_unique', (select count(distinct visitor_id) from v),
    'first_day',    (select min(vday) from v),
    'daily',        (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('day', d.vday, 'visits', coalesce(p.visits, 0), 'visitors', coalesce(p.visitors, 0))
          order by d.vday
        ),
        '[]'::jsonb
      )
      from days d
      left join per_day p on p.vday = d.vday
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.visit_stats(int) from public, anon;
grant execute on function public.visit_stats(int) to authenticated;

-- check: the table exists and is empty until the new version of the site is opened
select count(*) as visits_recorded from public.site_visits;
