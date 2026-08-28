-- Reuse league driver identities when a later season uses another game preset.
-- Historical names, teams, cars and numbers remain immutable in season_driver_assignments.

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
  roster_entry jsonb;
  result jsonb;
  roster_size integer;
  track_count integer;
  player_count integer;
  season_id uuid;
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

  if not exists (
    select 1
    from jsonb_array_elements(private.season_game_catalog()) game
    where game ->> 'key' = p_game_key
  ) then
    raise exception using errcode = '22023', message = 'Unsupported game preset.';
  end if;

  -- The league driver row is the durable identity. Move its preset reference to
  -- the current game/seat before the legacy starter resolves the roster.
  for roster_entry in
    select roster.value
    from jsonb_array_elements(private.season_game_catalog()) game
    cross join lateral jsonb_array_elements(game.value -> 'roster') roster
    where game.value ->> 'key' = p_game_key
  loop
    if not exists (
      select 1
      from public.drivers existing_reference
      where existing_reference.league_id = target_league.id
        and existing_reference.ai_driver_reference = p_game_key || ':' || (roster_entry ->> 'seat_code')
    ) then
      update public.drivers reusable_driver
      set ai_driver_reference = p_game_key || ':' || (roster_entry ->> 'seat_code')
      where reusable_driver.id = (
        select candidate.id
        from public.drivers candidate
        where candidate.league_id = target_league.id
          and candidate.gamertag is null
          and lower(candidate.display_name) = lower(roster_entry ->> 'ai_driver_name')
        order by candidate.is_active desc, candidate.created_at, candidate.id
        limit 1
      );
    end if;
  end loop;

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
  season_id := (result -> 'season' ->> 'id')::uuid;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league.id, actor_id, 'season.preset.seeded',
    'season', season_id,
    jsonb_build_object(
      'league_id', target_league.id,
      'game_key', p_game_key,
      'players', player_count,
      'ai_drivers', roster_size - player_count,
      'races', track_count
    )
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

comment on function public.start_league_season(text, text, text, date, date, jsonb) is
  'Starts a league season while reusing durable league driver identities across game presets.';
