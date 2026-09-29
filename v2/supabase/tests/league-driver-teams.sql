-- Isolated synthetic fixtures; every write is rolled back.
begin;
create temporary table team_test as select gen_random_uuid() actor, gen_random_uuid() outsider,
  gen_random_uuid() league_id, gen_random_uuid() other_league, gen_random_uuid() driver_id,
  gen_random_uuid() other_driver, gen_random_uuid() inactive_driver,
  null::uuid team_id, null::uuid second_team, null::uuid season_id;
grant select, update on team_test to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select actor,'authenticated','authenticated',actor::text||'@team-test.invalid','{}'::jsonb,'{}'::jsonb from team_test
union all select outsider,'authenticated','authenticated',outsider::text||'@team-test.invalid','{}'::jsonb,'{}'::jsonb from team_test;
insert into public.driver_identities(user_id,status,display_name,gamertag)
select actor,'active','Synthetic Admin','AdminTag' from team_test;
insert into public.leagues(id,name,slug,is_public,settings)
select league_id,'Synthetic Team League','team-test-'||league_id,false,'{}'::jsonb from team_test
union all select other_league,'Other Synthetic League','team-test-'||other_league,false,'{}'::jsonb from team_test;
insert into public.league_members(league_id,user_id,role) select league_id,actor,'league_admin' from team_test;
insert into public.drivers(id,league_id,display_name,gamertag,is_active)
select driver_id,league_id,'Existing Driver','ExistingTag',true from team_test
union all select other_driver,other_league,'Other League Driver','OtherTag',true from team_test
union all select inactive_driver,league_id,'Inactive Driver','InactiveTag',false from team_test;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','team-test-'||league_id)::text,true) from team_test;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from team_test;
set local role authenticated;
select public.link_league_member_driver(actor,driver_id) from team_test;
update team_test set team_id = public.create_league_team('RCC Racing'), second_team = public.create_league_team('RCC Junior');
select public.assign_league_driver_team(driver_id,team_id,null) from team_test;
do $$ declare f record; directory jsonb; payload jsonb; result jsonb; invalid_driver uuid;
begin
  select * into f from team_test;
  directory := public.get_league_team_directory();
  if directory->'profiles'->0->>'gamertag' <> 'AdminTag' then raise exception 'Canonical profile gamertag not used'; end if;
  if jsonb_array_length(directory->'teams') <> 2 or jsonb_array_length(directory->'profiles') <> 2
    or jsonb_array_length(directory->'preferences') <> 1 then raise exception 'Directory incorrect: %',directory; end if;
  begin perform public.create_league_team('rcc racing'); raise exception 'Duplicate name accepted'; exception when unique_violation then null; end;
  foreach invalid_driver in array array[f.other_driver,f.inactive_driver] loop
    begin perform public.assign_league_driver_team(invalid_driver,f.team_id,null); raise exception 'Invalid driver accepted'; exception when invalid_parameter_value then null; end;
  end loop;
  payload := jsonb_build_array(jsonb_build_object('seat_code','mercedes-russell','driver_id',f.driver_id,'team_id',f.team_id));
  result := public.start_league_season_from_profiles('Synthetic Season','synthetic-season','f1_25',current_date,payload,
    jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false),
      jsonb_build_object('track_key','monaco','date',current_date,'time','21:00','weather','klar','has_sprint',false)),false);
  update team_test set season_id = (result->'season'->>'id')::uuid;
  if (result->>'players')::int <> 1 or (result->>'ai_drivers')::int <> 19 then raise exception 'Wrong roster counts: %',result; end if;
  begin
    perform public.start_league_season_from_profiles('Duplicate','duplicate','f1_25',current_date,payload||payload,'[]',false);
    raise exception 'Duplicate driver accepted';
  exception when invalid_parameter_value then null; end;
  perform public.assign_league_driver_team(f.driver_id,f.second_team,2);
