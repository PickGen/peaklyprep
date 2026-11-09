-- PeaklyPrep: Manual payment flow migration
-- Run this in Supabase SQL Editor

-- 1. payment_requests table
create table if not exists public.payment_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plan        text not null check (plan in ('1m','3m','6m','12m')),
  amount_usd  numeric(10,2) not null,
  receipt_url text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note  text,
  created_at  timestamptz not null default now()
);

alter table public.payment_requests enable row level security;

drop policy if exists "requests read"   on public.payment_requests;
drop policy if exists "requests insert" on public.payment_requests;
drop policy if exists "requests update" on public.payment_requests;

create policy "requests read" on public.payment_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "requests insert" on public.payment_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy "requests update" on public.payment_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Card number in app_settings (update with your real card)
insert into public.app_settings(key, value)
values('card_number', '"4400 4303 7236 1391"'::jsonb)
on conflict (key) do nothing;

-- 3. Storage bucket for receipts (run separately if needed)
-- Go to: Supabase Dashboard → Storage → New bucket → "receipts" → Public: ON
-- Then add these policies on storage.objects:
/*
create policy "receipts insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts');

create policy "receipts select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts');
*/
