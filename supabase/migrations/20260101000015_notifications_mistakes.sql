-- PeaklyPrep: notifications (read marks) and the mistake bank -------------------------------------
-- Notifications are built in the app from news, the subscription end date, payment decisions and the exam date;
-- the database only remembers which ones a student has already read, so the bell works on every device.
-- The mistake bank lists every question whose latest answer was wrong; retrying is graded here, never in the browser.

-- 1. Read marks for notifications --------------------------------------------------------------
create table if not exists public.notification_reads (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null check (length(key) between 1 and 200),
  read_at    timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notification_reads enable row level security;

drop policy if exists "notification reads own" on public.notification_reads;
create policy "notification reads own" on public.notification_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Questions a student fixed in the mistake bank ----------------------------------------------
create table if not exists public.mastered_questions (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  mastered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.mastered_questions enable row level security;

drop policy if exists "mastered read own" on public.mastered_questions;
create policy "mastered read own" on public.mastered_questions for select to authenticated using (user_id = auth.uid());
drop policy if exists "mastered delete own" on public.mastered_questions;
create policy "mastered delete own" on public.mastered_questions for delete to authenticated using (user_id = auth.uid());
-- rows are added only by check_mistake() below (a correct retry), not directly by the browser

-- 3. Is a stored answer correct? (same rules as submit_attempt) ---------------------------------
create or replace function public.answer_is_correct(p_chosen jsonb, p_correct_index int, p_correct_answers text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_correct_answers is not null then coalesce(jsonb_typeof(p_chosen) = 'string' and public.spr_correct(p_chosen #>> '{}', p_correct_answers), false)
    else coalesce(jsonb_typeof(p_chosen) = 'number' and (p_chosen #>> '{}')::numeric = p_correct_index, false)
  end;
$$;

-- 4. The mistake bank: for each question the student has answered, the latest answer; wrong or skipped ones are listed,
--    unless the student fixed the question in the bank after that attempt.
create or replace function public.get_mistake_bank()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_out jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_study() then
    raise exception 'Subscription required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) - 'is_ok' order by x.attempted_at desc, x.test_title, x.position), '[]'::jsonb)
  into v_out
  from (
    select distinct on (q.id)
      q.id as question_id,
      q.test_id,
      t.title as test_title,
      t.section,
      q.position,
      q.passage,
      q.prompt,
      q.options,
      a.id as attempt_id,
      a.created_at as attempted_at,
      a.answers -> q.id::text as chosen,
      k.correct_index,
      k.correct_answers,
      k.explanation,
      public.answer_is_correct(a.answers -> q.id::text, k.correct_index, k.correct_answers) as is_ok
    from public.test_attempts a
    join public.tests t on t.id = a.test_id
    join public.questions q on q.test_id = a.test_id
    join public.question_keys k on k.question_id = q.id
    where a.user_id = uid
    order by q.id, a.created_at desc
  ) x
  where not x.is_ok
    and not exists (
      select 1 from public.mastered_questions m
      where m.user_id = uid and m.question_id = x.question_id and m.mastered_at > x.attempted_at
    );

  return v_out;
end;
$$;

revoke all on function public.get_mistake_bank() from public, anon;
grant execute on function public.get_mistake_bank() to authenticated;

-- 5. Retry one question from the bank. Only questions the student has already seen in an attempt may be checked.
--    A correct answer moves the question out of the bank.
create or replace function public.check_mistake(p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k   record;
  v_ok boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_study() then
    raise exception 'Subscription required';
  end if;
  if not exists (
    select 1 from public.test_attempts a join public.questions q on q.test_id = a.test_id
    where a.user_id = uid and q.id = p_question_id
  ) then
    raise exception 'Question not in your mistake bank';
  end if;

  select correct_index, correct_answers into k from public.question_keys where question_id = p_question_id;
  v_ok := public.answer_is_correct(p_answer, k.correct_index, k.correct_answers);

  if v_ok then
    insert into public.mastered_questions (user_id, question_id) values (uid, p_question_id)
    on conflict (user_id, question_id) do update set mastered_at = now();
  end if;

  return jsonb_build_object('correct', v_ok);
end;
$$;

revoke all on function public.check_mistake(uuid, jsonb) from public, anon;
grant execute on function public.check_mistake(uuid, jsonb) to authenticated;
