-- RaceVora V2: guided season start with an authoritative game roster.

create table public.season_driver_assignments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  seat_code text not null,
  ai_driver_name text not null,
  team_name text not null,
  car_name text not null,
  number integer not null,
  nationality_code text not null,
  participant_type text not null default 'BOT',
  gamertag_snapshot text,
  created_at timestamptz not null default now(),
  constraint season_driver_assignments_seat_unique unique (season_id, seat_code),
  constraint season_driver_assignments_driver_unique unique (season_id, driver_id),
  constraint season_driver_assignments_type_check check (participant_type in ('BOT', 'PLAYER')),
  constraint season_driver_assignments_number_check check (number between 0 and 99),
  constraint season_driver_assignments_country_check check (nationality_code ~ '^[A-Z]{2}$')
);

create index idx_season_driver_assignments_driver_id
  on public.season_driver_assignments (driver_id);

alter table public.season_driver_assignments enable row level security;
revoke all on table public.season_driver_assignments from public, anon, authenticated;
grant select on table public.season_driver_assignments to authenticated;
grant select, insert, update, delete on table public.season_driver_assignments to service_role;

create policy "v2 authenticated read requested season assignments"
on public.season_driver_assignments for select to authenticated
using (exists (
  select 1
  from public.seasons s
  where s.id = season_id
    and (select public.matches_requested_league(s.league_id))
));

create or replace function private.season_game_catalog()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_array(jsonb_build_object(
    'key', 'f1_25',
    'label', 'F1 25 · Saison 2025',
    'roster', jsonb_build_array(
      jsonb_build_object('seat_code','mclaren-norris','ai_driver_name','Lando Norris','number',4,'nationality_code','GB','team_name','McLaren','car_name','McLaren MCL39'),
      jsonb_build_object('seat_code','mclaren-piastri','ai_driver_name','Oscar Piastri','number',81,'nationality_code','AU','team_name','McLaren','car_name','McLaren MCL39'),
      jsonb_build_object('seat_code','red-bull-verstappen','ai_driver_name','Max Verstappen','number',1,'nationality_code','NL','team_name','Red Bull Racing','car_name','Red Bull RB21'),
      jsonb_build_object('seat_code','red-bull-tsunoda','ai_driver_name','Yuki Tsunoda','number',22,'nationality_code','JP','team_name','Red Bull Racing','car_name','Red Bull RB21'),
      jsonb_build_object('seat_code','mercedes-russell','ai_driver_name','George Russell','number',63,'nationality_code','GB','team_name','Mercedes','car_name','Mercedes W16'),
      jsonb_build_object('seat_code','mercedes-antonelli','ai_driver_name','Kimi Antonelli','number',12,'nationality_code','IT','team_name','Mercedes','car_name','Mercedes W16'),
      jsonb_build_object('seat_code','ferrari-leclerc','ai_driver_name','Charles Leclerc','number',16,'nationality_code','MC','team_name','Ferrari','car_name','Ferrari SF-25'),
      jsonb_build_object('seat_code','ferrari-hamilton','ai_driver_name','Lewis Hamilton','number',44,'nationality_code','GB','team_name','Ferrari','car_name','Ferrari SF-25'),
      jsonb_build_object('seat_code','williams-albon','ai_driver_name','Alexander Albon','number',23,'nationality_code','TH','team_name','Williams','car_name','Williams FW47'),
      jsonb_build_object('seat_code','williams-sainz','ai_driver_name','Carlos Sainz','number',55,'nationality_code','ES','team_name','Williams','car_name','Williams FW47'),
      jsonb_build_object('seat_code','racing-bulls-lawson','ai_driver_name','Liam Lawson','number',30,'nationality_code','NZ','team_name','Racing Bulls','car_name','Racing Bulls VCARB 02'),
      jsonb_build_object('seat_code','racing-bulls-hadjar','ai_driver_name','Isack Hadjar','number',6,'nationality_code','FR','team_name','Racing Bulls','car_name','Racing Bulls VCARB 02'),
      jsonb_build_object('seat_code','aston-martin-alonso','ai_driver_name','Fernando Alonso','number',14,'nationality_code','ES','team_name','Aston Martin','car_name','Aston Martin AMR25'),
      jsonb_build_object('seat_code','aston-martin-stroll','ai_driver_name','Lance Stroll','number',18,'nationality_code','CA','team_name','Aston Martin','car_name','Aston Martin AMR25'),
      jsonb_build_object('seat_code','haas-ocon','ai_driver_name','Esteban Ocon','number',31,'nationality_code','FR','team_name','Haas','car_name','Haas VF-25'),
      jsonb_build_object('seat_code','haas-bearman','ai_driver_name','Oliver Bearman','number',87,'nationality_code','GB','team_name','Haas','car_name','Haas VF-25'),
      jsonb_build_object('seat_code','sauber-hulkenberg','ai_driver_name','Nico Hülkenberg','number',27,'nationality_code','DE','team_name','KICK Sauber','car_name','Sauber C45'),
      jsonb_build_object('seat_code','sauber-bortoleto','ai_driver_name','Gabriel Bortoleto','number',5,'nationality_code','BR','team_name','KICK Sauber','car_name','Sauber C45'),
      jsonb_build_object('seat_code','alpine-gasly','ai_driver_name','Pierre Gasly','number',10,'nationality_code','FR','team_name','Alpine','car_name','Alpine A525'),
      jsonb_build_object('seat_code','alpine-colapinto','ai_driver_name','Franco Colapinto','number',43,'nationality_code','AR','team_name','Alpine','car_name','Alpine A525')
    )
  ));
