-- Private, short-lived staging area for AI result screenshots.
-- The browser uploads compact JPEGs here and deletes them after analysis.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('result-import-images', 'result-import-images', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "v2 league admins insert temporary result images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'result-import-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (
    (select public.is_platform_owner())
    or exists (
      select 1 from public.leagues l
      join public.league_members lm on lm.league_id = l.id
      where l.slug = (storage.foldername(name))[1]
        and lm.user_id = (select auth.uid())
        and lm.role = 'league_admin'
    )
  )
);

create policy "v2 league admins read own temporary result images"
on storage.objects for select to authenticated
using (bucket_id = 'result-import-images' and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy "v2 league admins delete own temporary result images"
on storage.objects for delete to authenticated
using (bucket_id = 'result-import-images' and (storage.foldername(name))[2] = (select auth.uid())::text);
