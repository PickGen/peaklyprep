-- ===== 20260101000000_schema.sql =====
-- PeaklyPrep: core schema ------------------------------------------------------

-- Profiles (1:1 with auth.users). Role decides student vs admin access.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  section       text not null check (section in ('Reading', 'Writing', 'Math')),
  summary       text not null default '',
  content       text not null default '',
  video_url     text,
  duration_min  int  not null default 10 check (duration_min > 0),
  position      int  not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.tests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  section       text not null check (section in ('Reading', 'Writing', 'Math')),
  description   text not null default '',
  duration_min  int  not null default 15 check (duration_min > 0),
  position      int  not null default 0,
  published     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Questions are readable by students; the answer key lives in a separate admin-only table.
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests (id) on delete cascade,
  prompt      text not null,
  options     jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists questions_test_idx on public.questions (test_id, position);

create table if not exists public.question_keys (
  question_id    uuid primary key references public.questions (id) on delete cascade,
  correct_index  int  not null check (correct_index >= 0),
  explanation    text
);

create table if not exists public.test_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  test_id     uuid not null references public.tests (id) on delete cascade,
  score       int  not null,
  total       int  not null,
  answers     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.test_attempts (user_id, created_at desc);

create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- Create a profile automatically whenever someone signs up -----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ===== 20260101000001_rls.sql =====
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


-- ===== 20260101000002_seed.sql =====
-- PeaklyPrep: seed data --------------------------------------------------------
-- Default admin:   admin@peaklyprep.com   /   Admin12345!      (change the password after first login)

do $$
declare
  admin_id uuid := '00000000-0000-4000-8000-0000000000ad';
begin
  if not exists (select 1 from auth.users where email = 'admin@peaklyprep.com') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@peaklyprep.com', extensions.crypt('Admin12345!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@peaklyprep.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  -- the signup trigger created a 'student' profile; promote it
  update public.profiles set role = 'admin', full_name = 'Admin' where email = 'admin@peaklyprep.com';
end $$;

-- Demo lessons ------------------------------------------------------------------
insert into public.lessons (id, title, section, summary, content, duration_min, position) values
('a1000000-0000-4000-8000-000000000001', 'Linear Equations & Systems', 'Math',
 'Solve one- and two-variable linear equations quickly and accurately.',
 E'Linear equations show up in almost every SAT Math module. The goal is always the same: isolate the variable.\n\n## Solving one variable\n\nUndo operations in reverse order. For 3x + 7 = 31, subtract 7 to get 3x = 24, then divide by 3 so x = 8.\n\n## Systems of equations\n\nTwo strategies cover almost every question:\n\n- Substitution: replace one variable using the other equation (best when one equation already says y = …).\n- Elimination: add or subtract the equations to cancel a variable.\n\n## Check yourself\n\nAlways plug your answer back in. On the SAT, a one-second check prevents most careless errors.',
 12, 1),
('a1000000-0000-4000-8000-000000000002', 'Percentages, Ratios & Rates', 'Math',
 'Master percent change, unit rates, and proportional reasoning.',
 E'Percent problems reward a consistent method.\n\n## Percent change\n\nMultiply by (1 ± rate). A 25% markup is × 1.25, and a 20% discount is × 0.8. Successive changes multiply — they do not simply add.\n\n## Rates\n\nBuild a unit rate first (miles per hour, dollars per item), then scale it.\n\n- Distance = rate × time\n- Part = percent × whole\n\n## Watch out\n\nA 25% increase followed by a 20% decrease brings you back to the start, not to a 5% gain.',
 10, 2),
('a1000000-0000-4000-8000-000000000003', 'Quadratics & Exponential Growth', 'Math',
 'Factor quadratics and model growth that doubles over equal time steps.',
 E'## Factoring\n\nTo solve x² − 5x + 6 = 0, find two numbers that multiply to 6 and add to −5. They are −2 and −3, so (x − 2)(x − 3) = 0 and x = 2 or x = 3.\n\n## Exponential growth\n\nIf a quantity doubles every 3 hours, after 12 hours it has doubled 12 ÷ 3 = 4 times. The final amount is start × 2⁴.\n\n- Linear growth adds the same amount each step.\n- Exponential growth multiplies by the same factor each step.',
 14, 3),
