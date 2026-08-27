-- RaceVora V2: add the complete F1 26 preset and seed its calendar on season start.

alter function private.season_game_catalog() rename to season_game_catalog_f1_25;

create or replace function private.season_track_catalog(p_game_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_game_key
    when 'f1_25' then jsonb_build_array(
      jsonb_build_object('key','australia','grand_prix_name','Australien GP','circuit_name','Melbourne Grand Prix Circuit','country_code','AU'),
      jsonb_build_object('key','china','grand_prix_name','China GP','circuit_name','Shanghai International Circuit','country_code','CN'),
      jsonb_build_object('key','japan','grand_prix_name','Japan GP','circuit_name','Suzuka International Racing Course','country_code','JP'),
      jsonb_build_object('key','bahrain','grand_prix_name','Bahrain GP','circuit_name','Bahrain International Circuit','country_code','BH'),
      jsonb_build_object('key','saudi-arabia','grand_prix_name','Saudi-Arabien GP','circuit_name','Jeddah Corniche Circuit','country_code','SA'),
      jsonb_build_object('key','miami','grand_prix_name','Miami GP','circuit_name','Miami International Autodrome','country_code','US'),
      jsonb_build_object('key','imola','grand_prix_name','Emilia-Romagna GP','circuit_name','Autodromo Enzo e Dino Ferrari','country_code','IT'),
      jsonb_build_object('key','monaco','grand_prix_name','Monaco GP','circuit_name','Circuit de Monaco','country_code','MC'),
      jsonb_build_object('key','canada','grand_prix_name','Kanada GP','circuit_name','Circuit Gilles Villeneuve','country_code','CA'),
      jsonb_build_object('key','spain','grand_prix_name','Spanien GP','circuit_name','Circuit de Barcelona-Catalunya','country_code','ES'),
      jsonb_build_object('key','austria','grand_prix_name','Österreich GP','circuit_name','Red Bull Ring','country_code','AT'),
      jsonb_build_object('key','great-britain','grand_prix_name','Großbritannien GP','circuit_name','Silverstone Circuit','country_code','GB'),
      jsonb_build_object('key','belgium','grand_prix_name','Belgien GP','circuit_name','Circuit de Spa-Francorchamps','country_code','BE'),
      jsonb_build_object('key','hungary','grand_prix_name','Ungarn GP','circuit_name','Hungaroring','country_code','HU'),
      jsonb_build_object('key','netherlands','grand_prix_name','Niederlande GP','circuit_name','Circuit Zandvoort','country_code','NL'),
      jsonb_build_object('key','italy','grand_prix_name','Italien GP','circuit_name','Autodromo Nazionale Monza','country_code','IT'),
      jsonb_build_object('key','azerbaijan','grand_prix_name','Aserbaidschan GP','circuit_name','Baku City Circuit','country_code','AZ'),
      jsonb_build_object('key','singapore','grand_prix_name','Singapur GP','circuit_name','Marina Bay Street Circuit','country_code','SG'),
      jsonb_build_object('key','united-states','grand_prix_name','USA GP','circuit_name','Circuit of the Americas','country_code','US'),
      jsonb_build_object('key','mexico','grand_prix_name','Mexiko GP','circuit_name','Autódromo Hermanos Rodríguez','country_code','MX'),
      jsonb_build_object('key','brazil','grand_prix_name','São Paulo GP','circuit_name','Autódromo José Carlos Pace','country_code','BR'),
      jsonb_build_object('key','las-vegas','grand_prix_name','Las Vegas GP','circuit_name','Las Vegas Strip Circuit','country_code','US'),
      jsonb_build_object('key','qatar','grand_prix_name','Katar GP','circuit_name','Lusail International Circuit','country_code','QA'),
      jsonb_build_object('key','abu-dhabi','grand_prix_name','Abu Dhabi GP','circuit_name','Yas Marina Circuit','country_code','AE')
    )
    when 'f1_26' then jsonb_build_array(
      jsonb_build_object('key','australia','grand_prix_name','Australien GP','circuit_name','Melbourne Grand Prix Circuit','country_code','AU'),
      jsonb_build_object('key','china','grand_prix_name','China GP','circuit_name','Shanghai International Circuit','country_code','CN'),
      jsonb_build_object('key','japan','grand_prix_name','Japan GP','circuit_name','Suzuka International Racing Course','country_code','JP'),
      jsonb_build_object('key','bahrain','grand_prix_name','Bahrain GP','circuit_name','Bahrain International Circuit','country_code','BH'),
      jsonb_build_object('key','saudi-arabia','grand_prix_name','Saudi-Arabien GP','circuit_name','Jeddah Corniche Circuit','country_code','SA'),
      jsonb_build_object('key','miami','grand_prix_name','Miami GP','circuit_name','Miami International Autodrome','country_code','US'),
      jsonb_build_object('key','monaco','grand_prix_name','Monaco GP','circuit_name','Circuit de Monaco','country_code','MC'),
      jsonb_build_object('key','canada','grand_prix_name','Kanada GP','circuit_name','Circuit Gilles Villeneuve','country_code','CA'),
      jsonb_build_object('key','catalonia','grand_prix_name','Katalonien GP','circuit_name','Circuit de Barcelona-Catalunya','country_code','ES'),
      jsonb_build_object('key','austria','grand_prix_name','Österreich GP','circuit_name','Red Bull Ring','country_code','AT'),
      jsonb_build_object('key','great-britain','grand_prix_name','Großbritannien GP','circuit_name','Silverstone Circuit','country_code','GB'),
      jsonb_build_object('key','belgium','grand_prix_name','Belgien GP','circuit_name','Circuit de Spa-Francorchamps','country_code','BE'),
      jsonb_build_object('key','hungary','grand_prix_name','Ungarn GP','circuit_name','Hungaroring','country_code','HU'),
      jsonb_build_object('key','netherlands','grand_prix_name','Niederlande GP','circuit_name','Circuit Zandvoort','country_code','NL'),
      jsonb_build_object('key','madrid','grand_prix_name','Spanien GP','circuit_name','Madring','country_code','ES'),
      jsonb_build_object('key','italy','grand_prix_name','Italien GP','circuit_name','Autodromo Nazionale Monza','country_code','IT'),
      jsonb_build_object('key','azerbaijan','grand_prix_name','Aserbaidschan GP','circuit_name','Baku City Circuit','country_code','AZ'),
      jsonb_build_object('key','singapore','grand_prix_name','Singapur GP','circuit_name','Marina Bay Street Circuit','country_code','SG'),
      jsonb_build_object('key','united-states','grand_prix_name','USA GP','circuit_name','Circuit of the Americas','country_code','US'),
      jsonb_build_object('key','mexico','grand_prix_name','Mexiko GP','circuit_name','Autódromo Hermanos Rodríguez','country_code','MX'),
      jsonb_build_object('key','brazil','grand_prix_name','São Paulo GP','circuit_name','Autódromo José Carlos Pace','country_code','BR'),
      jsonb_build_object('key','las-vegas','grand_prix_name','Las Vegas GP','circuit_name','Las Vegas Strip Circuit','country_code','US'),
      jsonb_build_object('key','qatar','grand_prix_name','Katar GP','circuit_name','Lusail International Circuit','country_code','QA'),
      jsonb_build_object('key','abu-dhabi','grand_prix_name','Abu Dhabi GP','circuit_name','Yas Marina Circuit','country_code','AE')
    )
    else '[]'::jsonb
  end;
$$;

create or replace function private.season_game_catalog()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with games as (
    select value as game
    from jsonb_array_elements(private.season_game_catalog_f1_25())
    union all
    select jsonb_build_object(
      'key', 'f1_26',
      'label', 'F1 26 · Saison 2026',
      'roster', jsonb_build_array(
        jsonb_build_object('seat_code','mclaren-norris','ai_driver_name','Lando Norris','number',1,'nationality_code','GB','team_name','McLaren','car_name','McLaren MCL40'),
        jsonb_build_object('seat_code','mclaren-piastri','ai_driver_name','Oscar Piastri','number',81,'nationality_code','AU','team_name','McLaren','car_name','McLaren MCL40'),
        jsonb_build_object('seat_code','red-bull-verstappen','ai_driver_name','Max Verstappen','number',3,'nationality_code','NL','team_name','Red Bull Racing','car_name','Red Bull RB22'),
        jsonb_build_object('seat_code','red-bull-hadjar','ai_driver_name','Isack Hadjar','number',6,'nationality_code','FR','team_name','Red Bull Racing','car_name','Red Bull RB22'),
        jsonb_build_object('seat_code','mercedes-russell','ai_driver_name','George Russell','number',63,'nationality_code','GB','team_name','Mercedes','car_name','Mercedes W17'),
        jsonb_build_object('seat_code','mercedes-antonelli','ai_driver_name','Kimi Antonelli','number',12,'nationality_code','IT','team_name','Mercedes','car_name','Mercedes W17'),
        jsonb_build_object('seat_code','ferrari-leclerc','ai_driver_name','Charles Leclerc','number',16,'nationality_code','MC','team_name','Ferrari','car_name','Ferrari SF-26'),
        jsonb_build_object('seat_code','ferrari-hamilton','ai_driver_name','Lewis Hamilton','number',44,'nationality_code','GB','team_name','Ferrari','car_name','Ferrari SF-26'),
        jsonb_build_object('seat_code','aston-martin-alonso','ai_driver_name','Fernando Alonso','number',14,'nationality_code','ES','team_name','Aston Martin','car_name','Aston Martin AMR26'),
        jsonb_build_object('seat_code','aston-martin-stroll','ai_driver_name','Lance Stroll','number',18,'nationality_code','CA','team_name','Aston Martin','car_name','Aston Martin AMR26'),
        jsonb_build_object('seat_code','alpine-gasly','ai_driver_name','Pierre Gasly','number',10,'nationality_code','FR','team_name','Alpine','car_name','Alpine A526'),
        jsonb_build_object('seat_code','alpine-colapinto','ai_driver_name','Franco Colapinto','number',43,'nationality_code','AR','team_name','Alpine','car_name','Alpine A526'),
        jsonb_build_object('seat_code','williams-albon','ai_driver_name','Alexander Albon','number',23,'nationality_code','TH','team_name','Williams','car_name','Williams FW48'),
        jsonb_build_object('seat_code','williams-sainz','ai_driver_name','Carlos Sainz','number',55,'nationality_code','ES','team_name','Williams','car_name','Williams FW48'),
        jsonb_build_object('seat_code','racing-bulls-lawson','ai_driver_name','Liam Lawson','number',30,'nationality_code','NZ','team_name','Racing Bulls','car_name','Racing Bulls VCARB 03'),
        jsonb_build_object('seat_code','racing-bulls-lindblad','ai_driver_name','Arvid Lindblad','number',41,'nationality_code','GB','team_name','Racing Bulls','car_name','Racing Bulls VCARB 03'),
        jsonb_build_object('seat_code','audi-hulkenberg','ai_driver_name','Nico Hülkenberg','number',27,'nationality_code','DE','team_name','Audi','car_name','Audi R26'),
        jsonb_build_object('seat_code','audi-bortoleto','ai_driver_name','Gabriel Bortoleto','number',5,'nationality_code','BR','team_name','Audi','car_name','Audi R26'),
        jsonb_build_object('seat_code','haas-ocon','ai_driver_name','Esteban Ocon','number',31,'nationality_code','FR','team_name','Haas','car_name','Haas VF-26'),
        jsonb_build_object('seat_code','haas-bearman','ai_driver_name','Oliver Bearman','number',87,'nationality_code','GB','team_name','Haas','car_name','Haas VF-26'),
        jsonb_build_object('seat_code','cadillac-perez','ai_driver_name','Sergio Pérez','number',11,'nationality_code','MX','team_name','Cadillac','car_name','Cadillac MAC-26'),
        jsonb_build_object('seat_code','cadillac-bottas','ai_driver_name','Valtteri Bottas','number',77,'nationality_code','FI','team_name','Cadillac','car_name','Cadillac MAC-26')
      )
    )
  )
  select jsonb_agg(game || jsonb_build_object('tracks', private.season_track_catalog(game ->> 'key')))
  from games;
$$;

revoke all on function private.season_game_catalog_f1_25() from public, anon, authenticated, service_role;
revoke all on function private.season_track_catalog(text) from public, anon, authenticated, service_role;
revoke all on function private.season_game_catalog() from public, anon, authenticated, service_role;

create or replace function private.seed_season_preset_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_entry jsonb;
  track_round integer;
begin
  for track_entry, track_round in
    select value, ordinality::integer
    from jsonb_array_elements(private.season_track_catalog(new.game_key)) with ordinality
  loop
    insert into public.races (
      season_id, round_number, grand_prix_name, circuit_name, country_code, status, race_order
    ) values (
      new.id, track_round, track_entry ->> 'grand_prix_name', track_entry ->> 'circuit_name',
      track_entry ->> 'country_code', 'upcoming', track_round
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.seed_season_preset_calendar() from public, anon, authenticated, service_role;

create trigger seed_season_preset_calendar_after_insert
after insert on public.seasons
for each row execute function private.seed_season_preset_calendar();

alter function public.start_league_season(text, text, text, date, date, jsonb)
  rename to start_league_season_legacy;

revoke all on function public.start_league_season_legacy(text, text, text, date, date, jsonb)
  from public, anon, authenticated, service_role;

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
  result jsonb;
  roster_size integer;
  track_count integer;
  player_count integer;
begin
  result := public.start_league_season_legacy(
    p_name, p_slug, p_game_key, p_start_date, p_end_date, p_assignments
  );
  roster_size := jsonb_array_length((
    select value -> 'roster'
    from jsonb_array_elements(private.season_game_catalog())
    where value ->> 'key' = p_game_key
  ));
  track_count := jsonb_array_length(private.season_track_catalog(p_game_key));
  player_count := coalesce((result ->> 'players')::integer, 0);

  update public.v2_audit_events
  set metadata = metadata || jsonb_build_object(
    'players', player_count,
    'ai_drivers', roster_size - player_count,
    'races', track_count
  )
  where id = (
    select e.id
    from public.v2_audit_events e
    where e.action = 'season.started'
      and e.entity_type = 'season'
      and e.entity_id = (result -> 'season' ->> 'id')::uuid
    order by e.occurred_at desc
    limit 1
  );

  return result || jsonb_build_object(
    'ai_drivers', roster_size - player_count,
    'races', track_count
  );
end;
$$;

revoke all on function public.start_league_season(text, text, text, date, date, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.start_league_season(text, text, text, date, date, jsonb)
  to authenticated, service_role;

comment on function private.season_track_catalog(text) is
  'Authoritative default track list for supported season game presets.';
comment on function public.start_league_season(text, text, text, date, date, jsonb) is
  'Starts a league season with the complete preset grid and an editable default race calendar.';
