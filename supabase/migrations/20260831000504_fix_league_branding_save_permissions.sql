-- Repair league-branding writes after league access became membership-scoped.
-- The helper is intentionally actor-bound and only authorizes the requested
-- tenant's folder for a platform owner or that tenant's league administration.

create or replace function private.can_manage_league_brand_asset(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.leagues l
      where l.slug = (storage.foldername(p_object_name))[1]
        and l.slug = public.requested_league_slug()
        and private.has_league_capability(l.id, 'league_admin')
    );
$$;

revoke all on function private.can_manage_league_brand_asset(text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_manage_league_brand_asset(text)
  to authenticated;

drop policy if exists "v2 admins upload league brand assets" on storage.objects;
create policy "v2 admins upload league brand assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'league-brand-assets'
  and (select private.can_manage_league_brand_asset(name))
);

drop policy if exists "v2 admins update league brand assets" on storage.objects;
create policy "v2 admins update league brand assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'league-brand-assets'
  and (select private.can_manage_league_brand_asset(name))
)
with check (
  bucket_id = 'league-brand-assets'
  and (select private.can_manage_league_brand_asset(name))
);

-- Reassert the intended privilege boundary in case an older remote deployment
-- drifted to the default invoker mode. The function itself verifies auth.uid(),
-- the requested tenant and the league_admin capability before writing.
alter function public.update_league_branding(text, text, text, text, text, text, text)
  security definer;
alter function public.update_league_branding(text, text, text, text, text, text, text)
  set search_path = '';

revoke all on function public.update_league_branding(text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_league_branding(text, text, text, text, text, text, text)
  to authenticated, service_role;

comment on function private.can_manage_league_brand_asset(text) is
  'Actor-bound authorization for the requested league brand-assets folder; usable only by authenticated policy evaluation.';
