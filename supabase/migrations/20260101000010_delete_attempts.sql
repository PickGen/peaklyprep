-- Students can delete their own old attempts (admins can delete any).
drop policy if exists "attempts delete own" on public.test_attempts;
create policy "attempts delete own" on public.test_attempts
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
