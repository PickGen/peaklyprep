-- PeaklyPrep: practice tests made of several modules -----------------------------------

-- Tests that share a form_title are the modules of one full practice test.
alter table public.tests add column if not exists form_title text;
alter table public.tests add column if not exists module_no  int check (module_no between 1 and 9);

-- Group the two uploaded modules into "SAT Practice Test 1"
update public.tests set form_title = 'SAT Practice Test 1', module_no = 1 where title like 'SAT Practice (Bluebook Style)%Module 1%';
update public.tests set form_title = 'SAT Practice Test 1', module_no = 2 where title like 'SAT Practice (Bluebook Style)%Module 2%';

-- Remove the original demo tests (also removes their questions, answer keys and attempts)
delete from public.tests where id::text like 'b1000000%';
