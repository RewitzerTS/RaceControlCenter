-- Extend league onboarding with season team/driver slots and reserve-driver support.

create or replace function public.complete_league_onboarding(
  p_league_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_game_key text := btrim(coalesce(p_payload->>'game_key', ''));
  v_game_label text := btrim(coalesce(p_payload->>'game_label', ''));
  v_season_name text := btrim(coalesce(p_payload#>>'{season,name}', ''));
  v_season_slug text;
  v_start_date date;
  v_scoring jsonb := coalesce(p_payload->'scoring', '{}'::jsonb);
  v_teams jsonb := coalesce(p_payload->'teams', '[]'::jsonb);
  v_drivers jsonb := coalesce(p_payload->'drivers', '[]'::jsonb);
  v_races jsonb := coalesce(p_payload->'races', '[]'::jsonb);
  v_publish boolean := coalesce((p_payload->>'publish')::boolean, false);
  v_season_id uuid;
  v_team jsonb;
  v_driver jsonb;
  v_race jsonb;
  v_team_id uuid;
  v_driver_id uuid;
  v_team_name text;
  v_team_slug text;
  v_driver_name text;
  v_driver_role text;
  v_gp_name text;
  v_round integer := 0;
  v_team_count integer := 0;
  v_primary_count integer := 0;
  v_reserve_count integer := 0;
  v_team_slot_number integer := 0;
  v_team_slot_id uuid;
  v_driver_slot_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = p_league_id and lm.user_id = v_user_id;
  if v_role is null or v_role not in ('owner', 'admin') then raise exception 'Owner or admin role required'; end if;
  if exists (select 1 from public.seasons s where s.league_id = p_league_id) then
    raise exception 'League onboarding can only be completed before the first season exists';
  end if;

  if v_game_key = '' or v_game_label = '' then raise exception 'Game is required'; end if;
  if char_length(v_season_name) < 2 or char_length(v_season_name) > 80 then raise exception 'Season name must be between 2 and 80 characters'; end if;
  if jsonb_typeof(v_scoring->'points') <> 'array' or jsonb_array_length(v_scoring->'points') < 1 then raise exception 'At least one scoring position is required'; end if;
  if jsonb_typeof(v_teams) <> 'array' or jsonb_typeof(v_drivers) <> 'array' or jsonb_typeof(v_races) <> 'array' then raise exception 'Teams, drivers and races must be arrays'; end if;
  if jsonb_array_length(v_teams) < 1 then raise exception 'At least one team is required'; end if;
  if jsonb_array_length(v_teams) > 10 then raise exception 'A maximum of 10 teams is supported'; end if;
  if jsonb_array_length(v_drivers) < 1 then raise exception 'At least one driver is required'; end if;
  if jsonb_array_length(v_races) < 1 then raise exception 'At least one race is required'; end if;

  begin
    v_start_date := nullif(p_payload#>>'{season,start_date}', '')::date;
  exception when others then raise exception 'Invalid season start date'; end;

  v_season_slug := trim(both '-' from lower(regexp_replace(v_season_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if v_season_slug = '' then v_season_slug := 'season-1'; end if;

  insert into public.seasons (league_id, name, slug, start_date, is_active, game_key, game_label)
  values (p_league_id, v_season_name, v_season_slug, v_start_date, true, v_game_key, v_game_label)
  returning id into v_season_id;

  for v_team in select value from jsonb_array_elements(v_teams)
  loop
    v_team_name := btrim(coalesce(v_team->>'name', ''));
    if v_team_name = '' then continue; end if;
    if char_length(v_team_name) > 80 then raise exception 'Team name too long'; end if;
    v_team_slug := trim(both '-' from lower(regexp_replace(v_team_name, '[^a-zA-Z0-9]+', '-', 'g')));
    if v_team_slug = '' then v_team_slug := 'team-' || substr(gen_random_uuid()::text, 1, 8); end if;

    insert into public.teams (league_id, slug, display_name, short_name)
    values (p_league_id, v_team_slug, v_team_name, nullif(btrim(coalesce(v_team->>'short_name', '')), ''))
    returning id into v_team_id;

    v_team_slot_number := v_team_slot_number + 1;
    insert into public.season_team_slots (season_id, slot_number, slot_label, is_bot_team)
    values (v_season_id, v_team_slot_number, v_team_name, false)
    returning id into v_team_slot_id;

    insert into public.season_driver_slots (season_id, team_slot_id, slot_number, seat_number)
    values
      (v_season_id, v_team_slot_id, ((v_team_slot_number - 1) * 2) + 1, 1),
      (v_season_id, v_team_slot_id, ((v_team_slot_number - 1) * 2) + 2, 2);

    v_team_count := v_team_count + 1;
  end loop;

  for v_driver in select value from jsonb_array_elements(v_drivers)
  loop
    v_driver_name := btrim(coalesce(v_driver->>'name', ''));
    if v_driver_name = '' then continue; end if;
    if char_length(v_driver_name) > 100 then raise exception 'Driver name too long'; end if;

    v_team_name := btrim(coalesce(v_driver->>'team', ''));
    v_driver_role := lower(btrim(coalesce(v_driver->>'role', 'primary')));
    if v_driver_role not in ('primary', 'reserve') then raise exception 'Driver role must be primary or reserve'; end if;

    v_team_id := null;
    if v_team_name <> '' then
      select t.id into v_team_id
      from public.teams t
      where t.league_id = p_league_id and lower(t.display_name) = lower(v_team_name)
      limit 1;
      if v_team_id is null then raise exception 'Unknown team for driver %', v_driver_name; end if;
    end if;

    if v_driver_role = 'primary' and v_team_id is null then
      raise exception 'Primary driver % requires a team', v_driver_name;
    end if;

    insert into public.drivers (league_id, display_name, gamertag, number, league_team, is_active)
    values (
      p_league_id,
      v_driver_name,
      nullif(btrim(coalesce(v_driver->>'gamertag', '')), ''),
      nullif(v_driver->>'number', '')::integer,
      nullif(v_team_name, ''),
      true
    )
    returning id into v_driver_id;

    insert into public.driver_season_assignments (season_id, driver_id, team_id, league_team, is_primary)
    values (v_season_id, v_driver_id, v_team_id, nullif(v_team_name, ''), v_driver_role = 'primary');

    if v_driver_role = 'primary' then
      select sds.id
      into v_driver_slot_id
      from public.season_driver_slots sds
      join public.season_team_slots sts on sts.id = sds.team_slot_id
      join public.teams t on t.league_id = p_league_id and lower(t.display_name) = lower(sts.slot_label)
      where sds.season_id = v_season_id
        and t.id = v_team_id
        and not exists (
          select 1
          from public.driver_slot_assignments dsa
          where dsa.driver_slot_id = sds.id and dsa.season_id = v_season_id
        )
      order by sds.seat_number
      limit 1;

      if v_driver_slot_id is null then
        raise exception 'Team % already has two primary drivers', v_team_name;
      end if;

      insert into public.driver_slot_assignments (
        driver_slot_id,
        season_id,
        participant_driver_id,
        points_owner_driver_id,
        participation_mode,
        effective_round_number
      )
      values (v_driver_slot_id, v_season_id, v_driver_id, v_driver_id, 'player', 1);

      v_primary_count := v_primary_count + 1;
    else
      v_reserve_count := v_reserve_count + 1;
    end if;
  end loop;

  if v_primary_count < 1 then raise exception 'At least one primary driver is required'; end if;

  for v_race in select value from jsonb_array_elements(v_races)
  loop
    v_gp_name := btrim(coalesce(v_race->>'name', ''));
    if v_gp_name = '' then continue; end if;
    v_round := v_round + 1;
    insert into public.races (season_id, round_number, grand_prix_name, circuit_name, race_date, race_time, status)
    values (
      v_season_id,
      v_round,
      v_gp_name,
      nullif(btrim(coalesce(v_race->>'circuit', '')), ''),
      nullif(v_race->>'date', '')::date,
      nullif(btrim(coalesce(v_race->>'time', '')), ''),
      'upcoming'
    );
  end loop;

  if v_round = 0 then raise exception 'At least one valid race is required'; end if;

  update public.leagues l
  set settings = coalesce(l.settings, '{}'::jsonb) || jsonb_build_object(
    'published', v_publish,
    'onboarding_complete', true,
    'game_key', v_game_key,
    'game_label', v_game_label,
    'scoring', v_scoring,
    'season_structure', jsonb_build_object(
      'max_teams', 10,
      'primary_seats_per_team', 2,
      'reserve_drivers_supported', true
    )
  ),
  updated_at = now()
  where l.id = p_league_id;

  return jsonb_build_object(
    'ok', true,
    'league_id', p_league_id,
    'season_id', v_season_id,
    'published', v_publish,
    'drivers_created', jsonb_array_length(v_drivers),
    'primary_drivers_created', v_primary_count,
    'reserve_drivers_created', v_reserve_count,
    'teams_created', v_team_count,
    'races_created', v_round
  );
end;
$$;

revoke execute on function public.complete_league_onboarding(uuid, jsonb) from public, anon;
grant execute on function public.complete_league_onboarding(uuid, jsonb) to authenticated;
