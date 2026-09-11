begin;
do $$
declare v_actor uuid := gen_random_uuid(); v_league uuid := gen_random_uuid(); v_other uuid := gen_random_uuid();
  v_code text; v_other_code text; v_slug text := 'qa-code-' || v_league; v_result jsonb;
begin
  assert not exists(select 1 from public.leagues where join_code is null or join_code !~ '^[0-9]{5}$'), 'Backfill must cover all leagues';
  insert into auth.users(id,email) values(v_actor,v_actor||'@example.invalid');
  insert into public.leagues(id,name,slug,is_public) values(v_league,'Transient Join Code QA',v_slug,false) returning join_code into v_code;
  insert into public.leagues(id,name,slug,is_public) values(v_other,'Transient Join Code QA 2','qa-code-'||v_other,false) returning join_code into v_other_code;
  assert v_code ~ '^[0-9]{5}$' and v_code <> v_other_code, 'New codes must be unique and five digits';
  begin
    update public.leagues set join_code = v_other_code where id = v_league;
    raise exception 'ASSERT: code changed';
  exception when others then
    if sqlerrm like 'ASSERT:%' then raise; end if;
    assert sqlerrm = 'League join codes cannot be changed.';
  end;
  begin
    update public.leagues set slug = v_code where id = v_other;
    raise exception 'ASSERT: ambiguous slug accepted';
  exception when others then
    if sqlerrm like 'ASSERT:%' then raise; end if;
    assert sqlerrm = 'This league slug is already a join code.';
  end;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug',v_slug)::text,true);
  v_result := public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,' '||v_code||' ');
  assert v_result->>'league_id' = v_league::text and v_result->>'request_status' = 'pending', 'Code must request correct league';
  assert not exists(select 1 from public.league_members where league_id = v_league and user_id = v_actor), 'Code must not grant membership';
  v_result := public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,v_league::text);
  assert v_result->>'request_status' = 'pending', 'UUID compatibility';
  v_result := public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,v_slug);
  assert v_result->>'request_status' = 'pending', 'Slug compatibility';
  v_result := public.complete_driver_onboarding('QA Code','QA Code',null,null,v_league::text);
  assert v_result->>'request_status' = 'pending', 'Old RPC remains compatible';
  assert (select count(*) from public.league_join_requests where league_id = v_league and user_id = v_actor and status = 'pending') = 1, 'No duplicate requests';
  begin
    perform public.get_current_league_join_code();
    raise exception 'ASSERT: non-admin read accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,'00000');
    raise exception 'ASSERT: unknown code accepted';
  exception when no_data_found then null;
  end;
  insert into public.league_members(league_id,user_id,role) values(v_league,v_actor,'league_admin');
  assert public.get_current_league_join_code() = v_code, 'Admin can copy code';
  v_result := public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,v_code);
  assert v_result->>'request_status' = 'already_member', 'Existing membership preserved';
  update public.leagues set status = 'archived' where id = v_other;
  begin
    perform public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,v_other_code);
    raise exception 'ASSERT: archived code accepted';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.complete_driver_onboarding_with_code('QA Code','QA Code',null,null,v_code);
    raise exception 'ASSERT: anonymous request accepted';
  exception when insufficient_privilege then null;
  end;
  assert not has_function_privilege('anon','public.complete_driver_onboarding_with_code(text,text,text,text,text)','EXECUTE');
  assert has_function_privilege('authenticated','public.complete_driver_onboarding_with_code(text,text,text,text,text)','EXECUTE');
end;
$$;
rollback;
