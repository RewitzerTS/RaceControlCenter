-- Teams belong to a season. Historical results, points and XP are not rewritten.
create table league_roster_private.season_teams (
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references league_roster_private.teams(id) on delete restrict,
  primary key (season_id, team_id)
);
create index season_teams_team_idx on league_roster_private.season_teams(team_id);
alter table league_roster_private.season_teams enable row level security;
revoke all on league_roster_private.season_teams from public, anon, authenticated;

-- Only explicit season records qualify; old profile values/preferences do not.
insert into league_roster_private.season_teams(season_id,team_id)
select distinct v.season_id,t.id from private.season_vehicle_assignments v
join public.seasons s on s.id=v.season_id
join league_roster_private.teams t on t.league_id=s.league_id and t.name=v.team_name
on conflict do nothing;

create function league_roster_private.season_members(p_season_id uuid,p_round integer)
returns table(id uuid,display_name text,gamertag text,is_active boolean,is_ai boolean,
  team_name text,car_name text,ai_driver_id uuid,ai_driver_name text)
language sql stable security definer set search_path='' as $$
  select d.id,d.display_name,coalesce(nullif(di.gamertag,''),d.gamertag),
    (d.is_active or private.result_participation_status(d.ai_driver_reference,null)<>'PLAYER'),
    private.result_participation_status(d.ai_driver_reference,null)<>'PLAYER',
    case when v.id is not null then v.team_name when a.participant_type='PLAYER' then nullif(a.team_name,'') else null end,
    case when v.id is not null then v.car_name else coalesce(a.car_name,bot.car_name,case when d.ai_driver_reference like s.game_key||':%' then d.car_name end) end,
    link.ai_driver_id,bot.display_name
  from public.seasons s join public.drivers d on d.league_id=s.league_id
  left join public.driver_identity_links dl on dl.driver_id=d.id
  left join public.driver_identities di on di.id=dl.driver_identity_id and di.status='active'
  left join public.season_driver_assignments a on a.season_id=s.id and a.driver_id=d.id
  left join lateral(select x.* from private.season_vehicle_assignments x
    where x.season_id=s.id and x.driver_id=d.id and x.effective_from_round<=p_round
    order by x.effective_from_round desc limit 1) v on true
  left join lateral(select x.* from private.season_driver_ai_assignments x
    where x.season_id=s.id and x.human_driver_id=d.id and x.effective_from_round<=p_round
      and (x.effective_to_round is null or x.effective_to_round>=p_round)
    order by x.effective_from_round desc limit 1) link on true
  left join public.drivers bot on bot.id=link.ai_driver_id
  where s.id=p_season_id and (
    (private.result_participation_status(d.ai_driver_reference,null)='PLAYER'
      and (d.is_active or v.id is not null or link.id is not null or a.id is not null))
    or (d.ai_driver_reference like s.game_key||':%' and
      not exists(select 1 from private.season_driver_ai_assignments x where x.season_id=s.id
        and x.ai_driver_id=d.id and x.effective_from_round<=p_round
        and (x.effective_to_round is null or x.effective_to_round>=p_round)))
  );
$$;
-- Internal helper never exposes another league through a direct client call.
revoke all on function league_roster_private.season_members(uuid,integer) from public,anon,authenticated;

