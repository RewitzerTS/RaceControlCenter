-- Storage requests do not rely on the application tenant header. Resolve the
-- league from the object path and check the actor through a private helper.

create or replace function private.can_manage_league_storage(p_league_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when p_league_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then false
    when public.is_platform_owner() then true
    else exists (
      select 1
      from public.leagues l
      join public.league_members lm on lm.league_id = l.id
      where l.slug = p_league_slug
        and lm.user_id = (select auth.uid())
        and lm.role = 'league_admin'
    )
  end;
$$;

revoke all on function private.can_manage_league_storage(text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_manage_league_storage(text)
  to authenticated;

drop policy if exists "v2 league admins insert temporary result images" on storage.objects;
drop policy if exists "v2 league admins read own temporary result images" on storage.objects;
drop policy if exists "v2 league admins delete own temporary result images" on storage.objects;

create policy "v2 league admins insert temporary result images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'result-import-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select private.can_manage_league_storage((storage.foldername(name))[1]))
);

create policy "v2 league admins read own temporary result images"
on storage.objects for select to authenticated
using (
  bucket_id = 'result-import-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select private.can_manage_league_storage((storage.foldername(name))[1]))
);

create policy "v2 league admins delete own temporary result images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'result-import-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select private.can_manage_league_storage((storage.foldername(name))[1]))
);
