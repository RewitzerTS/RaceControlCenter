-- Keep season start compatible with the immutable V2 audit trail.
-- The F1 26 preset wrapper previously tried to update the season.started event,
-- which correctly triggered the append-only protection and rolled back the season.

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
  season_id uuid;
  target_league_id uuid;
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
  season_id := (result -> 'season' ->> 'id')::uuid;

  select s.league_id into target_league_id
  from public.seasons s
  where s.id = season_id;

  -- Corrections and enrichments are new facts in an append-only audit log.
  -- Never mutate the season.started event written by the base transaction.
  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league_id, (select auth.uid()), 'season.preset.seeded',
    'season', season_id,
    jsonb_build_object(
      'league_id', target_league_id,
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
  'Starts a league season, seeds its preset, and records enrichment as a new append-only audit fact.';
