-- Synthetic, transactionally rolled-back tests. No existing league is changed.
begin;
create temporary table de_fixture as select gen_random_uuid() actor,gen_random_uuid() outsider,gen_random_uuid() lid,
  gen_random_uuid() d1,gen_random_uuid() d2,null::uuid sid,null::uuid ai1,null::uuid ai2,null::jsonb before_result;
grant select,update on de_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select actor,'authenticated','authenticated',actor||'@driver-editor.invalid','{}'::jsonb,'{}'::jsonb from de_fixture
union all select outsider,'authenticated','authenticated',outsider||'@driver-editor.invalid','{}'::jsonb,'{}'::jsonb from de_fixture;
insert into public.leagues(id,name,slug,is_public,settings) select lid,'Synthetic editor','de-'||lid,false,'{}' from de_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag) select actor,'active','Editor admin','Personal' from de_fixture;
insert into public.league_members(league_id,user_id,role) select lid,actor,'league_admin' from de_fixture;
insert into public.drivers(id,league_id,display_name,gamertag,number,is_active,league_team)
select d1,lid,'Driver One','MainOne',77,true,'Hobbyracer' from de_fixture union all select d2,lid,'Driver Two','MainTwo',88,true,'Hobbyracer' from de_fixture;
insert into public.driver_claims(driver_id,claimant_user_id,verification_method,status,resolved_at,resolved_by)
select d1,actor,'admin_verified','verified',now(),actor from de_fixture;
insert into public.driver_identity_links(driver_id,driver_identity_id,claim_id)
select f.d1,i.id,c.id from de_fixture f join public.driver_identities i on i.user_id=f.actor join public.driver_claims c on c.driver_id=f.d1;
insert into public.driver_aliases(driver_identity_id,alias,alias_type,platform)
select i.id,'PersonalPS','gamertag','playstation' from de_fixture f join public.driver_identities i on i.user_id=f.actor;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','de-'||lid)::text,true) from de_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from de_fixture;
set local role authenticated;
do $$ declare f record; state jsonb; result jsonb; profile jsonb; calendar jsonb; begin
  select * into f from de_fixture;
  calendar:=jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false),
    jsonb_build_object('track_key','monaco','date',current_date+7,'time','20:00','weather','klar','has_sprint',false));
  result:=public.start_league_season_setup('Editor test','editor-test','f1_25',current_date,calendar,false);
  update de_fixture set sid=(result->'season'->>'id')::uuid;
  if (result->>'players')::integer<>0 or (result->>'ai_drivers')::integer<>20 then raise exception 'F1 25 grid must initially be AI only'; end if;
  state:=public.get_league_driver_editor(f.d1);
  profile:=jsonb_build_object('display_name','Driver One Edited','gamertag','MainOne','nationality_code','DE','is_active',true);
  begin perform public.save_league_driver_editor(f.d1,profile||'{"number":99}','[]',null,null,state->>'revision'); raise exception 'Number write accepted'; exception when invalid_parameter_value then null; end;
  state:=public.save_league_driver_editor(f.d1,profile,'[{"alias":"SameName","platform":"ea"},{"alias":"SameName","platform":"steam"}]',null,null,state->>'revision');
  if (state->'driver'->>'number')::integer<>77 then raise exception 'Number changed'; end if;
  if jsonb_array_length(state->'gamertags'->'aliases')<3 then raise exception 'Aliases lost'; end if;
  begin perform public.save_league_driver_editor(f.d1,profile,'[]',null,null,'stale'); raise exception 'Stale write accepted'; exception when serialization_failure then null; end;
  begin perform public.get_league_driver_editor(gen_random_uuid()); raise exception 'Foreign read accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare f record; state jsonb; profile jsonb; ai uuid; ai_other uuid; rid uuid; ver uuid; begin
  select * into f from de_fixture;
  if (select count(*) from public.season_driver_assignments where season_id=f.sid and participant_type='BOT')<>20 then raise exception 'Initial grid not 20 AI'; end if;
  if exists(select 1 from private.season_driver_ai_assignments where season_id=f.sid) then raise exception 'Implicit human seating'; end if;
  if (select count(*) from public.drivers where id in (f.d1,f.d2) and is_active)<>2 then raise exception 'Directory profiles deactivated'; end if;
  select id into ai from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:mercedes-russell';
  select id into ai_other from public.drivers where league_id=f.lid and ai_driver_reference='f1_25:red-bull-verstappen';
  update de_fixture set ai1=ai,ai2=ai_other;
  state:=public.get_league_driver_editor(f.d1);
  profile:=jsonb_build_object('display_name','Driver One Edited','gamertag','MainOne','nationality_code','DE','is_active',true);
  begin perform public.save_league_driver_editor(f.d1,profile,'[]',ai,null,state->>'revision'); raise exception 'Implicit round accepted'; exception when invalid_parameter_value then null; end;
  state:=public.save_league_driver_editor(f.d1,profile,'[{"alias":"SameName","platform":"ea"}]',ai,1,state->>'revision');
  if state->'driver'->>'league_team'<>'Hobbyracer' then raise exception 'AI overwrote independent team'; end if;
  if (state->'driver'->>'number')::integer<>63 then raise exception 'Seat number not derived'; end if;
  if not exists(select 1 from public.season_driver_assignments where season_id=f.sid and driver_id=f.d1 and participant_type='PLAYER' and seat_code='mercedes-russell') then raise exception 'Grid missing human'; end if;
  if not exists(select 1 from public.driver_aliases where alias='PersonalPS' and driver_identity_id=(select id from public.driver_identities where user_id=f.actor)) then raise exception 'Personal alias modified'; end if;
  state:=public.get_league_driver_editor(f.d2);
  begin perform public.save_league_driver_editor(f.d2,profile||'{"display_name":"Must rollback","gamertag":"Rollback"}','[{"alias":"MustRollback","platform":"xbox"}]',ai,1,state->>'revision'); raise exception 'Occupied seat accepted'; exception when unique_violation then null; end;
  if (select display_name from public.drivers where id=f.d2)<>'Driver Two' or exists(select 1 from public.driver_aliases where driver_id=f.d2) then raise exception 'Atomic save failed'; end if;
  select id into rid from public.races where season_id=f.sid and round_number=1;
  ver:=(public.create_league_result_draft(rid,jsonb_build_array(jsonb_build_object('driver_id',f.d1,'points',25,'finish_position',1)),'Editor test')->>'id')::uuid;
  perform public.publish_league_result_draft(ver);
  update de_fixture set before_result=(select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d1);
  state:=public.get_league_driver_editor(f.d1);
  begin perform public.save_league_driver_editor(f.d1,profile,'[]',ai_other,1,state->>'revision'); raise exception 'Locked race changed'; exception when invalid_parameter_value then null; end;
  perform public.save_league_driver_editor(f.d1,profile,'[]',ai_other,2,state->>'revision');
  if (select to_jsonb(r) from public.race_results r where r.race_id=rid and r.driver_id=f.d1) is distinct from (select before_result from de_fixture) then raise exception 'Historical result changed'; end if;
  if has_function_privilege('anon','public.save_league_driver_editor(uuid,jsonb,jsonb,uuid,integer,text)','execute') then raise exception 'Anonymous access'; end if;
  update public.seasons set is_active=false where id=f.sid;
  state:=public.start_league_season_setup('Editor F1 26','editor-f1-26','f1_26',current_date,
    jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false)),false);
  if (state->>'ai_drivers')::integer<>22 or (state->>'players')::integer<>0 then raise exception 'F1 26 initial grid incorrect'; end if;
  -- Season seeding reuses AI profile IDs and updates their game reference.
  -- Make this synthetic profile explicitly belong to the other game.
  update public.drivers set ai_driver_reference='f1_25:wrong-game-test' where id=ai and league_id=f.lid;
  state:=public.get_league_driver_editor(f.d1);
  begin perform public.save_league_driver_editor(f.d1,profile,'[]',ai,1,state->>'revision'); raise exception 'Wrong game accepted'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from de_fixture;
set local role authenticated;
do $$ declare f record; begin
  select * into f from de_fixture;
  begin perform public.get_league_driver_editor(f.d1); raise exception 'Outsider read'; exception when insufficient_privilege then null; end;
  begin perform public.save_league_driver_editor(f.d1,'{}','[]',null,null,''); raise exception 'Outsider write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'unified_driver_editor_rollback_tests_passed' as result;
rollback;
