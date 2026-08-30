-- RaceVora V2 Phase 21: deterministic, result-version-bound social graphics.
-- Additive staging migration. Never execute against V1 Production.

create table public.social_graphic_renders (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete restrict,
  result_version_id uuid references public.result_versions(id) on delete restrict,
  graphic_type text not null,
  graphic_format text not null,
  source_digest text not null,
  source_payload jsonb not null,
  status text not null default 'ready',
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  outdated_at timestamptz,
  constraint social_graphic_type_check check (
    graphic_type in ('race_result', 'podium', 'winner', 'driver_standings', 'team_standings', 'achievement')
  ),
  constraint social_graphic_format_check check (graphic_format in ('square', 'portrait', 'story', 'landscape')),
  constraint social_graphic_digest_check check (source_digest ~ '^[0-9a-f]{64}$'),
  constraint social_graphic_payload_object_check check (jsonb_typeof(source_payload) = 'object'),
  constraint social_graphic_status_check check (status in ('ready', 'outdated')),
  constraint social_graphic_outdated_state_check check (
    (status = 'ready' and outdated_at is null) or (status = 'outdated' and outdated_at is not null)
  ),
  constraint social_graphic_result_binding_check check (
    graphic_type not in ('race_result', 'podium', 'winner') or result_version_id is not null
  ),
  constraint social_graphic_render_unique unique (league_id, graphic_type, graphic_format, source_digest)
);

create index idx_social_graphics_league_generated
  on public.social_graphic_renders (league_id, generated_at desc);
create index idx_social_graphics_result_version
  on public.social_graphic_renders (result_version_id)
  where result_version_id is not null;
create index idx_social_graphics_ready_result
  on public.social_graphic_renders (result_version_id, generated_at desc)
  where status = 'ready' and result_version_id is not null;
create index idx_social_graphics_generated_by
  on public.social_graphic_renders (generated_by)
  where generated_by is not null;

alter table public.social_graphic_renders enable row level security;
revoke all on table public.social_graphic_renders from public, anon, authenticated;
grant select on table public.social_graphic_renders to authenticated;
grant select, insert, update on table public.social_graphic_renders to service_role;

create policy "v2 league admins read tenant social graphics"
on public.social_graphic_renders for select to authenticated
using (
  (select public.matches_requested_league(league_id))
  and (select private.has_league_capability(league_id, 'league_admin'))
);

create or replace function public.get_social_graphics_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
  target_result public.result_versions%rowtype;
  target_race public.races%rowtype;
  graphics_enabled boolean;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Social graphics administration is not allowed.';
  end if;

  select coalesce(pff.enabled, false) into graphics_enabled
  from public.platform_feature_flags pff
  where pff.flag_key = 'graphics_enabled';

  if not coalesce(graphics_enabled, false) then
    raise exception using errcode = '42501', message = 'Social graphics are disabled.';
  end if;

  select rv.* into target_result
  from public.result_versions rv
  join public.races r on r.current_result_version_id = rv.id
  join public.seasons s on s.id = r.season_id
  where s.league_id = target_league.id and rv.status = 'active'
  order by coalesce(rv.activated_at, rv.created_at) desc
  limit 1;

  if target_result.id is not null then
    select r.* into target_race
    from public.races r
    where r.id = target_result.race_id;
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object(
      'id', target_league.id,
      'name', target_league.name,
      'slug', target_league.slug
    ),
    'latest_result', case when target_result.id is null then null else jsonb_build_object(
      'id', target_result.id,
      'version', target_result.version_number,
      'race_id', target_race.id,
      'race_name', target_race.grand_prix_name,
      'circuit', target_race.circuit_name,
      'race_date', target_race.race_date,
      'round', target_race.round_number,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'position', rvr.finish_position,
          'driver', d.display_name,
          'team', coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent'),
          'points', rvr.awarded_points,
          'status', coalesce(rvr.classification_status, 'classified')
        ) order by rvr.row_order)
        from public.result_version_rows rvr
        join public.drivers d on d.id = rvr.driver_id
        where rvr.result_version_id = target_result.id
      ), '[]'::jsonb)
    ) end,
    'driver_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', ranked.position,
        'driver', ranked.driver,
        'points', ranked.points,
        'wins', ranked.wins
      ) order by ranked.position)
      from (
        select row_number() over (order by sum(rvr.awarded_points) desc, d.display_name)::integer as position,
               d.display_name as driver,
               sum(rvr.awarded_points) as points,
               count(*) filter (where rvr.finish_position = 1) as wins
        from public.result_version_rows rvr
        join public.result_versions rv on rv.id = rvr.result_version_id and rv.status = 'active'
        join public.races r on r.current_result_version_id = rv.id
        join public.drivers d on d.id = rvr.driver_id
        where r.season_id = target_race.season_id
        group by d.id, d.display_name
        order by points desc, driver
        limit 12
      ) ranked
    ), '[]'::jsonb),
    'team_standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', ranked.position,
        'team', ranked.team,
        'points', ranked.points,
        'wins', ranked.wins
      ) order by ranked.position)
      from (
        select row_number() over (order by sum(rvr.awarded_points) desc, coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent'))::integer as position,
               coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent') as team,
               sum(rvr.awarded_points) as points,
               count(*) filter (where rvr.finish_position = 1) as wins
        from public.result_version_rows rvr
        join public.result_versions rv on rv.id = rvr.result_version_id and rv.status = 'active'
        join public.races r on r.current_result_version_id = rv.id
        join public.drivers d on d.id = rvr.driver_id
        where r.season_id = target_race.season_id
        group by coalesce(rvr.points_team_name, rvr.car_name_snapshot, d.league_team, 'Independent')
        order by points desc, team
        limit 12
      ) ranked
    ), '[]'::jsonb),
    'latest_achievement', (
      select jsonb_build_object(
        'driver', d.display_name,
        'code', dae.achievement_code,
        'value', dae.observed_value,
        'unlocked_at', dae.occurred_at
      )
      from public.driver_achievement_events dae
      join public.driver_identity_links dil on dil.driver_identity_id = dae.driver_identity_id
      join public.drivers d on d.id = dil.driver_id and d.league_id = target_league.id
      where dae.event_type = 'unlocked'
      order by dae.occurred_at desc
      limit 1
    ),
    'recent_renders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sgr.id,
        'graphic_type', sgr.graphic_type,
        'graphic_format', sgr.graphic_format,
        'result_version_id', sgr.result_version_id,
        'source_digest', sgr.source_digest,
        'status', case
          when sgr.status = 'outdated' then 'outdated'
          when sgr.result_version_id is not null and r.current_result_version_id is distinct from sgr.result_version_id then 'outdated'
          else 'ready'
        end,
        'generated_at', sgr.generated_at
      ) order by sgr.generated_at desc)
      from (
        select * from public.social_graphic_renders
        where league_id = target_league.id
        order by generated_at desc
        limit 20
      ) sgr
      left join public.result_versions rv on rv.id = sgr.result_version_id
      left join public.races r on r.id = rv.race_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_social_graphics_workspace() from public, anon, authenticated, service_role;
