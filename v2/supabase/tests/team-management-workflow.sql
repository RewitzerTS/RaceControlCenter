-- Synthetic fixtures only. The final rollback preserves every existing league.
begin;
create temporary table tm_fixture as select gen_random_uuid() actor,gen_random_uuid() outsider,gen_random_uuid() lid,
  gen_random_uuid() d1,gen_random_uuid() d2,gen_random_uuid() d3,gen_random_uuid() d4,gen_random_uuid() foreign_driver,
  null::uuid sid,null::jsonb before_result;
grant select,update on tm_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select actor,'authenticated','authenticated',actor||'@team-manager.invalid','{}'::jsonb,'{}'::jsonb from tm_fixture
union all select outsider,'authenticated','authenticated',outsider||'@team-manager.invalid','{}'::jsonb,'{}'::jsonb from tm_fixture;
insert into public.leagues(id,name,slug,is_public,settings) select lid,'Synthetic team management','tm-'||lid,false,'{}' from tm_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag) select actor,'active','Synthetic Admin','AdminTag' from tm_fixture;
insert into public.league_members(league_id,user_id,role) select lid,actor,'league_admin' from tm_fixture;
insert into public.drivers(id,league_id,display_name,gamertag,is_active)
select d1,lid,'Test A','TagA',true from tm_fixture union all select d2,lid,'Test B','TagB',true from tm_fixture
union all select d3,lid,'Test C','TagC',true from tm_fixture union all select d4,lid,'Test D','TagD',true from tm_fixture;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','tm-'||lid)::text,true) from tm_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from tm_fixture;
set local role authenticated;
do $$ declare f record; r jsonb; s jsonb; rev text; a uuid; b uuid; begin
  select * into f from tm_fixture;
  s:=public.get_league_team_manager('next',null);
  if s->'season'<>'null'::jsonb then raise exception 'Unexpected season'; end if;
  a:=public.create_league_team('Alpha'); b:=public.create_league_team('Beta');
  r:=public.start_league_season_from_profiles('Synthetic season','synthetic-season','f1_25',current_date,
    jsonb_build_array(jsonb_build_object('seat_code','mercedes-russell','driver_id',f.d1,'team_id',a),
      jsonb_build_object('seat_code','red-bull-verstappen','driver_id',f.d2,'team_id',a),
      jsonb_build_object('seat_code','ferrari-leclerc','driver_id',f.d3,'team_id',b),
      jsonb_build_object('seat_code','mercedes-antonelli','driver_id',f.d4,'team_id',b)),
    jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false),
      jsonb_build_object('track_key','monaco','date',current_date+7,'time','20:00','weather','klar','has_sprint',false),
      jsonb_build_object('track_key','belgium','date',current_date+14,'time','20:00','weather','klar','has_sprint',false)),false);
  update tm_fixture set sid=(r->'season'->>'id')::uuid;
  s:=public.get_league_team_manager('current',2); rev:=s->>'revision';
  if jsonb_array_length(s->'profiles')<>4 or jsonb_array_length(s->'teams')<>2 then raise exception 'Manager omitted humans or included AI'; end if;
  begin perform public.save_league_team_lineup('current',null,null,'Invalid',array[f.d1],'[]',rev); raise exception 'Implicit round accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',2,null,'Invalid',array[f.d1,f.d1],'[]',rev); raise exception 'Duplicate driver accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',2,null,'Invalid',array[f.foreign_driver],'[]',rev); raise exception 'Foreign driver accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',2,'Alpha','Alpha',array[f.d1,f.d3],'[]',rev); raise exception 'Departure without destination accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',2,'Alpha','Alpha',array[f.d1],jsonb_build_array(jsonb_build_object('driver_id',f.d2,'team_name','Beta')),rev); raise exception 'Overfull destination accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',2,'Alpha','Renamed',array[f.d1,f.d2],'[]',rev); raise exception 'Historical team renamed'; exception when invalid_parameter_value then null; end;
  -- One transaction moves C to Alpha and B to Beta, including full-team swaps.
  s:=public.save_league_team_lineup('current',2,'Alpha','Alpha',array[f.d1,f.d3],jsonb_build_array(jsonb_build_object('driver_id',f.d2,'team_name','Beta')),rev);
  if not exists(select 1 from jsonb_array_elements(s->'profiles') p where p->>'id'=f.d3::text and p->>'team_name'='Alpha' and p->>'car_name'='Ferrari SF-25') then raise exception 'Swap or car preservation failed'; end if;
  begin perform public.save_league_team_lineup('current',2,null,'Stale',array[f.d1],'[]',rev); raise exception 'Stale revision accepted'; exception when serialization_failure then null; end;
  -- Prepare next season independently, preserving the running-season snapshot.
  s:=public.get_league_team_manager('next',null);
  s:=public.save_league_team_lineup('next',null,null,'Hobbyracer',array[f.d1,f.d2],'[]',s->>'revision');
  s:=public.get_league_team_manager('current',2);
  if not exists(select 1 from jsonb_array_elements(s->'profiles') p where p->>'id'=f.d2::text and p->>'team_name'='Beta') then raise exception 'Next-season planning changed current season'; end if;
