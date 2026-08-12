-- Public league logos with tenant-scoped write permissions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('league-brand-assets', 'league-brand-assets', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "league brand assets owners admins insert" on storage.objects for insert to authenticated
with check (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(name))[1] and public.has_league_role(l.id, array['owner','admin'])));

create policy "league brand assets owners admins update" on storage.objects for update to authenticated
using (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(name))[1] and public.has_league_role(l.id, array['owner','admin'])))
with check (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(name))[1] and public.has_league_role(l.id, array['owner','admin'])));

create policy "league brand assets owners admins delete" on storage.objects for delete to authenticated
using (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(name))[1] and public.has_league_role(l.id, array['owner','admin'])));
