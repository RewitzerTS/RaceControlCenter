-- Processes result domain events in dependency order and retries them automatically.
-- Additive V2 migration. Never execute against the retired V1 project.

create extension if not exists pg_cron;

create or replace function private.process_domain_event_queue(
  p_event_limit integer default 25,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_item record;
  delivery private.domain_event_processing%rowtype;
  processor_name text;
  worker_id text := 'racevora-database-worker';
  error_message text;
  processed_count integer := 0;
  failed_count integer := 0;
  blocked_count integer := 0;
  event_blocked boolean;
begin
  if p_event_limit not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'The domain-event batch size must be between 1 and 100.';
  end if;

  for event_item in
    select de.id, de.occurred_at
    from public.domain_events de
    where (p_event_id is null or de.id = p_event_id)
      and exists (
        select 1
        from private.domain_event_processing pending
        where pending.event_id = de.id
          and pending.status <> 'succeeded'
      )
    order by de.occurred_at, de.recorded_at, de.id
    limit p_event_limit
  loop
    event_blocked := false;

    foreach processor_name in array array[
      'career', 'xp', 'achievements', 'challenges',
      'notifications', 'graphics', 'vora'
    ]
    loop
      exit when event_blocked;

      select dep.* into delivery
      from private.domain_event_processing dep
      where dep.event_id = event_item.id
        and dep.processor = processor_name
      for update;

      if not found or delivery.status = 'succeeded' then
        continue;
      end if;

      if delivery.status = 'dead_letter'
         or delivery.attempts >= 10
         or (
           delivery.status in ('pending', 'failed')
           and delivery.next_attempt_at > now()
         )
         or (
           delivery.status = 'processing'
           and delivery.locked_at >= now() - interval '5 minutes'
         ) then
        blocked_count := blocked_count + 1;
        event_blocked := true;
        continue;
      end if;

      update private.domain_event_processing dep
      set status = 'processing',
          attempts = dep.attempts + 1,
          locked_by = worker_id,
          locked_at = now(),
          last_error = null,
          next_attempt_at = now()
      where dep.id = delivery.id;

      begin
        case processor_name
          when 'career' then
            perform private.process_career_event(delivery.id, worker_id);
          when 'xp' then
            perform private.process_xp_event(delivery.id, worker_id);
          when 'achievements' then
            perform private.process_achievement_event(delivery.id, worker_id);
          when 'challenges' then
            perform private.process_challenge_event(delivery.id, worker_id);
          when 'notifications' then
            perform private.process_notification_event(delivery.id, worker_id);
          when 'graphics' then
            perform private.process_graphics_event(delivery.id, worker_id);
          when 'vora' then
            perform private.process_vora_event(delivery.id, worker_id);
          else
            raise exception using errcode = '22023', message = 'Unknown domain-event processor.';
        end case;

        processed_count := processed_count + 1;
      exception when others then
        get stacked diagnostics error_message = message_text;
        perform private.fail_domain_event_processing(
          delivery.id,
          processor_name,
          worker_id,
          left(coalesce(error_message, 'Unknown domain-event processing error.'), 2000),
          60
        );
        failed_count := failed_count + 1;
        event_blocked := true;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'blocked', blocked_count
  );
end;
$$;

revoke all on function private.process_domain_event_queue(integer, uuid)
  from public, anon, authenticated;
grant execute on function private.process_domain_event_queue(integer, uuid)
  to service_role;

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'racevora-domain-event-worker'
  ) then
    perform cron.unschedule('racevora-domain-event-worker');
  end if;

  perform cron.schedule(
    'racevora-domain-event-worker',
    '* * * * *',
    'select private.process_domain_event_queue(25, null);'
  );
end;
$$;

comment on function private.process_domain_event_queue(integer, uuid) is
  'Processes immutable domain events in dependency order with leases, retries, and bounded batches.';
