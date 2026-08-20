-- RaceVora V2 Phase 10: deterministic, revision-aware Core Achievements.
-- Additive staging migration. Never execute against V1 Production.

create table public.achievement_definitions (
  code text primary key,
  metric text not null,
  threshold bigint not null,
  title_key text not null,
  description_key text not null,
  reward_vc integer not null default 0,
  rule_version smallint not null default 1,
  sort_order integer not null,
  is_core boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint achievement_definitions_code_format_check check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint achievement_definitions_metric_check check (
    metric in (
      'starts', 'classified_finishes', 'wins', 'podiums',
      'poles', 'fastest_laps', 'leagues_competed'
    )
  ),
  constraint achievement_definitions_threshold_positive_check check (threshold > 0),
  constraint achievement_definitions_reward_nonnegative_check check (reward_vc >= 0),
  constraint achievement_definitions_rule_version_positive_check check (rule_version > 0),
  constraint achievement_definitions_sort_order_positive_check check (sort_order > 0),
  constraint achievement_definitions_title_key_format_check check (title_key ~ '^achievement\.[a-z0-9_.]+$'),
  constraint achievement_definitions_description_key_format_check check (description_key ~ '^achievement\.[a-z0-9_.]+$'),
  constraint achievement_definitions_metric_threshold_unique unique (metric, threshold),
  constraint achievement_definitions_sort_order_unique unique (sort_order)
);

insert into public.achievement_definitions (
  code, metric, threshold, title_key, description_key, reward_vc, rule_version, sort_order
) values
  ('starts_1', 'starts', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 1),
  ('starts_5', 'starts', 5, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 2),
  ('starts_10', 'starts', 10, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 3),
  ('starts_25', 'starts', 25, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 4),
  ('starts_50', 'starts', 50, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 5),
  ('starts_100', 'starts', 100, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 6),
  ('starts_200', 'starts', 200, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 7),
  ('starts_300', 'starts', 300, 'achievement.metric.title', 'achievement.metric.description', 750, 1, 8),
  ('starts_500', 'starts', 500, 'achievement.metric.title', 'achievement.metric.description', 900, 1, 9),
  ('starts_1000', 'starts', 1000, 'achievement.metric.title', 'achievement.metric.description', 1200, 1, 10),
  ('wins_1', 'wins', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 11),
  ('wins_3', 'wins', 3, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 12),
  ('wins_5', 'wins', 5, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 13),
  ('wins_10', 'wins', 10, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 14),
  ('wins_25', 'wins', 25, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 15),
  ('wins_50', 'wins', 50, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 16),
  ('wins_100', 'wins', 100, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 17),
  ('wins_200', 'wins', 200, 'achievement.metric.title', 'achievement.metric.description', 750, 1, 18),
  ('podiums_1', 'podiums', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 19),
  ('podiums_5', 'podiums', 5, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 20),
  ('podiums_10', 'podiums', 10, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 21),
  ('podiums_25', 'podiums', 25, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 22),
  ('podiums_50', 'podiums', 50, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 23),
  ('podiums_100', 'podiums', 100, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 24),
  ('podiums_200', 'podiums', 200, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 25),
  ('podiums_500', 'podiums', 500, 'achievement.metric.title', 'achievement.metric.description', 750, 1, 26),
  ('poles_1', 'poles', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 27),
  ('poles_5', 'poles', 5, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 28),
  ('poles_10', 'poles', 10, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 29),
  ('poles_25', 'poles', 25, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 30),
  ('poles_50', 'poles', 50, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 31),
  ('poles_100', 'poles', 100, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 32),
  ('poles_250', 'poles', 250, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 33),
  ('fastest_laps_1', 'fastest_laps', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 34),
  ('fastest_laps_5', 'fastest_laps', 5, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 35),
  ('fastest_laps_10', 'fastest_laps', 10, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 36),
  ('fastest_laps_25', 'fastest_laps', 25, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 37),
  ('fastest_laps_50', 'fastest_laps', 50, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 38),
  ('fastest_laps_100', 'fastest_laps', 100, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 39),
  ('fastest_laps_250', 'fastest_laps', 250, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 40),
  ('classified_finishes_1', 'classified_finishes', 1, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 41),
  ('classified_finishes_10', 'classified_finishes', 10, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 42),
  ('classified_finishes_25', 'classified_finishes', 25, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 43),
  ('classified_finishes_50', 'classified_finishes', 50, 'achievement.metric.title', 'achievement.metric.description', 150, 1, 44),
  ('classified_finishes_100', 'classified_finishes', 100, 'achievement.metric.title', 'achievement.metric.description', 250, 1, 45),
  ('classified_finishes_250', 'classified_finishes', 250, 'achievement.metric.title', 'achievement.metric.description', 400, 1, 46),
  ('classified_finishes_500', 'classified_finishes', 500, 'achievement.metric.title', 'achievement.metric.description', 600, 1, 47),
  ('leagues_competed_2', 'leagues_competed', 2, 'achievement.metric.title', 'achievement.metric.description', 50, 1, 48),
  ('leagues_competed_3', 'leagues_competed', 3, 'achievement.metric.title', 'achievement.metric.description', 75, 1, 49),
  ('leagues_competed_5', 'leagues_competed', 5, 'achievement.metric.title', 'achievement.metric.description', 100, 1, 50);

