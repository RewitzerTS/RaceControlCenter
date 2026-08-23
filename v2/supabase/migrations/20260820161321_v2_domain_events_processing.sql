-- RaceVora V2 Phase 7: immutable domain-event outbox and independent processors.
-- This migration is additive to the isolated V2 staging model and must never run on V1 Production.

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  league_id uuid not null references public.leagues(id) on delete restrict,
  result_version_id uuid references public.result_versions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  constraint domain_events_idempotency_key_unique unique (idempotency_key),
  constraint domain_events_event_type_format_check
    check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint domain_events_aggregate_type_format_check
    check (aggregate_type ~ '^[a-z][a-z0-9_]*$'),
  constraint domain_events_idempotency_key_length_check
    check (char_length(idempotency_key) between 8 and 250),
  constraint domain_events_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index idx_domain_events_league_occurred_at
  on public.domain_events (league_id, occurred_at desc);
create index idx_domain_events_result_version_id
  on public.domain_events (result_version_id)
  where result_version_id is not null;
create index idx_domain_events_actor_user_id
  on public.domain_events (actor_user_id)
  where actor_user_id is not null;
create index idx_domain_events_aggregate
  on public.domain_events (aggregate_type, aggregate_id, occurred_at);

create table private.domain_event_processing (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.domain_events(id) on delete restrict,
  processor text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_event_processing_event_processor_unique unique (event_id, processor),
  constraint domain_event_processing_processor_check check (
    processor in ('career', 'xp', 'achievements', 'challenges', 'notifications', 'graphics', 'vora')
  ),
  constraint domain_event_processing_status_check check (
    status in ('pending', 'processing', 'failed', 'succeeded', 'dead_letter')
  ),
  constraint domain_event_processing_attempts_check check (attempts between 0 and 10),
  constraint domain_event_processing_lock_check check (
    (status = 'processing' and locked_by is not null and locked_at is not null)
    or (status <> 'processing' and locked_by is null and locked_at is null)
  ),
  constraint domain_event_processing_success_check check (
    (status = 'succeeded' and processed_at is not null)
    or (status <> 'succeeded' and processed_at is null)
  ),
  constraint domain_event_processing_failure_check check (
    (status in ('failed', 'dead_letter') and last_error is not null)
    or (status not in ('failed', 'dead_letter') and last_error is null)
  )
);

create index idx_domain_event_processing_claim
  on private.domain_event_processing (processor, next_attempt_at, created_at)
  where status in ('pending', 'failed', 'processing');

create trigger domain_event_processing_set_updated_at
before update on private.domain_event_processing
for each row execute function private.set_updated_at();

create or replace function private.protect_domain_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'Recorded domain events are immutable and cannot be deleted.';
end;
$$;

revoke all on function private.protect_domain_event()
  from public, anon, authenticated, service_role;

create trigger domain_events_protect_history
before update or delete on public.domain_events
for each row execute function private.protect_domain_event();

create or replace function private.emit_domain_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_league_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_result_version_id uuid default null,
  p_actor_user_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  existing_event public.domain_events%rowtype;
begin
  insert into public.domain_events (
    event_type, aggregate_type, aggregate_id, league_id, result_version_id,
    actor_user_id, payload, idempotency_key, occurred_at
  ) values (
    p_event_type, p_aggregate_type, p_aggregate_id, p_league_id,
    p_result_version_id, p_actor_user_id, coalesce(p_payload, '{}'::jsonb),
    p_idempotency_key, p_occurred_at
  )
  on conflict (idempotency_key) do nothing
  returning id into target_event_id;

  if target_event_id is null then
    select * into existing_event
    from public.domain_events de
    where de.idempotency_key = p_idempotency_key;

    if existing_event.event_type <> p_event_type
       or existing_event.aggregate_type <> p_aggregate_type
       or existing_event.aggregate_id <> p_aggregate_id
       or existing_event.league_id <> p_league_id
       or existing_event.result_version_id is distinct from p_result_version_id
       or existing_event.actor_user_id is distinct from p_actor_user_id
       or existing_event.payload <> coalesce(p_payload, '{}'::jsonb) then
      raise exception using
        errcode = '23505',
        message = 'Domain event idempotency key was reused for different evidence.';
    end if;

    target_event_id := existing_event.id;
  end if;

  insert into private.domain_event_processing (event_id, processor)
  select target_event_id, processor_name
  from unnest(array[
    'career', 'xp', 'achievements', 'challenges',
    'notifications', 'graphics', 'vora'
  ]) as processors(processor_name)
  on conflict (event_id, processor) do nothing;

  return target_event_id;
end;
$$;

