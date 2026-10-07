-- Keep the existing protected graphics RPC, scoring and grants. Only select the
-- active season independently of the last published race and remove row caps.
do $migration$
declare
  original text := pg_get_functiondef('public.get_social_graphics_workspace()'::regprocedure);
  updated text;
begin
  if position('target_race public.races%rowtype;' in original) = 0
     or position('where r.season_id = target_race.season_id' in original) = 0 then
    raise exception 'Unexpected social graphics function; refusing an incomplete patch';
  end if;
  updated := replace(original, 'target_race public.races%rowtype;',
    'target_race public.races%rowtype; target_season public.seasons%rowtype;');
  updated := replace(updated, '  select rv.* into target_result',
    E'  select s.* into target_season from public.seasons s\n  where s.league_id = target_league.id and s.is_active\n  order by s.created_at desc, s.id limit 1;\n\n  select rv.* into target_result');
  updated := replace(updated, 'where s.league_id = target_league.id and rv.status = ''active''',
    'where s.id = target_season.id and rv.status = ''active''');
  updated := replace(updated, '''latest_result'', case',
    '''season'', case when target_season.id is null then null else jsonb_build_object(''id'', target_season.id, ''name'', target_season.name) end, ''latest_result'', case');
  updated := replace(updated, 'where r.season_id = target_race.season_id', 'where r.season_id = target_season.id');
  updated := regexp_replace(updated, E'\n        limit (12|24)', '', 'g');
  if updated = original or position('where r.season_id = target_race.season_id' in updated) > 0 then
    raise exception 'Social graphics season patch failed';
  end if;
  execute updated;
end;
$migration$;