$$;

revoke all on function private.season_game_catalog() from public, anon, authenticated, service_role;

create or replace function public.get_season_setup_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Season setup access denied.';
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', target_league.id, 'name', target_league.name, 'slug', target_league.slug),
    'games', private.season_game_catalog(),
    'active_season', (
      select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'game_label', s.game_label, 'start_date', s.start_date, 'end_date', s.end_date)
      from public.seasons s
      where s.league_id = target_league.id and s.is_active
      order by s.created_at desc
      limit 1
    )
  );
end;
$$;

create or replace function public.start_league_season(
  p_name text,
  p_slug text,
  p_game_key text,
  p_start_date date default null,
  p_end_date date default null,
  p_assignments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  catalog_game jsonb;
  roster_entry jsonb;
  assignment jsonb;
  saved_season public.seasons%rowtype;
  ai_driver public.drivers%rowtype;
  selected_driver public.drivers%rowtype;
  player_name text;
  player_gamertag text;
  player_count integer := 0;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug()
  for update;

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Season setup access denied.';
  end if;
  if char_length(normalized_name) not between 3 and 80 or normalized_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'Season name must contain 3 to 80 safe characters.';
  end if;
  if char_length(normalized_slug) not between 3 and 50 or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Season slug is invalid.';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'Season end date must not be before its start date.';
  end if;
  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Season assignments must be an array.';
  end if;

  select game into catalog_game
  from jsonb_array_elements(private.season_game_catalog()) game
  where game ->> 'key' = p_game_key;
  if catalog_game is null then
    raise exception using errcode = '22023', message = 'Unsupported game preset.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) a
    where not exists (
      select 1 from jsonb_array_elements(catalog_game -> 'roster') r
      where r ->> 'seat_code' = a ->> 'seat_code'
    )
  ) then
    raise exception using errcode = '22023', message = 'An assignment references an unknown seat.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) a
    group by lower(a ->> 'seat_code') having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A seat can only be assigned once.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) a
    where char_length(btrim(coalesce(a ->> 'player_name', ''))) not between 2 and 80
       or char_length(btrim(coalesce(a ->> 'gamertag', ''))) not between 2 and 80
       or (a ->> 'player_name') ~ '[<>]'
       or (a ->> 'gamertag') ~ '[<>]'
  ) then
    raise exception using errcode = '22023', message = 'Every player assignment requires a safe player name and gamertag.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) a
    group by lower(btrim(a ->> 'gamertag')) having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A gamertag can only be assigned once.';
  end if;

  update public.seasons set is_active = false
  where league_id = target_league.id and is_active;

  insert into public.seasons (
    league_id, slug, name, start_date, end_date, is_active, game_key, game_label
  ) values (
    target_league.id, normalized_slug, normalized_name, p_start_date, p_end_date,
    true, p_game_key, catalog_game ->> 'label'
  ) returning * into saved_season;

  for roster_entry in select value from jsonb_array_elements(catalog_game -> 'roster') loop
    select d.* into ai_driver
    from public.drivers d
    where d.league_id = target_league.id
      and d.ai_driver_reference = p_game_key || ':' || (roster_entry ->> 'seat_code')
    limit 1;

    if ai_driver.id is null then
      insert into public.drivers (
        league_id, display_name, number, nationality_code, league_team, car_name,
        ai_driver_reference, is_active
      ) values (
        target_league.id, roster_entry ->> 'ai_driver_name', (roster_entry ->> 'number')::integer,
        roster_entry ->> 'nationality_code', roster_entry ->> 'team_name', roster_entry ->> 'car_name',
        p_game_key || ':' || (roster_entry ->> 'seat_code'), true
      ) returning * into ai_driver;
    end if;

    assignment := null;
    select value into assignment
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
    where value ->> 'seat_code' = roster_entry ->> 'seat_code'
    limit 1;

    if assignment is null then
      selected_driver := ai_driver;
    else
      player_name := btrim(assignment ->> 'player_name');
      player_gamertag := btrim(assignment ->> 'gamertag');
      selected_driver := null;
      select d.* into selected_driver
      from public.drivers d
      where d.league_id = target_league.id and lower(d.gamertag) = lower(player_gamertag)
      limit 1;

      if selected_driver.id is null then
        insert into public.drivers (
          league_id, display_name, gamertag, number, nationality_code, league_team, car_name, is_active
        ) values (
          target_league.id, player_name, player_gamertag, (roster_entry ->> 'number')::integer,
          roster_entry ->> 'nationality_code', roster_entry ->> 'team_name', roster_entry ->> 'car_name', true
        ) returning * into selected_driver;
      else
        update public.drivers
        set display_name = player_name,
            number = (roster_entry ->> 'number')::integer,
            league_team = roster_entry ->> 'team_name',
            car_name = roster_entry ->> 'car_name',
            is_active = true
        where id = selected_driver.id
        returning * into selected_driver;
      end if;
      player_count := player_count + 1;
    end if;

    insert into public.season_driver_assignments (
      season_id, driver_id, seat_code, ai_driver_name, team_name, car_name,
      number, nationality_code, participant_type, gamertag_snapshot
    ) values (
      saved_season.id, selected_driver.id, roster_entry ->> 'seat_code', roster_entry ->> 'ai_driver_name',
      roster_entry ->> 'team_name', roster_entry ->> 'car_name', (roster_entry ->> 'number')::integer,
      roster_entry ->> 'nationality_code', case when assignment is null then 'BOT' else 'PLAYER' end,
      case when assignment is null then null else player_gamertag end
    );
  end loop;

  update public.leagues
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
    'onboarding_complete', true,
    'game_key', p_game_key,
    'active_season_id', saved_season.id
  )
  where id = target_league.id;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id, 'season.started', 'season', saved_season.id,
    jsonb_build_object('league_id', target_league.id, 'game_key', p_game_key, 'players', player_count, 'ai_drivers', 20 - player_count)
  );

  return jsonb_build_object(
    'season', jsonb_build_object('id', saved_season.id, 'name', saved_season.name, 'slug', saved_season.slug),
    'players', player_count,
    'ai_drivers', 20 - player_count,
    'started', true
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Season name, slug, player name or gamertag already exists in this league.';
end;
$$;

revoke all on function public.get_season_setup_workspace() from public, anon, authenticated, service_role;
revoke all on function public.start_league_season(text, text, text, date, date, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.get_season_setup_workspace() to authenticated, service_role;
grant execute on function public.start_league_season(text, text, text, date, date, jsonb) to authenticated, service_role;

comment on table public.season_driver_assignments is
  'Season-specific grid snapshot. A PLAYER may replace the preset AI driver without losing the official game roster.';
comment on function public.start_league_season(text, text, text, date, date, jsonb) is
  'Actor-bound league-admin workflow that atomically creates and explicitly starts a season with its complete grid.';

