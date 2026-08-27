-- RaceVora V2: explicit season completion with a durable calendar archive marker.

alter table public.seasons
  add column archived_at timestamptz;

update public.seasons
set archived_at = coalesce(end_date::timestamptz, updated_at, created_at)
where not is_active and archived_at is null;

update public.seasons
set end_date = null
where is_active and end_date is not null;

create or replace function private.mark_completed_season_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    new.archived_at := coalesce(new.archived_at, now());
  elsif new.is_active then
    new.archived_at := null;
    new.end_date := null;
  end if;
  return new;
end;
$$;

revoke all on function private.mark_completed_season_archive()
  from public, anon, authenticated, service_role;

create trigger seasons_mark_archive_before_update
before update of is_active on public.seasons
for each row execute function private.mark_completed_season_archive();

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

  select count(*) into race_count
  from public.races r
  where r.season_id = target_season.id;

  select count(*) into official_result_count
  from public.races r
  join public.result_versions rv on rv.id = r.current_result_version_id
  where r.season_id = target_season.id and rv.status = 'active';

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

comment on column public.seasons.archived_at is
  'Timestamp at which an active season was completed and made available in the calendar archive.';
comment on function public.complete_league_season(uuid) is
  'Actor-bound league-admin transition that archives a season without copying or changing its races and result versions.';
