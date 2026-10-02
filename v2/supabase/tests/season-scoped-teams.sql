-- Isolated synthetic fixtures. No existing league, result or XP is modified.
begin;
create temporary table st_fixture as select gen_random_uuid() actor,gen_random_uuid() outsider,gen_random_uuid() lid,
  gen_random_uuid() d1,gen_random_uuid() d2,gen_random_uuid() d3,gen_random_uuid() d4,
  null::uuid sid,null::jsonb result_before;
grant select,update on st_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select actor,'authenticated','authenticated',actor||'@season-team.invalid','{}'::jsonb,'{}'::jsonb from st_fixture
union all select outsider,'authenticated','authenticated',outsider||'@season-team.invalid','{}'::jsonb,'{}'::jsonb from st_fixture;
insert into public.leagues(id,name,slug,is_public,settings) select lid,'Synthetic seasonal teams','st-'||lid,false,'{}' from st_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag) select actor,'active','Synthetic Admin','AdminTag' from st_fixture;
insert into public.league_members(league_id,user_id,role) select lid,actor,'league_admin' from st_fixture;
insert into public.drivers(id,league_id,display_name,gamertag,is_active,league_team,car_name)
select d1,lid,'Test A','TagA',true,'Old season team','Old car' from st_fixture
union all select d2,lid,'Test B','TagB',true,'Old season team','Old car' from st_fixture
union all select d3,lid,'Test C','TagC',true,'Old season team','Old car' from st_fixture
union all select d4,lid,'Test D','TagD',true,'Old season team','Old car' from st_fixture;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','st-'||lid)::text,true) from st_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from st_fixture;
set local role authenticated;
do $$ declare f record; state jsonb; result jsonb; cal jsonb; ai1 uuid; ai2 uuid; ai3 uuid; ai4 uuid; tid uuid; rid uuid; vid uuid; rev text; begin
  select * into f from st_fixture;
  begin perform public.get_league_team_manager('next',null); raise exception 'Next season option still accepted'; exception when invalid_parameter_value then null; end;
  cal:=jsonb_build_array(
    jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false),
    jsonb_build_object('track_key','monaco','date',current_date+7,'time','20:00','weather','klar','has_sprint',false),
    jsonb_build_object('track_key','belgium','date',current_date+14,'time','20:00','weather','klar','has_sprint',false));
  result:=public.start_league_season_setup('Season one','season-one','f1_25',current_date,cal,false);
  update st_fixture set sid=(result->'season'->>'id')::uuid;
  select * into f from st_fixture;
  state:=public.get_league_team_manager('current',1);
  if jsonb_array_length(state->'teams')<>0 or exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'team_name' is not null) then raise exception 'Previous season teams leaked'; end if;
  if (select count(*) from jsonb_array_elements(state->'profiles') p where (p->>'is_ai')::boolean)<>20 then raise exception 'F1 25 must expose 20 free AI'; end if;
  select id into ai1 from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:mercedes-russell';
  select id into ai2 from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:red-bull-verstappen';
  select id into ai3 from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:ferrari-leclerc';
  select id into ai4 from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:mercedes-antonelli';
  -- Claim a teamless seat, then form a mixed human/AI team.
  perform public.save_league_driver_editor(f.d1,jsonb_build_object('display_name','Test A','gamertag','TagA','is_active',true),'[]',ai1,1,public.get_league_driver_editor(f.d1)->>'revision');
  state:=public.get_league_team_manager('current',1); rev:=state->>'revision';
  state:=public.save_league_team_lineup('current',1,null,'Alpha',array[f.d1,ai2],'[]',rev);
  if exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=ai1::text) then raise exception 'Linked AI counted twice'; end if;
  if (select count(*) from jsonb_array_elements(state->'profiles') p where p->>'team_name'='Alpha')<>2 then raise exception 'Mixed team missing'; end if;
  begin perform public.save_league_team_lineup('current',null,null,'Invalid',array[ai3],'[]',state->>'revision'); raise exception 'Implicit round allowed'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',1,null,'Invalid',array[f.d1,ai2,ai3],'[]',state->>'revision'); raise exception 'Three slots accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',1,null,'Invalid',array[ai1],'[]',state->>'revision'); raise exception 'Linked AI selectable'; exception when invalid_parameter_value then null; end;
  begin perform public.save_league_team_lineup('current',1,null,'Stale',array[ai3],'[]',rev); raise exception 'Stale state accepted'; exception when serialization_failure then null; end;
  -- No-team human takes over AI's team place, not an additional third place.
  perform public.save_league_driver_editor(f.d2,jsonb_build_object('display_name','Test B','gamertag','TagB','is_active',true),'[]',ai2,1,public.get_league_driver_editor(f.d2)->>'revision');
  state:=public.get_league_team_manager('current',1);
  if not exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=f.d2::text and p->>'team_name'='Alpha' and p->>'ai_driver_id'=ai2::text) then raise exception 'Team place not inherited'; end if;
  if (select count(*) from jsonb_array_elements(state->'profiles') p where p->>'team_name'='Alpha')<>2 then raise exception 'Inherited seat double counted'; end if;
  state:=public.save_league_team_lineup('current',1,null,'Beta',array[ai3,ai4],'[]',state->>'revision');
  -- Public vehicle RPC cannot bypass capacity.
  begin
    perform public.change_season_vehicle(ai3,1,'Alpha','Ferrari SF-25',null);
    set constraints all immediate;
    raise exception 'Direct third member accepted';
  exception when invalid_parameter_value then null; end;
  set constraints all deferred;
  -- Publish one historical result before later switches.
  select id into rid from public.races where season_id=f.sid and round_number=1;
  vid:=(public.create_league_result_draft(rid,jsonb_build_array(jsonb_build_object('driver_id',f.d1,'finish_position',1,'points',25)),'Season teams regression')->>'id')::uuid;
  perform public.publish_league_result_draft(vid);
  update st_fixture set result_before=(select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d1);
  state:=public.get_league_team_manager('current',2);
  begin perform public.save_league_team_lineup('current',1,'Alpha','Changed',array[f.d1,f.d2],'[]',state->>'revision'); raise exception 'Published race changed'; exception when invalid_parameter_value then null; end;
  -- Full-team swap is one transaction and keeps cars independent.
  state:=public.save_league_team_lineup('current',2,'Alpha','Alpha',array[f.d1,ai3],
    jsonb_build_array(jsonb_build_object('driver_id',f.d2,'team_name','Beta')),state->>'revision');
  if not exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=ai3::text and p->>'team_name'='Alpha') then raise exception 'AI swap failed'; end if;
  -- Human already in Beta claims AI now in Alpha; keeps Beta and vacates old AI seat.
  perform public.save_league_driver_editor(f.d2,jsonb_build_object('display_name','Test B','gamertag','TagB','is_active',true),'[]',ai3,2,public.get_league_driver_editor(f.d2)->>'revision');
  state:=public.get_league_team_manager('current',2);
  if not exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=f.d2::text and p->>'team_name'='Beta') then raise exception 'Existing human team overwritten'; end if;
  if (select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d1) is distinct from (select result_before from st_fixture) then raise exception 'Historical result changed'; end if;
  -- A future third arrival is rejected even when the earlier view has room.
  state:=public.get_league_team_manager('current',3);
  state:=public.save_league_team_lineup('current',3,null,'Future',array[ai4],'[]',state->>'revision');
  state:=public.get_league_team_manager('current',2);
  begin
    perform public.save_league_team_lineup('current',2,'Future','Future',array[f.d1,f.d2],'[]',state->>'revision');
    raise exception 'Future third member accepted';
  exception when invalid_parameter_value then null; end;
  set constraints all immediate;
  set constraints all deferred;
  -- Claiming an AI must not silently discard that AI's already scheduled team move.
  begin
    perform public.save_league_driver_editor(f.d3,jsonb_build_object('display_name','Test C','gamertag','TagC','is_active',true),'[]',ai4,2,public.get_league_driver_editor(f.d3)->>'revision');
    raise exception 'Scheduled AI move discarded';
  exception when invalid_parameter_value then
    if sqlerrm<>'ROSTER_LATER_CHANGE_EXISTS' then raise; end if;
  end;
  -- A team change must not conflict with an already scheduled future human claim.
  select (p->>'id')::uuid into ai4 from jsonb_array_elements(public.get_league_team_manager('current',3)->'profiles') p
    where (p->>'is_ai')::boolean and p->>'team_name' is null limit 1;
  perform public.save_league_driver_editor(f.d3,jsonb_build_object('display_name','Test C','gamertag','TagC','is_active',true),'[]',ai4,3,public.get_league_driver_editor(f.d3)->>'revision');
  begin
    perform public.change_season_vehicle(ai4,2,'Delayed','Test car',null);
    raise exception 'Scheduled human claim ignored';
  exception when invalid_parameter_value then
    if sqlerrm<>'ROSTER_LATER_CHANGE_EXISTS' then raise; end if;
  end;
  -- A fresh F1 26 season must not inherit teams from F1 25.
  result:=public.start_league_season_setup('Season two','season-two','f1_26',current_date+21,cal,false);
  state:=public.get_league_team_manager('current',1);
  if jsonb_array_length(state->'teams')<>0 or exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'team_name' is not null) then raise exception 'New season inherited team assignments'; end if;
  if (select count(*) from jsonb_array_elements(state->'profiles') p where (p->>'is_ai')::boolean)<>22 then raise exception 'F1 26 must expose 22 free AI'; end if;
  if exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=f.d1::text and (p->>'car_name' is not null or p->>'ai_driver_id' is not null)) then raise exception 'New season inherited human seat'; end if;
  if (select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d1) is distinct from (select result_before from st_fixture) then raise exception 'Season start changed previous result'; end if;
  set constraints all immediate;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from st_fixture;
set local role authenticated;
do $$ begin
  begin perform public.get_league_team_manager('current',null); raise exception 'Outsider read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_league_team_lineup('current',1,null,'Forbidden','{}','[]',''); raise exception 'Outsider write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'season_scoped_teams_rollback_tests_passed' result;
rollback;
