-- RaceVora V2 Phase 8: deterministic cross-league Career facts and statistics.
-- This migration is additive to the isolated V2 staging model and must never run on V1 Production.

alter table public.result_version_rows
  add column classification_status text not null default 'classified',
  add constraint result_version_rows_classification_status_check
    check (classification_status in ('classified', 'dns', 'dnf', 'dsq'));

alter table public.race_results
  add column classification_status text not null default 'classified',
  add constraint race_results_classification_status_check
    check (classification_status in ('classified', 'dns', 'dnf', 'dsq'));

create table public.career_result_facts (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete cascade,
  result_version_id uuid not null references public.result_versions(id) on delete restrict,
  result_version_row_id uuid not null references public.result_version_rows(id) on delete restrict,
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  race_date date,
  grid_position integer,
  finish_position integer,
  classification_status text not null,
  participation_status text not null,
  awarded_points numeric(7,2) not null default 0,
  is_pole boolean not null default false,
  is_fastest_lap boolean not null default false,
  reconciled_by_event_id uuid not null references public.domain_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_result_facts_race_identity_unique unique (race_id, driver_identity_id),
  constraint career_result_facts_result_row_unique unique (result_version_row_id),
  constraint career_result_facts_classification_status_check
    check (classification_status in ('classified', 'dns', 'dnf', 'dsq')),
  constraint career_result_facts_participation_status_check
    check (upper(participation_status) = 'PLAYER'),
  constraint career_result_facts_grid_position_check
    check (grid_position is null or grid_position > 0),
  constraint career_result_facts_finish_position_check
    check (finish_position is null or finish_position > 0)
);

create index idx_career_result_facts_identity_race_date
  on public.career_result_facts (driver_identity_id, race_date desc);
create index idx_career_result_facts_league_id
  on public.career_result_facts (league_id);
create index idx_career_result_facts_season_id
  on public.career_result_facts (season_id);
create index idx_career_result_facts_result_version_id
  on public.career_result_facts (result_version_id);
create index idx_career_result_facts_driver_id
  on public.career_result_facts (driver_id);
create index idx_career_result_facts_reconciled_event_id
  on public.career_result_facts (reconciled_by_event_id);

create table public.driver_career_stats (
  driver_identity_id uuid primary key references public.driver_identities(id) on delete cascade,
  starts bigint not null default 0,
  classified_finishes bigint not null default 0,
  wins bigint not null default 0,
  podiums bigint not null default 0,
  poles bigint not null default 0,
  fastest_laps bigint not null default 0,
  dns bigint not null default 0,
  dnfs bigint not null default 0,
  dsqs bigint not null default 0,
  total_points numeric(12,2) not null default 0,
  best_finish integer,
  average_finish numeric(8,2),
  leagues_competed bigint not null default 0,
  seasons_competed bigint not null default 0,
  last_race_date date,
  updated_at timestamptz not null default now(),
  constraint driver_career_stats_counts_nonnegative_check check (
    starts >= 0 and classified_finishes >= 0 and wins >= 0 and podiums >= 0
    and poles >= 0 and fastest_laps >= 0 and dns >= 0 and dnfs >= 0 and dsqs >= 0
    and leagues_competed >= 0 and seasons_competed >= 0
  ),
  constraint driver_career_stats_best_finish_check
    check (best_finish is null or best_finish > 0),
  constraint driver_career_stats_average_finish_check
    check (average_finish is null or average_finish > 0)
);

create trigger career_result_facts_set_updated_at
before update on public.career_result_facts
for each row execute function private.set_updated_at();

