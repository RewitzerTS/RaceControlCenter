-- Synthetic Staging-only regression. All fixture data and effects are rolled back.
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f7600000-0000-4000-8000-000000000001','authenticated','authenticated','steward-simple@example.invalid','{}','{}',now(),now()),
 ('f7600000-0000-4000-8000-000000000002','authenticated','authenticated','driver-simple@example.invalid','{}','{}',now(),now());
insert into public.driver_identities(user_id,status) values
 ('f7600000-0000-4000-8000-000000000001','active'),('f7600000-0000-4000-8000-000000000002','active');
insert into public.leagues(id,name,slug,is_public,settings) values
 ('f7610000-0000-4000-8000-000000000001','Synthetic Steward Regression','synthetic-steward-regression',true,'{"published":true}'),
 ('f7610000-0000-4000-8000-000000000002','Synthetic Other League','synthetic-other-regression',true,'{"published":true}');
insert into public.league_members(league_id,user_id,role) values
 ('f7610000-0000-4000-8000-000000000001','f7600000-0000-4000-8000-000000000001','league_admin'),
 ('f7610000-0000-4000-8000-000000000001','f7600000-0000-4000-8000-000000000002','driver');
insert into public.seasons(id,league_id,slug,name,is_active) values
 ('f7620000-0000-4000-8000-000000000001','f7610000-0000-4000-8000-000000000001','synthetic-season','Synthetic Season',true);
-- Season creation seeds a preset calendar. Replace only this transaction's fixture calendar.
delete from public.races where season_id='f7620000-0000-4000-8000-000000000001';
insert into public.races(id,season_id,round_number,grand_prix_name,race_date,race_start_at,status) values
 ('f7630000-0000-4000-8000-000000000001','f7620000-0000-4000-8000-000000000001',1,'Synthetic Race One',current_date-1,now()-interval '1 day','upcoming'),
 ('f7630000-0000-4000-8000-000000000002','f7620000-0000-4000-8000-000000000001',2,'Synthetic Next Race',current_date+7,now()+interval '7 days','upcoming'),
 ('f7630000-0000-4000-8000-000000000003','f7620000-0000-4000-8000-000000000001',3,'Synthetic Pending Race',current_date-1,now()-interval '1 day','upcoming');
insert into public.drivers(id,league_id,display_name) values
 ('f7640000-0000-4000-8000-000000000001','f7610000-0000-4000-8000-000000000001','Synthetic Alpha'),
 ('f7640000-0000-4000-8000-000000000002','f7610000-0000-4000-8000-000000000001','Synthetic Beta'),
 ('f7640000-0000-4000-8000-000000000003','f7610000-0000-4000-8000-000000000001','Synthetic Lapped'),
 ('f7640000-0000-4000-8000-000000000004','f7610000-0000-4000-8000-000000000002','Synthetic Outsider');
