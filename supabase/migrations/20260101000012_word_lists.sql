-- PeaklyPrep: word lists are shown in their own menu item, not among the lessons ----
-- A word list is stored as a lesson with kind = 'word_list'.

alter table public.lessons add column if not exists kind text not null default 'lesson';
alter table public.lessons drop constraint if exists lessons_kind_check;
alter table public.lessons add constraint lessons_kind_check check (kind in ('lesson', 'word_list'));

-- the existing "SAT Words …" lessons become word lists
update public.lessons set kind = 'word_list' where kind = 'lesson' and title ~* 'sat\s*words?';
