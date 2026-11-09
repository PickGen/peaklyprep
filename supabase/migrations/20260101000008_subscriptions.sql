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
