-- Bootstrap the catalog teams only for a league's first season. No backfill.
-- Keep the existing authorization, league lock and later-season reset behavior.
create or replace function league_roster_private.start_without_assignments(
  p_name text,p_slug text,p_game_key text,p_start_date date,p_calendar jsonb,
  p_fastest_lap_bonus_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  lid uuid := private.roster_admin_league();
  active_humans uuid[];
  result jsonb;
  sid uuid;
  first_season boolean;
  team_count integer;
begin
  perform 1 from public.leagues where id=lid for update;
  -- The league lock serializes concurrent setup requests. A completed onboarding
  -- also prevents accidental re-seeding if an old season was subsequently removed.
  select not exists(select 1 from public.seasons where league_id=lid)
    and coalesce(settings->>'onboarding_complete','false') <> 'true'
    into first_season from public.leagues where id=lid;
  select array_agg(id) into active_humans from public.drivers
    where league_id=lid and is_active
      and private.result_participation_status(ai_driver_reference,null)='PLAYER';
  result := league_roster_private.start_from_profiles(
    p_name,p_slug,p_game_key,p_start_date,'[]',p_calendar,p_fastest_lap_bonus_enabled);
  sid := (result->'season'->>'id')::uuid;
  update public.drivers set is_active=true,league_team=null,car_name=null
    where id=any(active_humans);

  if first_season then
    -- These snapshots were just created from the selected game's catalog.
    -- Never hardcode constructor names or replace existing directory entries.
    insert into league_roster_private.teams(league_id,name)
      select distinct lid,a.team_name from public.season_driver_assignments a
      where a.season_id=sid and nullif(btrim(a.team_name),'') is not null
      on conflict do nothing;
    insert into league_roster_private.season_teams(season_id,team_id)
      select distinct sid,t.id from public.season_driver_assignments a
      join league_roster_private.teams t on t.league_id=lid and lower(t.name)=lower(a.team_name)
      where a.season_id=sid
      on conflict do nothing;
  end if;

  insert into private.season_vehicle_assignments(
    season_id,driver_id,effective_from_round,team_name,car_name,created_by)
    select a.season_id,a.driver_id,1,case when first_season then t.name else null end,a.car_name,auth.uid()
    from public.season_driver_assignments a
    left join league_roster_private.teams t on t.league_id=lid and lower(t.name)=lower(a.team_name)
    where a.season_id=sid
    on conflict(season_id,driver_id,effective_from_round)
      do update set team_name=excluded.team_name;

  if first_season then
    perform league_roster_private.assert_season_team_capacity(sid);
    select count(*) into team_count from league_roster_private.season_teams where season_id=sid;
    insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
      values('league',lid,auth.uid(),'season.standard_teams.seeded','season',sid,
        jsonb_build_object('game_key',p_game_key,'team_count',team_count));
  end if;
  return result;
end;
$$;
