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

insert into public.driver_claims (id,driver_id,claimant_user_id,verification_method,status,resolved_at,resolved_by) values
 ('f7650000-0000-4000-8000-000000000001','f7640000-0000-4000-8000-000000000002','f7600000-0000-4000-8000-000000000002','admin_verified','verified',now(),'f7600000-0000-4000-8000-000000000001');
insert into public.driver_identity_links(driver_identity_id,driver_id,claim_id)
 select id,'f7640000-0000-4000-8000-000000000002','f7650000-0000-4000-8000-000000000001' from public.driver_identities where user_id='f7600000-0000-4000-8000-000000000002';
do $$ declare response jsonb; begin
  response:=public.save_steward_group_case('f7630000-0000-4000-8000-000000000001',
    array['f7640000-0000-4000-8000-000000000001'::uuid,'f7640000-0000-4000-8000-000000000002'::uuid],
    array['f7640000-0000-4000-8000-000000000001'::uuid,'f7640000-0000-4000-8000-000000000003'::uuid],
    'Participant access','Second reporter must see this open case.','[]',true,null,'group-visibility');
  perform set_config('racevora.group_access_case',response->>'case_id',true);
end $$;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.steward_cases where id=current_setting('racevora.group_access_case')::uuid)
    or (select count(*) from public.steward_case_participants where case_id=current_setting('racevora.group_access_case')::uuid)<>4 then raise exception 'Second reporter cannot read open case'; end if;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-other-regression"}',true);
  if exists(select 1 from public.steward_case_participants where case_id=current_setting('racevora.group_access_case')::uuid) then raise exception 'Cross tenant participants leaked'; end if;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-steward-regression"}',true);
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare response jsonb; v_event_id uuid; processing_id uuid; begin
  response:=public.save_steward_group_case('f7630000-0000-4000-8000-000000000001',
    array['f7640000-0000-4000-8000-000000000001'::uuid,'f7640000-0000-4000-8000-000000000002'::uuid],
    array['f7640000-0000-4000-8000-000000000001'::uuid,'f7640000-0000-4000-8000-000000000003'::uuid],
    'Participant access','Second reporter must see this open case.',
    '[{"driver_id":"f7640000-0000-4000-8000-000000000001","penalty_type":"no_action","reasoning":"No penalty for Alpha."},
      {"driver_id":"f7640000-0000-4000-8000-000000000003","penalty_type":"no_action","reasoning":"No penalty for Gamma."}]',
    false,current_setting('racevora.group_access_case')::uuid,'group-visibility-close');
  select id into v_event_id from public.domain_events where aggregate_id=(response->>'case_id')::uuid and event_type='steward.decision_finalized';
  select p.id into processing_id from private.domain_event_processing p where p.event_id=v_event_id and p.processor='notifications';
  -- Process only this fixture's exact event, without invoking any global worker.
  update private.domain_event_processing p set status='processing',locked_by='synthetic-group-worker',locked_at=now() where p.id=processing_id;
  perform private.process_notification_event(processing_id,'synthetic-group-worker');
  if not exists(select 1 from public.user_notifications n where n.source_event_id=v_event_id and n.recipient_user_id='f7600000-0000-4000-8000-000000000002') then raise exception 'Second reporter notification missing'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  perform public.submit_steward_appeal(current_setting('racevora.group_access_case')::uuid,'Second reporter can appeal the grouped decision.','group-second-appeal');
end $$;
reset role;
select 'PASS: second reporter visibility, tenant isolation, notifications and appeal' as result;
rollback;
