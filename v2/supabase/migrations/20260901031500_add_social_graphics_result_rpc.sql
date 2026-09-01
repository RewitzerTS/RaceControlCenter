-- Resolve result drivers through their round-specific points attribution.
-- The function is league scoped and works for every current and future league.

create or replace function public.get_social_graphics_result(p_result_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
  target_result public.result_versions%rowtype;
  target_race public.races%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select result_version.* into target_result
  from public.result_versions as result_version
  where result_version.id = p_result_version_id
    and result_version.status = 'active';

  if target_result.id is null then
    raise exception using errcode = 'P0002', message = 'Published result not found.';
  end if;

  select race.* into target_race
  from public.races as race
  where race.id = target_result.race_id;

  select league.* into target_league
  from public.seasons as season
  join public.leagues as league on league.id = season.league_id
  where season.id = target_race.season_id
    and league.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Social graphics administration is not allowed.';
  end if;

  return jsonb_build_object(
    'id', target_result.id,
    'version', target_result.version_number,
    'race_id', target_race.id,
    'race_name', target_race.grand_prix_name,
    'circuit', target_race.circuit_name,
    'country_code', target_race.country_code,
    'race_date', target_race.race_date,
    'round', target_race.round_number,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', result_row.finish_position,
          'driverId', credited_driver.id,
          'driver', credited_driver.display_name,
          'displayName', credited_driver.display_name,
          'gamertag', credited_driver.gamertag,
          'team', coalesce(
            result_row.points_team_name,
            result_row.car_name_snapshot,
            participant_driver.league_team,
            'Independent'
          ),
          'points', result_row.awarded_points,
          'status', coalesce(result_row.classification_status, 'classified'),
          'raceTime', result_row.race_time,
          'raceTimeMs', result_row.race_time_ms
        )
        order by result_row.row_order
      )
      from public.result_version_rows as result_row
      join public.drivers as participant_driver
        on participant_driver.id = result_row.driver_id
      left join lateral private.resolve_season_driver_attribution(
        target_race.season_id,
        target_race.round_number,
        result_row.driver_id
      ) as attribution on true
      join public.drivers as credited_driver
        on credited_driver.id = coalesce(
          result_row.points_owner_driver_id,
          attribution.points_owner_driver_id,
          result_row.driver_id
        )
      where result_row.result_version_id = target_result.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_social_graphics_result(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_social_graphics_result(uuid)
  to authenticated, service_role;

comment on function public.get_social_graphics_result(uuid) is
  'Returns one league-scoped official result with round-aware credited driver identities for Social Graphics.';
