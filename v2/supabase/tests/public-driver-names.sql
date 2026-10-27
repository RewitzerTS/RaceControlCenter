-- Staging only. Synthetic identities, league and links; every write rolls back.
begin;
do $$
declare actor uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  lid uuid:=gen_random_uuid(); did uuid:=gen_random_uuid(); second uuid:=gen_random_uuid();
  slug text:='name-qa-'||lid; code text; state jsonb; rev text; identity_id uuid; request_id uuid;
  links_before text; aliases_before text; editor jsonb; profile jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,actor||'@example.invalid',now()),
    (admin_id,admin_id||'@example.invalid',now()),(outsider,outsider||'@example.invalid',now());
  insert into public.leagues(id,name,slug,is_public) values(lid,'Names QA',slug,false) returning join_code into code;
  insert into public.drivers(id,league_id,display_name,gamertag) values(did,lid,'Historical Name','OldTag'),(second,lid,'Other Historical Name','OtherTag');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug',slug)::text,true);
  state:=public.get_my_entry_state(); identity_id:=(state->>'identity_id')::uuid;
  state:=public.save_my_entry_names('Richard','CurrentTag','gamertag');
  assert state->>'real_name'='Richard' and state->>'public_name_mode'='gamertag' and state->>'profile_complete'='true','Entry saves names';
  assert state->>'display_name'='CurrentTag','New compatibility records use selected public gamertag';
  perform public.request_my_entry_league(code);
  select id into request_id from public.league_join_requests where user_id=actor and league_id=lid;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.get_my_entry_state();
  insert into public.league_members(league_id,user_id,role) values(lid,admin_id,'league_admin');
  perform public.review_league_join_request_explicit(request_id,'approved',did,false);
  assert (select public_name='CurrentTag' and display_name='Historical Name' from public.drivers where id=did),'New link carries selected name, preserves matching label';
  -- Account provisioning initializes its own career rows. Snapshot after fixture setup.
  create temporary table name_test_fingerprints as
    select 'results' as label,md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) as digest from public.race_results t
    union all select 'xp',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.xp_ledger t
    union all select 'credits',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.credit_ledger t
    union all select 'career',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.driver_career_stats t;
  select md5(string_agg(to_jsonb(t)::text,'|' order by id)) into links_before from public.driver_identity_links t;
  select md5(string_agg(to_jsonb(t)::text,'|' order by id)) into aliases_before from public.driver_aliases t;
  editor:=public.get_league_driver_editor(did);
  assert editor->>'name'='Richard' and editor->>'name_managed_by_driver'='true','Management sees canonical real name';
  profile:=jsonb_build_object('name','Impersonation','public_name_mode','name','gamertag','CurrentTag','is_active',true,'nationality_code','');
  begin
    perform public.save_league_named_driver(did,profile,'[]',null,null,editor->>'revision');
    raise exception 'ASSERT manager overrode personal selection';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  state:=public.get_my_name_settings(); rev:=state->>'revision';
  perform public.save_my_name_settings('Richard','name',rev);
  assert (select public_name='Richard' and id=did and display_name='Historical Name' from public.drivers where id=did),'Name presentation only';
  begin
    perform public.save_my_name_settings('Different','gamertag',rev);
    raise exception 'ASSERT stale edit accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_my_name_settings('<script>','name',public.get_my_name_settings()->>'revision');
    raise exception 'ASSERT invalid name accepted';
  exception when invalid_parameter_value then null; end;
  assert links_before=(select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.driver_identity_links t),'Links unchanged';
  assert aliases_before=(select md5(string_agg(to_jsonb(t)::text,'|' order by id)) from public.driver_aliases t),'Aliases unchanged';
  perform public.save_my_name_settings('Richard','gamertag',public.get_my_name_settings()->>'revision');
  perform public.update_my_gamertag('CorrectedTag');
  assert (select public_name='CorrectedTag' from public.drivers where id=did),'Gamertag edits update public label';
  perform public.save_my_name_settings('Richard','name',public.get_my_name_settings()->>'revision');
  set local role authenticated;
  assert current_user='authenticated','Test browser role rather than database owner';
  state:=public.get_my_name_settings();
  assert state->>'name'='Richard','Own settings readable with browser grants';
  perform public.save_my_name_settings('Richard','name',state->>'revision');
  begin
    perform real_name from public.drivers limit 1;
    raise exception 'ASSERT direct real-name read allowed';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  editor:=public.get_league_driver_editor(second);
  profile:=jsonb_build_object('name','Richard','public_name_mode','name','gamertag','OtherTag','is_active',true,'nationality_code','');
  perform public.save_league_named_driver(second,profile,'[]',null,null,editor->>'revision');
  assert (select count(*) from public.drivers where league_id=lid and public_name='Richard')=2,'Duplicate first names keep distinct IDs';
  assert (select display_name='Other Historical Name' from public.drivers where id=second),'Admin name edit preserves old matching label';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert public.get_my_name_settings() is null,'No reading another identity';
  begin
    perform public.save_my_name_settings('Outsider','name',rev);
    raise exception 'ASSERT outsider wrote identity';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.get_my_name_settings();
    raise exception 'ASSERT anonymous read allowed';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.save_my_name_settings(text,text,text)','EXECUTE'),'Anonymous cannot save';
  assert not has_column_privilege('anon','public.drivers','real_name','SELECT'),'Real name not publicly selectable';
  assert not has_column_privilege('authenticated','public.drivers','real_name','SELECT'),'Real name not readable outside authorized RPC';
  assert has_column_privilege('anon','public.drivers','public_name','SELECT'),'Public label selectable';
  assert not exists(select 1 from name_test_fingerprints old join (
    select 'results' as label,md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) as digest from public.race_results t
    union all select 'xp',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.xp_ledger t
    union all select 'credits',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.credit_ledger t
    union all select 'career',md5(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text)) from public.driver_career_stats t
  ) current using(label) where old.digest is distinct from current.digest),'Results, XP, credits and career unchanged';
end; $$;
rollback;
select 'public driver names: all assertions passed; synthetic writes rolled back' as result;
