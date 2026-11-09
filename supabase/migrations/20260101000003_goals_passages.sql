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