select set_config('request.headers','{"x-rcc-league-slug":"synthetic-steward-regression"}',true);
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.seasons set fastest_lap_bonus_enabled=true,fastest_lap_bonus_points=2,fastest_lap_bonus_max_finish_position=1 where id='f7620000-0000-4000-8000-000000000001';
do $$ declare v uuid; begin
  v:=private.create_result_version('f7630000-0000-4000-8000-000000000001','Synthetic baseline');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
   (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
   (v,2,'f7640000-0000-4000-8000-000000000002',2,'+3.000',18,18),
   (v,3,'f7640000-0000-4000-8000-000000000003',3,'+1 lap',15,15);
  update public.result_version_rows set fastest_lap_time_ms=40000 where result_version_id=v and driver_id='f7640000-0000-4000-8000-000000000002';
  perform private.validate_result_version(v); perform private.activate_result_version(v);
end $$;


insert into public.drivers(id,league_id,display_name) values
 ('f7640000-0000-4000-8000-000000000005','f7610000-0000-4000-8000-000000000001','Synthetic Delta');
set local role authenticated;
do $test$
declare
  race uuid:='f7630000-0000-4000-8000-000000000001';
  alpha uuid:='f7640000-0000-4000-8000-000000000001';
  beta uuid:='f7640000-0000-4000-8000-000000000002';
  gamma uuid:='f7640000-0000-4000-8000-000000000003';
  outsider uuid:='f7640000-0000-4000-8000-000000000004';
  delta uuid:='f7640000-0000-4000-8000-000000000005';
  reporters uuid[]; accused uuid[]; decisions jsonb;
  response jsonb; repeated jsonb; current_id uuid; baseline uuid; group_id uuid; draft_id uuid;
  before_versions integer; before_cases integer; before_events integer; unrelated uuid;
begin
  reporters:=array[alpha,beta]; accused:=array[alpha,beta,gamma,delta];
  decisions:=jsonb_build_array(
    jsonb_build_object('driver_id',alpha,'penalty_type','time_penalty','amount',5,'reasoning','Five seconds for Alpha.'),
    jsonb_build_object('driver_id',beta,'penalty_type','time_credit','amount',2,'reasoning','Two seconds credited to Beta.'),
    jsonb_build_object('driver_id',gamma,'penalty_type','grid_penalty','amount',3,'target_race_id','f7630000-0000-4000-8000-000000000002','reasoning','Three places back for Gamma.'),
    jsonb_build_object('driver_id',delta,'penalty_type','no_action','reasoning','No further action for Delta.')
  );
  select current_result_version_id into baseline from public.races where id=race;
  select count(*) into before_versions from public.result_versions;
  response:=public.save_steward_group_case(race,reporters,accused,'Group incident','Four drivers reviewed together.',decisions,false,null,'group-regression-mixed');
  group_id:=(response->>'case_id')::uuid;
  repeated:=public.save_steward_group_case(race,reporters,accused,'Group incident','Four drivers reviewed together.',decisions,false,null,'group-regression-mixed');
  if response<>repeated then raise exception 'Retry not idempotent'; end if;
  if (select count(*) from public.result_versions)<>before_versions+1 then raise exception 'Time corrections not batched into one revision'; end if;
  if (select count(*) from public.steward_case_participants where case_id=group_id)<>6 then raise exception 'Participants lost'; end if;
  if (select count(*) from public.steward_driver_decisions where decision_version_id=(response->>'id')::uuid)<>4 then raise exception 'Individual decisions lost'; end if;
  if (select count(*) from public.steward_penalty_applications a join public.steward_penalties p on p.id=a.penalty_id where p.decision_version_id=(response->>'id')::uuid)<>2 then raise exception 'Incorrect application receipts'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>5000
    or (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=beta)<>-2000
    or (select finish_position from public.race_results where race_id=race and driver_id=beta)<>1
    or (select awarded_points from public.race_results where race_id=race and driver_id=beta)<>27
    or (select awarded_points from public.race_results where race_id=race and driver_id=alpha)<>18 then
    raise exception 'Mixed corrections, order or fastest lap points incorrect';
  end if;
  begin
    perform public.save_steward_group_case(race,reporters,accused,'Changed title','Four drivers reviewed together.',decisions,false,null,'group-regression-mixed');
    raise exception 'TEST: mismatched retry accepted';
  exception when others then if sqlerrm<>'Idempotency key belongs to another request.' then raise; end if; end;
  begin
    perform public.save_steward_group_case(race,reporters,accused,'Duplicate decision','Four drivers reviewed together.',jsonb_set(decisions,'{1,driver_id}',to_jsonb(alpha)),false,null,'group-duplicate-decision');
    raise exception 'TEST: duplicate decision accepted';
  exception when others then if sqlerrm<>'Provide exactly one decision per accused driver.' then raise; end if; end;
  begin
    perform public.save_steward_group_case(race,array[outsider],accused,'Outsider reporter','Foreign league must not be accepted.',decisions,false,null,'group-foreign-driver');
    raise exception 'TEST: outsider accepted';
  exception when others then if sqlerrm<>'Select drivers from this league.' then raise; end if; end;
  select count(*) into before_versions from public.result_versions;
  select count(*) into before_cases from public.steward_cases;
  select count(*) into before_events from public.domain_events;
  begin
    perform public.save_steward_group_case(race,reporters,accused,'Invalid group','One impossible credit must abort all.',jsonb_set(decisions,'{1,amount}','1000'),false,null,'group-negative-credit');
    raise exception 'TEST: impossible credit accepted';
  exception when others then if sqlerrm not ilike '%negative%' then raise; end if; end;
  if (select count(*) from public.result_versions)<>before_versions or (select count(*) from public.steward_cases)<>before_cases
    or (select count(*) from public.domain_events)<>before_events then raise exception 'Failed group left partial effects'; end if;

  unrelated:=(public.record_steward_decision(race,alpha,alpha,'Unrelated penalty','Retain separate one second penalty.','time_penalty',1,null,null,'group-unrelated')->>'case_id')::uuid;
  select current_result_version_id into current_id from public.races where id=race;
  perform public.delete_steward_case(group_id,'Withdraw the complete group case.',1,current_id);
  if exists(select 1 from public.steward_case_participants where case_id=group_id)
    or exists(select 1 from public.steward_driver_decisions where decision_version_id=(response->>'id')::uuid)
    or exists(select 1 from public.steward_penalties where decision_version_id=(response->>'id')::uuid) then raise exception 'Withdrawn group remains visible'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>1000
    or (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=beta)<>0
    or (select awarded_points from public.race_results where race_id=race and driver_id=alpha)<>25
    or (select awarded_points from public.race_results where race_id=race and driver_id=beta)<>18 then raise exception 'Group withdrawal lost unrelated penalty or points'; end if;

  response:=public.save_steward_group_case(race,reporters,array[alpha,beta],'Open group draft','Participants retained without a decision.','[]',true,null,'group-open-draft');
  draft_id:=(response->>'case_id')::uuid;
  if (select count(*) from public.steward_case_participants where case_id=draft_id)<>4 then raise exception 'Draft participants lost'; end if;
  begin
    perform public.record_steward_decision(race,alpha,alpha,'Open group draft','Old client must not close only one driver.','no_action',null,null,draft_id,'group-legacy-rejected');
    raise exception 'TEST: legacy partial closure accepted';
  exception when others then if sqlerrm<>'Use the multi-driver case workflow.' then raise; end if; end;
  decisions:=jsonb_build_array(
    jsonb_build_object('driver_id',alpha,'penalty_type','no_action','reasoning','Alpha is not responsible.'),
    jsonb_build_object('driver_id',beta,'penalty_type','no_action','reasoning','Beta is not responsible.')
  );
  select current_result_version_id into current_id from public.races where id=race;
  perform public.save_steward_group_case(race,reporters,array[alpha,beta],'Open group draft','Participants retained without a decision.',decisions,false,draft_id,'group-resolve-draft');
  if (select current_result_version_id from public.races where id=race)<>current_id then raise exception 'No action changed result'; end if;
  begin
    perform public.save_steward_group_case(race,reporters,array[alpha,beta],'Open group draft','Participants retained without a decision.',decisions,false,draft_id,'group-resolve-again');
    raise exception 'TEST: closed case changed';
  exception when others then if sqlerrm<>'The open case changed. Reload before publishing.' then raise; end if; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-other-regression"}',true);
  begin
    perform public.save_steward_group_case(race,reporters,array[alpha,beta],'Tenant mismatch','No write in another tenant.','[]',true,null,'group-cross-tenant');
    raise exception 'TEST: wrong tenant accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-steward-regression"}',true);
