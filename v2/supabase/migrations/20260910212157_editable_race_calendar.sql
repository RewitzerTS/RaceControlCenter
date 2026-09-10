-- Individual edits retain race IDs, results and roster references.
create schema if not exists calendar_editor;
revoke all on schema calendar_editor from public, anon, authenticated;
grant usage on schema calendar_editor to authenticated;

create function calendar_editor.workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_league_id uuid; season public.seasons%rowtype;
begin
  select l.id into v_league_id from public.leagues l where l.slug = public.requested_league_slug();
  if auth.uid() is null or v_league_id is null or not private.has_league_capability(v_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Calendar access denied.';
  end if;
  select s.* into season from public.seasons s where s.league_id = v_league_id and s.is_active;
  return jsonb_build_object('season_id', season.id, 'tracks', coalesce(private.season_track_catalog(season.game_key), '[]'::jsonb),
    'races', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'round', r.round_number, 'name', r.grand_prix_name, 'track_key', r.track_key,
      'date', r.race_date, 'time', coalesce(r.race_time, to_char(r.race_start_at at time zone 'Europe/Berlin', 'HH24:MI'), ''),
      'weather', coalesce(r.weather, 'dynamisch'), 'has_sprint', r.has_sprint, 'updated_at', r.updated_at,
      'locked', r.status <> 'upcoming' or exists(select 1 from public.result_versions rv where rv.race_id = r.id)
    ) order by r.round_number) from public.races r where r.season_id = season.id), '[]'::jsonb));
end;
$$;

create function calendar_editor.update_race(p_race_id uuid, p_expected_updated_at timestamptz, p_entry jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_league_id uuid; season public.seasons%rowtype; race public.races%rowtype; track jsonb; race_day date; race_clock time;
begin
  select l.id into v_league_id from public.leagues l where l.slug = public.requested_league_slug();
  if auth.uid() is null or v_league_id is null or not private.has_league_capability(v_league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Calendar access denied.';
  end if;
  select s.* into season from public.seasons s join public.races r on r.season_id = s.id
    where r.id = p_race_id and s.league_id = v_league_id and s.is_active for update of s;
  if season.id is null then raise exception 'Die aktive Saison wurde nicht gefunden.'; end if;
  select r.* into race from public.races r where r.id = p_race_id for update;
  if race.updated_at is distinct from p_expected_updated_at then
    raise exception 'Das Rennen wurde inzwischen geändert. Bitte neu laden und erneut bearbeiten.';
  end if;
  if race.status <> 'upcoming' or exists(select 1 from public.result_versions rv where rv.race_id = race.id) then
    raise exception 'Rennen mit Ergebnissen oder abgeschlossenem Status bleiben unverändert.';
  end if;
  select value into track from jsonb_array_elements(private.season_track_catalog(season.game_key)) where value->>'key' = p_entry->>'track_key';
  if track is null or coalesce(p_entry->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or coalesce(p_entry->>'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
    or coalesce(p_entry->>'weather', '') not in ('klar', 'regen', 'dynamisch')
    or jsonb_typeof(p_entry->'has_sprint') is distinct from 'boolean' then
    raise exception 'Bitte Strecke, Datum, Uhrzeit, Wetter und Sprint prüfen.';
  end if;
  if exists(select 1 from public.races r where r.season_id = season.id and r.id <> race.id and r.track_key = p_entry->>'track_key') then
    raise exception 'Diese Strecke ist bereits im Kalender enthalten.';
  end if;
  race_day := (p_entry->>'date')::date; race_clock := (p_entry->>'time')::time;
  update public.races set track_key = track->>'key', grand_prix_name = track->>'grand_prix_name',
    circuit_name = track->>'circuit_name', country_code = track->>'country_code',
    race_date = race_day, weekend_start_date = race_day, race_time = p_entry->>'time',
    race_start_at = (race_day + race_clock) at time zone 'Europe/Berlin', weather = p_entry->>'weather',
    has_sprint = (p_entry->>'has_sprint')::boolean where id = race.id;
  update public.seasons set start_date = (select min(r.race_date) from public.races r where r.season_id = season.id), updated_at = now() where id = season.id;
  insert into public.v2_audit_events(scope, league_id, actor_user_id, action, entity_type, entity_id, metadata)
    values ('league', v_league_id, auth.uid(), 'race.calendar.updated', 'race', race.id,
      jsonb_build_object('before', jsonb_build_object('date', race.race_date, 'track_key', race.track_key, 'time', race.race_time, 'weather', race.weather, 'has_sprint', race.has_sprint), 'after', p_entry));
  return jsonb_build_object('saved', true, 'race_id', race.id);
end;
$$;
revoke all on function calendar_editor.workspace() from public, anon, authenticated, service_role;
revoke all on function calendar_editor.update_race(uuid,timestamptz,jsonb) from public, anon, authenticated, service_role;
grant execute on function calendar_editor.workspace(), calendar_editor.update_race(uuid,timestamptz,jsonb) to authenticated;
create function public.get_editable_race_calendar() returns jsonb language sql security invoker set search_path = '' as $$ select calendar_editor.workspace(); $$;
create function public.update_league_calendar_race(p_race_id uuid, p_expected_updated_at timestamptz, p_entry jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select calendar_editor.update_race(p_race_id,p_expected_updated_at,p_entry); $$;
revoke all on function public.get_editable_race_calendar(), public.update_league_calendar_race(uuid,timestamptz,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.get_editable_race_calendar(), public.update_league_calendar_race(uuid,timestamptz,jsonb) to authenticated;
