-- Race-scoped human substitutes and effective-dated vehicles. No published
-- result is rewritten. Private tables are accessible only through scoped RPCs.
-- Preserve all values that league admins confirm in the result import review table.

create or replace function public.create_league_result_draft(
  p_race_id uuid,
  p_rows jsonb,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league_id uuid;
  target_season_id uuid;
  current_version_id uuid;
  new_version_id uuid;
  clean_reason text := btrim(coalesce(p_change_reason, ''));
  row_item jsonb;
  row_no integer := 0;
  target_driver public.drivers%rowtype;
  finish_value integer;
  grid_value integer;
  pit_stops_value integer;
  points_value numeric;
  fastest_lap_value bigint;
  fastest_lap_text text;
  race_time_text text;
  participant_value text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select s.league_id, s.id, r.current_result_version_id
  into target_league_id, target_season_id, current_version_id
  from public.races r
  join public.seasons s on s.id = r.season_id
  join public.leagues l on l.id = s.league_id
  where r.id = p_race_id
    and l.slug = public.requested_league_slug();

  if target_league_id is null
    or not private.has_league_capability(target_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League result access denied.';
  end if;

  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) not between 1 and 40
    or char_length(clean_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Result rows or change reason are invalid.';
  end if;

  new_version_id := private.create_result_version(p_race_id, clean_reason, current_version_id, null);

  for row_item in select value from jsonb_array_elements(p_rows)
  loop
    row_no := row_no + 1;

    select d.*
    into target_driver
    from public.drivers d
    where d.league_id = target_league_id
      and (
        d.id::text = nullif(row_item->>'driver_id', '')
        or (nullif(row_item->>'driver_id', '') is null
          and nullif(btrim(row_item->>'driver_name'), '') is not null
          and (lower(d.display_name) = lower(btrim(row_item->>'driver_name'))
            or lower(d.gamertag) = lower(btrim(row_item->>'driver_name'))))
      )
    limit 1;

    if target_driver.id is null then
      raise exception using errcode = 'P0002', message = format('Unknown driver in row %s.', row_no);
    end if;

    begin
      finish_value := nullif(row_item->>'finish_position', '')::integer;
      grid_value := nullif(row_item->>'grid_position', '')::integer;
      pit_stops_value := coalesce(nullif(row_item->>'pit_stops', '')::integer, 0);
      points_value := coalesce(nullif(row_item->>'points', '')::numeric, 0);
      fastest_lap_value := coalesce(
        nullif(row_item->>'fastest_lap_time_ms', '')::bigint,
        nullif(row_item->>'fastest_lap_ms', '')::bigint
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = format('Invalid numeric value in row %s.', row_no);
    end;

    if finish_value is not null and finish_value not between 1 and 99 then
      raise exception using errcode = '22023', message = format('Invalid finish position in row %s.', row_no);
    end if;
    if grid_value is not null and grid_value not between 1 and 99 then
      raise exception using errcode = '22023', message = format('Invalid grid position in row %s.', row_no);
    end if;
    if pit_stops_value not between 0 and 99 then
      raise exception using errcode = '22023', message = format('Invalid pit-stop count in row %s.', row_no);
    end if;
    if fastest_lap_value is not null and fastest_lap_value not between 1 and 600000 then
      raise exception using errcode = '22023', message = format('Invalid fastest lap in row %s.', row_no);
    end if;

    fastest_lap_text := nullif(btrim(coalesce(row_item->>'fastest_lap_time', '')), '');
    race_time_text := nullif(btrim(coalesce(row_item->>'race_time', '')), '');

    select case when upper(a.participant_type) = 'BOT' then 'BOT' else 'PLAYER' end
    into participant_value
    from public.season_driver_assignments a
    where a.season_id = target_season_id
      and a.driver_id = target_driver.id
    limit 1;
    participant_value := coalesce(participant_value, 'PLAYER');

    insert into public.result_version_rows (
      result_version_id, row_order, driver_id, finish_position, grid_position,
      pit_stops, participation_status, awarded_points, base_points, points,
      fastest_lap_time, fastest_lap_time_ms, fastest_lap_ms, race_time,
      points_team_name, points_car_name, car_name_snapshot
    ) values (
      new_version_id, row_no, target_driver.id, finish_value, grid_value,
      pit_stops_value, participant_value, points_value, points_value, points_value,
      fastest_lap_text, fastest_lap_value, fastest_lap_value, race_time_text,
      coalesce(nullif(row_item->>'team_name', ''), target_driver.league_team),
      coalesce(nullif(row_item->>'car_name', ''), target_driver.car_name),
      target_driver.car_name
    );
  end loop;

  perform private.validate_result_version(new_version_id);

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league_id, actor_id, 'result.draft_created', 'result_version', new_version_id,
    jsonb_build_object('race_id', p_race_id, 'rows', row_no, 'base_version_id', current_version_id)
  );

  return jsonb_build_object('id', new_version_id, 'status', 'validated', 'rows', row_no);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'A driver or finish row occurs more than once.';
end
$$;

revoke all on function public.create_league_result_draft(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_league_result_draft(uuid, jsonb, text)
  to authenticated, service_role;

create table private.race_substitutions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  primary_driver_id uuid not null references public.drivers(id) on delete restrict,
  substitute_driver_id uuid not null references public.drivers(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (primary_driver_id <> substitute_driver_id),
  unique (race_id, primary_driver_id), unique (race_id, substitute_driver_id)
);
create index race_substitutions_primary on private.race_substitutions(primary_driver_id);
create index race_substitutions_substitute on private.race_substitutions(substitute_driver_id);
create index race_substitutions_actor on private.race_substitutions(created_by);
alter table private.race_substitutions enable row level security;
revoke all on private.race_substitutions from public, anon, authenticated, service_role;

create table private.season_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  effective_from_round integer not null check (effective_from_round > 0),
  team_name text, car_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, driver_id, effective_from_round)
);
create index season_vehicle_assignments_driver on private.season_vehicle_assignments(driver_id);
create index season_vehicle_assignments_actor on private.season_vehicle_assignments(created_by);
alter table private.season_vehicle_assignments enable row level security;
revoke all on private.season_vehicle_assignments from public, anon, authenticated, service_role;

create function private.roster_admin_league()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_league_id uuid;
begin
  select l.id into v_league_id from public.leagues l where l.slug = public.requested_league_slug();
  if (select auth.uid()) is null or v_league_id is null
    or not private.has_league_capability(v_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League roster administration access denied.';
  end if;
  return v_league_id;
end;
$$;
revoke all on function private.roster_admin_league() from public, anon, authenticated, service_role;

create function private.assert_roster_race_open(p_race_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.races%rowtype;
begin
  select * into target from public.races where id = p_race_id for update;
  if target.id is null or target.status <> 'upcoming'
    or target.current_result_version_id is not null
    or exists (select 1 from public.result_versions where race_id = p_race_id) then
    raise exception using errcode = '22023', message = 'ROSTER_RACE_LOCKED';
  end if;
end;
$$;
revoke all on function private.assert_roster_race_open(uuid) from public, anon, authenticated, service_role;

create function public.set_race_substitution(p_race_id uuid, p_primary_driver_id uuid, p_substitute_driver_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid := private.roster_admin_league();
  target public.races%rowtype;
  saved private.race_substitutions%rowtype;
begin
  -- Same lock order for all roster mutations; imports serialize on race locks.
  perform 1 from public.seasons s join public.races r on r.season_id = s.id
    where r.id = p_race_id and s.league_id = v_league_id and s.is_active for update of s;
  if not found then raise exception using errcode = '42501', message = 'Active league race required.'; end if;
  perform private.assert_roster_race_open(p_race_id);
  select * into target from public.races where id = p_race_id;
  if p_primary_driver_id is null or not exists (
    select 1 from public.drivers where id = p_primary_driver_id and drivers.league_id = v_league_id
      and private.result_participation_status(ai_driver_reference, null) = 'PLAYER'
  ) then raise exception using errcode = '22023', message = 'ROSTER_HUMAN_REQUIRED'; end if;
  if p_substitute_driver_id is null then
    delete from private.race_substitutions where race_id = p_race_id and primary_driver_id = p_primary_driver_id returning * into saved;
  else
    if p_primary_driver_id = p_substitute_driver_id or not exists (
      select 1 from public.drivers where id = p_substitute_driver_id and drivers.league_id = v_league_id
        and private.result_participation_status(ai_driver_reference, null) = 'PLAYER'
    ) then raise exception using errcode = '22023', message = 'ROSTER_HUMAN_REQUIRED'; end if;
    if exists (
      select 1 from private.race_substitutions s where s.race_id = p_race_id
        and s.primary_driver_id <> p_primary_driver_id
        and (s.substitute_driver_id in (p_primary_driver_id, p_substitute_driver_id)
          or s.primary_driver_id = p_substitute_driver_id)
    ) then raise exception using errcode = '23505', message = 'ROSTER_DOUBLE_BOOKING'; end if;
    insert into private.race_substitutions (race_id, primary_driver_id, substitute_driver_id, created_by)
      values (p_race_id, p_primary_driver_id, p_substitute_driver_id, auth.uid())
      on conflict (race_id, primary_driver_id) do update
      set substitute_driver_id = excluded.substitute_driver_id, created_by = excluded.created_by, created_at = now()
      returning * into saved;
  end if;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id, metadata)
    values ('league', v_league_id, auth.uid(), case when p_substitute_driver_id is null then 'roster.substitute_removed' else 'roster.substitute_set' end,
      'race', p_race_id, jsonb_build_object('primary_driver_id', p_primary_driver_id, 'substitute_driver_id', p_substitute_driver_id, 'points_owner_driver_id', p_primary_driver_id));
  return jsonb_build_object('id', saved.id, 'race_id', p_race_id);
end;
$$;
revoke all on function public.set_race_substitution(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_race_substitution(uuid, uuid, uuid) to authenticated;

-- Retain the existing AI-seat conflict handling, but remove its public bypass.
alter function public.assign_season_driver_ai(uuid, uuid, integer) set schema private;
revoke all on function private.assign_season_driver_ai(uuid, uuid, integer) from public, anon, authenticated, service_role;

create function public.change_season_vehicle(
  p_driver_id uuid, p_effective_from_round integer, p_team_name text, p_car_name text, p_ai_driver_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_league_id uuid := private.roster_admin_league();
  season public.seasons%rowtype;
  driver public.drivers%rowtype;
  race_id uuid;
  saved_id uuid;
  clean_team text := nullif(btrim(p_team_name), '');
  clean_car text := nullif(btrim(p_car_name), '');
begin
  select * into season from public.seasons s where s.league_id = v_league_id and s.is_active order by created_at desc limit 1 for update;
  select * into driver from public.drivers d where d.id = p_driver_id and d.league_id = v_league_id;
  if season.id is null or driver.id is null or private.result_participation_status(driver.ai_driver_reference, null) <> 'PLAYER' then
    raise exception using errcode = '22023', message = 'ROSTER_HUMAN_REQUIRED';
  end if;
  if clean_team is null or clean_car is null or length(clean_team) > 80 or length(clean_car) > 80
    or clean_team ~ '[<>]' or clean_car ~ '[<>]' then
    raise exception using errcode = '22023', message = 'ROSTER_VEHICLE_REQUIRED';
  end if;
  if p_effective_from_round is null or not exists (
    select 1 from public.races r where r.season_id = season.id and r.round_number = p_effective_from_round
  ) then raise exception using errcode = '22023', message = 'ROSTER_ROUND_REQUIRED'; end if;
  for race_id in select r.id from public.races r where r.season_id = season.id and r.round_number >= p_effective_from_round order by r.round_number loop
    perform private.assert_roster_race_open(race_id);
  end loop;
  -- A later scheduled switch must not silently disappear.
  if exists (select 1 from private.season_vehicle_assignments v where v.season_id = season.id and v.driver_id = p_driver_id and v.effective_from_round > p_effective_from_round)
    or exists (select 1 from private.season_driver_ai_assignments a where a.season_id = season.id and a.human_driver_id = p_driver_id and a.effective_from_round > p_effective_from_round) then
    raise exception using errcode = '22023', message = 'ROSTER_LATER_CHANGE_EXISTS';
  end if;
  -- Preserve the pre-switch vehicle, including legacy seasons without a ledger.
  insert into private.season_vehicle_assignments(season_id, driver_id, effective_from_round, team_name, car_name, created_by)
    values(season.id, p_driver_id, 1, driver.league_team, driver.car_name, auth.uid())
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

create function public.assign_season_driver_ai(p_human_driver_id uuid, p_ai_driver_id uuid, p_effective_from_round integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare ai public.drivers%rowtype;
begin
  select * into ai from public.drivers where id = p_ai_driver_id;
  return public.change_season_vehicle(p_human_driver_id, p_effective_from_round, ai.league_team, ai.car_name, p_ai_driver_id);
end;
$$;
revoke all on function public.assign_season_driver_ai(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.assign_season_driver_ai(uuid, uuid, integer) to authenticated;

create function public.get_league_roster_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_league_id uuid := private.roster_admin_league(); v_season_id uuid;
begin
  select s.id into v_season_id from public.seasons s where s.league_id = v_league_id and s.is_active order by created_at desc limit 1;
  return jsonb_build_object('season_id', v_season_id,
    'races', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'round', r.round_number, 'name', r.grand_prix_name,
      'locked', r.status <> 'upcoming' or r.current_result_version_id is not null or exists(select 1 from public.result_versions rv where rv.race_id = r.id)) order by r.round_number)
      from public.races r where r.season_id = v_season_id), '[]'::jsonb),
    'substitutions', coalesce((select jsonb_agg(jsonb_build_object('id', sub.id, 'race_id', sub.race_id, 'primary_driver_id', sub.primary_driver_id,
      'substitute_driver_id', sub.substitute_driver_id) order by r.round_number)
      from private.race_substitutions sub join public.races r on r.id = sub.race_id where r.season_id = v_season_id), '[]'::jsonb),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'driver_id', v.driver_id,
      'from_round', v.effective_from_round, 'team_name', v.team_name, 'car_name', v.car_name) order by v.effective_from_round desc)
      from private.season_vehicle_assignments v where v.season_id = v_season_id), '[]'::jsonb));
