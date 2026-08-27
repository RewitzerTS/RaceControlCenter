-- RaceVora V2 Phase 26: keep public tenant reads independent of owner-only RPC grants.
-- Additive staging migration. Never execute against V1 Production.

create or replace function public.matches_requested_league(p_league_id uuid)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return exists (
      select 1
      from public.leagues l
      where l.id = p_league_id
        and l.slug = public.requested_league_slug()
        and coalesce(l.settings ->> 'owner_only', 'false') <> 'true'
    );
  end if;

  return exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.slug = public.requested_league_slug()
      and (
        coalesce(l.settings ->> 'owner_only', 'false') <> 'true'
        or (select public.is_platform_owner())
      )
  );
end;
$$;

revoke all on function public.matches_requested_league(uuid) from public, anon, authenticated, service_role;
grant execute on function public.matches_requested_league(uuid) to anon, authenticated, service_role;

comment on function public.matches_requested_league(uuid) is
  'Fail-closed tenant match. Anonymous public reads never invoke the authenticated owner RPC.';
