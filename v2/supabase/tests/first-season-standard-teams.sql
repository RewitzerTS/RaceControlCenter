-- Synthetic leagues only; all data and test users are rolled back.
begin;
create temporary table bootstrap_actor as select gen_random_uuid() actor,gen_random_uuid() outsider;
create temporary table bootstrap_fixture(game text,expected integer,lid uuid,slug text,human uuid default gen_random_uuid(),sid uuid,old_vehicles jsonb);
grant select on bootstrap_actor to authenticated;
grant select,insert,update on bootstrap_fixture to authenticated;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select actor,'authenticated','authenticated',actor||'@bootstrap.invalid','{}'::jsonb,'{}'::jsonb from bootstrap_actor
union all select outsider,'authenticated','authenticated',outsider||'@bootstrap.invalid','{}'::jsonb,'{}'::jsonb from bootstrap_actor;
insert into public.driver_identities(user_id,status,display_name,gamertag)
select actor,'active','Bootstrap Admin','BootstrapAdmin' from bootstrap_actor;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from bootstrap_actor;
set local role authenticated;
do $$ declare game text; league jsonb; slug text; begin
  foreach game in array array['f1_25','f1_26'] loop
    slug:='seed-'||gen_random_uuid();
    league:=public.create_league('Bootstrap '||game,slug,false);
    insert into bootstrap_fixture(game,expected,lid,slug)
      values(game,case game when 'f1_25' then 10 else 11 end,(league->>'id')::uuid,slug);
  end loop;
end $$;
reset role;
insert into public.drivers(id,league_id,display_name,gamertag,is_active)
select human,lid,'Synthetic Driver','BootstrapHuman',true from bootstrap_fixture;
-- Reuse a matching directory team rather than introducing a duplicate.
insert into league_roster_private.teams(league_id,name) select lid,'Ferrari' from bootstrap_fixture;
set local role authenticated;
do $$ declare f record; cal jsonb; result jsonb; state jsonb; ai uuid; rejected boolean; begin
  cal:=jsonb_build_array(
    jsonb_build_object('track_key','bahrain','date',current_date+7,'time','20:00','weather','klar','has_sprint',false),
    jsonb_build_object('track_key','monaco','date',current_date+14,'time','20:00','weather','klar','has_sprint',false));
  for f in select * from bootstrap_fixture loop
    perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug',f.slug)::text,true);
    rejected:=false;
    begin
      perform public.start_league_season_setup('Invalid','invalid',f.game,current_date+7,
        jsonb_build_array(jsonb_build_object('track_key','not-a-circuit','date',current_date+7,'time','20:00','weather','klar','has_sprint',false)),false);
    exception when others then rejected:=true; end;
    if not rejected then raise exception 'Invalid setup accepted'; end if;
    if exists(select 1 from public.seasons where league_id=f.lid) then raise exception 'Failed setup left a season'; end if;
    result:=public.start_league_season_setup('First season','first-season',f.game,current_date+7,cal,false);
    update bootstrap_fixture set sid=(result->'season'->>'id')::uuid where lid=f.lid;
    state:=public.get_league_team_manager('current',1);
    if jsonb_array_length(state->'teams')<>f.expected then raise exception 'Wrong team count for %: %',f.game,state->'teams'; end if;
    if (select count(*) from jsonb_array_elements(state->'profiles') p where (p->>'is_ai')::boolean)<>f.expected*2 then raise exception 'Wrong AI count'; end if;
    if exists(select 1 from jsonb_array_elements(state->'profiles') p where (p->>'is_ai')::boolean and p->>'team_name' is null) then raise exception 'AI missing team'; end if;
    if exists(select 1 from jsonb_array_elements(state->'profiles') p where (p->>'is_ai')::boolean group by p->>'team_name' having count(*)<>2) then raise exception 'Team must have two AI'; end if;
    if exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=f.human::text and p->>'team_name' is not null) then raise exception 'Human assigned automatically'; end if;
    -- Rename the team and then replace an AI with a human through the real editor.
    perform public.rename_league_season_team('Ferrari','Custom Racing',1,state->>'revision');
    select id into ai from public.drivers where league_id=f.lid and ai_driver_reference=f.game||':ferrari-leclerc';
    if ai is null then raise exception 'Ferrari catalog seat missing'; end if;
    perform public.save_league_driver_editor(f.human,
      jsonb_build_object('display_name','Synthetic Driver','gamertag','BootstrapHuman','is_active',true),
      '[]',ai,1,public.get_league_driver_editor(f.human)->>'revision');
    state:=public.get_league_team_manager('current',1);
    if not exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'id'=f.human::text and p->>'team_name'='Ferrari' and p->>'team_display_name'='Custom Racing') then raise exception 'Human failed to inherit renamed team'; end if;
    if (select count(*) from jsonb_array_elements(state->'profiles') p where p->>'team_name'='Ferrari')<>2 then raise exception 'AI replacement double counted'; end if;
    if jsonb_array_length(state->'teams')<>f.expected then raise exception 'Rename created duplicate'; end if;
    set constraints all immediate;
    set constraints all deferred;
  end loop;
