-- PeaklyPrep: video files for lessons ------------------------------------------------------------
-- Public bucket "lesson-videos": anyone with the link can play a video (like an unlisted YouTube video);
-- only admins can upload, replace or delete files. Uploads are limited to video files up to 50 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-videos', 'lesson-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lesson videos admin insert" on storage.objects;
drop policy if exists "lesson videos admin update" on storage.objects;
drop policy if exists "lesson videos admin delete" on storage.objects;
create policy "lesson videos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-videos' and public.is_admin());
create policy "lesson videos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'lesson-videos' and public.is_admin()) with check (bucket_id = 'lesson-videos' and public.is_admin());
create policy "lesson videos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-videos' and public.is_admin());

-- admins also need to see the files (storage checks it to replace or delete a file)
drop policy if exists "lesson videos admin select" on storage.objects;
create policy "lesson videos admin select" on storage.objects for select to authenticated
  using (bucket_id = 'lesson-videos' and public.is_admin());
