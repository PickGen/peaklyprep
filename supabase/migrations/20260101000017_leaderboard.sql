-- PeaklyPrep: weekly leaderboard and study groups ------------------------------------------------
-- Points for the current week (Monday 00:00 to Sunday 23:59, Almaty time):
--   * tests: 1 point per correct answer, best attempt of each test this week (retakes don't farm points)
--   * lessons and word lists completed this week: 10 points each
--   * mistakes fixed in the mistake bank this week: 2 points each
-- Students see first name + initial only, never e-mails. Anyone can hide themselves from the ranking.
-- Groups (e.g. a class of a learning centre) have a join code; a student belongs to at most one group.

-- 1. Groups ----------------------------------------------------------------------------------------
create table if not exists public.study_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 60),
  join_code  text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);
alter table public.study_groups enable row level security;

alter table public.profiles add column if not exists group_id uuid references public.study_groups (id) on delete set null;
alter table public.profiles add column if not exists hide_from_leaderboard boolean not null default false;
create index if not exists profiles_group_idx on public.profiles (group_id);

-- students may change only the "hide me" switch themselves; the group changes through join_group / leave_group
grant update (hide_from_leaderboard) on public.profiles to authenticated;

drop policy if exists "groups admin" on public.study_groups;
drop policy if exists "groups read own" on public.study_groups;
create policy "groups admin" on public.study_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "groups read own" on public.study_groups for select to authenticated
  using (id = (select p.group_id from public.profiles p where p.id = auth.uid()));

-- 2. Joining and leaving --------------------------------------------------------------------------
create or replace function public.join_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.study_groups;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into g from public.study_groups where join_code = upper(trim(p_code));
  if g.id is null then
    raise exception 'Group not found';
  end if;
  update public.profiles set group_id = g.id where id = auth.uid();
  return jsonb_build_object('id', g.id, 'name', g.name);
end;
$$;

create or replace function public.leave_group()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set group_id = null where id = auth.uid();
$$;

-- admins: put a student (found by e-mail) into a group, or take them out with p_group_id = null
create or replace function public.admin_set_student_group(p_email text, p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  select id into v_id from public.profiles where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No student with this e-mail';
  end if;
  update public.profiles set group_id = p_group_id where id = v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

-- 3. Display name: "Aruzhan K." ------------------------------------------------------------------
create or replace function public.leaderboard_name(p_full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(trim(p_full_name), '') = '' then 'Student'
    when split_part(trim(p_full_name), ' ', 2) = '' then split_part(trim(p_full_name), ' ', 1)
    else split_part(trim(p_full_name), ' ', 1) || ' ' || upper(left(split_part(trim(p_full_name), ' ', 2), 1)) || '.'
  end;
$$;

-- 4. The weekly leaderboard -----------------------------------------------------------------------
-- p_scope: 'all' (every student) or 'group' (the caller's group; admins may pass p_group_id instead)
-- p_week_offset: 0 = this week, 1 = last week, ...
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
  ranked as (
    select s.*, rank() over (order by s.points desc) as rnk
    from scored s
    where s.points > 0 and not s.hidden
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

revoke all on function public.join_group(text) from public, anon;
revoke all on function public.leave_group() from public, anon;
revoke all on function public.admin_set_student_group(text, uuid) from public, anon;
revoke all on function public.weekly_leaderboard(text, int, uuid) from public, anon;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group() to authenticated;
grant execute on function public.admin_set_student_group(text, uuid) to authenticated;
grant execute on function public.weekly_leaderboard(text, int, uuid) to authenticated;
