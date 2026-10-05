-- Staging-only transactional regression. All synthetic rows and notifications roll back.
begin;
create temp table qa_history_context(actor uuid, outsider uuid, league uuid, season uuid, driver uuid);
grant select on qa_history_context to authenticated;
do $$
declare
 u uuid; steward uuid; outsider uuid; lid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
 did uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid();
 identity_id uuid; case_id uuid:=gen_random_uuid(); lvl_identity uuid; lvl_user uuid; old_level integer;
begin
 u:=gen_random_uuid(); steward:=gen_random_uuid(); outsider:=gen_random_uuid();
 insert into auth.users(id,email,role,aud) values(u,u||'@qa.example.invalid','authenticated','authenticated'),(steward,steward||'@qa.example.invalid','authenticated','authenticated'),(outsider,outsider||'@qa.example.invalid','authenticated','authenticated');
 insert into public.driver_identities(user_id,profile_number,status) values(u,88,'active'),(steward,89,'active'),(outsider,90,'active');
 select id into identity_id from public.driver_identities where user_id=outsider;
 if identity_id is null then raise exception 'QA requester identity missing'; end if;
 insert into public.driver_progression(driver_identity_id) values(identity_id) on conflict do nothing;
 insert into public.leagues(id,slug,name,is_public) values(lid,'qa-history-'||substr(lid::text,1,8),'Transactional QA history',false);
 insert into public.league_members(league_id,user_id,role) values(lid,u,'league_admin'),(lid,steward,'steward');
 insert into public.seasons(id,league_id,slug,name,is_active) values(sid,lid,'qa-season','QA historical season',false);
 insert into public.drivers(id,league_id,display_name) values(did,lid,'QA historical driver');
 -- Season creation seeds its calendar; reuse that synthetic season's first round.
 select id into rid from public.races where season_id=sid order by round_number limit 1;
 if rid is null then
   insert into public.races(season_id,round_number,grand_prix_name,circuit_name,race_date,status) values(sid,1,'Monaco GP','Circuit de Monaco','2026-10-05','upcoming') returning id into rid;
 end if;
 insert into league_roster_private.confirmed_team_history(season_id,driver_id,team_name,evidence) values(sid,did,'Confirmed old team','Synthetic test evidence, not production data');
 insert into qa_history_context values(u,outsider,lid,sid,did);
 insert into public.league_join_requests(id,league_id,user_id,driver_identity_id) values(request_id,lid,outsider,identity_id);
 if (select count(*) from public.user_notifications where dedupe_key='join-request:'||request_id)<>1 then raise exception 'Join request must notify one admin'; end if;
 if not exists(select 1 from public.user_notifications where dedupe_key='join-request:'||request_id and recipient_user_id=u) then raise exception 'Wrong join recipient'; end if;
 update public.league_join_requests set requested_at=now() where id=request_id;
 if (select count(*) from public.user_notifications where dedupe_key='join-request:'||request_id)<>1 then raise exception 'Duplicate request notification'; end if;
 insert into public.steward_cases(id,league_id,race_id,case_number,title,description,accused_driver_id,rule_code,rule_version,created_by,idempotency_key)
 values(case_id,lid,rid,'QA-2026-1','QA case','Synthetic regression case only',did,'QA','1',u,'qa-case-'||case_id);
 if (select count(*) from public.user_notifications where dedupe_key='steward-opened:'||case_id)<>2 then raise exception 'Case must notify only admin and steward'; end if;
 if exists(select 1 from public.user_notifications where dedupe_key='steward-opened:'||case_id and recipient_user_id=outsider) then raise exception 'Case leaked to outsider'; end if;
 select p.driver_identity_id,di.user_id,p.level into lvl_identity,lvl_user,old_level
 from public.driver_progression p join public.driver_identities di on di.id=p.driver_identity_id
 where p.driver_identity_id=identity_id and p.level<2 and di.status='active' and di.user_id is not null
 and not exists(select 1 from public.user_notifications n where n.dedupe_key='level-up:'||di.id||':2') limit 1;
 if lvl_identity is null then raise exception 'QA progression fixture unavailable'; end if;
 update public.driver_progression set level=2 where driver_identity_id=lvl_identity;
 update public.driver_progression set level=old_level where driver_identity_id=lvl_identity;
 update public.driver_progression set level=2 where driver_identity_id=lvl_identity;
 if (select count(*) from public.user_notifications where dedupe_key='level-up:'||lvl_identity||':2' and recipient_user_id=lvl_user)<>1 then raise exception 'Level notification missing or duplicated'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug','qa-history-'||substr(lid::text,1,8))::text,true);
end $$;
set local role authenticated;
do $$
begin
 if (select count(*) from public.get_league_team_history())<>1 then raise exception 'Historical label inaccessible to member'; end if;
 if (select team_name from public.get_league_team_history())<>'Confirmed old team' then raise exception 'Wrong history'; end if;
 if exists(select 1 from public.user_notifications where league_id=(select league from qa_history_context) and recipient_user_id<>auth.uid()) then raise exception 'Notification RLS leaked'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select outsider from qa_history_context),'role','authenticated')::text,true);
 if exists(select 1 from public.get_league_team_history()) then raise exception 'History leaked to non-member'; end if;
 perform set_config('request.jwt.claims','{}',true);
 begin
   perform public.get_league_team_history();
   raise exception 'Anonymous history unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'PASS: historical scope, join recipient, case recipients, level idempotency, inbox RLS; rolled back' as result;
rollback;
