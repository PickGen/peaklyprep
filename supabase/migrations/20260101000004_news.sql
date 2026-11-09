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