end $$;
reset role;
do $$ declare f record; begin
  for f in select * from bootstrap_fixture loop
    if (select count(*) from league_roster_private.teams where league_id=f.lid)<>f.expected then raise exception 'Directory duplicate'; end if;
    if exists(select 1 from public.season_driver_assignments a join private.season_vehicle_assignments v on v.season_id=a.season_id and v.driver_id=a.driver_id where a.season_id=f.sid and v.team_name is distinct from a.team_name and a.participant_type='BOT') then raise exception 'Catalog team mapping changed'; end if;
    if (select count(*) from public.v2_audit_events where league_id=f.lid and action='season.standard_teams.seeded')<>1 then raise exception 'Bootstrap audit missing'; end if;
    update bootstrap_fixture set old_vehicles=(select jsonb_agg(to_jsonb(v) order by v.driver_id,v.effective_from_round) from private.season_vehicle_assignments v where season_id=f.sid) where lid=f.lid;
  end loop;
end $$;
set local role authenticated;
do $$ declare f record; state jsonb; cal jsonb; begin
  cal:=jsonb_build_array(jsonb_build_object('track_key','bahrain','date',current_date+30,'time','20:00','weather','klar','has_sprint',false));
  for f in select * from bootstrap_fixture loop
    perform set_config('request.headers',jsonb_build_object('x-rcc-league-slug',f.slug)::text,true);
    perform public.start_league_season_setup('Second season','second-season',f.game,current_date+30,cal,false);
    state:=public.get_league_team_manager('current',1);
    if jsonb_array_length(state->'teams')<>0 or exists(select 1 from jsonb_array_elements(state->'profiles') p where p->>'team_name' is not null) then raise exception 'Later season was seeded'; end if;
  end loop;
end $$;
reset role;
do $$ declare f record; begin
  for f in select * from bootstrap_fixture loop
    if (select jsonb_agg(to_jsonb(v) order by v.driver_id,v.effective_from_round) from private.season_vehicle_assignments v where season_id=f.sid) is distinct from f.old_vehicles then raise exception 'Previous season modified'; end if;
    if (select count(*) from public.v2_audit_events where league_id=f.lid and action='season.standard_teams.seeded')<>1 then raise exception 'Bootstrap ran twice'; end if;
  end loop;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from bootstrap_actor;
set local role authenticated;
do $$ begin
  begin perform public.start_league_season_setup('Forbidden','forbidden','f1_25',current_date,'[]',false); raise exception 'Outsider allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set constraints all immediate;
select 'first-season teams: F1 25/26, rollback/retry, rename, AI replacement, later season, history and access checks passed' as result;
rollback;
