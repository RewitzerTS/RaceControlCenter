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

set local role authenticated;
do $test$
declare
  v_race_id uuid:='f7630000-0000-4000-8000-000000000001';
  pending_race uuid:='f7630000-0000-4000-8000-000000000003';
  alpha uuid:='f7640000-0000-4000-8000-000000000001';
  beta uuid:='f7640000-0000-4000-8000-000000000002';
  penalty_case uuid; credit_case uuid; draft_case uuid; grid_case uuid; pending_case uuid;
  baseline uuid; current_id uuid; response jsonb; repeated jsonb;
begin
  select current_result_version_id into baseline from public.races where id=v_race_id;
  -- Same driver is accepted for both an open case and a direct time credit.
  draft_case:=(public.create_steward_case(v_race_id,alpha,alpha,'Self report draft','Review my in-game penalty.','Review','1','withdraw-self-draft')->>'id')::uuid;
  perform public.delete_steward_case(draft_case,'Duplicate self report draft.',null,baseline);
  if exists(select 1 from public.steward_cases where id=draft_case) then raise exception 'Deleted open case remains visible'; end if;
  if (select current_result_version_id from public.races where id=v_race_id)<>baseline then raise exception 'Draft deletion changed result'; end if;

  penalty_case:=(public.record_steward_decision(v_race_id,beta,alpha,'Alpha penalty','Reviewed five seconds for Alpha.','time_penalty',5,null,null,'withdraw-alpha-penalty')->>'case_id')::uuid;
  credit_case:=(public.record_steward_decision(v_race_id,beta,beta,'Self report credit','Remove ten seconds wrongly awarded in-game.','time_credit',10,null,null,'withdraw-beta-credit')->>'case_id')::uuid;
  if (select penalty_time_delta_ms from public.race_results where race_id=v_race_id and driver_id=beta)<>-10000 then raise exception 'Self report credit missing'; end if;
  select current_result_version_id into current_id from public.races where id=v_race_id;
  begin
    perform public.delete_steward_case(penalty_case,'Stale result must be rejected.',1,baseline);
    raise exception 'TEST: stale result accepted';
  exception when others then if sqlerrm not like 'Case or result changed%' then raise; end if; end;
  begin
    perform public.delete_steward_case(penalty_case,'Stale decision must be rejected.',null,current_id);
    raise exception 'TEST: stale decision accepted';
  exception when others then if sqlerrm not like 'Case or result changed%' then raise; end if; end;
  response:=public.delete_steward_case(penalty_case,'Incorrect penalty after review.',1,current_id);
  repeated:=public.delete_steward_case(penalty_case,'Incorrect penalty after review.',1,current_id);
  if response<>repeated then raise exception 'Deletion retry not idempotent'; end if;
  if exists(select 1 from public.steward_cases where id=penalty_case) then raise exception 'Deleted closed case remains visible'; end if;
  if (select penalty_time_delta_ms from public.race_results r where r.race_id=v_race_id and driver_id=alpha)<>0 then raise exception 'Penalty not reversed'; end if;
  if (select penalty_time_delta_ms from public.race_results r where r.race_id=v_race_id and driver_id=beta)<>-10000 then raise exception 'Unrelated credit changed'; end if;
  if (select awarded_points from public.race_results r where r.race_id=v_race_id and driver_id=beta)<>27 then raise exception 'Unrelated fastest lap bonus changed'; end if;

  select current_result_version_id into current_id from public.races where id=v_race_id;
  perform public.delete_steward_case(credit_case,'Credit was approved in error.',1,current_id);
  if (select finish_position from public.race_results r where r.race_id=v_race_id and driver_id=alpha)<>1
    or (select awarded_points from public.race_results r where r.race_id=v_race_id and driver_id=alpha)<>25
    or (select awarded_points from public.race_results r where r.race_id=v_race_id and driver_id=beta)<>18
    or (select penalty_time_delta_ms from public.race_results r where r.race_id=v_race_id and driver_id=beta)<>0 then
    raise exception 'Credit reversal failed to restore positions, points and fastest lap boundary';
  end if;
  select current_result_version_id into current_id from public.races where id=v_race_id;
  grid_case:=(public.record_steward_decision(v_race_id,beta,alpha,'Grid penalty','Three places back next race.','grid_penalty',3,
    'f7630000-0000-4000-8000-000000000002',null,'withdraw-grid')->>'case_id')::uuid;
  perform public.delete_steward_case(grid_case,'The grid penalty was erroneous.',1,current_id);
  if exists(select 1 from public.steward_penalties where target_race_id='f7630000-0000-4000-8000-000000000002') then raise exception 'Deleted incoming grid penalty visible'; end if;
  if (select current_result_version_id from public.races where id=v_race_id)<>current_id then raise exception 'Grid deletion changed result'; end if;
  pending_case:=(public.record_steward_decision(pending_race,alpha,alpha,'Pending self report','Ten seconds credited at publication.','time_credit',10,null,null,'withdraw-pending')->>'case_id')::uuid;
  perform public.delete_steward_case(pending_case,'Pending credit no longer justified.',1,null);
  perform set_config('racevora.deleted_pending_case',pending_case::text,true);

  -- Keep one open self-report for authorization probes.
  draft_case:=(public.create_steward_case(v_race_id,alpha,alpha,'Protected draft','Only stewards may remove this.','Review','1','withdraw-protected')->>'id')::uuid;
  perform set_config('racevora.protected_case',draft_case::text,true);
  perform set_config('racevora.protected_result',current_id::text,true);
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-other-regression"}',true);
  begin
    perform public.delete_steward_case(draft_case,'Cross league deletion must fail.',null,current_id);
    raise exception 'TEST: cross league deletion accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-steward-regression"}',true);