end;
$$;
revoke all on function public.get_league_roster_workspace() from public, anon, authenticated, service_role;
grant execute on function public.get_league_roster_workspace() to authenticated;

-- Runs after the existing AI/BOT attribution, only for new result rows.
-- The actual participant remains driver_id; the represented driver owns points.
create function private.apply_roster_result_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  race public.races%rowtype;
  sub private.race_substitutions%rowtype;
  vehicle private.season_vehicle_assignments%rowtype;
  prior public.result_version_rows%rowtype;
  owner public.drivers%rowtype;
  slot_owner uuid;
begin
  select r.* into race from public.result_versions rv join public.races r on r.id = rv.race_id where rv.id = new.result_version_id;
  select * into sub from private.race_substitutions where race_id = race.id and substitute_driver_id = new.driver_id;
  slot_owner := coalesce(sub.primary_driver_id, new.points_owner_driver_id, new.driver_id);
  if exists (select 1 from private.race_substitutions s where s.race_id = race.id
    and s.primary_driver_id = slot_owner and s.substitute_driver_id <> new.driver_id) then
    raise exception using errcode = '22023', message = 'ROSTER_USE_SUBSTITUTE';
  end if;
  -- Do not credit both the replacement and the represented seat in one race.
  if exists (select 1 from public.result_version_rows rr where rr.result_version_id = new.result_version_id
    and coalesce(rr.points_owner_driver_id, rr.driver_id) = slot_owner and rr.id <> new.id) then
    raise exception using errcode = '22023', message = 'ROSTER_DOUBLE_POINTS';
  end if;
  select * into prior from public.result_version_rows where result_version_id = race.current_result_version_id and driver_id = new.driver_id;
  if prior.id is not null then
    new.points_owner_driver_id := prior.points_owner_driver_id;
    new.source_assignment_id := prior.source_assignment_id;
    new.points_team_name := prior.points_team_name;
    new.points_car_name := prior.points_car_name;
    new.car_name_snapshot := prior.car_name_snapshot;
    return new;
  end if;
  select * into vehicle from private.season_vehicle_assignments v where v.season_id = race.season_id
    and v.driver_id = slot_owner and v.effective_from_round <= race.round_number order by v.effective_from_round desc limit 1;
  if sub.id is not null then
    new.points_owner_driver_id := sub.primary_driver_id;
    new.source_assignment_id := sub.id;
    new.participation_status := 'PLAYER';
    select * into owner from public.drivers where id = sub.primary_driver_id;
    new.points_team_name := owner.league_team;
    new.points_car_name := owner.car_name;
    new.car_name_snapshot := owner.car_name;
  end if;
  if vehicle.id is not null then
    new.points_team_name := vehicle.team_name;
    new.points_car_name := vehicle.car_name;
    new.car_name_snapshot := vehicle.car_name;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_roster_result_snapshot() from public, anon, authenticated, service_role;
