-- RaceVora V2: restore the guided season calendar workflow for new and freshly started seasons.

alter table public.races
  add column if not exists track_key text;

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
      season_id, round_number, track_key, grand_prix_name, circuit_name, country_code, status, race_order
    ) values (
      new.id, track_round, track_entry ->> 'key', track_entry ->> 'grand_prix_name',
      track_entry ->> 'circuit_name', track_entry ->> 'country_code', 'upcoming', track_round
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.seed_season_preset_calendar() from public, anon, authenticated, service_role;

update public.races r
set track_key = catalog.track ->> 'key'
from public.seasons s
cross join lateral jsonb_array_elements(private.season_track_catalog(s.game_key)) catalog(track)
where r.season_id = s.id
  and r.track_key is null
  and catalog.track ->> 'grand_prix_name' = r.grand_prix_name
  and catalog.track ->> 'circuit_name' = r.circuit_name;

create or replace function public.configure_league_season_calendar(
  p_season_id uuid,
  p_calendar jsonb
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
  calendar_entry jsonb;
  track_entry jsonb;
  track_round integer;
  race_count integer;
  sprint_count integer;
  first_race_date date;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Season calendar access denied.';
  end if;

  select s.* into target_season
  from public.seasons s
  where s.id = p_season_id and s.league_id = target_league.id
  for update;

  if target_season.id is null then
    raise exception using errcode = '22023', message = 'Season not found in the requested league.';
  end if;
  if not target_season.is_active then
    raise exception using errcode = '22023', message = 'Only the active season calendar can be configured.';
  end if;
  if jsonb_typeof(coalesce(p_calendar, 'null'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Season calendar must be an array.';
  end if;

  race_count := jsonb_array_length(p_calendar);
  if race_count < 1 or race_count > jsonb_array_length(private.season_track_catalog(target_season.game_key)) then
    raise exception using errcode = '22023', message = 'Season calendar contains an invalid number of races.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_calendar) item
    group by lower(item ->> 'track_key') having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'A track can only appear once in the season calendar.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_calendar) item
    where not exists (
      select 1
      from jsonb_array_elements(private.season_track_catalog(target_season.game_key)) track
      where track ->> 'key' = item ->> 'track_key'
    )
      or coalesce(item ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(item ->> 'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
      or coalesce(item ->> 'weather', '') not in ('klar', 'regen', 'dynamisch')
  ) then
    raise exception using errcode = '22023', message = 'A calendar entry contains an invalid track, date, time or weather value.';
  end if;

  if exists (
    select 1 from public.races r
    where r.season_id = target_season.id
      and (r.status <> 'upcoming' or exists (select 1 from public.result_versions rv where rv.race_id = r.id))
  ) then
    raise exception using errcode = '55000', message = 'The calendar can no longer be replaced because races or results already exist.';
  end if;

  delete from public.races where season_id = target_season.id;

  for calendar_entry, track_round in
    select value, ordinality::integer
    from jsonb_array_elements(p_calendar) with ordinality
  loop
    select value into track_entry
    from jsonb_array_elements(private.season_track_catalog(target_season.game_key))
    where value ->> 'key' = calendar_entry ->> 'track_key'
    limit 1;

    insert into public.races (
      season_id, round_number, track_key, grand_prix_name, circuit_name, country_code,
      weekend_start_date, race_date, race_start_at, race_time, weather,
      status, race_order, has_sprint, notes
    ) values (
      target_season.id, track_round, track_entry ->> 'key', track_entry ->> 'grand_prix_name',
      track_entry ->> 'circuit_name', track_entry ->> 'country_code',
      (calendar_entry ->> 'date')::date, (calendar_entry ->> 'date')::date,
      (((calendar_entry ->> 'date')::date + (calendar_entry ->> 'time')::time) at time zone 'Europe/Berlin'),
      calendar_entry ->> 'time', calendar_entry ->> 'weather', 'upcoming', track_round,
      coalesce((calendar_entry ->> 'has_sprint')::boolean, false), 'Saison-Kalender-Wizard'
    );
  end loop;

  select min((item ->> 'date')::date), count(*) filter (where coalesce((item ->> 'has_sprint')::boolean, false))
  into first_race_date, sprint_count
  from jsonb_array_elements(p_calendar) item;

  update public.seasons
  set start_date = first_race_date, end_date = null, updated_at = now()
  where id = target_season.id;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league.id, actor_id, 'season.calendar.configured', 'season', target_season.id,
    jsonb_build_object('league_id', target_league.id, 'races', race_count, 'sprints', sprint_count, 'first_race_date', first_race_date)
  );

  return jsonb_build_object(
    'season_id', target_season.id, 'races', race_count, 'sprints', sprint_count,
    'first_race_date', first_race_date, 'configured', true
  );
end;
$$;

revoke all on function public.configure_league_season_calendar(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.configure_league_season_calendar(uuid, jsonb)
  to authenticated, service_role;

create or replace function public.start_league_season_with_calendar(
  p_name text,
  p_slug text,
  p_game_key text,
  p_start_date date,
  p_assignments jsonb,
  p_calendar jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  calendar_result jsonb;
begin
  result := public.start_league_season(
    p_name, p_slug, p_game_key, p_start_date, null, coalesce(p_assignments, '[]'::jsonb)
  );
  calendar_result := public.configure_league_season_calendar(
    (result -> 'season' ->> 'id')::uuid, p_calendar
  );
  return result || jsonb_build_object(
    'races', calendar_result -> 'races',
    'sprints', calendar_result -> 'sprints',
    'calendar_configured', true
  );
end;
$$;

revoke all on function public.start_league_season_with_calendar(text, text, text, date, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.start_league_season_with_calendar(text, text, text, date, jsonb, jsonb)
  to authenticated, service_role;

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
      select jsonb_build_object(
        'id', s.id, 'name', s.name, 'slug', s.slug, 'game_key', s.game_key,
        'game_label', s.game_label, 'start_date', s.start_date, 'end_date', s.end_date,
        'calendar_can_configure', not exists (
          select 1 from public.races locked_race
          where locked_race.season_id = s.id
            and (locked_race.status <> 'upcoming' or exists (select 1 from public.result_versions rv where rv.race_id = locked_race.id))
        ),
        'calendar', coalesce((
          select jsonb_agg(jsonb_build_object(
            'track_key', coalesce(r.track_key, catalog.track ->> 'key'),
            'date', r.race_date,
            'time', coalesce(r.race_time, to_char(r.race_start_at at time zone 'Europe/Berlin', 'HH24:MI'), '20:00'),
            'weather', coalesce(r.weather, 'dynamisch'),
            'has_sprint', r.has_sprint
          ) order by r.round_number)
          from public.races r
          left join lateral (
            select track
            from jsonb_array_elements(private.season_track_catalog(s.game_key)) track
            where track ->> 'grand_prix_name' = r.grand_prix_name
            limit 1
          ) catalog on true
          where r.season_id = s.id
        ), '[]'::jsonb)
      )
      from public.seasons s
      where s.league_id = target_league.id and s.is_active
      order by s.created_at desc
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_season_setup_workspace() from public, anon, authenticated, service_role;
grant execute on function public.get_season_setup_workspace() to authenticated, service_role;

comment on function public.configure_league_season_calendar(uuid, jsonb) is
  'Actor-bound calendar wizard save. It only replaces an active calendar before any race or result exists.';
comment on function public.start_league_season_with_calendar(text, text, text, date, jsonb, jsonb) is
  'Atomically starts a league season with its roster and fully configured race calendar.';

