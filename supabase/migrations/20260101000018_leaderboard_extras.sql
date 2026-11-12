-- PeaklyPrep: extra (demo) participants on the weekly leaderboard -----------------------------------
-- Admins can add names with points, e.g. to fill a new leaderboard while there are few real students.
-- group_id = null: shown on «All students»; a group id: shown in that group's ranking.
-- Only admins can read or change this table; students only see the names and points inside the ranking.

create table if not exists public.leaderboard_extras (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 60),
  points     int  not null default 0 check (points between 0 and 100000),
  group_id   uuid references public.study_groups (id) on delete cascade,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.leaderboard_extras enable row level security;

drop policy if exists "extras admin" on public.leaderboard_extras;
create policy "extras admin" on public.leaderboard_extras for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.weekly_leaderboard(p_scope text default 'all', p_week_offset int default 0, p_group_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  v_group   uuid;
  v_from    timestamptz;
  v_to      timestamptz;
  v_rows    jsonb;
  v_me      jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  v_from := (date_trunc('week', now() at time zone 'Asia/Almaty') - make_interval(weeks => greatest(p_week_offset, 0))) at time zone 'Asia/Almaty';
  v_to   := v_from + interval '7 days';

  if p_scope = 'group' then
    if p_group_id is not null and public.is_admin() then
      v_group := p_group_id;
    else
      select group_id into v_group from public.profiles where id = uid;
    end if;
    if v_group is null then
      return jsonb_build_object('week_start', v_from, 'week_end', v_to, 'group', null, 'rows', '[]'::jsonb, 'me', null);
    end if;
  end if;

  with people as (
    select p.id, p.full_name, p.hide_from_leaderboard as hidden
    from public.profiles p
    where p.role = 'student' and (v_group is null or p.group_id = v_group)
  ),
  test_points as (
    select user_id, sum(best) as pts
    from (
      select a.user_id, a.test_id, max(a.score) as best
      from public.test_attempts a
      where a.created_at >= v_from and a.created_at < v_to
      group by a.user_id, a.test_id
    ) t
    group by user_id
  ),
  lesson_points as (
    select user_id, count(*) * 10 as pts
    from public.lesson_progress
    where completed_at >= v_from and completed_at < v_to
    group by user_id
  ),
  mistake_points as (
    select user_id, count(*) * 2 as pts
    from public.mastered_questions
    where mastered_at >= v_from and mastered_at < v_to
    group by user_id
  ),
  scored as (
    select pe.id, pe.full_name, pe.hidden,
           (coalesce(tp.pts, 0) + coalesce(lp.pts, 0) + coalesce(mp.pts, 0))::int as points
    from people pe
    left join test_points tp on tp.user_id = pe.id
    left join lesson_points lp on lp.user_id = pe.id
    left join mistake_points mp on mp.user_id = pe.id
  ),
  visible as (
    select s.id, s.full_name, s.points
    from scored s
    where s.points > 0 and not s.hidden
    union all
    select e.id, e.name, e.points
    from public.leaderboard_extras e
    where e.active and e.points > 0
      and ((v_group is null and e.group_id is null) or (v_group is not null and e.group_id = v_group))
  ),
  ranked as (
    select v.*, rank() over (order by v.points desc) as rnk
    from visible v
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', r.rnk, 'name', public.leaderboard_name(r.full_name), 'points', r.points, 'is_me', r.id = uid) order by r.rnk, r.full_name)
              from (select * from ranked order by rnk, full_name limit 50) r), '[]'::jsonb),
    (select jsonb_build_object(
              'points', s.points,
              'hidden', s.hidden,
              'rank', (select r.rnk from ranked r where r.id = uid),
              'total', (select count(*) from ranked))
       from scored s where s.id = uid)
  into v_rows, v_me;

  return jsonb_build_object(
    'week_start', v_from,
    'week_end', v_to,
    'group', (select jsonb_build_object('id', g.id, 'name', g.name) from public.study_groups g where g.id = v_group),
    'rows', v_rows,
    'me', v_me
  );
end;
$$;
