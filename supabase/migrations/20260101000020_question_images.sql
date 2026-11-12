-- PeaklyPrep: images for test questions (graphs, geometry drawings) ---------------------------------
-- Public bucket "question-images": shown inside questions as ![figure](url); only admins upload or change files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question images admin select" on storage.objects;
drop policy if exists "question images admin insert" on storage.objects;
drop policy if exists "question images admin update" on storage.objects;
drop policy if exists "question images admin delete" on storage.objects;
create policy "question images admin select" on storage.objects for select to authenticated
  using (bucket_id = 'question-images' and public.is_admin());
create policy "question images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'question-images' and public.is_admin());
create policy "question images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin()) with check (bucket_id = 'question-images' and public.is_admin());
create policy "question images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());
