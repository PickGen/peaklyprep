-- PeaklyPrep: student-produced (free response) questions, like the "grid-in" questions of the Digital SAT ----
-- A free-response question has options = [] and its accepted answers in question_keys.correct_answers.

alter table public.questions drop constraint if exists questions_options_check;
alter table public.questions
  add constraint questions_options_check
  check (jsonb_typeof(options) = 'array' and (jsonb_array_length(options) = 0 or jsonb_array_length(options) between 2 and 6));

alter table public.question_keys alter column correct_index drop not null;
alter table public.question_keys add column if not exists correct_answers text[];

-- "-19", "1/3", ".5", "0.084" -> number (null when it is not a number or a fraction)
create or replace function public.spr_number(p text)
returns numeric
language plpgsql
immutable
as $$
declare
  s text := replace(replace(replace(replace(btrim(coalesce(p, '')), chr(8722), '-'), chr(8211), '-'), ' ', ''), ',', '');
begin
  if s ~ '^-?([0-9]+\.?[0-9]*|\.[0-9]+)$' then
    return s::numeric;
  end if;
  if s ~ '^-?[0-9]+/[0-9]+$' then
    if split_part(s, '/', 2)::numeric = 0 then
      return null;
    end if;
    return split_part(s, '/', 1)::numeric / split_part(s, '/', 2)::numeric;
  end if;
  return null;
end;
$$;

-- Is a typed answer equal to one of the accepted answers? Equal numbers match ("1/3" = "1/3"; "0.5" = ".5" = "1/2");
-- a fraction such as 21/29 also accepts its decimal rounded or cut to 3+ places (0.724), like the real test.
create or replace function public.spr_correct(p_answer text, p_accepted text[])
returns boolean
language plpgsql
immutable
as $$
declare
  acc text;
  v   numeric;
  n   numeric;
  d   int;
begin
  if p_answer is null or btrim(p_answer) = '' or length(p_answer) > 40 or p_accepted is null then
    return false;
  end if;
  v := public.spr_number(p_answer);
  foreach acc in array p_accepted loop
    if lower(replace(btrim(acc), ' ', '')) = lower(replace(btrim(p_answer), ' ', '')) then
      return true;
    end if;
    n := public.spr_number(acc);
    if v is not null and n is not null then
      if v = n then
        return true;
      end if;
      if acc like '%/%' and replace(p_answer, chr(8722), '-') ~ '\.[0-9]{3,}$' then
        d := length(split_part(replace(replace(btrim(p_answer), ' ', ''), chr(8722), '-'), '.', 2));
        if round(n, d) = v or trunc(n, d) = v then
          return true;
        end if;
      end if;
    end if;
  end loop;
  return false;
end;
$$;

-- Grading (server side, answer keys never reach the browser). Answers are { question_id: 2 } or { question_id: "21/29" }.
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

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a         record;
  r         record;
  v_chosen  jsonb;
  v_ok      boolean;
  v_review  jsonb := '[]'::jsonb;
begin
  select * into a from public.test_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;
  if a.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  for r in
    select q.id, k.correct_index, k.correct_answers, k.explanation
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.test_id = a.test_id
    order by q.position, q.created_at
  loop
    v_chosen := a.answers -> r.id::text;
    if r.correct_answers is not null then
      v_ok := coalesce(jsonb_typeof(v_chosen) = 'string' and public.spr_correct(v_chosen #>> '{}', r.correct_answers), false);
    else
      v_ok := coalesce(jsonb_typeof(v_chosen) = 'number' and (v_chosen #>> '{}')::numeric = r.correct_index, false);
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

  return jsonb_build_object('attempt_id', a.id, 'score', a.score, 'total', a.total, 'review', v_review);
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