create or replace function league_roster_private.team_manager(p_mode text,p_round integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; season_name text; view_round integer;
  profiles jsonb; teams jsonb; roster jsonb; state jsonb; ai_ledger jsonb;
begin
  if p_mode is distinct from 'current' then raise exception using errcode='22023',message='TEAM_MODE_REQUIRED'; end if;
  select s.id,s.name into sid,season_name from public.seasons s where s.league_id=lid and s.is_active order by s.created_at desc limit 1;
  select coalesce(p_round,min(r.round_number) filter(where r.status='upcoming'),max(r.round_number))
    into view_round from public.races r where r.season_id=sid;
  if p_round is not null and not exists(select 1 from public.races where season_id=sid and round_number=p_round) then
    raise exception using errcode='22023',message='ROSTER_ROUND_REQUIRED';
  end if;
  roster:=public.get_league_roster_workspace();
  select coalesce(jsonb_agg(to_jsonb(m) order by m.is_ai,m.display_name,m.id),'[]') into profiles
    from league_roster_private.season_members(sid,view_round) m;
  select coalesce(jsonb_agg(jsonb_build_object('name',name) order by name),'[]') into teams from (
    select t.name from league_roster_private.season_teams st join league_roster_private.teams t on t.id=st.team_id where st.season_id=sid
    union select p->>'team_name' from jsonb_array_elements(profiles) p where nullif(p->>'team_name','') is not null
  ) names;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into ai_ledger from private.season_driver_ai_assignments a where a.season_id=sid;
  state:=jsonb_build_object('mode','current','season',case when sid is null then null else jsonb_build_object('id',sid,'name',season_name) end,
    'view_round',view_round,'races',roster->'races','teams',teams,'profiles',profiles);
  return state||jsonb_build_object('revision',md5((state||jsonb_build_object('ledger',roster->'vehicles','ai_ledger',ai_ledger))::text));
end; $$;

-- Validate final transaction state, not intermediate rows during a two-way swap.
create function league_roster_private.assert_season_team_capacity(p_season_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  for n in select r.round_number from public.races r where r.season_id=p_season_id and r.status='upcoming' order by r.round_number loop
    if exists(select lower(btrim(m.team_name)) from league_roster_private.season_members(p_season_id,n) m
      where nullif(btrim(m.team_name),'') is not null group by lower(btrim(m.team_name)) having count(*)>2) then
      raise exception using errcode='22023',message='TEAM_FULL';
    end if;
  end loop;
end; $$;
create function league_roster_private.check_season_team_capacity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op<>'INSERT' then perform league_roster_private.assert_season_team_capacity(old.season_id); end if;
  if tg_op<>'DELETE' then perform league_roster_private.assert_season_team_capacity(new.season_id); end if;
  return null;
end; $$;
create function league_roster_private.lock_team_season()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then perform 1 from public.seasons where id=old.season_id for update; return old; end if;
  perform 1 from public.seasons where id=new.season_id for update; return new;
end; $$;
revoke all on function league_roster_private.assert_season_team_capacity(uuid),
  league_roster_private.check_season_team_capacity(),league_roster_private.lock_team_season() from public,anon,authenticated;
create trigger team_vehicle_season_lock before insert or update or delete on private.season_vehicle_assignments
  for each row execute function league_roster_private.lock_team_season();
create trigger team_ai_season_lock before insert or update or delete on private.season_driver_ai_assignments
  for each row execute function league_roster_private.lock_team_season();
create constraint trigger team_vehicle_capacity after insert or update or delete on private.season_vehicle_assignments
  deferrable initially deferred for each row execute function league_roster_private.check_season_team_capacity();
create constraint trigger team_ai_capacity after insert or update or delete on private.season_driver_ai_assignments
  deferrable initially deferred for each row execute function league_roster_private.check_season_team_capacity();

create or replace function league_roster_private.assign_team(p_driver_id uuid,p_team_id uuid,p_effective_from_round integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; member record; team text;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  if sid is null or p_effective_from_round is null then raise exception using errcode='22023',message='ROSTER_ROUND_REQUIRED'; end if;
  select * into member from league_roster_private.season_members(sid,p_effective_from_round) where id=p_driver_id;
  if member.id is null or not member.is_active and not member.is_ai then raise exception using errcode='22023',message='TEAM_DRIVERS_INVALID'; end if;
  select name into team from league_roster_private.teams where id=p_team_id and league_id=lid;
  if team is null then raise exception using errcode='22023',message='TEAM_DESTINATION_REQUIRED'; end if;
  insert into league_roster_private.season_teams(season_id,team_id) values(sid,p_team_id) on conflict do nothing;
  perform public.change_season_vehicle(p_driver_id,p_effective_from_round,team,member.car_name,null);
  return jsonb_build_object('driver_id',p_driver_id,'team_id',p_team_id);
end; $$;

create or replace function public.change_season_vehicle(
  p_driver_id uuid, p_effective_from_round integer, p_team_name text, p_car_name text, p_ai_driver_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid := private.roster_admin_league();
  season public.seasons%rowtype;
  driver public.drivers%rowtype;
  race_id uuid;
  saved_id uuid;
  previous record;
  inherited_team text;
  clean_team text := nullif(btrim(p_team_name), '');
  clean_car text := nullif(btrim(p_car_name), '');
begin
  perform 1 from public.leagues where id=v_league_id for update;
  select * into season from public.seasons s where s.league_id = v_league_id and s.is_active order by created_at desc limit 1 for update;
  select * into driver from public.drivers d where d.id = p_driver_id and d.league_id = v_league_id;
  if season.id is null or driver.id is null then
    raise exception using errcode = '22023', message = 'ROSTER_HUMAN_REQUIRED';
  end if;
  if clean_car is null or length(clean_team) > 80 or length(clean_car) > 80
    or clean_team ~ '[<>]' or clean_car ~ '[<>]' then
    raise exception using errcode = '22023', message = 'ROSTER_VEHICLE_REQUIRED';
  end if;
  if p_effective_from_round is null or not exists (
    select 1 from public.races r where r.season_id = season.id and r.round_number = p_effective_from_round
  ) then raise exception using errcode = '22023', message = 'ROSTER_ROUND_REQUIRED'; end if;
  for race_id in select r.id from public.races r where r.season_id = season.id and r.round_number >= p_effective_from_round order by r.round_number loop
    perform private.assert_roster_race_open(race_id);
  end loop;
  select * into previous from league_roster_private.season_members(season.id,p_effective_from_round) where id=p_driver_id;
  if previous.id is null or (previous.is_ai and p_ai_driver_id is not null) then
    raise exception using errcode='22023',message='TEAM_DRIVERS_INVALID';
  end if;
  if p_ai_driver_id is not null then
    select m.team_name into inherited_team from league_roster_private.season_members(season.id,p_effective_from_round) m where m.id=p_ai_driver_id;
    -- Claiming a seat never overwrites a human's independent team.
    clean_team:=coalesce(previous.team_name,inherited_team);
  elsif previous.team_name is not null and clean_team is null then
    raise exception using errcode='22023',message='TEAM_DESTINATION_REQUIRED';
  end if;
  -- A later scheduled switch must not silently disappear.
  if exists (select 1 from private.season_vehicle_assignments v where v.season_id = season.id and v.driver_id = p_driver_id and v.effective_from_round > p_effective_from_round)
    or exists (select 1 from private.season_driver_ai_assignments a where a.season_id = season.id and a.human_driver_id = p_driver_id and a.effective_from_round > p_effective_from_round) then
    raise exception using errcode = '22023', message = 'ROSTER_LATER_CHANGE_EXISTS';
  end if;
  -- Preserve the pre-switch vehicle, including legacy seasons without a ledger.
  insert into private.season_vehicle_assignments(season_id, driver_id, effective_from_round, team_name, car_name, created_by)
    select season.id,p_driver_id,1,m.team_name,m.car_name,auth.uid()
      from league_roster_private.season_members(season.id,1) m where m.id=p_driver_id
    on conflict (season_id, driver_id, effective_from_round) do nothing;
  if p_ai_driver_id is not null then
    perform private.assign_season_driver_ai(p_driver_id, p_ai_driver_id, p_effective_from_round);
  end if;
  insert into private.season_vehicle_assignments(season_id, driver_id, effective_from_round, team_name, car_name, created_by)
    values(season.id, p_driver_id, p_effective_from_round, clean_team, clean_car, auth.uid())
    on conflict(season_id, driver_id, effective_from_round) do update
      set team_name = excluded.team_name, car_name = excluded.car_name, created_by = excluded.created_by, created_at = now()
    returning id into saved_id;
  if p_effective_from_round <= (select coalesce(min(round_number) filter (where status = 'upcoming'), max(round_number)) from public.races where season_id = season.id) then
    update public.drivers set league_team = clean_team, car_name = clean_car where id = p_driver_id;
  end if;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id, metadata)
    values ('league', v_league_id, auth.uid(), 'roster.vehicle_changed', 'driver', p_driver_id,
      jsonb_build_object('season_id', season.id, 'effective_from_round', p_effective_from_round, 'team_name', clean_team, 'car_name', clean_car, 'ai_driver_id', p_ai_driver_id));
  return jsonb_build_object('id', saved_id);
end;
$$;
revoke all on function public.change_season_vehicle(uuid, integer, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.change_season_vehicle(uuid, integer, text, text, uuid) to authenticated;


create or replace function league_roster_private.save_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; state jsonb; old_ids uuid[]; expected_departures uuid[];
  future_round integer; future_state jsonb;
  name text:=btrim(p_name); moves jsonb; item jsonb; tid uuid; rid uuid; result jsonb;
begin
  perform 1 from public.leagues l where l.id=lid for update;
  select s.id into sid from public.seasons s where s.league_id=lid and s.is_active order by s.created_at desc limit 1 for update;
  if p_mode is distinct from 'current' then raise exception using errcode='22023',message='TEAM_MODE_REQUIRED'; end if;
  if p_mode='current' then
    if sid is null or p_round is null or not exists(select 1 from public.races r where r.season_id=sid and r.round_number=p_round) then
      raise exception using errcode='22023',message='ROSTER_ROUND_REQUIRED';
    end if;
    for rid in select r.id from public.races r where r.season_id=sid and r.round_number>=p_round order by r.round_number loop
      perform private.assert_roster_race_open(rid);
    end loop;
  elsif p_mode<>'next' or p_mode is null or p_round is not null then
    raise exception using errcode='22023',message='TEAM_MODE_REQUIRED';
  end if;
  state:=league_roster_private.team_manager(p_mode,p_round);
  if p_revision is distinct from state->>'revision' then raise exception using errcode='40001',message='TEAM_STATE_CHANGED'; end if;
  if name is null or length(name) not between 2 and 80 or name ~ '[<>[:cntrl:]]' then raise exception using errcode='22023',message='TEAM_NAME_INVALID'; end if;
  if p_original_name is not null and (not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'=p_original_name)) then
    raise exception using errcode='22023',message='TEAM_NOT_FOUND';
  end if;
  if (p_original_name is null or name<>p_original_name) and exists(select 1 from jsonb_array_elements(state->'teams') t where lower(t->>'name')=lower(name)) then
    raise exception using errcode='23505',message='TEAM_NAME_EXISTS';
  end if;
  if p_driver_ids is null or cardinality(p_driver_ids)>2 or array_position(p_driver_ids,null) is not null
    or cardinality(p_driver_ids)<>(select count(distinct id) from unnest(p_driver_ids) id)
    or exists(select 1 from unnest(p_driver_ids) id where not exists(select 1 from jsonb_array_elements(state->'profiles') p where (p->>'id')::uuid=id and ((p->>'is_active')::boolean or (p->>'is_ai')::boolean))) then
    raise exception using errcode='22023',message='TEAM_DRIVERS_INVALID';
  end if;
  select coalesce(array_agg((p->>'id')::uuid),'{}'::uuid[]) into old_ids from jsonb_array_elements(state->'profiles') p where p->>'team_name'=p_original_name;
  select coalesce(array_agg(id),'{}'::uuid[]) into expected_departures from unnest(old_ids) id where not(id=any(p_driver_ids));
  if p_departures is null or jsonb_typeof(p_departures)<>'array' then raise exception using errcode='22023',message='TEAM_DESTINATION_REQUIRED'; end if;
  if jsonb_array_length(p_departures)<>cardinality(expected_departures)
    or exists(select 1 from jsonb_array_elements(p_departures) d where not(coalesce((d->>'driver_id')::uuid=any(expected_departures),false))
      or not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'=d->>'team_name' and t->>'name'<>name and t->>'name'<>p_original_name))
    or (select count(distinct d->>'driver_id') from jsonb_array_elements(p_departures) d)<>cardinality(expected_departures) then
    raise exception using errcode='22023',message='TEAM_DESTINATION_REQUIRED';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('driver_id',id,'team_name',name)),'[]'::jsonb) into moves from unnest(p_driver_ids) id;
  moves:=moves||p_departures;
  -- Validate the final simultaneous state so two drivers can safely swap teams.
  if exists (
    select coalesce(m->>'team_name',p->>'team_name') from jsonb_array_elements(state->'profiles') p
    left join lateral (select value from jsonb_array_elements(moves) where value->>'driver_id'=p->>'id') moved(m) on true
    where coalesce(m->>'team_name',p->>'team_name') in (select value->>'team_name' from jsonb_array_elements(moves))
    group by coalesce(m->>'team_name',p->>'team_name') having count(*)>2
  ) then raise exception using errcode='22023',message='TEAM_FULL'; end if;
  -- A new lineup must also fit alongside other drivers' already scheduled moves.
  -- Only transition boundaries can change the future team capacity.
  if p_mode='current' then
    for future_round in select distinct v.effective_from_round from private.season_vehicle_assignments v
      join public.races r on r.season_id=v.season_id and r.round_number=v.effective_from_round
      where v.season_id=sid and v.effective_from_round>p_round order by v.effective_from_round loop
      future_state:=league_roster_private.team_manager('current',future_round);
      if exists(
        select coalesce(m->>'team_name',p->>'team_name') from jsonb_array_elements(future_state->'profiles') p
        left join lateral(select value from jsonb_array_elements(moves) where value->>'driver_id'=p->>'id') moved(m) on true
        where coalesce(m->>'team_name',p->>'team_name') in(select value->>'team_name' from jsonb_array_elements(moves))
        group by coalesce(m->>'team_name',p->>'team_name') having count(*)>2
      ) then raise exception using errcode='22023',message='TEAM_FULL'; end if;
    end loop;
  end if;
  perform 1 from public.drivers d where d.id in(select (m->>'driver_id')::uuid from jsonb_array_elements(moves) m) order by d.id for update;
  insert into league_roster_private.teams(league_id,name) values(lid,name) on conflict do nothing;
  select t.id into tid from league_roster_private.teams t where t.league_id=lid and t.name=btrim(p_name);
  if tid is null then raise exception using errcode='23505',message='TEAM_NAME_EXISTS'; end if;
  insert into league_roster_private.season_teams(season_id,team_id) values(sid,tid) on conflict do nothing;
  for item in select value from jsonb_array_elements(moves) order by value->>'driver_id' loop
    insert into league_roster_private.teams(league_id,name) values(lid,item->>'team_name') on conflict do nothing;
    select t.id into tid from league_roster_private.teams t where t.league_id=lid and t.name=item->>'team_name';
    if tid is null then raise exception using errcode='23505',message='TEAM_NAME_EXISTS'; end if;
    -- Reuse existing authorization, open-race guards, vehicle preservation and history snapshots.
    perform league_roster_private.assign_team((item->>'driver_id')::uuid,tid,p_round);
  end loop;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,metadata)
    values('league',lid,auth.uid(),'league_team.lineup_saved','team',jsonb_build_object('name',name,'mode',p_mode,'effective_from_round',p_round,'moves',moves));
  -- Only retire an unused name from the editable catalog. Historical snapshots remain intact.
  if p_original_name is not null and name<>p_original_name then
    delete from league_roster_private.season_teams st using league_roster_private.teams t
      where st.season_id=sid and st.team_id=t.id and t.league_id=lid and t.name=p_original_name;
  end if;
  perform league_roster_private.assert_season_team_capacity(sid);
  result:=league_roster_private.team_manager(p_mode,p_round);
  return result;
end; $$;
create or replace function league_roster_private.save_driver_editor(p_driver_id uuid,p_profile jsonb,p_aliases jsonb,
  p_ai_driver_id uuid,p_round integer,p_revision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid := private.roster_admin_league(); d public.drivers%rowtype; ai public.drivers%rowtype;
  sid uuid; saved jsonb; item jsonb; keep_ids uuid[] := '{}'; alias_id uuid; team text; seat public.season_driver_assignments%rowtype;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  if p_driver_id is not null then
    select * into d from public.drivers where id=p_driver_id and league_id=lid for update;
    if d.id is null then raise exception using errcode='42501',message='Fahrer gehört nicht zu dieser Liga.'; end if;
  end if;
  if p_revision is distinct from (league_roster_private.driver_editor(p_driver_id)->>'revision') then
    raise exception using errcode='40001',message='DRIVER_EDITOR_STALE';
  end if;
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or p_profile ? 'number' then
    raise exception using errcode='22023',message='Die Startnummer wird nicht manuell bearbeitet.';
  end if;
  if p_aliases is null or jsonb_typeof(p_aliases)<>'array' or jsonb_array_length(p_aliases)>20 then
    raise exception using errcode='22023',message='Höchstens 20 Gamertags sind erlaubt.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_aliases) a where jsonb_typeof(a)<>'object'
    or a->>'alias' is null or char_length(btrim(a->>'alias')) not between 2 and 60 or a->>'alias' ~ '[<>[:cntrl:]]'
    or a->>'platform' is null or a->>'platform' not in ('ea','playstation','steam','xbox','other')) then
    raise exception using errcode='22023',message='Prüfe die Gamertags und ihre Plattformen.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_aliases) a group by lower(btrim(a->>'alias')),a->>'platform' having count(*)>1) then
    raise exception using errcode='22023',message='Ein Gamertag ist für dieselbe Plattform doppelt eingetragen.';
  end if;
  saved := public.upsert_league_driver(p_profile->>'display_name',p_driver_id,p_profile->>'gamertag',d.number,
    p_profile->>'nationality_code',d.league_team,d.car_name,coalesce((p_profile->>'is_active')::boolean,true));
  select * into d from public.drivers where id=(saved->>'id')::uuid;
  -- Only aliases scoped to this league driver can be changed. Personal account aliases remain untouched.
  for item in select value from jsonb_array_elements(p_aliases) loop
    insert into public.driver_aliases(driver_id,alias,alias_type,platform)
      values(d.id,btrim(item->>'alias'),'gamertag',item->>'platform')
      on conflict(driver_id,normalized_alias,platform) where driver_id is not null do update set alias=excluded.alias
      returning id into alias_id;
    keep_ids := array_append(keep_ids,alias_id);
  end loop;
  delete from public.driver_aliases where driver_id=d.id and not(id=any(keep_ids));
  if p_ai_driver_id is not null then
    if sid is null then raise exception using errcode='22023',message='Bitte zuerst eine Saison einrichten.'; end if;
    if not d.is_active then raise exception using errcode='22023',message='Aktiviere den Fahrer vor der KI-Zuordnung.'; end if;
    select a.* into ai from public.drivers a join public.seasons s on s.id=sid
      where a.id=p_ai_driver_id and a.league_id=lid and a.ai_driver_reference like s.game_key||':%';
    if ai.id is null then raise exception using errcode='22023',message='Der KI-Fahrer gehört nicht zum Spiel dieser Saison.'; end if;
    select m.team_name into team from league_roster_private.season_members(sid,p_round) m where m.id=d.id;
    if team is null then
      select m.team_name into team from league_roster_private.season_members(sid,p_round) m where m.id=ai.id;
    end if;
    -- Retain existing effective-date, occupied-seat and locked-result checks, and preserve the independent league team.
    perform public.change_season_vehicle(d.id,p_round,team,ai.car_name,ai.id);
    if p_round=1 then
      -- Before any race is run the initial grid must reflect the chosen human, not the displaced AI.
      select * into seat from public.season_driver_assignments where season_id=sid and seat_code=split_part(ai.ai_driver_reference,':',2);
      if seat.id is null then raise exception using errcode='22023',message='Der KI-Sitz fehlt im Starterfeld.'; end if;
      update public.season_driver_assignments a set driver_id=bot.id,participant_type='BOT',gamertag_snapshot=null,
        team_name=bot.league_team,car_name=bot.car_name
        from public.drivers bot join public.seasons s on s.id=sid
        where a.season_id=sid and a.driver_id=d.id and a.id<>seat.id
          and bot.league_id=lid and bot.ai_driver_reference=s.game_key||':'||a.seat_code;
      update public.season_driver_assignments set driver_id=d.id,participant_type='PLAYER',gamertag_snapshot=d.gamertag,
        team_name=coalesce(team,''),car_name=ai.car_name where id=seat.id;
      -- Start number is derived from the game seat, never supplied by the editor.
      update public.drivers set number=seat.number where id=d.id;
    end if;
  elsif p_round is not null then raise exception using errcode='22023',message='Wähle einen KI-Fahrer für die Zuordnung.';
  end if;
  insert into public.v2_audit_events(scope,league_id,actor_user_id,action,entity_type,entity_id,metadata)
    values('league',lid,auth.uid(),'driver.editor_saved','driver',d.id,jsonb_build_object('alias_count',jsonb_array_length(p_aliases),'ai_driver_id',p_ai_driver_id,'effective_from_round',p_round));
  perform league_roster_private.assert_season_team_capacity(sid);
  return league_roster_private.driver_editor(d.id);
end; $$;


create or replace function league_roster_private.start_without_assignments(p_name text,p_slug text,p_game_key text,
  p_start_date date,p_calendar jsonb,p_fastest_lap_bonus_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lid uuid := private.roster_admin_league(); active_humans uuid[]; result jsonb;
begin
  perform 1 from public.leagues where id=lid for update;
  select array_agg(id) into active_humans from public.drivers where league_id=lid and is_active
    and private.result_participation_status(ai_driver_reference,null)='PLAYER';
  result := league_roster_private.start_from_profiles(p_name,p_slug,p_game_key,p_start_date,'[]',p_calendar,p_fastest_lap_bonus_enabled);
  -- Preserve directory eligibility, without assigning a single human to the new season grid.
  update public.drivers set is_active=true,league_team=null,car_name=null where id=any(active_humans);
  -- Every new grid starts without independent league teams, including AI seats.
  insert into private.season_vehicle_assignments(season_id,driver_id,effective_from_round,team_name,car_name,created_by)
    select a.season_id,a.driver_id,1,null,a.car_name,auth.uid() from public.season_driver_assignments a
    where a.season_id=(result->'season'->>'id')::uuid
    on conflict(season_id,driver_id,effective_from_round) do update set team_name=null;

  return result;
end; $$;


create or replace function league_roster_private.change_vehicle(p_driver_id uuid,p_effective_from_round integer,p_car_name text,p_ai_driver_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; team text;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  if not exists(select 1 from public.drivers where id=p_driver_id and league_id=lid
    and private.result_participation_status(ai_driver_reference,null)='PLAYER') then
    raise exception using errcode='42501',message='ROSTER_HUMAN_REQUIRED';
  end if;
  select m.team_name into team from league_roster_private.season_members(sid,p_effective_from_round) m where m.id=p_driver_id;
  return public.change_season_vehicle(p_driver_id,p_effective_from_round,team,p_car_name,p_ai_driver_id);
end; $$;

-- Legacy AI assignment endpoint obeys the same team inheritance rule.
create or replace function public.assign_season_driver_ai(p_human_driver_id uuid,p_ai_driver_id uuid,p_effective_from_round integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ai public.drivers%rowtype;
begin
  select * into ai from public.drivers where id=p_ai_driver_id;
  return public.change_season_vehicle(p_human_driver_id,p_effective_from_round,null,ai.car_name,p_ai_driver_id);
end; $$;
