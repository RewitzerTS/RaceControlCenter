-- Independent league teams. No historical results, identities or XP are rewritten.
create schema league_roster_private;
revoke all on schema league_roster_private from public, anon, authenticated;
grant usage on schema league_roster_private to authenticated;

create table league_roster_private.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(name) between 2 and 80 and name !~ '[<>[:cntrl:]]' and name = btrim(name)),
  created_at timestamptz not null default now(),
  unique (league_id, id)
);
create unique index league_teams_name_unique on league_roster_private.teams(league_id, lower(name));
create table league_roster_private.driver_teams (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_id uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (league_id, team_id) references league_roster_private.teams(league_id, id) on delete restrict
);
create index driver_teams_team_idx on league_roster_private.driver_teams(team_id);
create index driver_teams_league_idx on league_roster_private.driver_teams(league_id);
alter table league_roster_private.teams enable row level security;
alter table league_roster_private.driver_teams enable row level security;
revoke all on all tables in schema league_roster_private from public, anon, authenticated;

create function league_roster_private.get_directory() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
<<get_directory>>
declare league_id uuid := private.roster_admin_league();
begin
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
      from league_roster_private.teams t where t.league_id = get_directory.league_id), '[]'::jsonb),
    'preferences', coalesce((select jsonb_agg(jsonb_build_object('driver_id', dt.driver_id, 'team_id', dt.team_id))
      from league_roster_private.driver_teams dt where dt.league_id = get_directory.league_id), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'display_name', d.display_name,
      'gamertag', coalesce(nullif(di.gamertag, ''), d.gamertag), 'is_active', d.is_active) order by d.display_name)
      from public.drivers d left join public.driver_identity_links dl on dl.driver_id = d.id
      left join public.driver_identities di on di.id = dl.driver_identity_id and di.status = 'active'
      where d.league_id = get_directory.league_id and private.result_participation_status(d.ai_driver_reference, null) = 'PLAYER'), '[]'::jsonb)
  );
end; $$;

create function league_roster_private.create_team(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare league_id uuid := private.roster_admin_league(); saved_id uuid;
begin
  if p_name is null or length(btrim(p_name)) not between 2 and 80 or p_name ~ '[<>[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'Bitte einen Teamnamen mit 2 bis 80 Zeichen eingeben.';
  end if;
  insert into league_roster_private.teams(league_id, name) values(league_id, btrim(p_name)) returning id into saved_id;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id)
    values('league', league_id, auth.uid(), 'league_team.created', 'team', saved_id);
  return saved_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'Dieser Teamname existiert bereits in deiner Liga.';
end; $$;

create function league_roster_private.assign_team(p_driver_id uuid, p_team_id uuid, p_effective_from_round integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<assign_team>>
declare league_id uuid := private.roster_admin_league(); driver public.drivers%rowtype;
  team league_roster_private.teams%rowtype; season_id uuid; car text;
begin
  -- Lock order agrees with season start and the existing vehicle workflow.
  perform 1 from public.leagues l where l.id = league_id for update;
  select s.id into season_id from public.seasons s where s.league_id = assign_team.league_id and s.is_active order by s.created_at desc limit 1 for update;
  select * into driver from public.drivers d where d.id = p_driver_id and d.league_id = assign_team.league_id and d.is_active for update;
  if driver.id is null or private.result_participation_status(driver.ai_driver_reference, null) <> 'PLAYER' then
    raise exception using errcode = '22023', message = 'Wähle ein aktives Fahrerprofil dieser Liga.';
  end if;
  select * into team from league_roster_private.teams t where t.id = p_team_id and t.league_id = assign_team.league_id;
  if p_team_id is not null and team.id is null then
    raise exception using errcode = '22023', message = 'Dieses Team gehört nicht zu deiner Liga.';
  end if;
  if p_effective_from_round is not null then
    if team.id is null or season_id is null then
      raise exception using errcode = '22023', message = 'Für einen Saisonwechsel werden eine aktive Saison und ein Team benötigt.';
    end if;
    select v.car_name into car from private.season_vehicle_assignments v
      where v.season_id = assign_team.season_id and v.driver_id = driver.id and v.effective_from_round <= p_effective_from_round
      order by v.effective_from_round desc limit 1;
    perform public.change_season_vehicle(driver.id, p_effective_from_round, team.name, coalesce(car, driver.car_name), null);
  end if;
  if p_team_id is null then
    delete from league_roster_private.driver_teams dt where dt.driver_id = driver.id;
  else
    insert into league_roster_private.driver_teams(driver_id, league_id, team_id) values(driver.id, league_id, team.id)
      on conflict(driver_id) do update set team_id = excluded.team_id, updated_at = now();
  end if;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id, metadata)
    values('league', league_id, auth.uid(), 'league_team.assigned', 'driver', driver.id,
      jsonb_build_object('team_id', p_team_id, 'effective_from_round', p_effective_from_round));
  return jsonb_build_object('driver_id', driver.id, 'team_id', p_team_id);
end; $$;

