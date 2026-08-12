update public.leagues
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'published', coalesce((settings->>'published')::boolean, true),
  'onboarding_complete', coalesce((settings->>'onboarding_complete')::boolean, true)
)
where not (coalesce(settings, '{}'::jsonb) ? 'published')
   or not (coalesce(settings, '{}'::jsonb) ? 'onboarding_complete');

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_is_public boolean default true
)
returns table(id uuid, name text, slug text, is_public boolean, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_league_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 80 then raise exception 'League name must be between 3 and 80 characters'; end if;
  if v_name ~ '[<>]' then raise exception 'League name contains invalid characters'; end if;
  if char_length(v_slug) < 3 or char_length(v_slug) > 50 then raise exception 'League slug must be between 3 and 50 characters'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'League slug may only contain lowercase letters, numbers and single hyphens'; end if;
  if v_slug = any (array['admin','api','app','auth','login','logout','signup','register','support','help','www','racecontrolcenter']) then raise exception 'This league slug is reserved'; end if;

  insert into public.leagues (name, slug, is_public, created_by, settings)
  values (v_name, v_slug, coalesce(p_is_public, true), v_user_id,
    jsonb_build_object('published', false, 'onboarding_complete', false))
  returning leagues.id into v_league_id;

  insert into public.league_members (league_id, user_id, role)
  values (v_league_id, v_user_id, 'owner');

  insert into public.league_content (league_id, id)
  values (v_league_id, 'default');

  return query
  select l.id, l.name, l.slug, l.is_public, 'owner'::text
  from public.leagues l where l.id = v_league_id;
exception when unique_violation then
  raise exception 'League slug already exists';
end;
$$;

revoke execute on function public.create_league(text, text, boolean) from public, anon;
grant execute on function public.create_league(text, text, boolean) to authenticated;

drop policy if exists "public read public leagues" on public.leagues;
drop policy if exists "public read published public leagues" on public.leagues;
create policy "public read published public leagues"
on public.leagues for select to anon, authenticated
using (is_public = true and coalesce((settings->>'published')::boolean, true) = true);

create or replace function public.complete_league_onboarding(
  p_league_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_game_key text := btrim(coalesce(p_payload->>'game_key', ''));
  v_game_label text := btrim(coalesce(p_payload->>'game_label', ''));
  v_season_name text := btrim(coalesce(p_payload#>>'{season,name}', ''));
  v_season_slug text;
  v_start_date date;
  v_scoring jsonb := coalesce(p_payload->'scoring', '{}'::jsonb);
  v_teams jsonb := coalesce(p_payload->'teams', '[]'::jsonb);
  v_drivers jsonb := coalesce(p_payload->'drivers', '[]'::jsonb);
  v_races jsonb := coalesce(p_payload->'races', '[]'::jsonb);
  v_publish boolean := coalesce((p_payload->>'publish')::boolean, false);
  v_season_id uuid;
  v_team jsonb;
  v_driver jsonb;
  v_race jsonb;
  v_team_id uuid;
  v_driver_id uuid;
  v_team_name text;
  v_team_slug text;
  v_driver_name text;
  v_gp_name text;
  v_round integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select lm.role into v_role
  from public.league_members lm
  where lm.league_id = p_league_id and lm.user_id = v_user_id;
  if v_role is null or v_role not in ('owner', 'admin') then raise exception 'Owner or admin role required'; end if;
  if exists (select 1 from public.seasons s where s.league_id = p_league_id) then
    raise exception 'League onboarding can only be completed before the first season exists';
  end if;

  if v_game_key = '' or v_game_label = '' then raise exception 'Game is required'; end if;
  if char_length(v_season_name) < 2 or char_length(v_season_name) > 80 then raise exception 'Season name must be between 2 and 80 characters'; end if;
  if jsonb_typeof(v_scoring->'points') <> 'array' or jsonb_array_length(v_scoring->'points') < 1 then raise exception 'At least one scoring position is required'; end if;
  if jsonb_typeof(v_teams) <> 'array' or jsonb_typeof(v_drivers) <> 'array' or jsonb_typeof(v_races) <> 'array' then raise exception 'Teams, drivers and races must be arrays'; end if;
  if jsonb_array_length(v_drivers) < 1 then raise exception 'At least one driver is required'; end if;
  if jsonb_array_length(v_races) < 1 then raise exception 'At least one race is required'; end if;

  begin
    v_start_date := nullif(p_payload#>>'{season,start_date}', '')::date;
  exception when others then raise exception 'Invalid season start date'; end;

  v_season_slug := trim(both '-' from lower(regexp_replace(v_season_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if v_season_slug = '' then v_season_slug := 'season-1'; end if;

  insert into public.seasons (league_id, name, slug, start_date, is_active, game_key, game_label)
  values (p_league_id, v_season_name, v_season_slug, v_start_date, true, v_game_key, v_game_label)
  returning id into v_season_id;

  for v_team in select value from jsonb_array_elements(v_teams)
  loop
    v_team_name := btrim(coalesce(v_team->>'name', ''));
    if v_team_name = '' then continue; end if;
    if char_length(v_team_name) > 80 then raise exception 'Team name too long'; end if;
    v_team_slug := trim(both '-' from lower(regexp_replace(v_team_name, '[^a-zA-Z0-9]+', '-', 'g')));
    if v_team_slug = '' then v_team_slug := 'team-' || substr(gen_random_uuid()::text, 1, 8); end if;
    insert into public.teams (league_id, slug, display_name, short_name)
    values (p_league_id, v_team_slug, v_team_name, nullif(btrim(coalesce(v_team->>'short_name', '')), ''));
  end loop;

  for v_driver in select value from jsonb_array_elements(v_drivers)
  loop
    v_driver_name := btrim(coalesce(v_driver->>'name', ''));
    if v_driver_name = '' then continue; end if;
    if char_length(v_driver_name) > 100 then raise exception 'Driver name too long'; end if;
    v_team_name := btrim(coalesce(v_driver->>'team', ''));
    v_team_id := null;
    if v_team_name <> '' then
      select t.id into v_team_id from public.teams t
      where t.league_id = p_league_id and lower(t.display_name) = lower(v_team_name) limit 1;
    end if;

    insert into public.drivers (league_id, display_name, gamertag, number, league_team, is_active)
    values (p_league_id, v_driver_name,
      nullif(btrim(coalesce(v_driver->>'gamertag', '')), ''),
      nullif(v_driver->>'number', '')::integer,
      nullif(v_team_name, ''), true)
    returning id into v_driver_id;

    insert into public.driver_season_assignments (season_id, driver_id, team_id, league_team, is_primary)
    values (v_season_id, v_driver_id, v_team_id, nullif(v_team_name, ''), true);
  end loop;

  for v_race in select value from jsonb_array_elements(v_races)
  loop
    v_gp_name := btrim(coalesce(v_race->>'name', ''));
    if v_gp_name = '' then continue; end if;
    v_round := v_round + 1;
    insert into public.races (season_id, round_number, grand_prix_name, circuit_name, race_date, race_time, status)
    values (v_season_id, v_round, v_gp_name,
      nullif(btrim(coalesce(v_race->>'circuit', '')), ''),
      nullif(v_race->>'date', '')::date,
      nullif(btrim(coalesce(v_race->>'time', '')), ''), 'upcoming');
  end loop;
  if v_round = 0 then raise exception 'At least one valid race is required'; end if;

  update public.leagues l
  set settings = coalesce(l.settings, '{}'::jsonb) || jsonb_build_object(
    'published', v_publish,
    'onboarding_complete', true,
    'game_key', v_game_key,
    'game_label', v_game_label,
    'scoring', v_scoring
  ), updated_at = now()
  where l.id = p_league_id;

  return jsonb_build_object('ok', true, 'league_id', p_league_id, 'season_id', v_season_id,
    'published', v_publish, 'drivers_created', jsonb_array_length(v_drivers),
    'teams_created', jsonb_array_length(v_teams), 'races_created', v_round);
end;
$$;

revoke execute on function public.complete_league_onboarding(uuid, jsonb) from public, anon;
grant execute on function public.complete_league_onboarding(uuid, jsonb) to authenticated;