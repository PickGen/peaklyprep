-- PeaklyPrep: let a student re-open a finished attempt and see which answers were wrong ----

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a         record;
  r         record;
  chosen    int;
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
    select q.id, k.correct_index, k.explanation
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.test_id = a.test_id
    order by q.position, q.created_at
  loop
    chosen := case when a.answers ? r.id::text then (a.answers ->> r.id::text)::int else null end;
    v_review := v_review || jsonb_build_object(
      'question_id', r.id,
      'chosen', chosen,
      'correct_index', r.correct_index,
      'explanation', r.explanation
    );
  end loop;

  return jsonb_build_object('attempt_id', a.id, 'score', a.score, 'total', a.total, 'review', v_review);
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
