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