revoke all on function private.emit_domain_event(text, text, uuid, uuid, jsonb, text, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.emit_domain_event(text, text, uuid, uuid, jsonb, text, uuid, uuid, timestamptz)
  to service_role;

create or replace function private.emit_result_domain_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_league_id uuid;
  target_event_type text;
  target_actor_id uuid;
begin
  if old.status = 'validated' and new.status = 'active' then
    target_event_type := case
      when new.previous_version_id is null then 'result.published'
      else 'result.revised'
    end;
    target_actor_id := new.activated_by;
  elsif old.status = 'active' and new.status = 'void' then
    target_event_type := 'result.voided';
    target_actor_id := new.voided_by;
  else
    return new;
  end if;

  select s.league_id into target_league_id
  from public.races r
  join public.seasons s on s.id = r.season_id
  where r.id = new.race_id;

  if target_league_id is null then
    raise exception using
      errcode = '23514',
      message = 'A result domain event requires an existing race league.';
  end if;

  perform private.emit_domain_event(
    target_event_type,
    'result_version',
    new.id,
    target_league_id,
    jsonb_build_object(
      'race_id', new.race_id,
      'result_version_id', new.id,
      'previous_version_id', new.previous_version_id,
      'version_number', new.version_number
    ),
    format('result-version:%s:%s', new.id, target_event_type),
    new.id,
    target_actor_id,
    coalesce(new.voided_at, new.activated_at, now())
  );

  return new;
end;
$$;

revoke all on function private.emit_result_domain_event()
  from public, anon, authenticated, service_role;

create trigger result_versions_emit_domain_event
after update of status on public.result_versions
for each row execute function private.emit_result_domain_event();

create or replace function private.claim_domain_event(
  p_processor text,
  p_worker_id text
)
returns table (
  processing_id uuid,
  event_id uuid,
  event_type text,
  league_id uuid,
  aggregate_id uuid,
  payload jsonb,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_processing_id uuid;
begin
  if p_processor not in ('career', 'xp', 'achievements', 'challenges', 'notifications', 'graphics', 'vora') then
    raise exception using errcode = '22023', message = 'Unknown domain event processor.';
  end if;
  if p_worker_id is null or char_length(btrim(p_worker_id)) not between 3 and 100 then
    raise exception using errcode = '22023', message = 'A worker identifier between 3 and 100 characters is required.';
  end if;

  select dep.id into target_processing_id
  from private.domain_event_processing dep
  join public.domain_events de on de.id = dep.event_id
  where dep.processor = p_processor
    and dep.attempts < 10
    and (
      (dep.status in ('pending', 'failed') and dep.next_attempt_at <= now())
      or (dep.status = 'processing' and dep.locked_at < now() - interval '5 minutes')
    )
  order by de.occurred_at, dep.created_at
  for update of dep skip locked
  limit 1;

  if target_processing_id is null then
    return;
  end if;

  update private.domain_event_processing dep
  set status = 'processing',
      attempts = dep.attempts + 1,
      locked_by = btrim(p_worker_id),
      locked_at = now(),
      last_error = null,
      next_attempt_at = now()
  where dep.id = target_processing_id;

  return query
  select dep.id, de.id, de.event_type, de.league_id, de.aggregate_id,
         de.payload, dep.attempts
  from private.domain_event_processing dep
  join public.domain_events de on de.id = dep.event_id
  where dep.id = target_processing_id;
end;
$$;

revoke all on function private.claim_domain_event(text, text)
  from public, anon, authenticated;
grant execute on function private.claim_domain_event(text, text)
  to service_role;

create or replace function private.complete_domain_event_processing(
  p_processing_id uuid,
  p_processor text,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_record private.domain_event_processing%rowtype;
begin
  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = p_processor
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Domain event processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this processing lease.';
  end if;

  update private.domain_event_processing
  set status = 'succeeded',
      processed_at = now(),
      locked_by = null,
      locked_at = null,
      last_error = null
  where id = p_processing_id;
end;
$$;

revoke all on function private.complete_domain_event_processing(uuid, text, text)
  from public, anon, authenticated;
grant execute on function private.complete_domain_event_processing(uuid, text, text)
  to service_role;

create or replace function private.fail_domain_event_processing(
  p_processing_id uuid,
  p_processor text,
  p_worker_id text,
  p_error text,
  p_retry_after_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  processing_record private.domain_event_processing%rowtype;
  next_status text;
begin
  if p_error is null or char_length(btrim(p_error)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'A bounded processor error is required.';
  end if;
  if p_retry_after_seconds not between 0 and 86400 then
    raise exception using errcode = '22023', message = 'Retry delay must be between 0 and 86400 seconds.';
  end if;

  select * into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = p_processor
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Domain event processing record not found.';
  end if;
  if processing_record.status in ('failed', 'dead_letter')
     and processing_record.last_error = btrim(p_error) then
    return;
  end if;
  if processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this processing lease.';
  end if;

  next_status := case when processing_record.attempts >= 10 then 'dead_letter' else 'failed' end;

  update private.domain_event_processing
  set status = next_status,
      next_attempt_at = now() + make_interval(secs => p_retry_after_seconds),
      locked_by = null,
      locked_at = null,
      last_error = btrim(p_error)
  where id = p_processing_id;
end;
$$;

revoke all on function private.fail_domain_event_processing(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function private.fail_domain_event_processing(uuid, text, text, text, integer)
  to service_role;

alter table public.domain_events enable row level security;
alter table private.domain_event_processing enable row level security;

revoke all on table public.domain_events from public, anon, authenticated;
revoke all on table private.domain_event_processing from public, anon, authenticated;

grant select on table public.domain_events to authenticated;
grant select, insert, update, delete on table public.domain_events to service_role;
grant select, insert, update, delete on table private.domain_event_processing to service_role;

create policy "v2 stewards read requested league domain events"
on public.domain_events
for select
to authenticated
using (
  (select public.is_platform_owner())
  or (select private.has_league_capability(league_id, 'steward'))
);

comment on table public.domain_events is
  'Immutable transactional outbox. Core workflows record facts here without running secondary processors.';
comment on table private.domain_event_processing is
  'Independent idempotent processor state with leases, retries, audit evidence, and dead-letter cutoff.';
comment on function private.claim_domain_event(text, text) is
  'Claims one due processor delivery with SKIP LOCKED and recovers stale leases after five minutes.';