('a1000000-0000-4000-8000-000000000004', 'Central Ideas & Main Purpose', 'Reading',
 'Find what a passage is really about, and why the author wrote it.',
 E'Every SAT passage has a central idea — the one claim the whole text supports.\n\n## A reliable approach\n\n- Read the first and last sentences first; they usually frame the idea.\n- Ask: if I removed this sentence, what would be lost?\n- Predict the answer before looking at the choices.\n\n## Trap answers\n\nWrong choices are usually too narrow (a single detail), too broad, or true but not what the passage argues.',
 10, 4),
('a1000000-0000-4000-8000-000000000005', 'Words in Context', 'Reading',
 'Use surrounding clues to pin down a word''s meaning in a sentence.',
 E'The SAT rarely tests obscure vocabulary. It tests whether you can use context.\n\n## Method\n\n- Cover the word and predict a replacement.\n- Look for contrast words (although, yet) and support words (because, for example).\n- Test each choice by substituting it into the sentence.\n\nExample: "Though no one objected, the council''s reaction was tepid." The word though signals contrast with open objection, so tepid means unenthusiastic.',
 8, 5),
('a1000000-0000-4000-8000-000000000006', 'Sentence Boundaries & Punctuation', 'Writing',
 'Commas, semicolons, colons and how to avoid run-ons.',
 E'Most punctuation questions come down to one test: is each side of the mark a complete sentence?\n\n## Rules that cover most questions\n\n- Two complete sentences need a period, a semicolon, or a comma plus a conjunction (and, but, so, or).\n- A comma alone cannot join two complete sentences (comma splice).\n- A colon must follow a complete sentence.\n\n## Subject–verb agreement\n\nFind the true subject and ignore interrupting phrases. In "Each of the students is required…", the subject is each, so the verb is singular.',
 12, 6)
on conflict (id) do nothing;

-- Demo tests --------------------------------------------------------------------
insert into public.tests (id, title, section, description, duration_min, position) values
('b1000000-0000-4000-8000-000000000001', 'Math Fundamentals — Set 1', 'Math', 'Algebra, percentages, quadratics and growth.', 15, 1),
('b1000000-0000-4000-8000-000000000002', 'Reading Comprehension — Set 1', 'Reading', 'Main ideas, words in context and inference.', 10, 2),
('b1000000-0000-4000-8000-000000000003', 'Writing & Language — Set 1', 'Writing', 'Grammar, punctuation and concise writing.', 10, 3)
on conflict (id) do nothing;

create or replace function public.seed_question(p_test uuid, p_pos int, p_prompt text, p_options jsonb, p_correct int, p_expl text)
returns void language plpgsql as $$
declare qid uuid;
begin
  if exists (select 1 from public.questions where test_id = p_test and prompt = p_prompt) then
    return;
  end if;
  insert into public.questions (test_id, prompt, options, position) values (p_test, p_prompt, p_options, p_pos) returning id into qid;
  insert into public.question_keys (question_id, correct_index, explanation) values (qid, p_correct, p_expl);
end $$;

