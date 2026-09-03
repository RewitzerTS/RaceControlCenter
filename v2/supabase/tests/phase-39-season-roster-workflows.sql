-- AI participants keep their own result identity while championship points
-- follow the effective-dated human owner. Synthetic fixtures are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'f3900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'phase39-admin@example.invalid', '{}', '{}', now(), now()
);

insert into public.leagues (id, name, slug, is_public, settings)
values (
  'f3910000-0000-0000-0000-000000000001', 'Roster Workflow Test',
  'roster-workflow-test', true, '{"published":true,"theme_id":"1"}'
);

insert into public.driver_identities (id, user_id)
values (
  'f3900000-0000-0000-0000-000000000002',
  'f3900000-0000-0000-0000-000000000001'
);

insert into public.league_members (league_id, user_id, role)
values (
  'f3910000-0000-0000-0000-000000000001',
  'f3900000-0000-0000-0000-000000000001',
  'league_admin'
);

insert into public.seasons (
  id, league_id, slug, name, is_active, game_key, game_label
) values (
  'f3920000-0000-0000-0000-000000000001',
  'f3910000-0000-0000-0000-000000000001',
  'season-2026', 'Season 2026', true, 'f1_25', 'F1 25'
);

insert into public.drivers (
  id, league_id, display_name, gamertag, league_team, car_name, ai_driver_reference, is_active
) values
  ('f3940000-0000-0000-0000-000000000001', 'f3910000-0000-0000-0000-000000000001', 'Human Driver', 'HumanTag', 'Mercedes', 'Mercedes W16', null, true),
  ('f3940000-0000-0000-0000-000000000002', 'f3910000-0000-0000-0000-000000000001', 'AI Driver One', null, 'Mercedes', 'Mercedes W16', 'f1_25:mercedes-one', false),
  ('f3940000-0000-0000-0000-000000000003', 'f3910000-0000-0000-0000-000000000001', 'AI Driver Two', null, 'Ferrari', 'Ferrari SF-25', 'f1_25:ferrari-two', true);

insert into public.season_driver_assignments (
  id, season_id, driver_id, seat_code, ai_driver_name, team_name,
  car_name, number, nationality_code, participant_type, gamertag_snapshot
) values (
  'f3950000-0000-0000-0000-000000000001',
  'f3920000-0000-0000-0000-000000000001',
  'f3940000-0000-0000-0000-000000000001',
  'mercedes-one', 'AI Driver One', 'Mercedes', 'Mercedes W16', 12, 'IT', 'PLAYER', 'HumanTag'
);

insert into public.drivers(id, league_id, display_name, ai_driver_reference, league_team, car_name)
values
 ('f3940000-0000-0000-0000-000000000004','f3910000-0000-0000-0000-000000000001','Human Replacement','Lance Stroll','Reserve Team','Reserve Car'),
 ('f3940000-0000-0000-0000-000000000005','f3910000-0000-0000-0000-000000000001','Other Human',null,'Other Team','Other Car');
