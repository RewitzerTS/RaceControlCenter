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
    if exists(select 1 from private.season_vehicle_assignments v where v.season_id=season.id
      and v.driver_id=p_ai_driver_id and v.effective_from_round>p_effective_from_round) then
      raise exception using errcode='22023',message='ROSTER_LATER_CHANGE_EXISTS';
    end if;
    select m.team_name into inherited_team from league_roster_private.season_members(season.id,p_effective_from_round) m where m.id=p_ai_driver_id;
    -- Claiming a seat never overwrites a human's independent team.
    clean_team:=coalesce(previous.team_name,inherited_team);
  elsif previous.team_name is not null and clean_team is null then
    raise exception using errcode='22023',message='TEAM_DESTINATION_REQUIRED';
  end if;
  -- A later scheduled switch must not silently disappear.
  if exists (select 1 from private.season_vehicle_assignments v where v.season_id = season.id and v.driver_id = p_driver_id and v.effective_from_round > p_effective_from_round)
    or exists (select 1 from private.season_driver_ai_assignments a where a.season_id = season.id and (a.human_driver_id = p_driver_id or a.ai_driver_id = p_driver_id) and a.effective_from_round > p_effective_from_round) then
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