end $test$;
reset role;

-- The deleted pending credit must not be reapplied at publication.
do $$ declare v uuid; response jsonb; pending_id uuid; begin
  pending_id:=(public.record_steward_decision('f7630000-0000-4000-8000-000000000003','f7640000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000001',
    'Retained pending penalty','This five second penalty must survive until publication.','time_penalty',5,null,null,'withdraw-after-publication')->>'case_id')::uuid;
  v:=private.create_result_version('f7630000-0000-4000-8000-000000000003','Pending result without withdrawn credit');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
    (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
    (v,2,'f7640000-0000-4000-8000-000000000002',2,'+3.000',18,18);
  perform private.validate_result_version(v);
  response:=public.publish_league_result_draft(v);
  if (select penalty_time_delta_ms from public.race_results where race_id='f7630000-0000-4000-8000-000000000003' and driver_id='f7640000-0000-4000-8000-000000000001')<>5000 then raise exception 'Deleted pending credit was applied or retained penalty lost'; end if;
  perform public.delete_steward_case(pending_id,'Reverse after deferred publication.',1,(response->>'id')::uuid);
  if exists(select 1 from public.race_results where race_id='f7630000-0000-4000-8000-000000000003' and penalty_time_delta_ms<>0) then raise exception 'Deferred application not reversed'; end if;
  if (select count(*) from private.steward_case_deletions d join public.steward_cases c on c.id=d.case_id where c.league_id='f7610000-0000-4000-8000-000000000001')<>6 then raise exception 'Missing immutable deletion receipts'; end if;
  if (select count(*) from public.v2_audit_events where action='steward.case_deleted' and league_id='f7610000-0000-4000-8000-000000000001')<>6 then raise exception 'Missing deletion audit'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.delete_steward_case(current_setting('racevora.protected_case')::uuid,'Unauthorized driver deletion.',null,current_setting('racevora.protected_result')::uuid);
    raise exception 'TEST: driver deletion accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Server-side safety: incompatible manual deltas abort everything, not just the result update.
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare case_id uuid; v uuid; before_count integer; begin
  case_id:=(public.record_steward_decision('f7630000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000001',
    'Manual conflict','Test changed delta blocks unsafe reversal.','time_penalty',5,null,null,'withdraw-conflict')->>'case_id')::uuid;
  select current_result_version_id into v from public.races where id='f7630000-0000-4000-8000-000000000001';
  v:=private.prepare_steward_time_corrections(v,'[{"driver_id":"f7640000-0000-4000-8000-000000000001","delta":1000}]','Synthetic unrelated manual correction');
  perform private.validate_result_version(v); perform private.activate_result_version(v);
  select count(*) into before_count from public.result_versions;
  begin
    perform public.delete_steward_case(case_id,'Must not blindly reverse manual changes.',1,v);
    raise exception 'TEST: incompatible result deleted';
  exception when others then if sqlerrm not like 'Result history changed%' then raise; end if; end;
  if (select count(*) from public.result_versions)<>before_count
    or (select deleted_at from public.steward_cases where id=case_id) is not null then raise exception 'Failed deletion left partial changes'; end if;
end $$;
rollback;
