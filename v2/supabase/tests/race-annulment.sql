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
set local role authenticated;
do $$ declare f record; reply jsonb; begin
 select * into f from annul_fixture;
 begin perform public.annul_league_race(f.race1,null,f.stamp,'Stale'); raise exception 'Stale result accepted'; exception when serialization_failure then null; end;
 begin perform public.annul_league_race(f.race1,f.version_id,f.stamp,' '); raise exception 'Empty reason accepted'; exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.member,'role','authenticated')::text,true);
 begin perform public.annul_league_race(f.race1,f.version_id,f.stamp,'Forbidden'); raise exception 'Driver allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',f.actor,'role','authenticated')::text,true);
 perform set_config('request.headers','{"x-rcc-league-slug":"not-this-league"}',true);
 begin perform public.annul_league_race(f.race1,f.version_id,f.stamp,'Forbidden'); raise exception 'Cross league allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug','annul-'||f.lid)::text,true);
 reply:=public.annul_league_race(f.race1,f.version_id,f.stamp,'League chose not to score this race');
 assert reply->>'status'='cancelled','Annulment failed';
 reply:=public.annul_league_race(f.race1,f.version_id,f.stamp,'Retry');
 assert (reply->>'alreadyAnnulled')::boolean,'Retry not idempotent';
 begin perform public.publish_league_result_draft(f.version_id); raise exception 'Annulled result republished'; exception when raise_exception then if sqlerrm<>'RACE_ANNULLED' then raise; end if; end;
end $$;
reset role;
do $$ declare f record; count_before bigint; begin
 select * into f from annul_fixture;
 assert (select jsonb_agg(to_jsonb(r) order by round_number) from public.races r where season_id=f.sid and id<>f.race1)=f.calendar_before,'Following races changed';
 assert exists(select 1 from public.races where id=f.race1 and status='cancelled' and annulled_at is not null and round_number=1 and race_date=current_date+1 and current_result_version_id is null),'Calendar evidence missing';
 assert not exists(select 1 from public.race_results where race_id=f.race1),'Official points remain';
 assert (select status from public.result_versions where id=f.version_id)='void','Result history missing';
 assert (select lifetime_xp from public.driver_progression where driver_identity_id=f.identity_id)=0,'XP not reversed';
 assert coalesce((select starts from public.driver_career_stats where driver_identity_id=f.identity_id),0)=0,'Career not reversed';
 assert not exists(select 1 from public.career_result_facts where race_id=f.race1),'Career facts remain';
 assert (select balance from public.driver_wallets where driver_identity_id=f.identity_id)=f.wallet_before,'Rewards not reversed';
 assert not exists(select 1 from public.driver_achievements where driver_identity_id=f.identity_id and status='unlocked'),'Achievements not reversed';
 assert not exists(select 1 from public.challenge_result_facts where race_id=f.race1),'Challenge facts remain';
 assert (select count(*) from public.domain_events where result_version_id=f.version_id and event_type='result.voided')=1,'Duplicate void event';
 begin perform private.create_result_version(f.race1,'Attempt reimport'); raise exception 'Reimport accepted'; exception when invalid_parameter_value then if sqlerrm<>'RACE_ANNULLED' then raise; end if; end;
 perform public.annul_league_race(f.race3,null,(select updated_at from public.races where id=f.race3),'Unpublished race annulled');
 assert exists(select 1 from private.result_draft_discards where result_version_id=f.draft_id),'Draft not discarded';
 begin perform public.publish_league_result_draft(f.draft_id); raise exception 'Discarded draft published'; exception when raise_exception then if sqlerrm<>'RACE_ANNULLED' then raise; end if; end;
 assert not has_function_privilege('anon','public.annul_league_race(uuid,uuid,timestamptz,text)','execute'),'Anonymous access';
 set constraints all immediate;
end $$;
select 'annulment: points, career, XP, rewards, history, calendar, drafts, replay and access checks passed' as result;
rollback;
