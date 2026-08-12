-- Qualify storage.objects.name so the policy checks the uploaded object path,
-- not leagues.name from the correlated subquery.
drop policy if exists "league brand assets owners admins insert" on storage.objects;
drop policy if exists "league brand assets owners admins update" on storage.objects;
drop policy if exists "league brand assets owners admins delete" on storage.objects;

create policy "league brand assets owners admins insert" on storage.objects for insert to authenticated
with check (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(storage.objects.name))[1] and public.has_league_role(l.id, array['owner','admin'])));

create policy "league brand assets owners admins update" on storage.objects for update to authenticated
using (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(storage.objects.name))[1] and public.has_league_role(l.id, array['owner','admin'])))
with check (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(storage.objects.name))[1] and public.has_league_role(l.id, array['owner','admin'])));

create policy "league brand assets owners admins delete" on storage.objects for delete to authenticated
using (bucket_id = 'league-brand-assets' and exists (select 1 from public.leagues l where l.slug = (storage.foldername(storage.objects.name))[1] and public.has_league_role(l.id, array['owner','admin'])));
