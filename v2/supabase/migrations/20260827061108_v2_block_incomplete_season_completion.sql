-- A season may only be archived after every non-cancelled race is completed
-- and every completed race has an active official result version.

create or replace function public.complete_league_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_season public.seasons%rowtype;
  race_count integer;
  official_result_count integer;
  upcoming_race_count integer;
  missing_result_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select s.* into target_season
  from public.seasons s
  join public.leagues l on l.id = s.league_id
  where s.id = p_season_id
    and l.slug = public.requested_league_slug()
  for update of s;

  if target_season.id is null
     or not private.has_league_capability(target_season.league_id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Season completion access denied.';
  end if;
  if not target_season.is_active then
    raise exception using errcode = '22023', message = 'Season is already completed.';
  end if;

  perform 1
  from public.races r
  where r.season_id = target_season.id
  for update;

  select
    count(*),
    count(*) filter (where r.status = 'upcoming'),
    count(*) filter (
      where r.status = 'completed'
        and (rv.id is null or rv.status <> 'active')
    ),
    count(*) filter (where rv.status = 'active')
  into race_count, upcoming_race_count, missing_result_count, official_result_count
  from public.races r
  left join public.result_versions rv on rv.id = r.current_result_version_id
  where r.season_id = target_season.id;

  if upcoming_race_count > 0 or missing_result_count > 0 then
    raise exception using
      errcode = '55000',
      message = format(
        'Season completion blocked: %s upcoming race(s), %s completed race(s) without an active official result.',
        upcoming_race_count,
        missing_result_count
      );
  end if;

  update public.seasons
  set is_active = false, end_date = null
  where id = target_season.id
  returning * into target_season;

  update public.leagues
  set settings = (coalesce(settings, '{}'::jsonb) - 'active_season_id') || jsonb_build_object(
    'last_archived_season_id', target_season.id,
    'last_archived_at', target_season.archived_at
  )
  where id = target_season.league_id;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', actor_id, 'season.completed', 'season', target_season.id,
    jsonb_build_object(
      'league_id', target_season.league_id,
      'races', race_count,
      'official_results', official_result_count,
      'archived_at', target_season.archived_at
    )
  );

  return jsonb_build_object(
    'season', jsonb_build_object(
      'id', target_season.id,
      'name', target_season.name,
      'archived_at', target_season.archived_at
    ),
    'races', race_count,
    'official_results', official_result_count,
    'archived', true
  );
end;
$$;

revoke all on function public.complete_league_season(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_league_season(uuid)
  to authenticated, service_role;

comment on function public.complete_league_season(uuid) is
  'Actor-bound league-admin transition that requires every non-cancelled race to be completed with an active official result before archiving.';