create trigger result_version_rows_20_roster_snapshot before insert on public.result_version_rows
  for each row execute function private.apply_roster_result_snapshot();

-- Activate scheduled vehicle display values as the calendar advances.
create function private.sync_current_roster_vehicles()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_round integer;
begin
  if new.current_result_version_id is not distinct from old.current_result_version_id then return new; end if;
  select coalesce(min(round_number) filter(where status = 'upcoming'), max(round_number)) into next_round
    from public.races where season_id = new.season_id;
  update public.drivers d set league_team = v.team_name, car_name = v.car_name
    from (select distinct on (driver_id) driver_id, team_name, car_name from private.season_vehicle_assignments
      where season_id = new.season_id and effective_from_round <= next_round order by driver_id, effective_from_round desc) v
    where d.id = v.driver_id and (d.league_team is distinct from v.team_name or d.car_name is distinct from v.car_name);
  -- A future F1-seat switch must also release the old AI seat in the grid.
  update public.drivers d set is_active = not exists (
    select 1 from private.season_driver_ai_assignments a where a.season_id = new.season_id
      and a.ai_driver_id = d.id and a.effective_from_round <= next_round
      and (a.effective_to_round is null or a.effective_to_round >= next_round)
  ) where d.id in (select ai_driver_id from private.season_driver_ai_assignments where season_id = new.season_id);
  return new;
