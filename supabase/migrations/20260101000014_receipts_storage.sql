-- PeaklyPrep: let students upload payment receipts ---------------------------------------------
-- The "receipts" bucket existed but had no upload policy, so every upload failed with
-- "new row violates row-level security policy" ("Ошибка загрузки чека" on the checkout page).
-- Students may upload only into their own folder (<user id>/...); admins may read and delete all receipts.

drop policy if exists "receipts insert own" on storage.objects;
create policy "receipts insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts read own or admin" on storage.objects;
create policy "receipts read own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "receipts delete admin" on storage.objects;
create policy "receipts delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
