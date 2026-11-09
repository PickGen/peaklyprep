-- PeaklyPrep: the SAT has two sections, "Reading & Writing" and "Math" ----------------

alter table public.lessons drop constraint if exists lessons_section_check;
alter table public.tests   drop constraint if exists tests_section_check;

update public.lessons set section = 'Reading & Writing' where section in ('Reading', 'Writing');
update public.tests   set section = 'Reading & Writing' where section in ('Reading', 'Writing');

alter table public.lessons add constraint lessons_section_check check (section in ('Reading & Writing', 'Math'));
alter table public.tests   add constraint tests_section_check   check (section in ('Reading & Writing', 'Math'));