create or replace function private.activate_result_version(p_result_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_record public.result_versions%rowtype;
  race_record public.races%rowtype;
begin
  select * into version_record
  from public.result_versions rv
  where rv.id = p_result_version_id;

  if not found or version_record.status <> 'validated' then
    raise exception using errcode = '23514', message = 'Only a validated result version can be activated.';
  end if;

  select * into race_record
  from public.races r
  where r.id = version_record.race_id
  for update;

  if race_record.current_result_version_id is distinct from version_record.previous_version_id then
    raise exception using errcode = '40001', message = 'The validated revision is based on a stale official version.';
  end if;

  if race_record.current_result_version_id is not null then
    update public.result_versions
    set status = 'superseded', superseded_at = now()
    where id = race_record.current_result_version_id
      and status = 'active';

    if not found then
      raise exception using errcode = '23514', message = 'The current result pointer is inconsistent.';
    end if;
  end if;

  update public.result_versions
  set status = 'active', activated_by = auth.uid(), activated_at = now()
  where id = p_result_version_id;

  delete from public.race_results
  where race_id = version_record.race_id;

  insert into public.race_results (
    race_id, result_version_id, driver_id, team_id, source_assignment_id,
    car_name_snapshot, ai_driver_reference_snapshot, grid_position, finish_position,
    race_time_ms, fastest_lap_time_ms, pit_stops, participation_status,
    classification_status, base_points, penalty_time_delta_ms, awarded_points, notes,
    fastest_lap_time, race_time, points_owner_driver_id, points_team_name,
    points_car_name, points, fastest_lap_ms
  )
  select
    version_record.race_id, rvr.result_version_id, rvr.driver_id, rvr.team_id,
    rvr.source_assignment_id, rvr.car_name_snapshot, rvr.ai_driver_reference_snapshot,
    rvr.grid_position, rvr.finish_position, rvr.race_time_ms,
    rvr.fastest_lap_time_ms, rvr.pit_stops, rvr.participation_status,
    rvr.classification_status, rvr.base_points, rvr.penalty_time_delta_ms,
    rvr.awarded_points, rvr.notes, rvr.fastest_lap_time, rvr.race_time,
    rvr.points_owner_driver_id, rvr.points_team_name, rvr.points_car_name,
    rvr.points, rvr.fastest_lap_ms
  from public.result_version_rows rvr
  where rvr.result_version_id = p_result_version_id
  order by rvr.row_order;

  update public.races
  set current_result_version_id = p_result_version_id,
      status = 'completed'
  where id = version_record.race_id;
end;
$$;

revoke all on function private.activate_result_version(uuid)
  from public, anon, authenticated;
grant execute on function private.activate_result_version(uuid)
  to service_role;

create or replace function private.process_career_event(
  p_processing_id uuid,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_record private.domain_event_processing%rowtype;
  event_record public.domain_events%rowtype;
  race_record record;
  old_identity_ids uuid[];
  new_identity_ids uuid[];
  affected_identity_ids uuid[];
begin
  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
  for update;

  if not found or processing_record.processor <> 'career' then
    raise exception using errcode = 'P0002', message = 'Career processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if p_worker_id is null
     or processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this Career processing lease.';
  end if;

  select * into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type not in ('result.published', 'result.revised', 'result.voided') then
    perform private.complete_domain_event_processing(p_processing_id, 'career', p_worker_id);
    return;
  end if;

  if event_record.result_version_id is null
     or event_record.aggregate_type <> 'result_version'
     or event_record.aggregate_id <> event_record.result_version_id then
    raise exception using errcode = '23514', message = 'Career result event evidence is inconsistent.';
  end if;

  select r.id as race_id, r.season_id, r.race_date, r.weekend_start_date,
         r.current_result_version_id, s.league_id
    into race_record
  from public.result_versions rv
  join public.races r on r.id = rv.race_id
  join public.seasons s on s.id = r.season_id
  where rv.id = event_record.result_version_id
  for update of r;

  if not found or race_record.league_id <> event_record.league_id then
    raise exception using errcode = '23514', message = 'Career result event league is inconsistent.';
  end if;

  select array_agg(distinct crf.driver_identity_id)
    into old_identity_ids
  from public.career_result_facts crf
  where crf.race_id = race_record.race_id;

  delete from public.career_result_facts
  where race_id = race_record.race_id;

  if race_record.current_result_version_id is not null then
    insert into public.career_result_facts (
      race_id, league_id, season_id, result_version_id, result_version_row_id,
      driver_identity_id, driver_id, race_date, grid_position, finish_position,
      classification_status, participation_status, awarded_points,
      is_pole, is_fastest_lap, reconciled_by_event_id
    )
    select
      race_record.race_id,
      race_record.league_id,
      race_record.season_id,
      rvr.result_version_id,
      rvr.id,
      dil.driver_identity_id,
      rvr.driver_id,
      coalesce(race_record.race_date, race_record.weekend_start_date),
      rvr.grid_position,
      rvr.finish_position,
      rvr.classification_status,
      upper(rvr.participation_status),
      rvr.awarded_points,
      rvr.grid_position = 1,
      coalesce(nullif(rvr.fastest_lap_time_ms, 0), nullif(rvr.fastest_lap_ms, 0)) is not null
        and coalesce(nullif(rvr.fastest_lap_time_ms, 0), nullif(rvr.fastest_lap_ms, 0)) = (
          select min(coalesce(nullif(candidate.fastest_lap_time_ms, 0), nullif(candidate.fastest_lap_ms, 0)))
          from public.result_version_rows candidate
          join public.driver_identity_links candidate_link on candidate_link.driver_id = candidate.driver_id
          join public.driver_identities candidate_identity on candidate_identity.id = candidate_link.driver_identity_id
          join public.drivers candidate_driver on candidate_driver.id = candidate.driver_id
          where candidate.result_version_id = race_record.current_result_version_id
            and upper(candidate.participation_status) = 'PLAYER'
            and candidate.classification_status <> 'dns'
            and candidate_identity.status = 'active'
            and candidate_driver.is_active
        ),
      event_record.id
    from public.result_version_rows rvr
    join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
    join public.driver_identities di on di.id = dil.driver_identity_id
    join public.drivers d on d.id = rvr.driver_id
    where rvr.result_version_id = race_record.current_result_version_id
      and upper(rvr.participation_status) = 'PLAYER'
      and di.status = 'active'
      and d.is_active;
  end if;

  select array_agg(distinct crf.driver_identity_id)
    into new_identity_ids
  from public.career_result_facts crf
  where crf.race_id = race_record.race_id;

  select array_agg(distinct identity_id)
    into affected_identity_ids
  from unnest(
    coalesce(old_identity_ids, '{}'::uuid[]) || coalesce(new_identity_ids, '{}'::uuid[])
  ) as identities(identity_id);

  if coalesce(cardinality(affected_identity_ids), 0) > 0 then
    delete from public.driver_career_stats dcs
    where dcs.driver_identity_id = any(affected_identity_ids);

    insert into public.driver_career_stats (
      driver_identity_id, starts, classified_finishes, wins, podiums, poles,
      fastest_laps, dns, dnfs, dsqs, total_points, best_finish,
      average_finish, leagues_competed, seasons_competed, last_race_date
    )
    select
      crf.driver_identity_id,
      count(*) filter (where crf.classification_status <> 'dns'),
      count(*) filter (where crf.classification_status = 'classified'),
      count(*) filter (where crf.classification_status = 'classified' and crf.finish_position = 1),
      count(*) filter (where crf.classification_status = 'classified' and crf.finish_position between 1 and 3),
      count(*) filter (where crf.is_pole),
      count(*) filter (where crf.is_fastest_lap),
      count(*) filter (where crf.classification_status = 'dns'),
      count(*) filter (where crf.classification_status = 'dnf'),
      count(*) filter (where crf.classification_status = 'dsq'),
      coalesce(sum(crf.awarded_points), 0),
      min(crf.finish_position) filter (where crf.classification_status = 'classified'),
      round(avg(crf.finish_position) filter (where crf.classification_status = 'classified'), 2),
      count(distinct crf.league_id),
      count(distinct crf.season_id),
      max(crf.race_date)
    from public.career_result_facts crf
    where crf.driver_identity_id = any(affected_identity_ids)
    group by crf.driver_identity_id;
  end if;

  perform private.complete_domain_event_processing(p_processing_id, 'career', p_worker_id);
end;
$$;

revoke all on function private.process_career_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_career_event(uuid, text)
  to service_role;

alter table public.career_result_facts enable row level security;
alter table public.driver_career_stats enable row level security;

revoke all on table public.career_result_facts from public, anon, authenticated;
revoke all on table public.driver_career_stats from public, anon, authenticated;

grant select on table public.career_result_facts to authenticated;
grant select on table public.driver_career_stats to authenticated;
grant select, insert, update, delete on table public.career_result_facts to service_role;
grant select, insert, update, delete on table public.driver_career_stats to service_role;

create policy "v2 permitted users read career result facts"
on public.career_result_facts
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1
    from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
  or (select private.has_league_capability(league_id, 'steward'))
);

create policy "v2 users read own global career stats"
on public.driver_career_stats
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1
    from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

comment on column public.result_version_rows.classification_status is
  'Canonical sporting classification: classified, DNS, DNF, or DSQ.';
comment on table public.career_result_facts is
  'Rebuildable current official result contributions for active registered global driver identities.';
comment on table public.driver_career_stats is
  'Deterministic cross-league Career aggregate derived exclusively from current Career result facts.';
comment on function private.process_career_event(uuid, text) is
  'Idempotently reconciles one race to its explicit current result pointer and rebuilds affected global Career totals.';