end $test$;
reset role;

-- Deferred mixed corrections: publication and re-publication apply each exactly once.
do $test$
declare
  race uuid:='f7630000-0000-4000-8000-000000000003';
  alpha uuid:='f7640000-0000-4000-8000-000000000001'; beta uuid:='f7640000-0000-4000-8000-000000000002';
  response jsonb; published jsonb; v uuid; n integer;
begin
  response:=public.save_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Deferred group','Apply both corrections at publication.',
    jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','time_penalty','amount',5,'reasoning','Alpha receives five seconds.'),
    jsonb_build_object('driver_id',beta,'penalty_type','time_credit','amount',2,'reasoning','Beta receives two seconds credit.')),false,null,'group-deferred');
  if response->>'result_version_id' is not null then raise exception 'Deferred case changed nonexistent result'; end if;
  v:=private.create_result_version(race,'Deferred baseline');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
    (v,1,alpha,1,'1:40.000',25,25),(v,2,beta,2,'+3.000',18,18);
  perform private.validate_result_version(v);
  published:=public.publish_league_result_draft(v);
  select count(*) into n from public.steward_penalty_applications where result_version_id=(published->>'id')::uuid;
  if n<>2 then raise exception 'Deferred application receipts missing'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>5000
    or (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=beta)<>-2000 then raise exception 'Deferred multi-driver effects missing'; end if;
  perform public.publish_league_result_draft(v);
  if (select count(*) from public.steward_penalty_applications where result_version_id=(published->>'id')::uuid)<>n then raise exception 'Deferred correction duplicated'; end if;
  perform public.delete_steward_case((response->>'case_id')::uuid,'Withdraw after deferred publication.',1,(published->>'id')::uuid);
  if exists(select 1 from public.race_results where race_id=race and penalty_time_delta_ms<>0) then raise exception 'Deferred group withdrawal failed'; end if;
end $test$;

select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.save_steward_group_case('f7630000-0000-4000-8000-000000000001',array['f7640000-0000-4000-8000-000000000001'::uuid],
      array['f7640000-0000-4000-8000-000000000001'::uuid],'Unauthorized driver','Driver cannot create steward decisions.','[]',true,null,'group-driver-reject');
    raise exception 'TEST: non-steward accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.save_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text)','execute')
    or has_function_privilege('authenticated','private.save_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text)','execute')
    or has_table_privilege('authenticated','public.steward_case_participants','insert')
    or has_table_privilege('authenticated','public.steward_driver_decisions','insert') then raise exception 'Privileges too broad'; end if;
end $$;
select 'PASS: mixed decisions, atomic result correction, no-action, draft, exactly-once publication, withdrawal, authorization and retry checks' as result;
rollback;
