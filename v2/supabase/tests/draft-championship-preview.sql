-- Synthetic fixtures only. Never commit this transaction on any environment.
begin;
set local statement_timeout='30s';
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('f8800000-0000-4000-8000-000000000001','authenticated','authenticated','preview-admin@example.invalid','{}','{}',now(),now()),
 ('f8800000-0000-4000-8000-000000000002','authenticated','authenticated','preview-driver@example.invalid','{}','{}',now(),now());
insert into public.driver_identities(user_id,status) values
 ('f8800000-0000-4000-8000-000000000001','active'),('f8800000-0000-4000-8000-000000000002','active');
insert into public.leagues(id,name,slug,is_public) values
 ('f8810000-0000-4000-8000-000000000001','Synthetic Preview','synthetic-preview',true),
 ('f8810000-0000-4000-8000-000000000002','Synthetic Other Preview','synthetic-other-preview',true);
insert into public.league_members(league_id,user_id,role) values
 ('f8810000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000001','league_admin'),
 ('f8810000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002','driver');
insert into public.seasons(id,league_id,slug,name,is_active,fastest_lap_bonus_enabled,fastest_lap_bonus_points,fastest_lap_bonus_max_finish_position) values
 ('f8820000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','preview-season','Synthetic Preview Season',true,true,2,1);
delete from public.races where season_id='f8820000-0000-4000-8000-000000000001';
insert into public.races(id,season_id,round_number,grand_prix_name,race_date,status) values
 ('f8830000-0000-4000-8000-000000000001','f8820000-0000-4000-8000-000000000001',1,'Synthetic Race',current_date,'upcoming');
insert into public.drivers(id,league_id,display_name) values
 ('f8840000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001','Synthetic Alpha'),
 ('f8840000-0000-4000-8000-000000000002','f8810000-0000-4000-8000-000000000001','Synthetic Beta'),
 ('f8840000-0000-4000-8000-000000000003','f8810000-0000-4000-8000-000000000001','Synthetic Lapped');
select set_config('request.headers','{"x-rcc-league-slug":"synthetic-preview"}',true);
select set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare v uuid; begin
  v:=private.create_result_version('f8830000-0000-4000-8000-000000000001','Synthetic saved draft');
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,race_time,awarded_points,points,fastest_lap_time_ms) values
    (v,1,'f8840000-0000-4000-8000-000000000001',1,'1:40.000',32,32,41000),
    (v,2,'f8840000-0000-4000-8000-000000000002',2,'+3.000',18,18,40000),
    (v,3,'f8840000-0000-4000-8000-000000000003',3,'+1 lap',15,15,42000);
  perform private.validate_result_version(v);
  perform set_config('racevora.preview_draft',v::text,true);
end $$;
set local role authenticated;
do $$ declare v uuid:=current_setting('racevora.preview_draft')::uuid; preview jsonb; begin
  preview:=public.get_result_draft_championship_preview(v);
  if jsonb_array_length(preview->'draftRows')<>3 or jsonb_array_length(preview#>'{data,results}')<>0 then raise exception 'Wrong draft snapshot'; end if;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-other-preview"}',true);
  begin perform public.get_result_draft_championship_preview(v); raise exception 'Cross-league preview allowed'; exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-rcc-league-slug":"synthetic-preview"}',true);
  perform set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  begin perform public.get_result_draft_championship_preview(v); raise exception 'Driver preview allowed'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{}',true);
  begin perform public.get_result_draft_championship_preview(v); raise exception 'Anonymous preview allowed'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{"sub":"f8800000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  perform public.record_steward_decision('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000002','f8840000-0000-4000-8000-000000000001',
    'Synthetic penalty','Eight seconds after steward discussion.','time_penalty',8,null,null,'synthetic-preview-penalty');
  perform public.record_steward_decision('f8830000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001','f8840000-0000-4000-8000-000000000001',
    'Synthetic credit','Three seconds credited after steward discussion.','time_credit',3,null,null,'synthetic-preview-credit');
end $$;
reset role;
do $$ declare v uuid:=current_setting('racevora.preview_draft')::uuid; preview jsonb; before_counts jsonb; after_counts jsonb; receipt jsonb; begin
  select jsonb_build_array((select count(*) from public.result_versions),(select count(*) from public.race_results),
    (select count(*) from public.steward_penalty_applications),(select count(*) from public.v2_audit_events),(select count(*) from public.domain_events)) into before_counts;
  preview:=public.get_result_draft_championship_preview(v);
  if preview->'draftRows' is distinct from public.get_result_draft_championship_preview(v)->'draftRows' then raise exception 'Unstable preview'; end if;
  select jsonb_build_array((select count(*) from public.result_versions),(select count(*) from public.race_results),
    (select count(*) from public.steward_penalty_applications),(select count(*) from public.v2_audit_events),(select count(*) from public.domain_events)) into after_counts;
  if before_counts<>after_counts then raise exception 'Preview wrote sporting state or events'; end if;
  if (preview->>'pendingCorrections')::int<>2 or (preview#>>'{draftRows,0,finish_position}')::int<>2
    or (preview#>>'{draftRows,0,awarded_points}')::numeric<>25
    or (preview#>>'{draftRows,1,awarded_points}')::numeric<>27
    or (preview#>>'{draftRows,2,finish_position}')::int<>3 then raise exception 'Wrong preview correction'; end if;
  receipt:=public.publish_league_result_draft(v);
  if exists(select 1 from jsonb_array_elements(preview->'draftRows') p join public.race_results r on r.driver_id=(p->>'driver_id')::uuid
    and r.result_version_id=(receipt->>'id')::uuid where r.awarded_points<>(p->>'awarded_points')::numeric
      or r.finish_position<>(p->>'finish_position')::int
      or r.points_owner_driver_id is distinct from (p->>'points_owner_driver_id')::uuid) then raise exception 'Preview differs from publication'; end if;
  begin perform public.get_result_draft_championship_preview(v); raise exception 'Consumed preview allowed';
    exception when raise_exception then if sqlerrm<>'PREVIEW_DRAFT_STALE' then raise; end if; end;
end $$;
-- Revised, discarded and incomplete drafts; all remain isolated to this transaction.
do $$ declare v uuid; current_id uuid; preview jsonb; begin
  select current_result_version_id into current_id from public.races where id='f8830000-0000-4000-8000-000000000001';
  v:=private.create_result_version('f8830000-0000-4000-8000-000000000001','Synthetic revision',current_id);
  insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,awarded_points,points)
    values(v,1,'f8840000-0000-4000-8000-000000000001',1,25,25);
  perform private.validate_result_version(v);
  preview:=public.get_result_draft_championship_preview(v);
  if not (preview->>'replacesPublished')::boolean or jsonb_array_length(preview#>'{data,results}')<>3 then raise exception 'Revision lacks official baseline'; end if;
  perform public.discard_league_result_draft(v);
  begin perform public.get_result_draft_championship_preview(v); raise exception 'Discarded preview allowed';
    exception when raise_exception then if sqlerrm<>'PREVIEW_DRAFT_STALE' then raise; end if; end;
  if has_function_privilege('anon','public.get_result_draft_championship_preview(uuid)','execute')
    or has_function_privilege('authenticated','private.preview_result_rows(uuid)','execute') then raise exception 'Unexpected grants'; end if;
end $$;
select 'draft championship preview: permissions, no writes, credits, penalties, bonuses, manual adjustments, lapped slots, publication parity and lifecycle passed' as result;
rollback;
