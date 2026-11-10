-- Staging-only synthetic fixtures; always roll back, including rewards.
begin;
create temporary table annul_fixture as select gen_random_uuid() actor,gen_random_uuid() member,
 gen_random_uuid() lid,gen_random_uuid() sid,gen_random_uuid() driver,null::uuid identity_id,
 null::uuid race1,null::uuid race2,null::uuid race3,null::uuid version_id,null::uuid draft_id,
 null::timestamptz stamp,null::jsonb calendar_before,0::bigint wallet_before;
grant select,update on annul_fixture to authenticated;
insert into auth.users(id,email) select actor,actor||'@annul.invalid' from annul_fixture
 union all select member,member||'@annul.invalid' from annul_fixture;
insert into public.driver_identities(user_id,status) select actor,'active' from annul_fixture
 union all select member,'active' from annul_fixture;
update annul_fixture f set identity_id=(select id from public.driver_identities where user_id=f.member);
insert into public.leagues(id,name,slug,is_public) select lid,'Annul QA','annul-'||lid,false from annul_fixture;
insert into public.league_members(league_id,user_id,role) select lid,actor,'league_admin' from annul_fixture
 union all select lid,member,'driver' from annul_fixture;
insert into public.seasons(id,league_id,name,slug,is_active) select sid,lid,'Annul season','annul-season',true from annul_fixture;
delete from public.races where season_id=(select sid from annul_fixture);
insert into public.races(season_id,round_number,grand_prix_name,race_date,race_start_at,status)
 select sid,n,'Annul Test '||n,current_date+n,(current_date+n)::timestamptz+interval '20 hours','upcoming'
 from annul_fixture cross join generate_series(1,3) n;
update annul_fixture f set race1=(select id from public.races where season_id=f.sid and round_number=1),
 race2=(select id from public.races where season_id=f.sid and round_number=2),
 race3=(select id from public.races where season_id=f.sid and round_number=3);
insert into public.drivers(id,league_id,display_name,gamertag) select driver,lid,'Annul Driver','AnnulTag' from annul_fixture;
select set_config('request.headers',jsonb_build_object('x-rcc-league-slug','annul-'||lid)::text,true),
 set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from annul_fixture;
do $$ declare f record; v uuid; e uuid; receipt jsonb; begin
 select * into f from annul_fixture;
 perform public.link_league_member_driver(f.member,f.driver);
 update annul_fixture set wallet_before=coalesce((select balance from public.driver_wallets where driver_identity_id=f.identity_id),0);
 v:=private.create_result_version(f.race1,'Synthetic annulment result');
 insert into public.result_version_rows(result_version_id,row_order,driver_id,grid_position,finish_position,participation_status,classification_status,awarded_points,points)
 values(v,1,f.driver,1,1,'PLAYER','classified',25,25);
 perform private.validate_result_version(v);
 perform private.activate_result_version(v);
 for e in select id from public.domain_events where result_version_id=v loop
   receipt:=private.process_domain_event_queue(1,e);
   assert (receipt->>'failed')::integer=0,'Initial publication failed';
 end loop;
 update annul_fixture set version_id=v,stamp=(select updated_at from public.races where id=f.race1);
 assert (select lifetime_xp from public.driver_progression where driver_identity_id=f.identity_id)>0,'XP fixture missing';
 assert (select starts from public.driver_career_stats where driver_identity_id=f.identity_id)=1,'Career fixture missing';
 v:=private.create_result_version(f.race3,'Synthetic unpublished draft');
 insert into public.result_version_rows(result_version_id,row_order,driver_id,finish_position,awarded_points,points) values(v,1,f.driver,1,25,25);
 perform private.validate_result_version(v);
 update annul_fixture set draft_id=v,calendar_before=(select jsonb_agg(to_jsonb(r) order by round_number) from public.races r where season_id=f.sid and id<>f.race1);
end $$;


insert into public.drivers(league_id,display_name,ai_driver_reference,is_active)
select lid,'Pierre Gasly','f1_25:alpine-gasly',true from annul_fixture;
insert into private.season_driver_ai_assignments(season_id,human_driver_id,ai_driver_id,seat_code,effective_from_round)
select f.sid,f.driver,d.id,'alpine-gasly',1 from annul_fixture f join public.drivers d on d.league_id=f.lid and d.display_name='Pierre Gasly';
update public.driver_identities set gamertag='alpine_wolf' where id=(select identity_id from annul_fixture);
set local role authenticated;
do $$ declare f record; snapshot jsonb; begin
 select * into f from annul_fixture;
 snapshot:=public.get_reverse_grid_workspace(false);
 assert snapshot#>>'{data,season,id}'=f.sid::text,'Wrong season';
 assert jsonb_array_length(snapshot->'drafts')=0,'Draft in official snapshot';
 assert exists(select 1 from jsonb_array_elements(snapshot->'seats') seat where seat->>'driverId'=f.driver::text and seat->>'aiName'='Pierre Gasly' and seat->>'gamertag'='alpine_wolf'),'AI/gamertag pairing missing';
 assert jsonb_array_length(snapshot#>'{data,results}')=1,'Published result missing';
 snapshot:=public.get_reverse_grid_workspace(true);
 assert jsonb_array_length(snapshot->'drafts')=1,'Saved draft missing';
 assert snapshot#>>'{drafts,0,versionId}'=f.draft_id::text,'Wrong draft';
 assert snapshot#>>'{drafts,0,rows,0,driver_id}'=f.driver::text,'Wrong projected driver';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.member,'role','authenticated')::text,true);
 begin perform public.get_reverse_grid_workspace(false); raise exception 'Driver gained access'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.actor,'role','authenticated')::text,true);
 perform set_config('request.headers','{"x-rcc-league-slug":"not-this-league"}',true);
 begin perform public.get_reverse_grid_workspace(true); raise exception 'Wrong tenant allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug','annul-'||f.lid)::text,true);
end $$;
reset role;
do $$ declare f record; snapshot jsonb; begin
 select * into f from annul_fixture;
 insert into private.result_draft_discards(result_version_id,actor_id) values(f.draft_id,f.actor);
 assert jsonb_array_length(public.get_reverse_grid_workspace(true)->'drafts')=0,'Discarded draft remains';
 assert not has_function_privilege('anon','public.get_reverse_grid_workspace(boolean)','execute'),'Anon access';
 assert not has_schema_privilege('authenticated','private','usage'),'Private schema exposed';
 assert (select status from public.result_versions where id=f.draft_id)='validated','Preview mutated draft';
 assert (select current_result_version_id from public.races where id=f.race3) is null,'Preview published draft';
 set constraints all immediate;
end $$;
select 'reverse grid: official/draft sources, discarded drafts, isolation, permissions and no publication passed' result;
rollback;