create table public.driver_achievement_events (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete restrict,
  achievement_code text not null references public.achievement_definitions(code) on delete restrict,
  event_type text not null,
  source_event_id uuid not null references public.domain_events(id) on delete restrict,
  source_result_version_id uuid references public.result_versions(id) on delete restrict,
  observed_value bigint not null,
  threshold_snapshot bigint not null,
  reward_vc_snapshot integer not null default 0,
  credit_eligible boolean not null default false,
  rule_version smallint not null,
  idempotency_key text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint driver_achievement_events_type_check check (event_type in ('unlocked', 'revoked')),
  constraint driver_achievement_events_observed_nonnegative_check check (observed_value >= 0),
  constraint driver_achievement_events_threshold_positive_check check (threshold_snapshot > 0),
  constraint driver_achievement_events_reward_nonnegative_check check (reward_vc_snapshot >= 0),
  constraint driver_achievement_events_rule_version_positive_check check (rule_version > 0),
  constraint driver_achievement_events_idempotency_key_unique unique (idempotency_key),
  constraint driver_achievement_events_source_unique
    unique (source_event_id, driver_identity_id, achievement_code, event_type)
);

create index idx_driver_achievement_events_identity_recorded
  on public.driver_achievement_events (driver_identity_id, recorded_at desc);
create index idx_driver_achievement_events_source_event
  on public.driver_achievement_events (source_event_id);
create index idx_driver_achievement_events_result_version
  on public.driver_achievement_events (source_result_version_id)
  where source_result_version_id is not null;

