-- Configurable driver labels for Social Graphics.
-- Only league administrators may read the profile labels of drivers in the requested league.

create or replace function public.get_social_graphics_driver_labels()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select league.* into target_league
  from public.leagues as league
  where league.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Social graphics administration is not allowed.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'driverId', driver.id,
        'driverName', driver.display_name,
        'displayName', coalesce(
          nullif(btrim(identity_row.display_name), ''),
          driver.display_name
        ),
        'gamertag', coalesce(
          nullif(btrim(identity_row.gamertag), ''),
          nullif(btrim(driver.gamertag), '')
        )
      )
      order by driver.display_name, driver.id
    )
    from public.drivers as driver
    left join public.driver_identity_links as identity_link
      on identity_link.driver_id = driver.id
    left join public.driver_identities as identity_row
      on identity_row.id = identity_link.driver_identity_id
    where driver.league_id = target_league.id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_social_graphics_driver_labels()
  from public, anon, authenticated, service_role;
grant execute on function public.get_social_graphics_driver_labels()
  to authenticated, service_role;

comment on function public.get_social_graphics_driver_labels() is
  'Returns league-scoped driver, display-name and gamertag labels for authorized Social Graphics editors.';
