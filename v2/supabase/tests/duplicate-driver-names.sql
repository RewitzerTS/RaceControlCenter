-- Staging only: all synthetic accounts, profiles, results and rewards roll back.
begin;
create temporary table same_name_fixture as select gen_random_uuid() lid,gen_random_uuid() actor,
  gen_random_uuid() member_a,gen_random_uuid() member_b,null::uuid a,null::uuid b;
grant select,update on same_name_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select id,'authenticated','authenticated',id||'@name-test.invalid','{}','{}'
from same_name_fixture cross join lateral unnest(array[actor,member_a,member_b]) id;
insert into public.leagues(id,name,slug,is_public,settings)
select lid,'Same names QA','same-names-'||lid,false,'{}' from same_name_fixture;
insert into public.driver_identities(user_id,status,display_name,gamertag,real_name,public_name_mode)
select member_a,'active','Jakob','JakobFirstTag','Jakob','name' from same_name_fixture
union all select member_b,'active','Jakob','JakobSecondTag','Jakob','name' from same_name_fixture
union all select actor,'active','Admin','AdminTag','Admin','name' from same_name_fixture;
insert into public.league_members(league_id,user_id,role)
select lid,actor,'league_admin' from same_name_fixture
union all select lid,member_a,'driver' from same_name_fixture
union all select lid,member_b,'driver' from same_name_fixture;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','same-names-'||lid)::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from same_name_fixture;
set local role authenticated;
do $$ declare f record; state jsonb; v_season_id uuid; v_race_id uuid; draft_id uuid; before_versions bigint;
begin
  select * into f from same_name_fixture;
  update same_name_fixture set a=(public.create_and_link_league_member_driver(f.member_a)->>'driver_id')::uuid;
  update same_name_fixture set b=(public.create_and_link_league_member_driver(f.member_b)->>'driver_id')::uuid;
  select * into f from same_name_fixture;
  assert f.a<>f.b,'Same names must have separate driver IDs';
  assert (select count(*) from public.drivers where league_id=f.lid and display_name='Jakob')=2,'Both Jakobs must exist';
  begin perform public.create_and_link_league_member_driver(f.member_a); raise exception 'Duplicate account accepted'; exception when unique_violation then null; end;

  -- Creating a further unlinked same-name driver through the normal editor also works.
  state:=public.get_league_driver_editor(null);
  perform public.save_league_named_driver(null,jsonb_build_object('name','Jakob','public_name_mode','name','gamertag','JakobThirdTag','is_active',true),'[]',null,null,state->>'revision');
  assert (select count(*) from public.drivers where league_id=f.lid and display_name='Jakob')=3,'Editor still rejects equal names';

  state:=public.start_league_season_setup('Same names season','same-names-season','f1_25',current_date,
    jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date,'time','20:00','weather','klar','has_sprint',false)),false);
  v_season_id:=(state->'season'->>'id')::uuid;
  select id into v_race_id from public.races where races.season_id=v_season_id order by round_number limit 1;
  select count(*) into before_versions from public.result_versions where result_versions.race_id=v_race_id;
  begin
    perform public.create_league_result_draft(v_race_id,'[{"driver_name":"Jakob","finish_position":1,"points":25}]','Ambiguous name test');
    raise exception 'Ambiguous name was silently assigned';
  exception when invalid_parameter_value then
    if sqlerrm not like 'Mehrere Fahrer%' then raise; end if;
  end;
  reset role;
  assert (select count(*) from public.result_versions where result_versions.race_id=v_race_id)=before_versions,'Rejected import left a partial draft';
  set local role authenticated;
  begin
    perform public.create_league_result_draft(v_race_id,jsonb_build_array(jsonb_build_object('driver_id',gen_random_uuid(),'driver_name','JakobFirstTag','finish_position',1)),'Invalid ID test');
    raise exception 'Invalid ID fell back to a name';
  exception when no_data_found then null; end;
  -- Explicit IDs beat a shared name; a unique gamertag also resolves safely.
  draft_id:=(public.create_league_result_draft(v_race_id,jsonb_build_array(
    jsonb_build_object('driver_id',f.a,'driver_name','Jakob','finish_position',1,'points',25),
    jsonb_build_object('driver_name','JakobSecondTag','finish_position',2,'points',18)),'Distinct same-name result')->>'id')::uuid;
  -- Draft rows are not exposed through the public result-read policy.
  reset role;
  assert exists(select 1 from public.result_version_rows where result_version_id=draft_id and driver_id=f.a and finish_position=1),'First driver incorrectly assigned';
  assert exists(select 1 from public.result_version_rows where result_version_id=draft_id and driver_id=f.b and finish_position=2),'Second driver incorrectly assigned';
  set local role authenticated;
  perform public.publish_league_result_draft(draft_id);
  reset role;
  assert exists(select 1 from public.race_results where result_version_id=draft_id and driver_id=f.a and awarded_points=25),'First driver points lost';
  assert exists(select 1 from public.race_results where result_version_id=draft_id and driver_id=f.b and awarded_points=18),'Second driver points lost';
end; $$;
reset role;
do $$ declare f record; begin
  select * into f from same_name_fixture;
  assert exists(select 1 from public.driver_identity_links l join public.driver_identities i on i.id=l.driver_identity_id where l.driver_id=f.a and i.user_id=f.member_a),'First account link lost';
  assert exists(select 1 from public.driver_identity_links l join public.driver_identities i on i.id=l.driver_identity_id where l.driver_id=f.b and i.user_id=f.member_b),'Second account link lost';
end; $$;
set constraints all immediate;
select 'Same names, explicit links, editor creation, ambiguous import rollback and separate published points passed' as result;
rollback;
