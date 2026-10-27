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
do $$ declare v uuid; begin
 v:=private.create_result_version('f7630000-0000-4000-8000-000000000003','Pending correction baseline');
 insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
 (v,1,'f7640000-0000-4000-8000-000000000001',1,'1:40.000',25,25),
 (v,2,'f7640000-0000-4000-8000-000000000002',2,'+3.000',18,18);
 perform private.validate_result_version(v); perform set_config('test.pending_version',v::text,true);
end $$;
set local role authenticated;
do $$ declare
 race uuid:='f7630000-0000-4000-8000-000000000001';
 pending_race uuid:='f7630000-0000-4000-8000-000000000003';
 alpha uuid:='f7640000-0000-4000-8000-000000000001';
 beta uuid:='f7640000-0000-4000-8000-000000000002';
 cid uuid; other_id uuid; result_id uuid; decision_id uuid; response jsonb; repeated jsonb; decisions jsonb; original_decisions integer;
begin
 decisions:=jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','time_penalty','amount',10,'reasoning','Initial ten second penalty.'),jsonb_build_object('driver_id',beta,'penalty_type','dismissed','reasoning','The report against Beta was rejected.'));
 response:=public.save_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Initial incident','Incident with two accused drivers.',decisions,false,null,'correct-test-original');
 cid:=(response->>'case_id')::uuid;
 other_id:=(public.record_steward_decision(race,alpha,alpha,'Unrelated case','Independent one second penalty.','time_penalty',1,null,null,'correct-test-unrelated')->>'case_id')::uuid;
 select current_result_version_id into result_id from public.races where id=race;
 decisions:=jsonb_set(decisions,'{0,amount}','5');
 response:=public.correct_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Corrected incident','Corrected description for this incident.',decisions,cid,'correct-test-five',1,result_id,'The initial penalty was too severe.');
 repeated:=public.correct_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Corrected incident','Corrected description for this incident.',decisions,cid,'correct-test-five',1,result_id,'The initial penalty was too severe.');
 if response<>repeated then raise exception 'Correction retry is not idempotent'; end if;
 if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>6000 then raise exception 'Old penalty not replaced, or unrelated penalty lost'; end if;
 if (select count(*) from public.steward_decision_versions where case_id=cid)<>2 then raise exception 'History was not retained'; end if;
 begin
  perform public.correct_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Stale incident','Another correction from a stale tab.',decisions,cid,'correct-test-stale',1,result_id,'Reject this stale concurrent correction.');
  raise exception 'TEST: stale write accepted';
 exception when others then if sqlerrm not like '%Reload before correcting%' then raise; end if; end;
 select current_result_version_id into result_id from public.races where id=race;
 decisions:=jsonb_set(jsonb_set(decisions,'{0,penalty_type}','"time_credit"'),'{0,amount}','2');
 response:=public.correct_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Credit correction','The revised incident warrants a credit.',decisions,cid,'correct-test-credit',2,result_id,'Replace the penalty with a time credit.');
 if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>-1000
  or (select finish_position from public.race_results where race_id=race and driver_id=alpha)<>1 then raise exception 'Credit correction did not update ranking'; end if;
 select current_result_version_id into result_id from public.races where id=race;
 decisions:=jsonb_set((decisions #- '{0,amount}'),'{0,penalty_type}','"dismissed"');
 response:=public.correct_steward_group_case(race,array[alpha,beta],array[alpha,beta],'Rejected incident','Both reports have now been rejected.',decisions,cid,'correct-test-rejected',3,result_id,'New evidence invalidates the reports.');
 if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>1000 then raise exception 'Rejected decision left old time effects'; end if;
 select current_result_version_id into result_id from public.races where id=race;
 perform public.delete_steward_case(cid,'Remove the corrected rejected case.',4,result_id);
 if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>1000 then raise exception 'Deleting a corrected case undid historical penalties twice'; end if;
 -- A zero-net correction still marks the new penalty as applied, so deletion reverses it once.
 decisions:=jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','time_penalty','amount',3,'reasoning','Original three seconds for Alpha.'));
 response:=public.save_steward_group_case(race,array[alpha],array[alpha],'Same amount case','Only the explanation will be changed.',decisions,false,null,'correct-zero-original'); cid:=(response->>'case_id')::uuid;
 select current_result_version_id into result_id from public.races where id=race;
 response:=public.correct_steward_group_case(race,array[alpha],array[alpha],'Same amount case','Corrected explanation with same amount.',decisions,cid,'correct-zero-revision',1,result_id,'Correct only the written explanation.');
 if (select current_result_version_id from public.races where id=race)<>result_id then raise exception 'Zero-net correction created needless result revision'; end if;
 perform public.delete_steward_case(cid,'Remove the zero-net revised case.',2,result_id);
 if (select penalty_time_delta_ms from public.race_results where race_id=race and driver_id=alpha)<>1000 then raise exception 'Zero-net revised penalty not reversed exactly once'; end if;
 -- Superseded grid penalties disappear from incoming penalties.
 decisions:=jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','grid_penalty','amount',3,'target_race_id','f7630000-0000-4000-8000-000000000002','reasoning','Initial grid penalty for Alpha.'));
 response:=public.save_steward_group_case(race,array[alpha],array[alpha],'Grid penalty case','A grid penalty that will be rejected.',decisions,false,null,'correct-grid-original'); cid:=(response->>'case_id')::uuid;
 if (select count(*) from public.get_incoming_steward_grid_penalties('f7630000-0000-4000-8000-000000000002'))<>1 then raise exception 'Missing current incoming grid penalty'; end if;
 select current_result_version_id into result_id from public.races where id=race;
 decisions:=jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','dismissed','reasoning','The grid penalty complaint is rejected.'));
 perform public.correct_steward_group_case(race,array[alpha],array[alpha],'Grid penalty case','The initial grid penalty was incorrect.',decisions,cid,'correct-grid-rejected',1,result_id,'The evidence does not support a penalty.');
 if exists(select 1 from public.get_incoming_steward_grid_penalties('f7630000-0000-4000-8000-000000000002')) then raise exception 'Superseded grid penalty is still incoming'; end if;
 -- Pending corrections replace the queued effect before first publication.
 decisions:=jsonb_build_array(jsonb_build_object('driver_id',alpha,'penalty_type','time_penalty','amount',10,'reasoning','Initial pending ten second penalty.'));
 response:=public.save_steward_group_case(pending_race,array[alpha],array[alpha],'Pending incident','Incident awaiting official publication.',decisions,false,null,'correct-test-pending'); cid:=(response->>'case_id')::uuid;
 decisions:=jsonb_set(decisions,'{0,amount}','2');
 perform public.correct_steward_group_case(pending_race,array[alpha],array[alpha],'Pending incident','Incident awaiting official publication.',decisions,cid,'correct-test-pending-two',1,null,'Only two seconds should be applied.');
 perform public.publish_league_result_draft(current_setting('test.pending_version')::uuid);
 if (select penalty_time_delta_ms from public.race_results where race_id=pending_race and driver_id=alpha)<>2000 then raise exception 'Superseded pending penalty was also applied'; end if;
 select current_result_version_id into result_id from public.races where id=pending_race;
 perform public.delete_steward_case(cid,'Remove corrected pending-then-applied case.',2,result_id);
 if (select penalty_time_delta_ms from public.race_results where race_id=pending_race and driver_id=alpha)<>0 then raise exception 'Corrected pending decision did not reverse'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.correct_steward_group_case(uuid,uuid[],uuid[],text,text,jsonb,uuid,text,integer,uuid,text)','execute')
  or has_function_privilege('authenticated','private.save_steward_group_case_revision(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text,integer,uuid,text)','execute')
  or has_function_privilege('authenticated','private.steward_case_inverse_adjustments(uuid)','execute') then raise exception 'Correction privileges too broad'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f7600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.correct_steward_group_case('f7630000-0000-4000-8000-000000000001',array['f7640000-0000-4000-8000-000000000001'::uuid],array['f7640000-0000-4000-8000-000000000001'::uuid],'Unauthorized correction','Drivers cannot correct steward decisions.','[]',null,'correct-driver-denied',1,null,'Driver must not gain write permission.');
  raise exception 'TEST: driver correction accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: correction replacement, unrelated penalties, history, retry, stale rejection, credits, rejection, pending publication and deletion' as result;
rollback;