select set_config('request.headers', '{"x-rcc-league-slug":"roster-workflow-test"}', true);
select set_config('request.jwt.claims', '{"sub":"f3900000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  race1 uuid; race2 uuid; draft uuid; revision uuid;
  human uuid := 'f3940000-0000-0000-0000-000000000001';
  replacement uuid := 'f3940000-0000-0000-0000-000000000004';
  ai2 uuid := 'f3940000-0000-0000-0000-000000000003';
  row_data public.result_version_rows%rowtype;
  before_row jsonb;
begin
  select id into race1 from public.races where season_id = 'f3920000-0000-0000-0000-000000000001' and round_number = 1;
  select id into race2 from public.races where season_id = 'f3920000-0000-0000-0000-000000000001' and round_number = 2;
  if race1 is null or race2 is null then raise exception 'Missing test races'; end if;
  perform public.set_race_substitution(race1, human, replacement);
  begin
    perform public.set_race_substitution(race1, 'f3940000-0000-0000-0000-000000000005', replacement);
    raise exception 'Double booking accepted';
  exception when unique_violation then
    if sqlerrm <> 'ROSTER_DOUBLE_BOOKING' then raise; end if;
  end;
  begin
    perform public.set_race_substitution(race1, replacement, human);
    raise exception 'Circular substitution accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.set_race_substitution(race1, human, ai2);
    raise exception 'Dedicated AI accepted as human substitute';
  exception when invalid_parameter_value then null;
  end;
  -- Cancelling is possible before an import, then re-assigning is idempotent.
  perform public.set_race_substitution(race1, human, null);
  if exists(select 1 from private.race_substitutions where race_id = race1) then raise exception 'Cancellation failed'; end if;
  perform public.set_race_substitution(race1, human, replacement);
  perform public.set_race_substitution(race1, human, replacement);
  perform public.change_season_vehicle(human, 2, 'Ferrari', 'Ferrari SF-25', ai2);
  if (select car_name from public.drivers where id = human) <> 'Mercedes W16' then raise exception 'Future vehicle applied too soon'; end if;
  begin
    perform public.create_league_result_draft(race1, jsonb_build_array(jsonb_build_object('driver_id', human, 'points',25,'finish_position',1)), 'Wrong participant test');
    raise exception 'Represented driver accepted instead of actual substitute';
  exception when invalid_parameter_value then
    if sqlerrm <> 'ROSTER_USE_SUBSTITUTE' then raise; end if;
  end;
  draft := (public.create_league_result_draft(race1, jsonb_build_array(jsonb_build_object('driver_id', replacement,'points',25,'finish_position',1,'team_name','Wrong import team')), 'Substitution workflow test')->>'id')::uuid;
  select * into row_data from public.result_version_rows where result_version_id = draft;
  if row_data.driver_id <> replacement or row_data.points_owner_driver_id <> human or row_data.points_team_name <> 'Mercedes'
     or row_data.points_car_name <> 'Mercedes W16' or row_data.participation_status <> 'PLAYER' or row_data.awarded_points <> 25 then
    raise exception 'Incorrect substitute result snapshot: %', to_jsonb(row_data);
  end if;
  begin
    perform public.set_race_substitution(race1, human, null);
    raise exception 'Roster changed after draft validation';
  exception when invalid_parameter_value then
    if sqlerrm <> 'ROSTER_RACE_LOCKED' then raise; end if;
  end;
  perform public.publish_league_result_draft(draft);
  select to_jsonb(rr) into before_row from public.result_version_rows rr where result_version_id = draft;
  if not exists(select 1 from public.race_results where race_id = race1 and driver_id = replacement
     and points_owner_driver_id = human and awarded_points = 25 and participation_status = 'PLAYER' and points_team_name = 'Mercedes') then
    raise exception 'Published projection lost substitute attribution';
  end if;
  if (select car_name from public.drivers where id = human) <> 'Ferrari SF-25' then raise exception 'Scheduled vehicle did not activate'; end if;
  begin
    perform public.change_season_vehicle(human, 1, 'Wrong team', 'Wrong car', null);
    raise exception 'Retroactive vehicle change accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'ROSTER_RACE_LOCKED' then raise; end if;
  end;
  revision := (public.create_league_result_draft(race1, jsonb_build_array(jsonb_build_object('driver_id',replacement,'points',18,'finish_position',2)), 'Historical revision after vehicle switch')->>'id')::uuid;
  select * into row_data from public.result_version_rows where result_version_id = revision;
  if row_data.points_team_name <> 'Mercedes' or row_data.points_owner_driver_id <> human then raise exception 'Revision inherited new team'; end if;
  if before_row is distinct from (select to_jsonb(rr) from public.result_version_rows rr where result_version_id = draft) then raise exception 'Published historical row changed'; end if;
  draft := (public.create_league_result_draft(race2, jsonb_build_array(jsonb_build_object('driver_id', ai2,'points',18,'finish_position',2)), 'New vehicle AI attribution test')->>'id')::uuid;
  select * into row_data from public.result_version_rows where result_version_id = draft;
  if row_data.points_owner_driver_id <> human or row_data.points_team_name <> 'Ferrari' or row_data.participation_status <> 'BOT' then raise exception 'AI attribution regressed after vehicle switch'; end if;
  if jsonb_array_length(public.get_league_roster_workspace()->'substitutions') <> 1 then raise exception 'Workspace missing substitution'; end if;
  if has_table_privilege('authenticated','private.race_substitutions','SELECT')
    or has_table_privilege('authenticated','private.season_vehicle_assignments','INSERT')
    or has_function_privilege('anon','public.set_race_substitution(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.assign_season_driver_ai(uuid,uuid,integer)','EXECUTE') then raise exception 'Roster permission leak'; end if;
  perform set_config('request.headers','{"x-rcc-league-slug":"not-this-league"}',true);
  begin
    perform public.get_league_roster_workspace();
    raise exception 'Cross-league workspace access accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_race_substitution(race2,human,replacement);
    raise exception 'Cross-league mutation accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
