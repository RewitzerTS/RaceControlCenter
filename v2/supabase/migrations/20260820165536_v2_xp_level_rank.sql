-- RaceVora V2 Phase 9: append-only XP ledger and deterministic Level / Rank projection.
-- This migration is additive to the isolated V2 staging model and must never run on V1 Production.

create or replace function private.xp_for_result_v1(
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
  select case lower(p_classification_status)
    when 'dns' then 0
    when 'dsq' then 0
    when 'dnf' then
      40
      + case when p_grid_position = 1 then 15 else 0 end
      + case when p_is_fastest_lap then 15 else 0 end
    when 'classified' then
      100
      + greatest(0, 21 - coalesce(p_finish_position, 21)) * 5
      + case when p_finish_position = 1 then 50 else 0 end
      + case when p_finish_position between 1 and 3 then 25 else 0 end
      + case when p_grid_position = 1 then 15 else 0 end
      + case when p_is_fastest_lap then 15 else 0 end
    else 0
  end;
$$;

revoke all on function private.xp_for_result_v1(text, integer, integer, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.level_from_lifetime_xp(p_lifetime_xp bigint)
returns smallint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select least(100::bigint, greatest(1::bigint, (p_lifetime_xp / 1000) + 1))::smallint;
$$;

revoke all on function private.level_from_lifetime_xp(bigint)
  from public, anon, authenticated, service_role;

create or replace function private.rank_from_level(p_level integer)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_level between 1 and 4 then 'Rookie'
    when p_level between 5 and 9 then 'Challenger'
    when p_level between 10 and 19 then 'Racer'
    when p_level between 20 and 29 then 'Contender'
    when p_level between 30 and 39 then 'Front Runner'
    when p_level between 40 and 49 then 'Elite'
    when p_level between 50 and 64 then 'Apex'
    when p_level between 65 and 79 then 'Master'
    when p_level between 80 and 94 then 'Legend'
    when p_level between 95 and 99 then 'Icon'
    when p_level = 100 then 'Immortal'
    else null
  end;
$$;

revoke all on function private.rank_from_level(integer)
  from public, anon, authenticated, service_role;

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete restrict,
  source_event_id uuid not null references public.domain_events(id) on delete restrict,
  processing_id uuid not null references private.domain_event_processing(id) on delete restrict,
  league_id uuid references public.leagues(id) on delete restrict,
  race_id uuid references public.races(id) on delete restrict,
  result_version_id uuid references public.result_versions(id) on delete restrict,
  entry_type text not null,
  reason_code text not null,
  amount integer not null,
  rule_version smallint not null default 1,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint xp_ledger_source_identity_unique unique (source_event_id, driver_identity_id),
  constraint xp_ledger_idempotency_key_unique unique (idempotency_key),
  constraint xp_ledger_entry_type_check check (
    entry_type in ('result_award', 'result_adjustment', 'historical_backfill', 'manual_adjustment')
  ),
  constraint xp_ledger_reason_code_format_check
    check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint xp_ledger_amount_nonzero_check check (amount <> 0),
  constraint xp_ledger_rule_version_positive_check check (rule_version > 0),
  constraint xp_ledger_idempotency_key_length_check
    check (char_length(idempotency_key) between 12 and 250),
  constraint xp_ledger_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint xp_ledger_result_scope_check check (
    (entry_type in ('result_award', 'result_adjustment')
      and league_id is not null and race_id is not null)
    or entry_type in ('historical_backfill', 'manual_adjustment')
  )
);

create index idx_xp_ledger_driver_identity_recorded_at
  on public.xp_ledger (driver_identity_id, recorded_at desc);
create index idx_xp_ledger_league_id
  on public.xp_ledger (league_id)
  where league_id is not null;
create index idx_xp_ledger_race_identity
  on public.xp_ledger (race_id, driver_identity_id)
  where race_id is not null;
create index idx_xp_ledger_result_version_id
  on public.xp_ledger (result_version_id)
  where result_version_id is not null;
create index idx_xp_ledger_processing_id
  on public.xp_ledger (processing_id);

create table public.driver_progression (
  driver_identity_id uuid primary key references public.driver_identities(id) on delete cascade,
  lifetime_xp bigint not null default 0,
  level smallint not null default 1,
  rank text not null default 'Rookie',
  xp_into_level integer not null default 0,
  xp_to_next_level integer not null default 1000,
  last_ledger_entry_id uuid references public.xp_ledger(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint driver_progression_lifetime_xp_nonnegative_check check (lifetime_xp >= 0),
  constraint driver_progression_level_check check (level between 1 and 100),
  constraint driver_progression_rank_check check (
    rank in (
      'Rookie', 'Challenger', 'Racer', 'Contender', 'Front Runner',
      'Elite', 'Apex', 'Master', 'Legend', 'Icon', 'Immortal'
    )
  ),
  constraint driver_progression_level_window_check check (
    xp_into_level between 0 and 999
    and xp_to_next_level between 0 and 1000
    and (
      (level = 100 and xp_into_level = 0 and xp_to_next_level = 0)
      or (level < 100 and xp_to_next_level > 0)
    )
  )
);

create index idx_driver_progression_last_ledger_entry_id
  on public.driver_progression (last_ledger_entry_id)
  where last_ledger_entry_id is not null;

create or replace function private.protect_xp_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'XP ledger entries are immutable; corrections require a new ledger entry.';
end;
$$;

revoke all on function private.protect_xp_ledger()
  from public, anon, authenticated, service_role;

create trigger xp_ledger_protect_history
before update or delete on public.xp_ledger
for each row execute function private.protect_xp_ledger();

create or replace function private.process_xp_event(
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
  negative_lifetime_identity_id uuid;
begin
  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
  for update;

  if not found or processing_record.processor <> 'xp' then
    raise exception using errcode = 'P0002', message = 'XP processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if p_worker_id is null
     or processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this XP processing lease.';
  end if;

  select * into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type not in ('result.published', 'result.revised', 'result.voided') then
    perform private.complete_domain_event_processing(p_processing_id, 'xp', p_worker_id);
    return;
  end if;

  if event_record.result_version_id is null
     or event_record.aggregate_type <> 'result_version'
     or event_record.aggregate_id <> event_record.result_version_id then
    raise exception using errcode = '23514', message = 'XP result event evidence is inconsistent.';
  end if;

  select r.id as race_id, r.current_result_version_id, s.league_id
    into race_record
  from public.result_versions rv
  join public.races r on r.id = rv.race_id
  join public.seasons s on s.id = r.season_id
  where rv.id = event_record.result_version_id
  for update of r;

  if not found or race_record.league_id <> event_record.league_id then
    raise exception using errcode = '23514', message = 'XP result event league is inconsistent.';
  end if;

  select array_agg(distinct xl.driver_identity_id)
    into old_identity_ids
  from public.xp_ledger xl
  where xl.race_id = race_record.race_id
    and xl.entry_type in ('result_award', 'result_adjustment');

  if race_record.current_result_version_id is not null then
    if exists (
      select 1
      from public.result_version_rows rvr
      join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
      join public.driver_identities di on di.id = dil.driver_identity_id
      join public.drivers d on d.id = rvr.driver_id
      where rvr.result_version_id = race_record.current_result_version_id
        and upper(rvr.participation_status) = 'PLAYER'
        and di.status = 'active'
        and d.is_active
      group by dil.driver_identity_id
      having count(*) > 1
    ) then
      raise exception using
        errcode = '23514',
        message = 'One global identity cannot receive multiple XP results in the same race.';
    end if;

    select array_agg(distinct dil.driver_identity_id)
      into new_identity_ids
    from public.result_version_rows rvr
    join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
    join public.driver_identities di on di.id = dil.driver_identity_id
    join public.drivers d on d.id = rvr.driver_id
    where rvr.result_version_id = race_record.current_result_version_id
      and upper(rvr.participation_status) = 'PLAYER'
      and di.status = 'active'
      and d.is_active;
  end if;

  select array_agg(distinct identity_id)
    into affected_identity_ids
  from unnest(
    coalesce(old_identity_ids, '{}'::uuid[]) || coalesce(new_identity_ids, '{}'::uuid[])
  ) as identities(identity_id);

  if coalesce(cardinality(affected_identity_ids), 0) = 0 then
    perform private.complete_domain_event_processing(p_processing_id, 'xp', p_worker_id);
    return;
  end if;

  perform di.id
  from public.driver_identities di
  where di.id = any(affected_identity_ids)
  order by di.id
  for update;

  with desired as (
    select
      dil.driver_identity_id,
      sum(
        private.xp_for_result_v1(
          rvr.classification_status,
          rvr.finish_position,
          rvr.grid_position,
          coalesce(nullif(rvr.fastest_lap_time_ms, 0), nullif(rvr.fastest_lap_ms, 0)) is not null
            and rvr.classification_status not in ('dns', 'dsq')
            and coalesce(nullif(rvr.fastest_lap_time_ms, 0), nullif(rvr.fastest_lap_ms, 0)) = (
              select min(coalesce(nullif(candidate.fastest_lap_time_ms, 0), nullif(candidate.fastest_lap_ms, 0)))
              from public.result_version_rows candidate
              join public.driver_identity_links candidate_link on candidate_link.driver_id = candidate.driver_id
              join public.driver_identities candidate_identity on candidate_identity.id = candidate_link.driver_identity_id
              join public.drivers candidate_driver on candidate_driver.id = candidate.driver_id
              where candidate.result_version_id = race_record.current_result_version_id
                and upper(candidate.participation_status) = 'PLAYER'
                and candidate.classification_status not in ('dns', 'dsq')
                and candidate_identity.status = 'active'
                and candidate_driver.is_active
            )
        )
      )::bigint as desired_xp
    from public.result_version_rows rvr
    join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
    join public.driver_identities di on di.id = dil.driver_identity_id
    join public.drivers d on d.id = rvr.driver_id
    where rvr.result_version_id = race_record.current_result_version_id
      and upper(rvr.participation_status) = 'PLAYER'
      and di.status = 'active'
      and d.is_active
    group by dil.driver_identity_id
  ),
  current_result_xp as (
    select xl.driver_identity_id, sum(xl.amount)::bigint as current_xp
    from public.xp_ledger xl
    where xl.race_id = race_record.race_id
      and xl.entry_type in ('result_award', 'result_adjustment')
    group by xl.driver_identity_id
  ),
  target as (
    select
      identity_id as driver_identity_id,
      coalesce(desired.desired_xp, 0)::bigint as desired_xp,
      coalesce(current_result_xp.current_xp, 0)::bigint as current_xp
    from unnest(affected_identity_ids) as identities(identity_id)
    left join desired on desired.driver_identity_id = identity_id
    left join current_result_xp on current_result_xp.driver_identity_id = identity_id
  )
  insert into public.xp_ledger (
    driver_identity_id, source_event_id, processing_id, league_id, race_id,
    result_version_id, entry_type, reason_code, amount, rule_version,
    idempotency_key, metadata, occurred_at
  )
  select
    target.driver_identity_id,
    event_record.id,
    p_processing_id,
    race_record.league_id,
    race_record.race_id,
    race_record.current_result_version_id,
    case
      when target.current_xp = 0 and target.desired_xp > 0 then 'result_award'
      else 'result_adjustment'
    end,
    'official_race_result',
    (target.desired_xp - target.current_xp)::integer,
    1,
    format('xp-event:%s:identity:%s', event_record.id, target.driver_identity_id),
    jsonb_build_object(
      'event_type', event_record.event_type,
      'previous_race_xp', target.current_xp,
      'desired_race_xp', target.desired_xp,
      'authoritative_result_version_id', race_record.current_result_version_id,
      'rule', 'race_result_v1'
    ),
    event_record.occurred_at
  from target
  where target.desired_xp <> target.current_xp;

  select totals.driver_identity_id
    into negative_lifetime_identity_id
  from (
    select identity_id as driver_identity_id, coalesce(sum(xl.amount), 0) as lifetime_xp
    from unnest(affected_identity_ids) as identities(identity_id)
    left join public.xp_ledger xl on xl.driver_identity_id = identity_id
    group by identity_id
  ) totals
  where totals.lifetime_xp < 0
  limit 1;

  if negative_lifetime_identity_id is not null then
    raise exception using
      errcode = '23514',
      message = 'XP reconciliation would create a negative lifetime balance.';
  end if;

  with totals as (
    select
      identity_id as driver_identity_id,
      coalesce(sum(xl.amount), 0)::bigint as lifetime_xp,
      (
        array_agg(xl.id order by xl.recorded_at desc, xl.id desc)
        filter (where xl.id is not null)
      )[1] as last_ledger_entry_id
    from unnest(affected_identity_ids) as identities(identity_id)
    left join public.xp_ledger xl on xl.driver_identity_id = identity_id
    group by identity_id
  ),
  resolved as (
    select
      totals.*,
      private.level_from_lifetime_xp(totals.lifetime_xp) as resolved_level
    from totals
  )
  insert into public.driver_progression (
    driver_identity_id, lifetime_xp, level, rank,
    xp_into_level, xp_to_next_level, last_ledger_entry_id, updated_at
  )
  select
    resolved.driver_identity_id,
    resolved.lifetime_xp,
    resolved.resolved_level,
    private.rank_from_level(resolved.resolved_level),
    case when resolved.resolved_level = 100 then 0 else (resolved.lifetime_xp % 1000)::integer end,
    case
      when resolved.resolved_level = 100 then 0
      else 1000 - (resolved.lifetime_xp % 1000)::integer
    end,
    resolved.last_ledger_entry_id,
    now()
  from resolved
  on conflict (driver_identity_id) do update
  set lifetime_xp = excluded.lifetime_xp,
      level = excluded.level,
      rank = excluded.rank,
      xp_into_level = excluded.xp_into_level,
      xp_to_next_level = excluded.xp_to_next_level,
      last_ledger_entry_id = excluded.last_ledger_entry_id,
      updated_at = excluded.updated_at;

  perform private.complete_domain_event_processing(p_processing_id, 'xp', p_worker_id);
end;
$$;

revoke all on function private.process_xp_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_xp_event(uuid, text)
  to service_role;

alter table public.xp_ledger enable row level security;
alter table public.driver_progression enable row level security;

revoke all on table public.xp_ledger from public, anon, authenticated;
revoke all on table public.driver_progression from public, anon, authenticated;

grant select on table public.xp_ledger to authenticated;
grant select on table public.driver_progression to authenticated;
grant select, insert on table public.xp_ledger to service_role;
grant select, insert, update, delete on table public.driver_progression to service_role;

create policy "v2 permitted users read XP ledger"
on public.xp_ledger
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
  or (
    league_id is not null
    and (select private.has_league_capability(league_id, 'steward'))
  )
);

create policy "v2 users read own global progression"
on public.driver_progression
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

comment on function private.xp_for_result_v1(text, integer, integer, boolean) is
  'XP rule v1: DNS/DSQ 0; DNF 40; classified base 100 plus position and sporting bonuses.';
comment on table public.xp_ledger is
  'Append-only source of truth for global Driver XP. Corrections are new signed entries, never edits.';
comment on table public.driver_progression is
  'Rebuildable Lifetime XP, Level 1-100, and Rank projection derived from the XP ledger.';
comment on function private.process_xp_event(uuid, text) is
  'Idempotently reconciles race XP to the explicit current result pointer and appends signed adjustments.';