grant execute on function public.get_social_graphics_workspace() to authenticated;

create or replace function public.record_social_graphic_render(
  p_graphic_type text,
  p_graphic_format text,
  p_result_version_id uuid,
  p_source_digest text,
  p_source_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_league public.leagues%rowtype;
  recorded_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not private.has_league_capability(target_league.id, 'league_admin') then
    raise exception using errcode = '42501', message = 'Social graphics administration is not allowed.';
  end if;

  if not exists (
    select 1 from public.platform_feature_flags pff
    where pff.flag_key = 'graphics_enabled' and pff.enabled
  ) then
    raise exception using errcode = '42501', message = 'Social graphics are disabled.';
  end if;

  if p_result_version_id is not null and not exists (
    select 1
    from public.result_versions rv
    join public.races r on r.current_result_version_id = rv.id
    join public.seasons s on s.id = r.season_id
    where rv.id = p_result_version_id
      and rv.status = 'active'
      and s.league_id = target_league.id
  ) then
    raise exception using errcode = '22023', message = 'Result version is not the current official tenant result.';
  end if;

  insert into public.social_graphic_renders (
    league_id, result_version_id, graphic_type, graphic_format,
    source_digest, source_payload, generated_by
  ) values (
    target_league.id, p_result_version_id, p_graphic_type, p_graphic_format,
    p_source_digest, p_source_payload, (select auth.uid())
  )
  on conflict (league_id, graphic_type, graphic_format, source_digest)
  do update set generated_at = now(), generated_by = (select auth.uid())
  returning id into recorded_id;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', target_league.id, (select auth.uid()), 'social_graphic.rendered',
    'social_graphic_render', recorded_id,
    jsonb_build_object('graphic_type', p_graphic_type, 'graphic_format', p_graphic_format, 'result_version_id', p_result_version_id)
  );

  return recorded_id;
end;
$$;

revoke all on function public.record_social_graphic_render(text, text, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_social_graphic_render(text, text, uuid, text, jsonb)
  to authenticated;

create or replace function private.process_graphics_event(p_processing_id uuid, p_worker_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.domain_events%rowtype;
begin
  select de.* into event_record
  from private.domain_event_processing dep
  join public.domain_events de on de.id = dep.event_id
  where dep.id = p_processing_id
    and dep.processor = 'graphics'
    and dep.status = 'processing'
    and dep.locked_by = btrim(p_worker_id)
  for update of dep;

  if not found then
    raise exception using errcode = '23514', message = 'Worker does not own this graphics lease.';
  end if;

  if event_record.event_type in ('result.revised', 'result.voided') then
    update public.social_graphic_renders sgr
    set status = 'outdated', outdated_at = coalesce(sgr.outdated_at, now())
    where sgr.status = 'ready'
      and sgr.result_version_id is not null
      and exists (
        select 1
        from public.result_versions rendered_rv
        join public.result_versions event_rv on event_rv.id = event_record.result_version_id
        where rendered_rv.id = sgr.result_version_id
          and rendered_rv.race_id = event_rv.race_id
          and (
            (event_record.event_type = 'result.revised' and rendered_rv.id <> event_rv.id)
            or (event_record.event_type = 'result.voided' and rendered_rv.id = event_rv.id)
          )
      );
  end if;

  perform private.complete_domain_event_processing(p_processing_id, 'graphics', p_worker_id);
end;
$$;

revoke all on function private.process_graphics_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_graphics_event(uuid, text)
  to service_role;

update public.platform_feature_flags
set enabled = true, updated_at = now()
where flag_key = 'graphics_enabled';

comment on table public.social_graphic_renders is
  'Deterministic social graphic manifests. Binary PNG output remains downstream of result publication.';
comment on function public.get_social_graphics_workspace() is
  'Actor-bound league-admin snapshot for deterministic Social Graphics rendering.';
comment on function public.record_social_graphic_render(text, text, uuid, text, jsonb) is
  'Records a tenant-bound deterministic graphic manifest after PNG rendering succeeds.';
