-- Weekly challenges. Deploy to Staging first; Production requires release approval.
-- Keep immutable history and legacy reward behavior intact.
create table private.challenge_rotation_state (
  singleton boolean primary key default true check (singleton),
  anchor_at timestamptz not null
);
alter table private.challenge_rotation_state enable row level security;
revoke all on private.challenge_rotation_state from public, anon, authenticated, service_role;

-- End unbounded launch tasks; do not modify historical completion/reward records.
update public.challenge_definitions set active_until = now()
where is_active and active_until is null and active_from < now();
insert into private.challenge_rotation_state (anchor_at)
select greatest(now(), coalesce(max(active_until), now()))
from public.challenge_definitions
where is_active and active_from <= now() and active_until > now();

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
  -- Weekly rewards are settled from the locked projection, at expiry.
  if new.rule_version = 2 then return new; end if;
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


-- Caller locks the projection (also true for the AFTER UPDATE trigger).
-- Re-read it here so a stale completion cannot be paid after a correction.
create or replace function private.settle_weekly_challenge(p_identity uuid, p_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  projection public.driver_challenges%rowtype;
  completion public.driver_challenge_events%rowtype;
  definition public.challenge_definitions%rowtype;
  net_reward bigint;
  delta integer;
begin
  select * into projection from public.driver_challenges
  where driver_identity_id = p_identity and challenge_code = p_code for update;
  if not found or projection.last_event_id is null then return; end if;
  select * into definition from public.challenge_definitions where code = p_code;
  if definition.rule_version <> 2 or definition.active_until is null
     or definition.active_until > now() then return; end if;
  select * into completion from public.driver_challenge_events where id = projection.last_event_id;
  if not found or not completion.reward_eligible or completion.reward_vc_snapshot <= 0 then return; end if;

  -- Serialize wallet rebuilding across different tasks for the same driver.
  perform 1 from public.driver_identities where id = p_identity for update;
  select coalesce(sum(amount), 0) into net_reward from public.credit_ledger
  where driver_identity_id = p_identity and source_scope = format('challenge:%s', p_code)
    and entry_type in ('challenge_reward', 'challenge_reversal');
  if projection.status = 'completed' and completion.event_type = 'completed'
     and projection.reward_eligible and projection.progress >= definition.target_value and net_reward <= 0 then
    delta := completion.reward_vc_snapshot;
  elsif projection.status <> 'completed' and completion.event_type = 'revoked' and net_reward > 0 then
    delta := -least(net_reward, completion.reward_vc_snapshot)::integer;
  else return;
  end if;
  insert into public.credit_ledger (
    driver_identity_id, source_event_id, entry_type, reason_code, amount,
    source_scope, idempotency_key, metadata, occurred_at
  ) values (
    p_identity, completion.source_event_id,
    case when delta > 0 then 'challenge_reward' else 'challenge_reversal' end,
    case when delta > 0 then 'challenge_completed' else 'challenge_revoked' end,
    delta, format('challenge:%s', p_code),
    format('credit:challenge-event:%s', completion.id),
    jsonb_build_object('challenge_code', p_code, 'challenge_event_id', completion.id,
      'rule_version', 2, 'settled_at', now()), now()
  ) on conflict (idempotency_key) do nothing;
  perform private.rebuild_driver_wallet(p_identity);
end;
$$;
revoke all on function private.settle_weekly_challenge(uuid,text) from public, anon, authenticated, service_role;

create or replace function private.settle_weekly_challenge_projection()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.settle_weekly_challenge(new.driver_identity_id, new.challenge_code);
  return new;
end;
$$;
revoke all on function private.settle_weekly_challenge_projection() from public, anon, authenticated, service_role;
create trigger driver_challenges_settle_weekly
after insert or update of status, last_event_id on public.driver_challenges
for each row execute function private.settle_weekly_challenge_projection();

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
  -- Use the same lock order as rotation/settlement before locking projections.
  perform pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit', 0));
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

        -- Weekly rules already limit the catalogue to three tasks per cycle.
        -- A rolling seven-day cap would incorrectly penalize adjacent weeks.
        if challenge_record.rule_version = 2 then reward_allowed := true; end if;

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


create or replace function private.maintain_weekly_challenges()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  anchor timestamptz;
  cycle bigint;
  first_cycle bigint;
  starts_at timestamptz;
  ordering integer;
  task record;
  pending record;
begin
  -- Same lock as the catalogue's existing three-active-tasks guard.
  perform pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit', 0));
  select anchor_at into strict anchor from private.challenge_rotation_state where singleton;
  first_cycle := greatest(0, floor(extract(epoch from (now() - anchor)) / 604800)::bigint);
  -- Current cycle plus two future cycles: no empty boundary while the job runs.
  for cycle in first_cycle..first_cycle + 2 loop
    starts_at := anchor + cycle * interval '7 days';
    for task in
      select * from (values
        ('starts'::text, 1, 100),
        ('classified_finishes'::text, 1, 150),
        ((array['podiums','fastest_laps','poles','wins'])[1 + (cycle % 4)::integer], 1, 250)
      ) as tasks(metric, target, reward)
    loop
      if not exists (select 1 from public.challenge_definitions
        where code = format('weekly_%s_%s', cycle, task.metric)) then
        select coalesce(max(sort_order), 0) + 1 into ordering from public.challenge_definitions;
        insert into public.challenge_definitions (
          code, metric, target_value, title_key, description_key, reward_vc,
          rule_version, active_from, active_until, is_active, sort_order
        ) values (
          format('weekly_%s_%s', cycle, task.metric), task.metric, task.target,
          'challenge.metric.title', 'challenge.metric.description', task.reward,
          2, starts_at, starts_at + interval '7 days', true, ordering
        );
      end if;
    end loop;
  end loop;
  -- Corrections and late processing use the projection trigger above.
  for pending in
    select dc.driver_identity_id, dc.challenge_code
    from public.driver_challenges dc
    join public.challenge_definitions cd on cd.code = dc.challenge_code
    where cd.rule_version = 2 and cd.active_until <= now()
      and dc.status = 'completed' and dc.reward_eligible
      and not exists (select 1 from public.credit_ledger cl
        where cl.idempotency_key = format('credit:challenge-event:%s', dc.last_event_id))
    order by dc.driver_identity_id, dc.challenge_code
    for update of dc skip locked
  loop
    perform private.settle_weekly_challenge(pending.driver_identity_id, pending.challenge_code);
  end loop;
end;
$$;
revoke all on function private.maintain_weekly_challenges() from public, anon, authenticated, service_role;

select private.maintain_weekly_challenges();
select cron.schedule('racevora-weekly-challenges', '* * * * *', 'select private.maintain_weekly_challenges();');