end $$;
reset role;
do $$ declare f record; test_race_id uuid; draft_id uuid; before_result jsonb; begin
  select * into f from team_test;
  if (select count(*) from public.drivers where league_id=f.league_id and gamertag='ExistingTag') <> 1 then raise exception 'Profile duplicated'; end if;
  if not exists(select 1 from public.season_driver_assignments where season_id=f.season_id and driver_id=f.driver_id and team_name='RCC Racing' and car_name='Mercedes W16' and gamertag_snapshot='AdminTag') then raise exception 'Seat snapshot incorrect'; end if;
  if not exists(select 1 from private.season_vehicle_assignments where season_id=f.season_id and driver_id=f.driver_id and effective_from_round=1 and team_name='RCC Racing')
    or not exists(select 1 from private.season_vehicle_assignments where season_id=f.season_id and driver_id=f.driver_id and effective_from_round=2 and team_name='RCC Junior' and car_name='Mercedes W16') then raise exception 'Team history incorrect'; end if;
  if (select league_team from public.drivers where id=f.driver_id) <> 'RCC Racing' then raise exception 'Future switch applied early'; end if;
  if (select count(*) from public.races where season_id=f.season_id and race_date=current_date) <> 2 then raise exception 'Two races on one day were not preserved'; end if;
  select id into test_race_id from public.races where season_id=f.season_id and round_number=1;
  draft_id := (public.create_league_result_draft(test_race_id,jsonb_build_array(jsonb_build_object('driver_id',f.driver_id,'points',25,'finish_position',1)),'League team regression')->>'id')::uuid;
  perform public.publish_league_result_draft(draft_id);
  select to_jsonb(r) into before_result from public.race_results r where r.race_id=test_race_id and r.driver_id=f.driver_id;
  if before_result is null or before_result->>'points_team_name' <> 'RCC Racing' then raise exception 'Published result lost original team'; end if;
  begin perform public.assign_league_driver_team(f.driver_id,f.second_team,1); raise exception 'Locked race rewritten'; exception when invalid_parameter_value then null; end;
  if (select to_jsonb(r) from public.race_results r where r.race_id=test_race_id and r.driver_id=f.driver_id) is distinct from before_result then raise exception 'Historical result changed'; end if;
  if has_table_privilege('authenticated','league_roster_private.teams','insert') or has_function_privilege('anon','public.get_league_team_directory()','execute') then raise exception 'Excessive privileges'; end if;
end $$;
set local role authenticated;
do $$ declare f record; result jsonb; calendar jsonb; begin
  select * into f from team_test;
  calendar := jsonb_build_array(jsonb_build_object('track_key','monaco','date',current_date,'time','20:00','weather','klar','has_sprint',false));
  begin
    perform public.start_league_season_from_profiles('Foreign','foreign','f1_26',current_date,
      jsonb_build_array(jsonb_build_object('seat_code','mercedes-russell','driver_id',f.other_driver)),calendar,false);
    raise exception 'Foreign profile accepted';
  exception when invalid_parameter_value then null; end;
  result := public.start_league_season_from_profiles('Synthetic F1 26','synthetic-f1-26','f1_26',current_date,
    jsonb_build_array(jsonb_build_object('seat_code','mercedes-russell','driver_id',f.driver_id,'team_id',f.team_id)),calendar,false);
  if (result->>'players')::int <> 1 or (result->>'ai_drivers')::int <> 21 then raise exception 'Wrong F1 26 roster counts: %',result; end if;
end $$;
reset role;
do $$ declare f record; begin
  select * into f from team_test;
  if exists(select 1 from public.seasons where league_id=f.league_id and slug='foreign') then raise exception 'Invalid season was not rolled back'; end if;
  if not exists(select 1 from public.race_results r join public.races race on race.id=r.race_id where race.season_id=f.season_id and r.driver_id=f.driver_id and r.points_team_name='RCC Racing') then raise exception 'New season changed historical result'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from team_test;
set local role authenticated;
do $$ begin
  begin perform public.get_league_team_directory(); raise exception 'Outsider read permitted'; exception when insufficient_privilege then null; end;
  begin perform public.create_league_team('Forbidden'); raise exception 'Outsider write permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'league_driver_teams_rollback_tests_passed' as result;
