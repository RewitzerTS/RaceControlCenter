-- Synthetic accounts and league only; all rows are rolled back.
begin;
do $$
<<entry_two_test>>
declare actor uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  league_id uuid:=gen_random_uuid(); second_league uuid:=gen_random_uuid(); driver_id uuid:=gen_random_uuid();
  other_driver uuid:=gen_random_uuid(); code text; state jsonb; original_id text; request_id uuid; original_date timestamptz;
  slug text:='entry-qa-'||league_id; candidates jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,actor||'@example.invalid',now()),
    (admin_id,admin_id||'@example.invalid',now()),(outsider,outsider||'@example.invalid',now());
  insert into public.leagues(id,name,slug,is_public) values(league_id,'Entry QA',slug,false) returning join_code into code;
  insert into public.leagues(id,name,slug,is_public) values(second_league,'Entry Other','entry-qa-'||second_league,false);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug',slug)::text,true);
  state:=public.get_my_entry_state(); original_id:=state->>'racevora_id';
  assert original_id ~ '^RV-[0-9]+$' and state->>'step'='1' and state->>'profile_complete'='false', 'Identity before profile';
  assert public.get_my_entry_state()->>'racevora_id'=original_id, 'Idempotent provisioning';
  assert (select count(*) from public.driver_identities where user_id=actor)=1, 'One identity per account';
  perform public.advance_my_entry(3,true);
  assert public.get_my_entry_state()->>'step'='1', 'Skipped empty profile remains resumable';
  assert (select raw_user_meta_data->>'onboarding_complete'='true' from auth.users where id=actor), 'Skip dismisses wizard';
  state:=public.save_my_entry_profile('ExactTag','ExactTag');
  assert state->>'step'='2' and state->>'profile_complete'='true', 'Profile saved before league';
  assert (select raw_user_meta_data->>'display_name'='ExactTag' from auth.users where id=actor), 'Profile and auth copy atomic';
  begin
    perform public.save_my_entry_profile('<bad>','ExactTag');
    raise exception 'ASSERT invalid profile accepted';
  exception when invalid_parameter_value then null; end;
  assert public.get_my_entry_state()->>'display_name'='ExactTag', 'Invalid edit retains saved profile';
  perform public.advance_my_entry(3,false);
  assert public.get_my_entry_state()->>'step'='3', 'Resume league step';
  begin
    perform public.request_my_entry_league('00000');
    raise exception 'ASSERT bad code accepted';
  exception when no_data_found then null; end;
  assert public.get_my_entry_state()->>'racevora_id'=original_id, 'Bad code cannot roll back saved identity';
  perform public.request_my_entry_league(code);
  select id,requested_at into request_id,original_date from public.league_join_requests where user_id=actor and league_join_requests.league_id=entry_two_test.league_id;
  perform public.request_my_entry_league(code);
  assert (select count(*) from public.league_join_requests where user_id=actor)=1, 'Retry has no duplicate';
  assert (select requested_at=original_date from public.league_join_requests where id=request_id), 'Retry preserves queue position';
  assert not exists(select 1 from public.league_members where user_id=actor), 'Request is not membership';
  assert not exists(select 1 from public.driver_identity_links l join public.driver_identities di on di.id=l.driver_identity_id where di.user_id=actor), 'No automatic links';
  insert into public.drivers(id,league_id,display_name,gamertag) values(driver_id,league_id,'Historical Driver','exacttag'),(other_driver,second_league,'Foreign Driver','exacttag');
  begin
    perform public.get_join_request_driver_candidates(request_id);
    raise exception 'ASSERT nonadmin candidates allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.get_my_entry_state();
  insert into public.league_members(league_id,user_id,role) values(league_id,admin_id,'league_admin');
  candidates:=public.get_join_request_driver_candidates(request_id);
  assert jsonb_array_length(candidates)=1 and candidates->0->>'id'=driver_id::text and candidates->0->>'matched'='true', 'Exact alias hint scoped to league';
  begin
    perform public.review_league_join_request(request_id,'approved');
    raise exception 'ASSERT legacy automatic approval allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.review_league_join_request_explicit(request_id,'approved',other_driver,false);
    raise exception 'ASSERT cross-league link allowed';
  exception when no_data_found then null; end;
  assert (select status='pending' from public.league_join_requests where id=request_id), 'Failed approval atomic';
  assert not exists(select 1 from public.league_members where user_id=actor), 'Failed approval leaves no membership';
  perform public.review_league_join_request_explicit(request_id,'approved',driver_id,false);
  assert exists(select 1 from public.driver_identity_links l join public.driver_identities di on di.id=l.driver_identity_id where di.user_id=actor and l.driver_id=entry_two_test.driver_id), 'Explicit driver linked';
  assert (select display_name='Historical Driver' from public.drivers where id=driver_id), 'Historical driver unchanged';
  begin
    perform public.review_league_join_request_explicit(request_id,'approved',driver_id,false);
    raise exception 'ASSERT repeat review accepted';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  assert public.request_my_entry_league(code)->>'request_status'='already_member', 'Existing membership recognized';
  assert public.get_my_entry_state()->>'racevora_id'=original_id, 'Same ID after join';
  begin
    update public.driver_identities set racevora_number=999999999 where user_id=actor;
    raise exception 'ASSERT mutable ID';
  exception when sqlstate '428C9' then null; end;
  begin
    update public.driver_identities set racevora_number=default where user_id=actor;
    raise exception 'ASSERT ID regenerated';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert public.get_my_entry_state()->>'racevora_id'<>original_id, 'IDs distinct';
  begin
    perform public.get_join_request_driver_candidates(request_id);
    raise exception 'ASSERT foreign account reads request';
  exception when insufficient_privilege then null; end;
  perform public.save_my_entry_profile('New Entrant','NewTag');
  perform public.request_my_entry_league(code);
  select id into request_id from public.league_join_requests where user_id=outsider;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  begin
    perform public.review_league_join_request_explicit(request_id,'approved',driver_id,false);
    raise exception 'ASSERT claimed driver reassigned';
  exception when unique_violation then null; end;
  assert not exists(select 1 from public.league_members where user_id=outsider), 'Taken driver rolls membership back';
  perform public.review_league_join_request_explicit(request_id,'approved',null,true);
  assert (select count(*) from public.driver_identity_links l join public.driver_identities di on di.id=l.driver_identity_id where di.user_id=outsider)=1, 'Explicit new driver creation';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  update auth.users set banned_until=now()+interval '1 day' where id=outsider;
  begin
    perform public.get_my_entry_state();
    raise exception 'ASSERT banned user can provision';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.get_my_entry_state();
    raise exception 'ASSERT anonymous provisioning';
  exception when insufficient_privilege then null; end;
  assert not has_function_privilege('anon','public.get_my_entry_state()','execute'), 'Anon grant forbidden';
  assert not has_function_privilege('authenticated','entry_private.ensure_identity()','execute'), 'Helper not callable';
  assert has_function_privilege('authenticated','public.get_my_entry_state()','execute'), 'Authenticated facade available';
end;
$$;
rollback;
