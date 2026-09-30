create or replace function league_roster_private.save_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; state jsonb; old_ids uuid[]; expected_departures uuid[];
  future_round integer; future_state jsonb;
  name text:=btrim(p_name); moves jsonb; item jsonb; tid uuid; rid uuid; result jsonb;
begin
  perform 1 from public.leagues l where l.id=lid for update;
  select s.id into sid from public.seasons s where s.league_id=lid and s.is_active order by s.created_at desc limit 1 for update;
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
    or exists(select 1 from unnest(p_driver_ids) id where not exists(select 1 from jsonb_array_elements(state->'profiles') p where (p->>'id')::uuid=id)) then
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
    delete from league_roster_private.teams t where t.league_id=lid and t.name=p_original_name
      and not exists(select 1 from league_roster_private.driver_teams dt where dt.team_id=t.id);
  end if;
  result:=league_roster_private.team_manager(p_mode,p_round);
  return result;
end; $$;


-- Vehicle changes no longer accept a team supplied by the browser.
create function league_roster_private.change_vehicle(p_driver_id uuid,p_effective_from_round integer,p_car_name text,p_ai_driver_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; current_team text; driver public.drivers%rowtype;
begin
  perform 1 from public.leagues where id=lid for update;
  select id into sid from public.seasons where league_id=lid and is_active order by created_at desc limit 1 for update;
  select * into driver from public.drivers where id=p_driver_id and league_id=lid for update;
  if driver.id is null then raise exception using errcode='42501',message='ROSTER_HUMAN_REQUIRED'; end if;
  if p_effective_from_round is null then raise exception using errcode='22023',message='ROSTER_ROUND_REQUIRED'; end if;
  select v.team_name into current_team from private.season_vehicle_assignments v
    where v.season_id=sid and v.driver_id=p_driver_id and v.effective_from_round<=p_effective_from_round
    order by v.effective_from_round desc limit 1;
  current_team:=coalesce(current_team,driver.league_team);
  if nullif(btrim(current_team),'') is null then
    raise exception using errcode='22023',message='ROSTER_TEAM_REQUIRED';
  end if;
  if p_ai_driver_id is not null and not exists(select 1 from public.drivers ai join public.seasons s on s.id=sid
    where ai.id=p_ai_driver_id and ai.league_id=lid and ai.ai_driver_reference like s.game_key||':%') then
    raise exception using errcode='22023',message='ROSTER_HUMAN_REQUIRED';
  end if;
  return public.change_season_vehicle(p_driver_id,p_effective_from_round,current_team,p_car_name,p_ai_driver_id);
end; $$;
create function public.change_league_vehicle(p_driver_id uuid,p_effective_from_round integer,p_car_name text,p_ai_driver_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select league_roster_private.change_vehicle(p_driver_id,p_effective_from_round,p_car_name,p_ai_driver_id);
$$;
revoke all on function league_roster_private.change_vehicle(uuid,integer,text,uuid), public.change_league_vehicle(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function league_roster_private.change_vehicle(uuid,integer,text,uuid), public.change_league_vehicle(uuid,integer,text,uuid) to authenticated;

