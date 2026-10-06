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
do $$ declare v uuid; begin
  v:=private.create_result_version('f7630000-0000-4000-8000-000000000001','Synthetic baseline');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
   (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
   (v,2,'f7640000-0000-4000-8000-000000000002',2,'+3.000',18,18),
   (v,3,'f7640000-0000-4000-8000-000000000003',3,'+1 lap',15,15);
  perform private.validate_result_version(v); perform private.activate_result_version(v);
end $$;
set local role authenticated;
do $$
declare response jsonb; replay jsonb; before_id uuid; v uuid; count_before integer;
begin
  select current_result_version_id into before_id from public.races where id='f7630000-0000-4000-8000-000000000001';
  response:=public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Synthetic penalty','Five seconds after external discussion.','time_penalty',5,null,null,'synthetic-direct-penalty');
  if (select count(*) from public.steward_votes)<>0 then raise exception 'Unexpected voting requirement'; end if;
  if (select finish_position from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000001')<>2 then raise exception 'Penalty did not change position'; end if;
  if (select awarded_points from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000001')<>18 then raise exception 'Penalty did not rescore accused'; end if;
  if (select awarded_points from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000002')<>25 then raise exception 'Penalty did not rescore promoted driver'; end if;
  if (select status from public.result_versions where id=before_id)<>'superseded' then raise exception 'Previous result not retained'; end if;
  replay:=public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Synthetic penalty','Five seconds after external discussion.','time_penalty',5,null,null,'synthetic-direct-penalty');
  if replay<>response then raise exception 'Replay was not idempotent'; end if;
  perform public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Synthetic credit','Four seconds credited after external discussion.','time_credit',4,null,null,'synthetic-direct-credit');
  if (select finish_position from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000001')<>1 then raise exception 'Credit did not change position'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000001')<>1000 then raise exception 'Cumulative correction wrong'; end if;
  if (select finish_position from public.race_results where race_id='f7630000-0000-4000-8000-000000000001' and driver_id='f7640000-0000-4000-8000-000000000003')<>3 then raise exception 'Lap deficit was interpreted as seconds'; end if;
  select current_result_version_id into before_id from public.races where id='f7630000-0000-4000-8000-000000000001';
  perform public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Synthetic grid','Three places back in the next race.','grid_penalty',3,'f7630000-0000-4000-8000-000000000002',null,'synthetic-grid-penalty');
  if (select current_result_version_id from public.races where id='f7630000-0000-4000-8000-000000000001')<>before_id then raise exception 'Grid penalty changed past result'; end if;
  if not exists(select 1 from public.steward_penalties where target_race_id='f7630000-0000-4000-8000-000000000002' and grid_positions=3) then raise exception 'Grid target missing'; end if;
  select count(*) into count_before from public.steward_cases;
  begin
    perform public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
      'Negative time','This credit must be rejected completely.','time_credit',1000,null,null,'synthetic-negative-time');
    raise exception 'TEST: negative race time accepted';
  exception when others then if sqlerrm like 'TEST:%' then raise; end if; end;
  if (select count(*) from public.steward_cases)<>count_before then raise exception 'Failed correction left a partial case'; end if;
  begin
    perform public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000004',
      'Cross league','This must not be accepted across leagues.','time_penalty',5,null,null,'synthetic-cross-league');
    raise exception 'TEST: cross league accepted';
  exception when others then if sqlerrm like 'TEST:%' then raise; end if; end;
  response:=public.record_steward_decision('f7630000-0000-4000-8000-000000000003','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Pending correction','Apply these eight seconds at result publication.','time_penalty',8,null,null,'synthetic-pending-penalty');
  if response->>'result_version_id' is not null then raise exception 'Pending penalty created a fake result'; end if;
  if exists(select 1 from public.race_results where race_id='f7630000-0000-4000-8000-000000000003') then raise exception 'Pending penalty published a result'; end if;
  perform public.record_steward_decision('f7630000-0000-4000-8000-000000000003','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
    'Pending credit','Apply this three second credit together with the penalty.','time_credit',3,null,null,'synthetic-pending-credit');
end $$;
reset role;
-- An incomplete validated import must stay unpublished, with both corrections pending.
do $$ declare v uuid; begin
  v:=private.create_result_version('f7630000-0000-4000-8000-000000000003','Synthetic incomplete result');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
   (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
   (v,2,'f7640000-0000-4000-8000-000000000002',2,null,18,18);
  perform private.validate_result_version(v);
  perform set_config('racevora.test_bad_draft_id',v::text,true);
end $$;
set local role authenticated;
do $$ declare before_count integer; begin
  select count(*) into before_count from public.steward_penalty_applications;
  begin
    perform public.publish_league_result_draft(current_setting('racevora.test_bad_draft_id')::uuid);
    raise exception 'TEST: incomplete times published';
  exception when others then
    if sqlerrm not like 'Complete the race times%' then raise; end if;
  end;
  if exists(select 1 from public.race_results where race_id='f7630000-0000-4000-8000-000000000003')
    or (select current_result_version_id from public.races where id='f7630000-0000-4000-8000-000000000003') is not null
    or (select count(*) from public.steward_penalty_applications)<>before_count then
    raise exception 'Incomplete publication left partial effects';
  end if;
end $$;
reset role;
update public.seasons set fastest_lap_bonus_enabled=true,fastest_lap_bonus_points=2,fastest_lap_bonus_max_finish_position=1
where id='f7620000-0000-4000-8000-000000000001';
do $$ declare v uuid; begin
  v:=private.create_result_version('f7630000-0000-4000-8000-000000000003','Synthetic pending result');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
   (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
   (v,2,'f7640000-0000-4000-8000-000000000002',2,'+3.000',18,18);
  update public.result_version_rows set fastest_lap_time_ms=40000 where result_version_id=v and driver_id='f7640000-0000-4000-8000-000000000002';
  perform private.validate_result_version(v);
  perform set_config('racevora.test_draft_id',v::text,true);
end $$;
set local role authenticated;
do $$ declare v uuid; response jsonb; replay jsonb; begin
  v:=current_setting('racevora.test_draft_id')::uuid;
  response:=public.publish_league_result_draft(v);
  replay:=public.publish_league_result_draft(v);
  if replay<>response then raise exception 'Publication replay was not idempotent'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id='f7630000-0000-4000-8000-000000000003' and driver_id='f7640000-0000-4000-8000-000000000001')<>5000 then raise exception 'Deferred correction missing or duplicated'; end if;
  if (select awarded_points from public.race_results where race_id='f7630000-0000-4000-8000-000000000003' and driver_id='f7640000-0000-4000-8000-000000000001')<>18 then raise exception 'Deferred points incorrect'; end if;
  if (select count(*) from public.steward_penalty_applications where result_version_id=(response->>'id')::uuid)<>2 then raise exception 'Deferred application receipts missing'; end if;
  if (select awarded_points from public.race_results where race_id='f7630000-0000-4000-8000-000000000003' and driver_id='f7640000-0000-4000-8000-000000000002')<>27 then raise exception 'Fastest lap bonus not recalculated at boundary'; end if;
  if exists(select 1 from jsonb_array_elements(public.get_league_configuration_workspace()->'result_drafts') item where item->>'id'=v::text) then raise exception 'Consumed source draft remains in workspace'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7640000-0000-4000-8000-000000000001',
      'Unauthorized penalty','A regular driver cannot publish a sanction.','time_penalty',5,null,null,'synthetic-driver-denied');
    raise exception 'TEST: regular driver finalized a sanction';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'simplified steward regression passed' as result;
rollback;
select count(*) as leftover_fixture_leagues from public.leagues where id in ('f7610000-0000-4000-8000-000000000001','f7610000-0000-4000-8000-000000000002');