-- Math
select public.seed_question('b1000000-0000-4000-8000-000000000001', 1, 'If 3x + 7 = 31, what is the value of x?', '["6","7","8","9"]', 2, '3x = 24, so x = 8.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 2, 'A $40 item is marked up 25%, then the new price is discounted 20%. What is the final price?', '["$38","$40","$42","$45"]', 1, '40 × 1.25 = 50, then 50 × 0.8 = 40.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 3, E'y = 2x + 1\n3x + y = 16\n\nWhat is the value of x in the solution to the system above?', '["2","3","4","5"]', 1, 'Substitute: 3x + 2x + 1 = 16, so 5x = 15 and x = 3.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 4, 'What are the solutions of x² − 5x + 6 = 0?', '["1 and 6","2 and 3","−2 and −3","−1 and −6"]', 1, 'x² − 5x + 6 = (x − 2)(x − 3).');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 5, 'A bacteria population doubles every 3 hours. If it starts at 500, how many bacteria are there after 12 hours?', '["2,000","4,000","6,000","8,000"]', 3, '12 hours is 4 doublings: 500 × 2⁴ = 8,000.');
select public.seed_question('b1000000-0000-4000-8000-000000000001', 6, 'A car travels 150 miles in 2.5 hours. At the same rate, how many miles will it travel in 4 hours?', '["220","240","250","260"]', 1, 'Rate = 60 mph, and 60 × 4 = 240.');

-- Reading
select public.seed_question('b1000000-0000-4000-8000-000000000002', 1, E'Researchers studying urban beekeeping found that rooftop hives in dense cities produced honey with a more varied flavor than rural hives, largely because city bees forage across many kinds of ornamental plants rather than a few large crops.\n\nWhich choice best states the main idea of the text?', '["Rural bees produce less honey than city bees.","Urban bees'' diverse food sources lead to more varied honey.","Ornamental plants are harmful to bees.","Rooftop hives are easier to manage than rural ones."]', 1, 'The text ties the varied flavor directly to the variety of plants city bees visit.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 2, E'The mayor''s proposal was met with tepid enthusiasm; though no one openly objected, few council members offered the support she had hoped for.\n\nAs used in the text, "tepid" most nearly means', '["heated","unenthusiastic","hostile","confused"]', 1, 'No one objected, but support was lacking: unenthusiastic.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 3, E'Although early critics dismissed the novel as a sentimental romance, later scholars have argued that its portrayal of class tension makes it one of the era''s sharpest social commentaries.\n\nThe first part of the sentence ("Although early critics … romance") mainly serves to', '["show how the novel''s reputation changed over time","prove that the novel is a romance","criticize modern scholars","summarize the novel''s plot"]', 0, 'The contrast signals a shift from early dismissal to later appreciation.');
select public.seed_question('b1000000-0000-4000-8000-000000000002', 4, E'A museum extended its weekend hours. In the following quarter, attendance rose 18%.\n\nWhich conclusion is best supported by the information?', '["Extending hours likely contributed to higher attendance.","Weekend visitors spend more money than weekday visitors.","Weekday attendance fell during the same quarter.","The museum lowered its ticket prices."]', 0, 'Only the first choice stays within what the text supports (a likely, not certain, link).');

-- Writing
select public.seed_question('b1000000-0000-4000-8000-000000000003', 1, E'The experiment failed twice ____ the team refused to give up.\n\nWhich choice completes the text correctly?', '[", but","; but"," but",": but"]', 0, 'Two complete sentences joined by a conjunction need a comma before it.');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 2, E'Each of the students ____ required to submit a project.\n\nWhich choice completes the text correctly?', '["are","is","were","have been"]', 1, 'The subject is "each," which is singular.');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 3, E'The museum, which opened in 1902, ____ one of the region''s largest collections of Impressionist art.\n\nWhich choice completes the text correctly?', '["have","holding","houses","to house"]', 2, 'A finite singular verb is needed for the subject "museum."');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 4, E'Which choice most effectively and concisely revises: "Due to the fact that it was raining, the game was postponed."', '["Because it was raining, the game was postponed.","Because of the reason that it was raining, the game was postponed.","Due to the fact of rain falling, the game was postponed.","As a result of the fact that rain was falling, the game was postponed."]', 0, '"Because" replaces the wordy "due to the fact that."');
select public.seed_question('b1000000-0000-4000-8000-000000000003', 5, E'The dog wagged ____ tail when its owner came home.\n\nWhich choice completes the text correctly?', '["it''s","its","its''","their"]', 1, '"Its" is the possessive; "it''s" means "it is."');

drop function public.seed_question(uuid, int, text, jsonb, int, text);


-- ===== 20260101000003_goals_passages.sql =====
-- PeaklyPrep: student goals + question passages -------------------------------

-- Goal / preference fields shown on the dashboard banner and profile page
alter table public.profiles add column if not exists target_score   int     not null default 1500 check (target_score between 400 and 1600);
alter table public.profiles add column if not exists exam_date      date;
alter table public.profiles add column if not exists study_minutes  int     not null default 60 check (study_minutes between 15 and 600);
alter table public.profiles add column if not exists email_updates  boolean not null default true;

-- Students may edit only these columns of their own profile (never `role`)
revoke update on public.profiles from anon, authenticated;
grant  update (full_name, target_score, exam_date, study_minutes, email_updates) on public.profiles to authenticated;