end;
$$;
revoke all on function private.sync_current_roster_vehicles() from public, anon, authenticated, service_role;
create trigger races_sync_roster_vehicles after update of current_result_version_id on public.races
  for each row execute function private.sync_current_roster_vehicles();

-- Legacy human identities may carry an F1 name; that does not make them bots.
create or replace function private.assign_season_driver_ai(
  p_human_driver_id uuid,
  p_ai_driver_id uuid,
  p_effective_from_round integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  target_season public.seasons%rowtype;
  human_driver public.drivers%rowtype;
  ai_driver public.drivers%rowtype;
  previous_assignment private.season_driver_ai_assignments%rowtype;
  saved_assignment private.season_driver_ai_assignments%rowtype;
  current_round integer;
  maximum_round integer;
  target_seat_code text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'League driver administration access denied.';
  end if;

  select s.* into target_season
  from public.seasons s
  where s.league_id = target_league.id and s.is_active
  order by s.created_at desc
  limit 1
  for update;

  if target_season.id is null then
    raise exception using errcode = '22023', message = 'An active season is required.';
  end if;

  select d.* into human_driver
  from public.drivers d
  where d.id = p_human_driver_id and d.league_id = target_league.id;
  if human_driver.id is null or private.result_participation_status(human_driver.ai_driver_reference, null) <> 'PLAYER' then
    raise exception using errcode = '22023', message = 'The points owner must be a human driver in this league.';
  end if;

  select d.* into ai_driver
  from public.drivers d
  where d.id = p_ai_driver_id and d.league_id = target_league.id;
  if ai_driver.id is null
     or ai_driver.ai_driver_reference is null
     or ai_driver.ai_driver_reference not like target_season.game_key || ':%' then
    raise exception using errcode = '22023', message = 'The selected AI driver does not belong to the active season game.';
  end if;

  target_seat_code := split_part(ai_driver.ai_driver_reference, ':', 2);

  select max(r.round_number) into maximum_round
  from public.races r
  where r.season_id = target_season.id;
  if p_effective_from_round is null
     or p_effective_from_round < 1
     or p_effective_from_round > coalesce(maximum_round, 0)
     or not exists (
       select 1 from public.races r
       where r.season_id = target_season.id
         and r.round_number = p_effective_from_round
     ) then
    raise exception using errcode = '22023', message = 'The effective round is not part of the active season.';
  end if;

  if exists (
    select 1
    from private.season_driver_ai_assignments a
    where a.season_id = target_season.id
      and a.ai_driver_id = p_ai_driver_id
      and a.human_driver_id <> p_human_driver_id
      and (a.effective_to_round is null or a.effective_to_round >= p_effective_from_round)
  ) then
    raise exception using errcode = '23505', message = 'This AI driver is already assigned to another human driver for the selected period.';
  end if;

  select a.* into previous_assignment
  from private.season_driver_ai_assignments a
  where a.season_id = target_season.id
    and a.human_driver_id = p_human_driver_id
    and p_effective_from_round >= a.effective_from_round
    and (a.effective_to_round is null or p_effective_from_round <= a.effective_to_round)
  order by a.effective_from_round desc
  limit 1;

  if previous_assignment.id is not null
     and previous_assignment.ai_driver_id = p_ai_driver_id
     and previous_assignment.effective_from_round = p_effective_from_round then
    saved_assignment := previous_assignment;
  else
    delete from private.season_driver_ai_assignments a
    where a.season_id = target_season.id
      and a.human_driver_id = p_human_driver_id
      and a.effective_from_round >= p_effective_from_round;

    update private.season_driver_ai_assignments a
    set effective_to_round = p_effective_from_round - 1
    where a.season_id = target_season.id
      and a.human_driver_id = p_human_driver_id
      and a.effective_from_round < p_effective_from_round
      and (a.effective_to_round is null or a.effective_to_round >= p_effective_from_round);

    insert into private.season_driver_ai_assignments (
      season_id, human_driver_id, ai_driver_id, seat_code,
      effective_from_round, effective_to_round, created_by
    ) values (
      target_season.id, p_human_driver_id, p_ai_driver_id, target_seat_code,
      p_effective_from_round, null, actor_id
    ) returning * into saved_assignment;
  end if;

  select coalesce(
    min(r.round_number) filter (where r.current_result_version_id is null),
    max(r.round_number),
    1
  ) into current_round
  from public.races r
  where r.season_id = target_season.id;

  if p_effective_from_round <= current_round then
    update public.drivers
    set league_team = ai_driver.league_team,
        car_name = ai_driver.car_name,
        is_active = true
    where id = human_driver.id;

    update public.drivers set is_active = false where id = ai_driver.id;

    if previous_assignment.ai_driver_id is not null
       and previous_assignment.ai_driver_id <> ai_driver.id
       and not exists (
         select 1
         from private.season_driver_ai_assignments a
         where a.season_id = target_season.id
           and a.ai_driver_id = previous_assignment.ai_driver_id
           and current_round >= a.effective_from_round
           and (a.effective_to_round is null or current_round <= a.effective_to_round)
       ) then
      update public.drivers set is_active = true where id = previous_assignment.ai_driver_id;
    end if;
  end if;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league.id, actor_id, 'driver.ai_assignment_changed',
    'driver', p_human_driver_id,
    jsonb_build_object(
      'season_id', target_season.id,
      'human_driver_id', p_human_driver_id,
      'ai_driver_id', p_ai_driver_id,
      'previous_ai_driver_id', previous_assignment.ai_driver_id,
      'seat_code', target_seat_code,
      'effective_from_round', p_effective_from_round
    )
  );

  return jsonb_build_object(
    'id', saved_assignment.id,
    'season_id', saved_assignment.season_id,
    'human_driver_id', saved_assignment.human_driver_id,
    'ai_driver_id', saved_assignment.ai_driver_id,
    'seat_code', saved_assignment.seat_code,
    'effective_from_round', saved_assignment.effective_from_round,
    'effective_to_round', saved_assignment.effective_to_round
  );
end;
$$;