end $$;
reset role;
do $$ declare f record; rid uuid; version_id uuid; state jsonb; begin
  select * into f from tm_fixture;
  if not exists(select 1 from private.season_vehicle_assignments where driver_id=f.d2 and season_id=f.sid and effective_from_round=1 and team_name='Alpha' and car_name='Red Bull RB21') then raise exception 'Earlier baseline changed'; end if;
  select id into rid from public.races where season_id=f.sid and round_number=1;
  version_id:=(public.create_league_result_draft(rid,jsonb_build_array(jsonb_build_object('driver_id',f.d2,'points',25,'finish_position',1)),'Team regression')->>'id')::uuid;
  perform public.publish_league_result_draft(version_id);
  update tm_fixture set before_result=(select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d2);
  if (select before_result->>'points_team_name' from tm_fixture)<>'Alpha' then raise exception 'Original result team lost'; end if;
  -- An already scheduled arrival cannot create three drivers in a later round.
  perform public.assign_league_driver_team(f.d4,public.create_league_team('Gamma'),3);
  state:=public.get_league_team_manager('current',2);
  begin perform public.save_league_team_lineup('current',2,'Gamma','Gamma',array[f.d1,f.d3],'[]',state->>'revision'); raise exception 'Future overfull team accepted'; exception when invalid_parameter_value then null; end;
  state:=public.get_league_team_manager('current',1);
  begin perform public.save_league_team_lineup('current',1,null,'Locked',array[f.d1],'[]',state->>'revision'); raise exception 'Published race modified'; exception when invalid_parameter_value then null; end;
  -- A late failure in a multi-driver move rolls back the preceding move and new team.
  perform public.assign_league_driver_team(f.d3,(select id from league_roster_private.teams where league_id=f.lid and name='Beta'),3);
  state:=public.get_league_team_manager('current',2);
  begin perform public.save_league_team_lineup('current',2,null,'Must rollback',array[f.d1,f.d3],'[]',state->>'revision'); raise exception 'Later assignment overwritten'; exception when invalid_parameter_value then null; end;
  if exists(select 1 from league_roster_private.teams where league_id=f.lid and name='Must rollback') then raise exception 'Failed transaction created a team'; end if;
  if not exists(select 1 from private.season_vehicle_assignments where season_id=f.sid and driver_id=f.d1 and effective_from_round=2 and team_name='Alpha') then raise exception 'Failed transaction partly moved a driver'; end if;
  if (select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d2) is distinct from (select before_result from tm_fixture) then raise exception 'Historic result changed'; end if;
  -- Legacy season names must remain visible even without a catalogue entry.
  update private.season_vehicle_assignments set team_name='Legacy actual team' where season_id=f.sid and driver_id=f.d4 and effective_from_round=1;
  state:=public.get_league_team_manager('current',1);
  if not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'='Legacy actual team') then raise exception 'Legacy team hidden'; end if;
  if has_function_privilege('anon','public.get_league_team_manager(text,integer)','execute') or has_table_privilege('authenticated','league_roster_private.teams','insert') then raise exception 'Excessive privilege'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from tm_fixture;
set local role authenticated;
do $$ begin
  begin perform public.get_league_team_manager('current',null); raise exception 'Outsider read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_league_team_lineup('next',null,null,'Forbidden','{}','[]',''); raise exception 'Outsider write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'team_management_workflow_rollback_tests_passed' as result;