-- New entry point keeps the established calendar/rules transaction and replaces
-- its new-season AI seats with explicit existing profiles before it commits.
create function league_roster_private.start_from_profiles(p_name text, p_slug text, p_game_key text,
  p_start_date date, p_assignments jsonb, p_calendar jsonb, p_fastest_lap_bonus_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<start_from_profiles>>
declare league_id uuid := private.roster_admin_league(); result jsonb; season_id uuid;
  item jsonb; driver public.drivers%rowtype; seat public.season_driver_assignments%rowtype;
  tag text; team_name text; selected_team uuid; player_count integer; eligible_drivers uuid[];
begin
  perform 1 from public.leagues l where l.id = league_id for update;
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'Ungültige Fahrerzuordnungen.';
  end if;
  player_count := jsonb_array_length(p_assignments);
  if player_count > 22 or exists(select 1 from jsonb_array_elements(p_assignments) a group by a->>'driver_id' having count(*) > 1)
    or exists(select 1 from jsonb_array_elements(p_assignments) a group by a->>'seat_code' having count(*) > 1) then
    raise exception using errcode = '22023', message = 'Jeder Fahrer und jeder Sitz darf nur einmal zugeordnet werden.';
  end if;
  -- Capture eligibility before the existing season-insert trigger deactivates the previous grid.
  select coalesce(array_agg(d.id), '{}'::uuid[]) into eligible_drivers from public.drivers d
    where d.league_id = start_from_profiles.league_id and d.is_active
      and private.result_participation_status(d.ai_driver_reference, null) = 'PLAYER';
  -- The transaction rolls back completely for unknown profiles, seats or teams.
  result := public.start_league_season_with_rules_and_calendar(p_name, p_slug, p_game_key,
    p_start_date, '[]'::jsonb, p_calendar, p_fastest_lap_bonus_enabled);
  season_id := (result->'season'->>'id')::uuid;
  for item in select value from jsonb_array_elements(p_assignments) loop
    select * into driver from public.drivers d where d.id = (item->>'driver_id')::uuid
      and d.league_id = start_from_profiles.league_id and d.id = any(eligible_drivers) for update;
    if driver.id is null or private.result_participation_status(driver.ai_driver_reference, null) <> 'PLAYER' then
      raise exception using errcode = '22023', message = 'Wähle ein aktives Fahrerprofil dieser Liga.';
    end if;
    select * into seat from public.season_driver_assignments a where a.season_id = start_from_profiles.season_id and a.seat_code = item->>'seat_code';
    if seat.id is null then raise exception using errcode = '22023', message = 'Der ausgewählte Sitz gehört nicht zu diesem Spiel.'; end if;
    select coalesce(nullif(di.gamertag, ''), driver.gamertag) into tag from public.driver_identity_links dl
      join public.driver_identities di on di.id = dl.driver_identity_id and di.status = 'active' where dl.driver_id = driver.id;
    tag := coalesce(tag, driver.gamertag);
    if length(coalesce(tag, '')) < 2 then raise exception using errcode = '22023', message = 'Bitte zuerst den Gamertag im Fahrerprofil ergänzen.'; end if;
    selected_team := nullif(item->>'team_id', '')::uuid;
    team_name := null;
    if selected_team is not null then
      select t.name into team_name from league_roster_private.teams t where t.id = selected_team and t.league_id = start_from_profiles.league_id;
      if team_name is null then raise exception using errcode = '22023', message = 'Dieses Team gehört nicht zu deiner Liga.'; end if;
    end if;
    team_name := coalesce(team_name, seat.team_name);
    perform private.assign_season_driver_ai(driver.id, seat.driver_id, 1);
    update public.season_driver_assignments a set driver_id = driver.id, participant_type = 'PLAYER', gamertag_snapshot = tag, team_name = start_from_profiles.team_name where a.id = seat.id;
    update public.drivers d set league_team = start_from_profiles.team_name, car_name = seat.car_name, number = seat.number where d.id = driver.id;
    insert into private.season_vehicle_assignments(season_id, driver_id, effective_from_round, team_name, car_name, created_by)
      values(season_id, driver.id, 1, team_name, seat.car_name, auth.uid());
  end loop;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id, metadata)
    values('league', league_id, auth.uid(), 'season.profiles_assigned', 'season', season_id, jsonb_build_object('player_count', player_count));
  return result || jsonb_build_object('players', player_count, 'ai_drivers', (select count(*) from public.season_driver_assignments a where a.season_id = start_from_profiles.season_id and a.participant_type = 'BOT'));
end; $$;

create function public.get_league_team_directory() returns jsonb language sql security invoker set search_path = ''
as $$ select league_roster_private.get_directory(); $$;
create function public.create_league_team(p_name text) returns uuid language sql security invoker set search_path = ''
as $$ select league_roster_private.create_team(p_name); $$;
create function public.assign_league_driver_team(p_driver_id uuid, p_team_id uuid, p_effective_from_round integer default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select league_roster_private.assign_team(p_driver_id, p_team_id, p_effective_from_round); $$;
create function public.start_league_season_from_profiles(p_name text, p_slug text, p_game_key text,
  p_start_date date, p_assignments jsonb, p_calendar jsonb, p_fastest_lap_bonus_enabled boolean)
returns jsonb language sql security invoker set search_path = ''
as $$ select league_roster_private.start_from_profiles(p_name, p_slug, p_game_key, p_start_date, p_assignments, p_calendar, p_fastest_lap_bonus_enabled); $$;

revoke all on all functions in schema league_roster_private from public, anon, authenticated;
grant execute on all functions in schema league_roster_private to authenticated;
revoke all on function public.get_league_team_directory(), public.create_league_team(text), public.assign_league_driver_team(uuid, uuid, integer), public.start_league_season_from_profiles(text, text, text, date, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.get_league_team_directory(), public.create_league_team(text), public.assign_league_driver_team(uuid, uuid, integer), public.start_league_season_from_profiles(text, text, text, date, jsonb, jsonb, boolean) to authenticated;
