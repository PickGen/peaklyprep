-- PeaklyPrep: lessons and tests only for students with an active subscription ------------------
-- Before this, the paywall was only on the Lessons / Practice lists in the app: a lesson or test opened by a
-- direct link (e.g. from Daily tasks) worked without a subscription, and the database gave lessons, questions
-- and (through submit_attempt) answers to any signed-in user. Admins keep full access.

-- 1. Test checkout ("Choose plan" activated a plan without payment) is switched off.
update public.app_settings set value = 'false'::jsonb where key = 'test_checkout';

-- 2. Who may study: admins, or a student whose newest subscription has not expired.
create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.subscriptions where user_id = auth.uid() and expires_at > now());
$$;

create or replace function public.can_study()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.has_active_subscription();
$$;

revoke all on function public.has_active_subscription() from public, anon;
revoke all on function public.can_study() from public, anon;
grant execute on function public.has_active_subscription() to authenticated;
grant execute on function public.can_study() to authenticated;

-- 3. Lessons and questions are readable only with access. Test titles stay visible (lists, plans page).
drop policy if exists "lessons read" on public.lessons;
create policy "lessons read" on public.lessons for select to authenticated
  using (public.is_admin() or (published and public.has_active_subscription()));

drop policy if exists "questions read" on public.questions;
create policy "questions read" on public.questions for select to authenticated
  using (public.is_admin() or (public.has_active_subscription() and exists (select 1 from public.tests t where t.id = test_id and t.published)));

-- 4. Submitting a test (which returns the correct answers) also needs access.
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
  if not public.can_study() then
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
