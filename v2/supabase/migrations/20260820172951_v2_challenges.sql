-- RaceVora V2 Phase 12: racing-only Challenges with deterministic correction and reward limits.
-- Additive staging migration. Never execute against V1 Production.

create table public.challenge_definitions (
  code text primary key,
  metric text not null,
  target_value integer not null,
  title_key text not null,
  description_key text not null,
  reward_vc integer not null default 0,
  rule_version smallint not null default 1,
  active_from timestamptz not null,
  active_until timestamptz,
  is_active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenge_definitions_code_format_check check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint challenge_definitions_metric_check check (
    metric in ('starts', 'classified_finishes', 'wins', 'podiums', 'poles', 'fastest_laps')
  ),
  constraint challenge_definitions_target_positive_check check (target_value > 0),
  constraint challenge_definitions_reward_nonnegative_check check (reward_vc >= 0),
  constraint challenge_definitions_rule_version_positive_check check (rule_version > 0),
  constraint challenge_definitions_window_check check (
    active_until is null or active_until > active_from
  ),
  constraint challenge_definitions_sort_order_positive_check check (sort_order > 0),
  constraint challenge_definitions_sort_order_unique unique (sort_order),
  constraint challenge_definitions_title_key_format_check check (title_key ~ '^challenge\.[a-z0-9_.]+$'),
  constraint challenge_definitions_description_key_format_check check (description_key ~ '^challenge\.[a-z0-9_.]+$')
);

create or replace function private.enforce_active_challenge_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit', 0));

  if new.is_active
     and new.active_from <= now()
     and (new.active_until is null or new.active_until > now()) then
    select count(*) into active_count
    from public.challenge_definitions cd
    where cd.code <> new.code
      and cd.is_active
      and cd.active_from <= now()
      and (cd.active_until is null or cd.active_until > now());

    if active_count >= 3 then
      raise exception using
        errcode = '23514',
        message = 'At most three Challenges may be active at the same time.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_active_challenge_limit()
  from public, anon, authenticated, service_role;

create trigger challenge_definitions_limit_active
before insert or update of is_active, active_from, active_until
on public.challenge_definitions
for each row execute function private.enforce_active_challenge_limit();

create trigger challenge_definitions_set_updated_at
before update on public.challenge_definitions
for each row execute function private.set_updated_at();

insert into public.challenge_definitions (
  code, metric, target_value, title_key, description_key, reward_vc,
  rule_version, active_from, sort_order
) values
  ('classified_launch', 'classified_finishes', 1, 'challenge.metric.title', 'challenge.metric.description', 100, 1, now(), 1),
  ('race_starts_three', 'starts', 3, 'challenge.metric.title', 'challenge.metric.description', 150, 1, now(), 2),
  ('podium_finish', 'podiums', 1, 'challenge.metric.title', 'challenge.metric.description', 250, 1, now(), 3);

