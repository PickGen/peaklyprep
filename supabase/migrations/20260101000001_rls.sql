-- PeaklyPrep: Row Level Security -----------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles        enable row level security;
alter table public.lessons         enable row level security;
alter table public.tests           enable row level security;
alter table public.questions       enable row level security;
alter table public.question_keys   enable row level security;
alter table public.test_attempts   enable row level security;
alter table public.lesson_progress enable row level security;

-- profiles: you see yourself, admins see everyone. Students may only change their own name.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant  update (full_name) on public.profiles to authenticated;

-- lessons & tests: students read published items, admins manage everything
drop policy if exists "lessons read"  on public.lessons;
drop policy if exists "lessons admin" on public.lessons;
create policy "lessons read"  on public.lessons for select to authenticated using (published or public.is_admin());
create policy "lessons admin" on public.lessons for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tests read"  on public.tests;
drop policy if exists "tests admin" on public.tests;
create policy "tests read"  on public.tests for select to authenticated using (published or public.is_admin());
create policy "tests admin" on public.tests for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- questions: visible when their test is published; only admins write
drop policy if exists "questions read"  on public.questions;
drop policy if exists "questions admin" on public.questions;
create policy "questions read" on public.questions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.tests t where t.id = test_id and t.published));
create policy "questions admin" on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- answer keys: admins only (students get results through submit_attempt)
drop policy if exists "keys admin" on public.question_keys;
create policy "keys admin" on public.question_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attempts: students read their own, admins read all. Writes happen via submit_attempt() only.
drop policy if exists "attempts read" on public.test_attempts;
create policy "attempts read" on public.test_attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- lesson progress: strictly per user
drop policy if exists "progress read"   on public.lesson_progress;
drop policy if exists "progress insert" on public.lesson_progress;
drop policy if exists "progress update" on public.lesson_progress;
drop policy if exists "progress delete" on public.lesson_progress;
create policy "progress read"   on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "progress insert" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy "progress update" on public.lesson_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress delete" on public.lesson_progress for delete to authenticated using (user_id = auth.uid());

-- Grading happens on the server so answer keys never reach the browser -------------
create or replace function public.submit_attempt(p_test_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  r          record;
  chosen     int;
  v_score    int := 0;
  v_total    int := 0;
  v_review   jsonb := '[]'::jsonb;
  v_attempt  uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.tests where id = p_test_id and (published or public.is_admin())) then
    raise exception 'Test not available';
  end if;

  for r in
    select q.id, k.correct_index, k.explanation
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.test_id = p_test_id
    order by q.position, q.created_at
  loop
    v_total := v_total + 1;
    chosen := case when p_answers ? r.id::text then (p_answers ->> r.id::text)::int else null end;
    if chosen is not null and chosen = r.correct_index then
      v_score := v_score + 1;
    end if;
    v_review := v_review || jsonb_build_object(
      'question_id', r.id,
      'chosen', chosen,
      'correct_index', r.correct_index,
      'explanation', r.explanation
    );
  end loop;

  if v_total = 0 then
    raise exception 'This test has no questions';
  end if;

  insert into public.test_attempts (user_id, test_id, score, total, answers)
  values (uid, p_test_id, v_score, v_total, coalesce(p_answers, '{}'::jsonb))
  returning id into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt, 'score', v_score, 'total', v_total, 'review', v_review);
end;
$$;

revoke all on function public.submit_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;