create table public.driver_achievements (
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  achievement_code text not null references public.achievement_definitions(code) on delete restrict,
  status text not null,
  current_value bigint not null default 0,
  first_unlocked_at timestamptz,
  unlocked_at timestamptz,
  revoked_at timestamptz,
  last_event_id uuid not null references public.driver_achievement_events(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (driver_identity_id, achievement_code),
  constraint driver_achievements_status_check check (status in ('unlocked', 'revoked')),
  constraint driver_achievements_current_value_nonnegative_check check (current_value >= 0),
  constraint driver_achievements_unlock_state_check check (
    (status = 'unlocked' and unlocked_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index idx_driver_achievements_identity_status
  on public.driver_achievements (driver_identity_id, status, updated_at desc);
create index idx_driver_achievements_last_event
  on public.driver_achievements (last_event_id);

create or replace function private.protect_achievement_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'Achievement definitions and events are immutable; corrections require a new event.';
end;
$$;

revoke all on function private.protect_achievement_history()
  from public, anon, authenticated, service_role;

create trigger achievement_definitions_protect_history
before update or delete on public.achievement_definitions
for each row execute function private.protect_achievement_history();

create trigger driver_achievement_events_protect_history
before update or delete on public.driver_achievement_events
for each row execute function private.protect_achievement_history();

create or replace function private.achievement_metric_value(
  p_driver_identity_id uuid,
  p_metric text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with current_facts as (
    select
      rr.race_id,
      rr.classification_status,
      rr.finish_position,
      rr.grid_position,
      rr.fastest_lap_time_ms,
      s.league_id,
      r.season_id,
      min(rr.fastest_lap_time_ms) filter (
        where rr.fastest_lap_time_ms is not null
          and upper(rr.participation_status) = 'PLAYER'
      ) over (partition by rr.race_id) as race_fastest_lap_ms
    from public.race_results rr
    join public.drivers d
      on d.id = rr.driver_id
     and d.is_active
    join public.driver_identity_links dil
      on dil.driver_id = d.id
     and dil.driver_identity_id = p_driver_identity_id
    join public.driver_identities di
      on di.id = dil.driver_identity_id
     and di.status = 'active'
    join public.races r on r.id = rr.race_id
    join public.seasons s on s.id = r.season_id
    where upper(rr.participation_status) = 'PLAYER'
  ),
  totals as (
    select
      count(*) filter (where classification_status <> 'dns')::bigint as starts,
      count(*) filter (where classification_status = 'classified')::bigint as classified_finishes,
      count(*) filter (where classification_status = 'classified' and finish_position = 1)::bigint as wins,
      count(*) filter (
        where classification_status = 'classified' and finish_position between 1 and 3
      )::bigint as podiums,
      count(*) filter (where grid_position = 1)::bigint as poles,
      count(*) filter (
        where fastest_lap_time_ms is not null
          and fastest_lap_time_ms = race_fastest_lap_ms
      )::bigint as fastest_laps,
      count(distinct league_id)::bigint as leagues_competed
    from current_facts
  )
  select case p_metric
    when 'starts' then starts
    when 'classified_finishes' then classified_finishes
    when 'wins' then wins
    when 'podiums' then podiums
    when 'poles' then poles
    when 'fastest_laps' then fastest_laps
    when 'leagues_competed' then leagues_competed
    else 0
  end
  from totals;
$$;

revoke all on function private.achievement_metric_value(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.process_achievement_event(
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
  target_race_id uuid;
  identity_id uuid;
  definition_record public.achievement_definitions%rowtype;
  projection_record public.driver_achievements%rowtype;
  target_event_id uuid;
  metric_value bigint;
  is_historical boolean;
  affected_identity_ids uuid[];
begin
  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = 'achievements'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Achievement processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this achievement lease.';
  end if;

  select * into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type not in ('result.published', 'result.revised', 'result.voided') then
    perform private.complete_domain_event_processing(
      p_processing_id, 'achievements', p_worker_id
    );
    return;
  end if;

  target_race_id := (event_record.payload ->> 'race_id')::uuid;
  if target_race_id is null then
    raise exception using errcode = '23514', message = 'Achievement processing requires immutable race evidence.';
  end if;

  perform 1 from public.races r where r.id = target_race_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Achievement source race not found.';
  end if;

  select array_agg(distinct candidate_id)
  into affected_identity_ids
  from (
    select dil.driver_identity_id as candidate_id
    from public.result_version_rows rvr
    join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
    where rvr.result_version_id = event_record.result_version_id
      and upper(rvr.participation_status) = 'PLAYER'
    union
    select dil.driver_identity_id
    from public.race_results rr
    join public.driver_identity_links dil on dil.driver_id = rr.driver_id
    where rr.race_id = target_race_id
      and upper(rr.participation_status) = 'PLAYER'
  ) candidates;

  is_historical := event_record.recorded_at < (
    select min(ad.created_at) from public.achievement_definitions ad
  );

  foreach identity_id in array coalesce(affected_identity_ids, '{}'::uuid[])
  loop
    if not exists (
      select 1
      from public.driver_identities di
      where di.id = identity_id
        and di.status = 'active'
        and di.user_id is not null
    ) then
      continue;
    end if;

    for definition_record in
      select *
      from public.achievement_definitions ad
      where ad.is_active
      order by ad.sort_order
    loop
      metric_value := private.achievement_metric_value(
        identity_id, definition_record.metric
      );

      select * into projection_record
      from public.driver_achievements da
      where da.driver_identity_id = identity_id
        and da.achievement_code = definition_record.code
      for update;

      if metric_value >= definition_record.threshold
         and (not found or projection_record.status = 'revoked') then
        insert into public.driver_achievement_events (
          driver_identity_id, achievement_code, event_type, source_event_id,
          source_result_version_id, observed_value, threshold_snapshot,
          reward_vc_snapshot, credit_eligible, rule_version, idempotency_key,
          occurred_at
        ) values (
          identity_id, definition_record.code, 'unlocked', event_record.id,
          event_record.result_version_id, metric_value, definition_record.threshold,
          definition_record.reward_vc, not is_historical, definition_record.rule_version,
          format(
            'achievement:%s:%s:%s:unlocked',
            event_record.id, identity_id, definition_record.code
          ),
          event_record.occurred_at
        )
        on conflict (source_event_id, driver_identity_id, achievement_code, event_type)
          do nothing
        returning id into target_event_id;

        if target_event_id is not null then
          insert into public.driver_achievements (
            driver_identity_id, achievement_code, status, current_value,
            first_unlocked_at, unlocked_at, revoked_at, last_event_id
          ) values (
            identity_id, definition_record.code, 'unlocked', metric_value,
            event_record.occurred_at, event_record.occurred_at, null, target_event_id
          )
          on conflict (driver_identity_id, achievement_code) do update
          set status = 'unlocked',
              current_value = excluded.current_value,
              first_unlocked_at = coalesce(
                public.driver_achievements.first_unlocked_at,
                excluded.first_unlocked_at
              ),
              unlocked_at = excluded.unlocked_at,
              revoked_at = null,
              last_event_id = excluded.last_event_id,
              updated_at = now();

          perform private.emit_domain_event(
            'achievement.unlocked',
            'driver_identity',
            identity_id,
            event_record.league_id,
            jsonb_build_object(
              'achievement_code', definition_record.code,
              'observed_value', metric_value,
              'threshold', definition_record.threshold
            ),
            format('achievement-event:%s', target_event_id),
            event_record.result_version_id,
            event_record.actor_user_id,
            event_record.occurred_at
          );
        end if;
      elsif metric_value < definition_record.threshold
            and found
            and projection_record.status = 'unlocked' then
        insert into public.driver_achievement_events (
          driver_identity_id, achievement_code, event_type, source_event_id,
          source_result_version_id, observed_value, threshold_snapshot,
          reward_vc_snapshot, credit_eligible, rule_version, idempotency_key,
          occurred_at
        ) values (
          identity_id, definition_record.code, 'revoked', event_record.id,
          event_record.result_version_id, metric_value, definition_record.threshold,
          definition_record.reward_vc, not is_historical, definition_record.rule_version,
          format(
            'achievement:%s:%s:%s:revoked',
            event_record.id, identity_id, definition_record.code
          ),
          event_record.occurred_at
        )
        on conflict (source_event_id, driver_identity_id, achievement_code, event_type)
          do nothing
        returning id into target_event_id;

        if target_event_id is not null then
          update public.driver_achievements
          set status = 'revoked',
              current_value = metric_value,
              revoked_at = event_record.occurred_at,
              last_event_id = target_event_id,
              updated_at = now()
          where driver_identity_id = identity_id
            and achievement_code = definition_record.code;

          perform private.emit_domain_event(
            'achievement.revoked',
            'driver_identity',
            identity_id,
            event_record.league_id,
            jsonb_build_object(
              'achievement_code', definition_record.code,
              'observed_value', metric_value,
              'threshold', definition_record.threshold
            ),
            format('achievement-event:%s', target_event_id),
            event_record.result_version_id,
            event_record.actor_user_id,
            event_record.occurred_at
          );
        end if;
      elsif found and projection_record.current_value <> metric_value then
        update public.driver_achievements
        set current_value = metric_value,
            updated_at = now()
        where driver_identity_id = identity_id
          and achievement_code = definition_record.code;
      end if;

      target_event_id := null;
      projection_record := null;
    end loop;
  end loop;

  perform private.complete_domain_event_processing(
    p_processing_id, 'achievements', p_worker_id
  );
end;
$$;

revoke all on function private.process_achievement_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_achievement_event(uuid, text)
  to service_role;

alter table public.achievement_definitions enable row level security;
alter table public.driver_achievement_events enable row level security;
alter table public.driver_achievements enable row level security;

revoke all on table public.achievement_definitions from public, anon, authenticated;
revoke all on table public.driver_achievement_events from public, anon, authenticated;
revoke all on table public.driver_achievements from public, anon, authenticated;

grant select on table public.achievement_definitions to authenticated;
grant select on table public.driver_achievement_events to authenticated;
grant select on table public.driver_achievements to authenticated;

grant select, insert on table public.achievement_definitions to service_role;
grant select, insert on table public.driver_achievement_events to service_role;
grant select, insert, update, delete on table public.driver_achievements to service_role;

create policy "registered users read active achievement definitions"
on public.achievement_definitions
for select
to authenticated
using (is_active);

create policy "users read own achievement history"
on public.driver_achievement_events
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

create policy "users read own achievement projection"
on public.driver_achievements
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

comment on table public.achievement_definitions is
  'Exactly 50 immutable Core Achievement rules using neutral translation keys.';
comment on table public.driver_achievement_events is
  'Append-only unlock and revoke evidence derived deterministically from official current results.';
comment on table public.driver_achievements is
  'Current achievement projection; history remains in driver_achievement_events.';
comment on function private.process_achievement_event(uuid, text) is
  'Independently reconciles affected global identities and emits deterministic unlock/revoke events.';