create table public.challenge_races (
  challenge_code text not null references public.challenge_definitions(code) on delete restrict,
  race_id uuid not null references public.races(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete restrict,
  entered_by_event_id uuid not null references public.domain_events(id) on delete restrict,
  entered_at timestamptz not null,
  primary key (challenge_code, race_id)
);

create index idx_challenge_races_race
  on public.challenge_races (race_id);
create index idx_challenge_races_league
  on public.challenge_races (league_id, entered_at desc);

create table public.challenge_result_facts (
  challenge_code text not null references public.challenge_definitions(code) on delete restrict,
  race_id uuid not null references public.races(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete restrict,
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  source_result_version_id uuid not null references public.result_versions(id) on delete restrict,
  contribution integer not null,
  reconciled_by_event_id uuid not null references public.domain_events(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (challenge_code, race_id, driver_identity_id),
  constraint challenge_result_facts_contribution_positive_check check (contribution > 0)
);

create index idx_challenge_result_facts_identity_challenge
  on public.challenge_result_facts (driver_identity_id, challenge_code);
create index idx_challenge_result_facts_league
  on public.challenge_result_facts (league_id);

create table public.driver_challenge_events (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete restrict,
  challenge_code text not null references public.challenge_definitions(code) on delete restrict,
  event_type text not null,
  source_event_id uuid not null references public.domain_events(id) on delete restrict,
  source_result_version_id uuid references public.result_versions(id) on delete restrict,
  progress_snapshot integer not null,
  target_snapshot integer not null,
  reward_vc_snapshot integer not null default 0,
  reward_eligible boolean not null default false,
  rule_version smallint not null,
  idempotency_key text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint driver_challenge_events_type_check check (event_type in ('completed', 'revoked')),
  constraint driver_challenge_events_progress_nonnegative_check check (progress_snapshot >= 0),
  constraint driver_challenge_events_target_positive_check check (target_snapshot > 0),
  constraint driver_challenge_events_reward_nonnegative_check check (reward_vc_snapshot >= 0),
  constraint driver_challenge_events_rule_version_positive_check check (rule_version > 0),
  constraint driver_challenge_events_idempotency_unique unique (idempotency_key),
  constraint driver_challenge_events_source_unique
    unique (source_event_id, driver_identity_id, challenge_code, event_type)
);

create index idx_driver_challenge_events_identity_recorded
  on public.driver_challenge_events (driver_identity_id, recorded_at desc);
create index idx_driver_challenge_events_source
  on public.driver_challenge_events (source_event_id);

create table public.driver_challenges (
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  challenge_code text not null references public.challenge_definitions(code) on delete restrict,
  status text not null default 'active',
  progress integer not null default 0,
  completed_at timestamptz,
  reward_eligible boolean not null default false,
  last_event_id uuid references public.driver_challenge_events(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (driver_identity_id, challenge_code),
  constraint driver_challenges_status_check check (status in ('active', 'completed')),
  constraint driver_challenges_progress_nonnegative_check check (progress >= 0),
  constraint driver_challenges_completed_state_check check (
    (status = 'active' and completed_at is null and reward_eligible = false)
    or (status = 'completed' and completed_at is not null)
  )
);

create index idx_driver_challenges_identity_status
  on public.driver_challenges (driver_identity_id, status, completed_at desc);
create index idx_driver_challenges_last_event
  on public.driver_challenges (last_event_id)
  where last_event_id is not null;

create trigger challenge_result_facts_set_updated_at
before update on public.challenge_result_facts
for each row execute function private.set_updated_at();

create or replace function private.protect_challenge_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'Challenge eligibility and completion history are immutable.';
end;
$$;

revoke all on function private.protect_challenge_history()
  from public, anon, authenticated, service_role;

create trigger challenge_races_protect_history
before update or delete on public.challenge_races
for each row execute function private.protect_challenge_history();

create trigger driver_challenge_events_protect_history
before update or delete on public.driver_challenge_events
for each row execute function private.protect_challenge_history();

create or replace function private.credit_challenge_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  outstanding_reward bigint;
  credit_delta integer;
begin
  if not new.reward_eligible or new.reward_vc_snapshot <= 0 then
    return new;
  end if;

  select coalesce(sum(cl.amount), 0)
  into outstanding_reward
  from public.credit_ledger cl
  where cl.driver_identity_id = new.driver_identity_id
    and cl.source_scope = format('challenge:%s', new.challenge_code)
    and cl.entry_type in ('challenge_reward', 'challenge_reversal');

  if new.event_type = 'completed' and outstanding_reward <= 0 then
    credit_delta := new.reward_vc_snapshot;
  elsif new.event_type = 'revoked' and outstanding_reward > 0 then
    credit_delta := -least(outstanding_reward, new.reward_vc_snapshot)::integer;
  else
    return new;
  end if;

  insert into public.credit_ledger (
    driver_identity_id, source_event_id, entry_type, reason_code, amount,
    source_scope, idempotency_key, metadata, occurred_at
  ) values (
    new.driver_identity_id, new.source_event_id,
    case when credit_delta > 0 then 'challenge_reward' else 'challenge_reversal' end,
    case when credit_delta > 0 then 'challenge_completed' else 'challenge_revoked' end,
    credit_delta,
    format('challenge:%s', new.challenge_code),
    format('credit:challenge-event:%s', new.id),
    jsonb_build_object(
      'challenge_code', new.challenge_code,
      'challenge_event_id', new.id,
      'rule_version', new.rule_version
    ),
    new.occurred_at
  )
  on conflict (idempotency_key) do nothing;

  perform private.rebuild_driver_wallet(new.driver_identity_id);
  return new;
end;
$$;

revoke all on function private.credit_challenge_event()
  from public, anon, authenticated, service_role;

create trigger driver_challenge_events_credit_reward
after insert on public.driver_challenge_events
for each row execute function private.credit_challenge_event();

create or replace function private.challenge_contribution(
  p_metric text,
  p_classification_status text,
  p_finish_position integer,
  p_grid_position integer,
  p_is_fastest_lap boolean
)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_metric
    when 'starts' then case when p_classification_status <> 'dns' then 1 else 0 end
    when 'classified_finishes' then case when p_classification_status = 'classified' then 1 else 0 end
    when 'wins' then case when p_classification_status = 'classified' and p_finish_position = 1 then 1 else 0 end
    when 'podiums' then case when p_classification_status = 'classified' and p_finish_position between 1 and 3 then 1 else 0 end
    when 'poles' then case when p_grid_position = 1 then 1 else 0 end
    when 'fastest_laps' then case when p_is_fastest_lap then 1 else 0 end
    else 0
  end;
$$;

revoke all on function private.challenge_contribution(text, text, integer, integer, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.process_challenge_event(
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
  affected_identity_ids uuid[];
  challenge_record public.challenge_definitions%rowtype;
  projection_record public.driver_challenges%rowtype;
  contribution_value integer;
  progress_value integer;
  target_event_id uuid;
  reward_allowed boolean;
  result_record record;
begin
  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = 'challenges'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Challenge processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this Challenge lease.';
  end if;

  select * into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type not in ('result.published', 'result.revised', 'result.voided') then
    perform private.complete_domain_event_processing(
      p_processing_id, 'challenges', p_worker_id
    );
    return;
  end if;

  target_race_id := (event_record.payload ->> 'race_id')::uuid;
  if target_race_id is null then
    raise exception using errcode = '23514', message = 'Challenge processing requires immutable race evidence.';
  end if;

  perform 1 from public.races r where r.id = target_race_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Challenge source race not found.';
  end if;

  if event_record.event_type = 'result.published' then
    insert into public.challenge_races (
      challenge_code, race_id, league_id, entered_by_event_id, entered_at
    )
    select
      cd.code, target_race_id, event_record.league_id,
      event_record.id, event_record.occurred_at
    from public.challenge_definitions cd
    where cd.is_active
      and cd.active_from <= event_record.occurred_at
      and (cd.active_until is null or cd.active_until > event_record.occurred_at)
      and event_record.recorded_at >= cd.created_at
    on conflict (challenge_code, race_id) do nothing;
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

  for challenge_record in
    select cd.*
    from public.challenge_races cr
    join public.challenge_definitions cd on cd.code = cr.challenge_code
    where cr.race_id = target_race_id
    order by cd.sort_order
  loop
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

      delete from public.challenge_result_facts crf
      where crf.challenge_code = challenge_record.code
        and crf.race_id = target_race_id
        and crf.driver_identity_id = identity_id;

      select
        rr.classification_status,
        rr.finish_position,
        rr.grid_position,
        (
          rr.fastest_lap_time_ms is not null
          and rr.fastest_lap_time_ms = (
            select min(rr2.fastest_lap_time_ms)
            from public.race_results rr2
            where rr2.race_id = rr.race_id
              and upper(rr2.participation_status) = 'PLAYER'
              and rr2.fastest_lap_time_ms is not null
          )
        ) as is_fastest_lap,
        rr.result_version_id
      into result_record
      from public.race_results rr
      join public.driver_identity_links dil
        on dil.driver_id = rr.driver_id
       and dil.driver_identity_id = identity_id
      join public.drivers d
        on d.id = rr.driver_id
       and d.is_active
      where rr.race_id = target_race_id
        and upper(rr.participation_status) = 'PLAYER'
      limit 1;

      contribution_value := 0;
      if found then
        contribution_value := private.challenge_contribution(
          challenge_record.metric,
          result_record.classification_status,
          result_record.finish_position,
          result_record.grid_position,
          result_record.is_fastest_lap
        );
      end if;

      if contribution_value > 0 then
        insert into public.challenge_result_facts (
          challenge_code, race_id, league_id, driver_identity_id,
          source_result_version_id, contribution, reconciled_by_event_id
        ) values (
          challenge_record.code, target_race_id, event_record.league_id,
          identity_id, result_record.result_version_id,
          contribution_value, event_record.id
        );
      end if;

      select coalesce(sum(crf.contribution), 0)::integer
      into progress_value
      from public.challenge_result_facts crf
      where crf.challenge_code = challenge_record.code
        and crf.driver_identity_id = identity_id;

      select * into projection_record
      from public.driver_challenges dc
      where dc.driver_identity_id = identity_id
        and dc.challenge_code = challenge_record.code
      for update;

      if not found and progress_value > 0 then
        insert into public.driver_challenges (
          driver_identity_id, challenge_code, status, progress
        ) values (
          identity_id, challenge_record.code, 'active', progress_value
        );

        select * into projection_record
        from public.driver_challenges dc
        where dc.driver_identity_id = identity_id
          and dc.challenge_code = challenge_record.code
        for update;
      end if;

      if progress_value >= challenge_record.target_value
         and (not found or projection_record.status <> 'completed') then
        select count(*) < 3
        into reward_allowed
        from public.driver_challenges dc
        where dc.driver_identity_id = identity_id
          and dc.status = 'completed'
          and dc.reward_eligible
          and dc.completed_at >= event_record.occurred_at - interval '7 days'
          and dc.completed_at <= event_record.occurred_at;

        insert into public.driver_challenge_events (
          driver_identity_id, challenge_code, event_type, source_event_id,
          source_result_version_id, progress_snapshot, target_snapshot,
          reward_vc_snapshot, reward_eligible, rule_version, idempotency_key,
          occurred_at
        ) values (
          identity_id, challenge_record.code, 'completed', event_record.id,
          event_record.result_version_id, progress_value,
          challenge_record.target_value, challenge_record.reward_vc,
          reward_allowed, challenge_record.rule_version,
          format(
            'challenge:%s:%s:%s:completed',
            event_record.id, identity_id, challenge_record.code
          ),
          event_record.occurred_at
        )
        on conflict (source_event_id, driver_identity_id, challenge_code, event_type)
          do nothing
        returning id into target_event_id;

        if target_event_id is not null then
          insert into public.driver_challenges (
            driver_identity_id, challenge_code, status, progress,
            completed_at, reward_eligible, last_event_id
          ) values (
            identity_id, challenge_record.code, 'completed', progress_value,
            event_record.occurred_at, reward_allowed, target_event_id
          )
          on conflict (driver_identity_id, challenge_code) do update
          set status = 'completed',
              progress = excluded.progress,
              completed_at = excluded.completed_at,
              reward_eligible = excluded.reward_eligible,
              last_event_id = excluded.last_event_id,
              updated_at = now();

          perform private.emit_domain_event(
            'challenge.completed',
            'driver_identity',
            identity_id,
            event_record.league_id,
            jsonb_build_object(
              'challenge_code', challenge_record.code,
              'progress', progress_value,
              'target', challenge_record.target_value,
              'reward_eligible', reward_allowed
            ),
            format('challenge-event:%s', target_event_id),
            event_record.result_version_id,
            event_record.actor_user_id,
            event_record.occurred_at
          );
        end if;
      elsif found
            and projection_record.status = 'completed'
            and progress_value < challenge_record.target_value then
        insert into public.driver_challenge_events (
          driver_identity_id, challenge_code, event_type, source_event_id,
          source_result_version_id, progress_snapshot, target_snapshot,
          reward_vc_snapshot, reward_eligible, rule_version, idempotency_key,
          occurred_at
        ) values (
          identity_id, challenge_record.code, 'revoked', event_record.id,
          event_record.result_version_id, progress_value,
          challenge_record.target_value, challenge_record.reward_vc,
          projection_record.reward_eligible, challenge_record.rule_version,
          format(
            'challenge:%s:%s:%s:revoked',
            event_record.id, identity_id, challenge_record.code
          ),
          event_record.occurred_at
        )
        on conflict (source_event_id, driver_identity_id, challenge_code, event_type)
          do nothing
        returning id into target_event_id;

        if target_event_id is not null then
          update public.driver_challenges
          set status = 'active',
              progress = progress_value,
              completed_at = null,
              reward_eligible = false,
              last_event_id = target_event_id,
              updated_at = now()
          where driver_identity_id = identity_id
            and challenge_code = challenge_record.code;

          perform private.emit_domain_event(
            'challenge.revoked',
            'driver_identity',
            identity_id,
            event_record.league_id,
            jsonb_build_object(
              'challenge_code', challenge_record.code,
              'progress', progress_value,
              'target', challenge_record.target_value
            ),
            format('challenge-event:%s', target_event_id),
            event_record.result_version_id,
            event_record.actor_user_id,
            event_record.occurred_at
          );
        end if;
      elsif found and projection_record.progress <> progress_value then
        update public.driver_challenges
        set progress = progress_value,
            updated_at = now()
        where driver_identity_id = identity_id
          and challenge_code = challenge_record.code;
      end if;

      target_event_id := null;
      projection_record := null;
      result_record := null;
    end loop;
  end loop;

  perform private.complete_domain_event_processing(
    p_processing_id, 'challenges', p_worker_id
  );
end;
$$;

revoke all on function private.process_challenge_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_challenge_event(uuid, text)
  to service_role;

alter table public.challenge_definitions enable row level security;
alter table public.challenge_races enable row level security;
alter table public.challenge_result_facts enable row level security;
alter table public.driver_challenge_events enable row level security;
alter table public.driver_challenges enable row level security;

revoke all on table public.challenge_definitions from public, anon, authenticated;
revoke all on table public.challenge_races from public, anon, authenticated;
revoke all on table public.challenge_result_facts from public, anon, authenticated;
revoke all on table public.driver_challenge_events from public, anon, authenticated;
revoke all on table public.driver_challenges from public, anon, authenticated;

grant select on table public.challenge_definitions to authenticated;
grant select on table public.challenge_result_facts to authenticated;
grant select on table public.driver_challenge_events to authenticated;
grant select on table public.driver_challenges to authenticated;

grant select, insert, update on table public.challenge_definitions to service_role;
grant select, insert on table public.challenge_races to service_role;
grant select, insert, update, delete on table public.challenge_result_facts to service_role;
grant select, insert on table public.driver_challenge_events to service_role;
grant select, insert, update, delete on table public.driver_challenges to service_role;

create policy "registered users read active Challenge definitions"
on public.challenge_definitions
for select
to authenticated
using (
  is_active
  and active_from <= now()
  and (active_until is null or active_until > now())
);

create policy "users read own Challenge result facts"
on public.challenge_result_facts
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "users read own Challenge history"
on public.driver_challenge_events
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "users read own Challenge projection"
on public.driver_challenges
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

comment on table public.challenge_definitions is
  'Racing-only Challenge catalog; write-time guard permits at most three simultaneously active definitions.';
comment on table public.challenge_races is
  'Immutable future-only eligibility evidence; historical results never enter Challenge evaluation.';
comment on table public.driver_challenge_events is
  'Append-only completion and revoke evidence with a rolling seven-day three-reward baseline.';
comment on function private.process_challenge_event(uuid, text) is
  'Independently reconciles eligible races, corrects revisions/voids, and never penalizes non-completion.';
