-- Team-centred management on top of the established effective-dated roster.
-- No scoring, result, identity, vehicle-seat or XP rules are changed.
create function league_roster_private.team_manager(p_mode text, p_round integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare lid uuid := private.roster_admin_league(); sid uuid; season_name text;
  view_round integer; directory jsonb; roster jsonb; profiles jsonb; teams jsonb; state jsonb;
begin
  if p_mode not in ('current','next') or p_mode is null then
    raise exception using errcode='22023', message='TEAM_MODE_REQUIRED';
  end if;
  select s.id,s.name into sid,season_name from public.seasons s where s.league_id=lid and s.is_active order by s.created_at desc limit 1;
  directory:=league_roster_private.get_directory();
  roster:=public.get_league_roster_workspace();
  select coalesce(p_round,min(r.round_number) filter(where r.status='upcoming'),max(r.round_number)) into view_round from public.races r where r.season_id=sid;
  if p_mode='current' and p_round is not null and not exists(select 1 from public.races r where r.season_id=sid and r.round_number=p_round) then
    raise exception using errcode='22023', message='ROSTER_ROUND_REQUIRED';
  end if;
  select coalesce(jsonb_agg(p || jsonb_build_object(
    'team_name',case when p_mode='next' then t.name when v.id is not null then v.team_name else d.league_team end,
    'car_name',case when v.id is not null then v.car_name else d.car_name end) order by p->>'display_name',p->>'id'),'[]'::jsonb)
  into profiles from jsonb_array_elements(directory->'profiles') p
  join public.drivers d on d.id=(p->>'id')::uuid
  left join league_roster_private.driver_teams dt on dt.driver_id=d.id and dt.league_id=lid
  left join league_roster_private.teams t on t.id=dt.team_id
  left join lateral (select a.* from private.season_vehicle_assignments a where a.season_id=sid and a.driver_id=d.id and a.effective_from_round<=view_round order by a.effective_from_round desc limit 1) v on true
  where d.is_active;
  select coalesce(jsonb_agg(jsonb_build_object('name',name) order by name),'[]'::jsonb) into teams from (
    select x->>'name' name from jsonb_array_elements(directory->'teams') x
    union select x->>'team_name' from jsonb_array_elements(profiles) x where nullif(x->>'team_name','') is not null
  ) names;
  state:=jsonb_build_object('mode',p_mode,'season',case when sid is null then null else jsonb_build_object('id',sid,'name',season_name) end,
    'view_round',view_round,'races',roster->'races','teams',teams,'profiles',profiles);
  -- Include future ledgers and preferences, not only the visible team snapshot.
  return state || jsonb_build_object('revision',md5((state || jsonb_build_object('ledger',roster->'vehicles','preferences',directory->'preferences'))::text));
end; $$;

create function league_roster_private.save_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lid uuid:=private.roster_admin_league(); sid uuid; state jsonb; old_ids uuid[]; expected_departures uuid[];
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
  if p_original_name is not null and (name<>p_original_name or not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'=p_original_name)) then
    raise exception using errcode='22023',message='TEAM_NOT_FOUND';
  end if;
  if p_original_name is null and exists(select 1 from jsonb_array_elements(state->'teams') t where lower(t->>'name')=lower(name)) then
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
      or not exists(select 1 from jsonb_array_elements(state->'teams') t where t->>'name'=d->>'team_name' and t->>'name'<>name))
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
  result:=league_roster_private.team_manager(p_mode,p_round);
  return result;
end; $$;

create function public.get_league_team_manager(p_mode text,p_round integer default null) returns jsonb language sql security invoker set search_path='' as $$ select league_roster_private.team_manager(p_mode,p_round); $$;
create function public.save_league_team_lineup(p_mode text,p_round integer,p_original_name text,p_name text,p_driver_ids uuid[],p_departures jsonb,p_revision text) returns jsonb language sql security invoker set search_path='' as $$ select league_roster_private.save_team_lineup(p_mode,p_round,p_original_name,p_name,p_driver_ids,p_departures,p_revision); $$;
revoke all on function league_roster_private.team_manager(text,integer),league_roster_private.save_team_lineup(text,integer,text,text,uuid[],jsonb,text),public.get_league_team_manager(text,integer),public.save_league_team_lineup(text,integer,text,text,uuid[],jsonb,text) from public,anon,authenticated;
grant execute on function league_roster_private.team_manager(text,integer),league_roster_private.save_team_lineup(text,integer,text,text,uuid[],jsonb,text),public.get_league_team_manager(text,integer),public.save_league_team_lineup(text,integer,text,text,uuid[],jsonb,text) to authenticated;
