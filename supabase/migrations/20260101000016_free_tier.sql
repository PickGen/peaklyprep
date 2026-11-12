-- PeaklyPrep: free tier --------------------------------------------------------------------------
-- Items marked is_free open without a subscription: their lessons, questions and test submission.
-- Everything else still needs an active subscription (admins always have access).

alter table public.tests   add column if not exists is_free boolean not null default false;
alter table public.lessons add column if not exists is_free boolean not null default false;

-- Free practice tests: full PeaklyTest 1 (Reading & Writing + Math, both modules) and three short tests
update public.tests set is_free = true
where title ~ '^PeaklyTest 1\M' or title in ('Math Test 1', 'Math Test 2', 'Verbal Test 1');

-- Free word lists: Day 1 to Day 5
update public.lessons set is_free = true
where kind = 'word_list' and title ~ '^Day [1-5]:';

drop policy if exists "lessons read" on public.lessons;
create policy "lessons read" on public.lessons for select to authenticated
  using (public.is_admin() or (published and (is_free or public.has_active_subscription())));

drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tests t
      where t.id = test_id and t.published and (t.is_free or public.has_active_subscription())
    )
  );

-- submit_attempt: a free test can be submitted without a subscription
create or replace function public.submit_attempt(p_test_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  r          record;
  v_chosen   jsonb;
  v_ok       boolean;
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
  if not public.can_study() and not exists (select 1 from public.tests where id = p_test_id and is_free) then
    raise exception 'Subscription required';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    p_answers := '{}'::jsonb;
  end if;

  for r in
    select q.id, k.correct_index, k.correct_answers, k.explanation
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.test_id = p_test_id
    order by q.position, q.created_at
  loop
    v_total := v_total + 1;
    v_chosen := p_answers -> r.id::text;
    if r.correct_answers is not null then
      v_ok := coalesce(jsonb_typeof(v_chosen) = 'string' and public.spr_correct(v_chosen #>> '{}', r.correct_answers), false);
    else
      v_ok := coalesce(jsonb_typeof(v_chosen) = 'number' and (v_chosen #>> '{}')::numeric = r.correct_index, false);
    end if;
    if v_ok then
      v_score := v_score + 1;
    end if;
    v_review := v_review || jsonb_build_object(
      'question_id', r.id,
      'chosen', v_chosen,
      'correct', v_ok,
      'correct_index', r.correct_index,
      'correct_answers', to_jsonb(r.correct_answers),
      'explanation', r.explanation
    );
  end loop;

  if v_total = 0 then
    raise exception 'This test has no questions';
  end if;

  insert into public.test_attempts (user_id, test_id, score, total, answers)
  values (uid, p_test_id, v_score, v_total, p_answers)
  returning id into v_attempt;

  return jsonb_build_object('attempt_id', v_attempt, 'score', v_score, 'total', v_total, 'review', v_review);
end;
$$;

revoke all on function public.submit_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;

-- what the free tier covers right now
select 'test' as kind, title from public.tests where is_free
union all
select 'word list', title from public.lessons where is_free
order by 1, 2;