-- Optional reading passage shown beside the question (split-screen test view)
alter table public.questions add column if not exists passage text;

-- Demo questions: move the text before the first blank line into `passage`
update public.questions
set passage = split_part(prompt, E'\n\n', 1),
    prompt  = substr(prompt, length(split_part(prompt, E'\n\n', 1)) + 3)
where test_id::text like 'b1000000%'
  and passage is null
  and position(E'\n\n' in prompt) > 0;


-- ===== 20260101000004_news.sql =====
-- PeaklyPrep: news feed shown on the student home screen ------------------------

create table if not exists public.news (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.news enable row level security;

drop policy if exists "news read"  on public.news;
drop policy if exists "news admin" on public.news;
create policy "news read"  on public.news for select to authenticated using (published or public.is_admin());
create policy "news admin" on public.news for all    to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.news (id, title, body, created_at) values
('c1000000-0000-4000-8000-000000000001', 'Welcome to PeaklyPrep',
 'Your SAT preparation hub is live: short lessons, practice tests with instant review and a progress tracker. Set your target score and exam date in your profile.',
 now() - interval '1 day'),
('c1000000-0000-4000-8000-000000000002', 'New practice sets: Reading & Writing',
 'Three fresh practice sets are available. Take them under timed conditions and review every explanation afterwards.',
 now() - interval '3 days'),
('c1000000-0000-4000-8000-000000000003', 'Tip: build a weekly study plan',
 'Students who study 30 minutes a day beat those who cram once a week. Pick a daily study time in your profile and stick with it.',
 now() - interval '6 days')
on conflict (id) do nothing;


-- ===== 20260101000005_merge_reading_writing.sql =====
-- PeaklyPrep: the SAT has two sections, "Reading & Writing" and "Math" ----------------

alter table public.lessons drop constraint if exists lessons_section_check;
alter table public.tests   drop constraint if exists tests_section_check;

update public.lessons set section = 'Reading & Writing' where section in ('Reading', 'Writing');
update public.tests   set section = 'Reading & Writing' where section in ('Reading', 'Writing');

alter table public.lessons add constraint lessons_section_check check (section in ('Reading & Writing', 'Math'));
alter table public.tests   add constraint tests_section_check   check (section in ('Reading & Writing', 'Math'));


-- ===== 20260101000006_test_forms.sql =====
-- PeaklyPrep: practice tests made of several modules -----------------------------------

-- Tests that share a form_title are the modules of one full practice test.
alter table public.tests add column if not exists form_title text;
alter table public.tests add column if not exists module_no  int check (module_no between 1 and 9);

-- Group the two uploaded modules into "SAT Practice Test 1"
update public.tests set form_title = 'SAT Practice Test 1', module_no = 1 where title like 'SAT Practice (Bluebook Style)%Module 1%';
update public.tests set form_title = 'SAT Practice Test 1', module_no = 2 where title like 'SAT Practice (Bluebook Style)%Module 2%';

-- Remove the original demo tests (also removes their questions, answer keys and attempts)
delete from public.tests where id::text like 'b1000000%';


-- ===== 20260101000007_attempt_review.sql =====
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


-- ===== 20260101000008_subscriptions.sql =====
-- PeaklyPrep: subscriptions (which plan a student bought and until when) -------------------
-- Until online payment (Paddle) is connected, an admin grants plans from the Students tab.
-- A payment webhook can later insert rows with source = 'paddle' using the service role.

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  plan        text not null check (plan in ('1m', '3m', '6m', '12m')),
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  source      text not null default 'manual',
  created_at  timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, expires_at desc);

alter table public.subscriptions enable row level security;

drop policy if exists "subs read"  on public.subscriptions;
drop policy if exists "subs admin" on public.subscriptions;
create policy "subs read"  on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "subs admin" on public.subscriptions for all    to authenticated using (public.is_admin()) with check (public.is_admin());


-- ===== 20260101000009_test_checkout.sql =====
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


-- ===== 20260101000010_delete_attempts.sql =====
-- Students can delete their own old attempts (admins can delete any).
drop policy if exists "attempts delete own" on public.test_attempts;
create policy "attempts delete own" on public.test_attempts
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());


-- ===== 20260101000011_free_response.sql =====
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


