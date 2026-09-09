-- Transactional staging test: all synthetic users, leagues and links are rolled back.
begin;
create temp table link_test_ids as select gen_random_uuid() actor, gen_random_uuid() member,
  gen_random_uuid() other_member, gen_random_uuid() league, gen_random_uuid() other_league,
  gen_random_uuid() driver, gen_random_uuid() other_driver, gen_random_uuid() ai_driver,
  gen_random_uuid() second_driver;
grant select on link_test_ids to authenticated;
insert into auth.users (id, email) select actor, actor || '@example.test' from link_test_ids
union all select member, member || '@example.test' from link_test_ids
union all select other_member, other_member || '@example.test' from link_test_ids;
insert into public.driver_identities (user_id) select actor from link_test_ids
union all select member from link_test_ids union all select other_member from link_test_ids;
insert into public.leagues (id,name,slug,is_public) select league,'Transient Link QA', 'qa-link-' || league,false from link_test_ids
union all select other_league,'Transient Other QA','qa-link-' || other_league,false from link_test_ids;
insert into public.league_members (league_id,user_id,role) select league,actor,'league_admin' from link_test_ids
union all select league,member,'driver' from link_test_ids
union all select league,other_member,'driver' from link_test_ids;
insert into public.drivers (id,league_id,display_name,ai_driver_reference)
select driver,league,'Legacy human','Lance Stroll' from link_test_ids
union all select other_driver,other_league,'Other league',null from link_test_ids
union all select ai_driver,league,'Dedicated AI','f1_25:mercedes-one' from link_test_ids
union all select second_driver,league,'Second human',null from link_test_ids;
select set_config('request.headers', jsonb_build_object('x-rcc-league-slug','qa-link-' || league)::text,true) from link_test_ids;
select set_config('request.jwt.claim.sub', actor::text,true) from link_test_ids;
set local role authenticated;
do $$
declare f record; options jsonb; receipt jsonb;
begin
  select * into f from link_test_ids;
  options := public.get_linkable_league_drivers();
  assert jsonb_array_length(options)=2, 'Only two same-league humans should be available';
  begin
    perform public.link_league_member_driver(f.member,f.other_driver);
    raise exception 'Cross-league link was accepted';
  exception when no_data_found then assert sqlerrm='MEMBER_DRIVER_NOT_FOUND'; end;
  begin
    perform public.link_league_member_driver(f.member,f.ai_driver);
    raise exception 'AI link was accepted';
  exception when no_data_found then assert sqlerrm='MEMBER_DRIVER_NOT_FOUND'; end;
  receipt := public.link_league_member_driver(f.member,f.driver);
  assert receipt->>'driver_id'=f.driver::text, 'Correct driver saved';
  assert public.link_league_member_driver(f.member,f.driver)->>'already_linked'='true', 'Retry must be idempotent';
  assert jsonb_array_length(public.get_linkable_league_drivers())=1, 'Linked driver removed from choices';
  assert (select count(*) from jsonb_array_elements(public.get_league_member_admin_workspace()->'members') m where m->>'driver_id'=f.driver::text)=1, 'Member workspace shows the link';
  begin
    perform public.link_league_member_driver(f.other_member,f.driver);
    raise exception 'Taken driver was accepted';
  exception when unique_violation then assert sqlerrm='MEMBER_DRIVER_TAKEN'; end;
  begin
    perform public.link_league_member_driver(f.member,f.second_driver);
    raise exception 'Second same-league link was accepted';
  exception when unique_violation then assert sqlerrm='MEMBER_ALREADY_LINKED'; end;
  begin
    perform public.link_league_member_driver(gen_random_uuid(),f.second_driver);
    raise exception 'Non-member was accepted';
  exception when no_data_found then assert sqlerrm='MEMBER_NOT_FOUND'; end;
  perform set_config('request.jwt.claim.sub',f.member::text,true);
  begin
    perform public.link_league_member_driver(f.other_member,f.second_driver);
    raise exception 'Driver permission was accepted';
  exception when insufficient_privilege then assert sqlerrm='MEMBER_LINK_DENIED'; end;
  begin
    perform public.get_linkable_league_drivers();
    raise exception 'Driver read permission was accepted';
  exception when insufficient_privilege then assert sqlerrm='MEMBER_LINK_DENIED'; end;
end;
$$;
reset role;
do $$
begin
  assert not has_function_privilege('anon','public.link_league_member_driver(uuid,uuid)','execute');
  assert not has_function_privilege('anon','public.get_linkable_league_drivers()','execute');
  assert (select count(*) from public.driver_claims c join link_test_ids f on c.driver_id=f.driver)=1, 'Exactly one verified claim';
  assert (select count(*) from public.driver_identity_links l join link_test_ids f on l.driver_id=f.driver)=1, 'Exactly one link';
end;
$$;
select 'member driver linking: all assertions passed' as result;
rollback;
