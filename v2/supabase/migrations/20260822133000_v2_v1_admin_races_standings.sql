-- RaceVora V2: restore the V1 race, result and standings admin overview.
-- Read-only and actor-bound; no production result is changed by this migration.

create or replace function public.get_league_race_admin_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  select l.* into target_league from public.leagues l
  where l.slug = public.requested_league_slug();
  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League race administration access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug, 'is_active', s.is_active,
        'game_label', s.game_label, 'start_date', s.start_date, 'end_date', s.end_date
      ) order by s.is_active desc, s.start_date desc nulls last, s.name)
      from public.seasons s where s.league_id = target_league.id
    ), '[]'::jsonb),
    'races', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'season_id', r.season_id, 'season_name', s.name,
        'round_number', r.round_number, 'grand_prix_name', r.grand_prix_name,
        'circuit_name', r.circuit_name, 'country_code', r.country_code,
        'race_date', r.race_date, 'race_start_at', r.race_start_at,
        'status', r.status, 'has_sprint', r.has_sprint,
        'result_count', (select count(*) from public.race_results rr where rr.race_id = r.id),
        'result_version', rv.version_number, 'result_status', rv.status,
        'result_activated_at', rv.activated_at
      ) order by s.is_active desc, r.round_number desc)
      from public.races r
      join public.seasons s on s.id = r.season_id
      left join public.result_versions rv on rv.id = r.current_result_version_id
      where s.league_id = target_league.id
    ), '[]'::jsonb),
    'driver_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'driver_id', ranked.driver_id, 'display_name', ranked.display_name,
        'gamertag', ranked.gamertag, 'points', ranked.points,
        'wins', ranked.wins, 'podiums', ranked.podiums, 'starts', ranked.starts
      ) order by ranked.points desc, ranked.wins desc, ranked.display_name)
      from (
        select d.id driver_id, d.display_name, d.gamertag,
          coalesce(sum(rr.awarded_points), 0) points,
          count(*) filter (where rr.finish_position = 1) wins,
          count(*) filter (where rr.finish_position between 1 and 3) podiums,
          count(*) starts
        from public.drivers d
        join public.race_results rr on rr.driver_id = d.id
        join public.races r on r.id = rr.race_id
        join public.seasons s on s.id = r.season_id
        where d.league_id = target_league.id and s.league_id = target_league.id and s.is_active
        group by d.id, d.display_name, d.gamertag
      ) ranked
    ), '[]'::jsonb),
    'team_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_name', ranked.team_name, 'points', ranked.points,
        'wins', ranked.wins, 'podiums', ranked.podiums
      ) order by ranked.points desc, ranked.wins desc, ranked.team_name)
      from (
        select coalesce(nullif(rr.points_team_name, ''), nullif(d.league_team, ''), 'Ohne Team') team_name,
          coalesce(sum(rr.awarded_points), 0) points,
          count(*) filter (where rr.finish_position = 1) wins,
          count(*) filter (where rr.finish_position between 1 and 3) podiums
        from public.race_results rr
        join public.drivers d on d.id = rr.driver_id
        join public.races r on r.id = rr.race_id
        join public.seasons s on s.id = r.season_id
        where d.league_id = target_league.id and s.league_id = target_league.id and s.is_active
        group by coalesce(nullif(rr.points_team_name, ''), nullif(d.league_team, ''), 'Ohne Team')
      ) ranked
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_league_race_admin_workspace()
  from public, anon, authenticated, service_role;
grant execute on function public.get_league_race_admin_workspace()
  to authenticated, service_role;
