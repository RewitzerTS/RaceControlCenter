-- RaceVora V2 Phase 29: close the notification and Vora delivery gaps.
-- Additive V2 migration. Never execute against the V1 Production project.

create or replace function private.process_notification_event(
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
  recipient record;
begin
  select dep.* into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = 'notifications'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Notification processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if p_worker_id is null
     or processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this Notification lease.';
  end if;

  select de.* into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type not in ('result.published', 'result.revised', 'result.voided') then
    perform private.complete_domain_event_processing(p_processing_id, 'notifications', p_worker_id);
    return;
  end if;

  target_race_id := (event_record.payload ->> 'race_id')::uuid;
  if target_race_id is null or event_record.result_version_id is null then
    raise exception using errcode = '23514', message = 'Notification processing requires immutable race evidence.';
  end if;

  for recipient in
    select distinct
      di.user_id as recipient_user_id,
      dil.driver_identity_id,
      rvr.driver_id,
      rvr.finish_position,
      rvr.classification_status,
      rvr.awarded_points
    from public.result_version_rows rvr
    join public.driver_identity_links dil on dil.driver_id = rvr.driver_id
    join public.driver_identities di on di.id = dil.driver_identity_id
    join public.drivers d on d.id = rvr.driver_id
    where rvr.result_version_id = event_record.result_version_id
      and upper(rvr.participation_status) = 'PLAYER'
      and di.status = 'active'
      and di.user_id is not null
      and d.is_active
  loop
    perform public.enqueue_race_summary_notification(
      recipient.recipient_user_id,
      event_record.league_id,
      event_record.id,
      jsonb_build_object(
        'event_type', event_record.event_type,
        'race_id', target_race_id,
        'result_version_id', event_record.result_version_id,
        'driver_identity_id', recipient.driver_identity_id,
        'driver_id', recipient.driver_id,
        'finish_position', recipient.finish_position,
        'classification_status', recipient.classification_status,
        'awarded_points', recipient.awarded_points
      ),
      format('race-summary:%s:%s', event_record.id, recipient.recipient_user_id)
    );
  end loop;

  perform private.complete_domain_event_processing(p_processing_id, 'notifications', p_worker_id);
end;
$$;

revoke all on function private.process_notification_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_notification_event(uuid, text)
  to service_role;

create or replace function private.process_vora_event(
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
begin
  select dep.* into processing_record
  from private.domain_event_processing dep
  where dep.id = p_processing_id
    and dep.processor = 'vora'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Vora processing record not found.';
  end if;
  if processing_record.status = 'succeeded' then
    return;
  end if;
  if p_worker_id is null
     or processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this Vora lease.';
  end if;

  -- Vora reads the actor-bound Career projections on demand. Its delivery is
  -- complete once all upstream processors have reconciled the immutable event.
  perform private.complete_domain_event_processing(p_processing_id, 'vora', p_worker_id);
end;
$$;

revoke all on function private.process_vora_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_vora_event(uuid, text)
  to service_role;

comment on function private.process_notification_event(uuid, text) is
  'Creates one private, deduplicated race summary per linked participant and completes the Notification lease.';
comment on function private.process_vora_event(uuid, text) is
  'Completes Vora delivery after on-demand actor-bound Career projections become authoritative.';
