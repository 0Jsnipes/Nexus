-- Storage bucket for avatars, message attachments, workspace logos, and files.
-- Object paths are namespaced as: {workspace_id}/{category}/{filename}
-- Avatars/logos use "profile" as the workspace segment since they aren't workspace-scoped.

insert into storage.buckets (id, name, public)
values ('nexus', 'nexus', true)
on conflict (id) do nothing;

create policy "public read access to nexus bucket"
  on storage.objects for select
  using (bucket_id = 'nexus');

create policy "signed-in users upload to their own profile folder"
  on storage.objects for insert
  with check (
    bucket_id = 'nexus'
    and (
      (storage.foldername(name))[1] = 'profile'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] <> 'profile'
      and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "owners delete their own uploads"
  on storage.objects for delete
  using (
    bucket_id = 'nexus'
    and owner = auth.uid()
  );
