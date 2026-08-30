-- Keep global driver identities separate from league authorization.
-- Signed-in users may only read a league after an approved membership exists.

create or replace function public.matches_requested_league(p_league_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return exists (
      select 1
      from public.leagues l
      where l.id = p_league_id
        and l.slug = public.requested_league_slug()
        and l.is_public
        and l.status = 'active'
        and coalesce(l.settings ->> 'published', 'true') = 'true'
        and coalesce(l.settings ->> 'owner_only', 'false') <> 'true'
    );
  end if;

  return exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.slug = public.requested_league_slug()
      and (
        (select public.is_platform_owner())
        or exists (
          select 1
          from public.league_members lm
          where lm.league_id = l.id
            and lm.user_id = (select auth.uid())
        )
      )
  );
end;
$$;

revoke all on function public.matches_requested_league(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.matches_requested_league(uuid)
  to anon, authenticated, service_role;

drop policy if exists "v2 authenticated read permitted leagues" on public.leagues;
create policy "v2 authenticated read permitted leagues"
on public.leagues
for select
to authenticated
using (
  (select public.is_platform_owner())
  or (select private.is_league_member(id))
);

create or replace function public.current_app_role()
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  resolved_role text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  if public.is_platform_owner() then
    return 'platform_owner';
  end if;

  select lm.role
    into resolved_role
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.user_id = (select auth.uid())
    and l.slug = public.requested_league_slug()
  limit 1;

  return resolved_role;
end;
$$;

revoke all on function public.current_app_role()
  from public, anon, authenticated, service_role;
grant execute on function public.current_app_role()
  to authenticated, service_role;

comment on function public.matches_requested_league(uuid) is
  'Anonymous reads require a public published league. Authenticated reads require platform ownership or an approved membership in the requested league.';
comment on function public.current_app_role() is
  'Actor-bound role resolver. A global driver identity never grants league access; non-owners require an approved membership in the requested league.';
