-- Entirely synthetic; this file must end in ROLLBACK on every environment.
begin;
set local statement_timeout='30s';
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f8700000-0000-4000-8000-000000000001','authenticated','authenticated','draft-admin@example.invalid','{}','{}',now(),now()),
 ('f8700000-0000-4000-8000-000000000002','authenticated','authenticated','draft-driver@example.invalid','{}','{}',now(),now());
insert into public.driver_identities(user_id,status) values
 ('f8700000-0000-4000-8000-000000000001','active'),('f8700000-0000-4000-8000-000000000002','active');
insert into public.leagues(id,name,slug,is_public) values
 ('f8710000-0000-4000-8000-000000000001','Synthetic Draft Recovery','synthetic-draft-recovery',true),
 ('f8710000-0000-4000-8000-000000000002','Synthetic Other Draft','synthetic-other-draft',true);
insert into public.league_members(league_id,user_id,role) values
 ('f8710000-0000-4000-8000-000000000001','f8700000-0000-4000-8000-000000000001','league_admin'),
 ('f8710000-0000-4000-8000-000000000001','f8700000-0000-4000-8000-000000000002','driver');
insert into public.seasons(id,league_id,slug,name,is_active) values
 ('f8720000-0000-4000-8000-000000000001','f8710000-0000-4000-8000-000000000001','synthetic-draft','Synthetic',true);
delete from public.races where season_id='f8720000-0000-4000-8000-000000000001';
insert into public.races(id,season_id,round_number,grand_prix_name,race_date,race_start_at,status) values
 ('f8730000-0000-4000-8000-000000000001','f8720000-0000-4000-8000-000000000001',1,'Synthetic Japan',current_date-1,now()-interval '1 day','upcoming');
insert into public.drivers(id,league_id,display_name) values
 ('f8740000-0000-4000-8000-000000000001','f8710000-0000-4000-8000-000000000001','Synthetic Winner'),
 ('f8740000-0000-4000-8000-000000000002','f8710000-0000-4000-8000-000000000001','Synthetic Credit');
select set_config('request.headers','{"x-rcc-league-slug":"synthetic-draft-recovery"}',true);
select set_config('request.jwt.claims','{"sub":"f8700000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare v uuid; begin
  if private.steward_duration_ms('14:337')<>14337 or private.steward_duration_ms('1:23')<>83000
    or private.steward_duration_ms('44:57,962')<>2697962 or private.steward_duration_ms('00:00,723')<>723
    or private.steward_duration_ms('1:02:03.456')<>3723456
    or private.steward_duration_ms('DNF') is not null or private.steward_duration_ms('1 lap') is not null
    or private.steward_duration_ms('1:2345') is not null then raise exception 'Duration regression'; end if;
  v:=private.create_result_version('f8730000-0000-4000-8000-000000000001','Synthetic imported draft');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points) values
   (v,1,'f8740000-0000-4000-8000-000000000001',1,'44:57,962',25,25),
   (v,2,'f8740000-0000-4000-8000-000000000002',2,'+14:337',18,18);
  perform private.validate_result_version(v);
  perform set_config('racevora.test_draft',v::text,true);
end $$;
set local role authenticated;
do $$ declare v uuid:=current_setting('racevora.test_draft')::uuid; receipt jsonb; case_id uuid; new_id uuid; begin
  receipt:=public.record_steward_decision('f8730000-0000-4000-8000-000000000001','f8740000-0000-4000-8000-000000000002','f8740000-0000-4000-8000-000000000002','Synthetic time credit','Synthetic appeal for an incorrect game penalty.','time_credit',10,null,null,'synthetic-draft-credit');
  case_id:=(receipt->>'case_id')::uuid;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-other-draft"}',true);
  begin perform public.discard_league_result_draft(v); raise exception 'Cross league discard allowed'; exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-draft-recovery"}',true);
  perform set_config('request.jwt.claims','{"sub":"f8700000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  begin perform public.discard_league_result_draft(v); raise exception 'Driver discard allowed'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{"sub":"f8700000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  receipt:=public.discard_league_result_draft(v);
  if receipt is distinct from public.discard_league_result_draft(v) then raise exception 'Discard not idempotent'; end if;
  if jsonb_array_length(public.get_league_configuration_workspace()->'result_drafts')<>0 then raise exception 'Discarded draft remains listed'; end if;
  begin perform public.publish_league_result_draft(v); raise exception 'Discarded draft published'; exception when raise_exception then if sqlerrm not like 'This result draft was discarded%' then raise; end if; end;
  if not exists(select 1 from public.steward_cases where id=case_id and deleted_at is null) then raise exception 'Pending decision was removed'; end if;
  perform set_config('racevora.test_case',case_id::text,true);
end $$;
reset role;
do $$ declare v uuid; begin
  v:=private.create_result_version('f8730000-0000-4000-8000-000000000001','Synthetic corrected reimport');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points)
    select v,row_order,driver_id,finish_position,race_time,awarded_points,points from public.result_version_rows where result_version_id=current_setting('racevora.test_draft')::uuid;
  perform private.validate_result_version(v); perform set_config('racevora.test_new_draft',v::text,true);
end $$;
set local role authenticated;
do $$ declare v uuid:=current_setting('racevora.test_new_draft')::uuid; receipt jsonb; begin
  receipt:=public.publish_league_result_draft(v);
  if receipt is distinct from public.publish_league_result_draft(v) then raise exception 'Publication not idempotent'; end if;
  if not exists(select 1 from public.race_results where result_version_id=(receipt->>'id')::uuid and driver_id='f8740000-0000-4000-8000-000000000002' and penalty_time_delta_ms=-10000 and race_time_ms=2712299) then raise exception 'OCR time or pending credit incorrect'; end if;
  begin perform public.discard_league_result_draft(v); raise exception 'Consumed draft discarded'; exception when raise_exception then if sqlerrm not like 'Only unpublished%' then raise; end if; end;
  begin perform public.discard_league_result_draft((receipt->>'id')::uuid); raise exception 'Active result discarded'; exception when raise_exception then if sqlerrm not like 'Only unpublished%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from private.result_draft_discards where result_version_id=current_setting('racevora.test_draft')::uuid)<>1 then raise exception 'Missing discard audit'; end if;
  if has_function_privilege('anon','public.discard_league_result_draft(uuid)','EXECUTE') or has_function_privilege('authenticated','private.discard_league_result_draft(uuid)','EXECUTE') then raise exception 'Unexpected execute grant'; end if;
end $$;
rollback;
