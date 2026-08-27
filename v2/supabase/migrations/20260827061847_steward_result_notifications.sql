-- RaceVora V2: private, tenant-bound notifications for result and steward events.
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
  target_race_name text;
  target_case public.steward_cases%rowtype;
  target_decision public.steward_decision_versions%rowtype;
  title_key text;
  body_key text;
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
  if processing_record.status = 'succeeded' then return; end if;
  if p_worker_id is null
     or processing_record.status <> 'processing'
     or processing_record.locked_by <> btrim(p_worker_id) then
    raise exception using errcode = '23514', message = 'Worker does not own this Notification lease.';
  end if;

  select de.* into event_record
  from public.domain_events de
  where de.id = processing_record.event_id;

  if event_record.event_type in ('result.published', 'result.revised', 'result.voided') then
    target_race_id := (event_record.payload ->> 'race_id')::uuid;
    if target_race_id is null or event_record.result_version_id is null then
      raise exception using errcode = '23514', message = 'Notification processing requires immutable race evidence.';
    end if;
    select r.grand_prix_name into target_race_name from public.races r where r.id = target_race_id;
    title_key := case event_record.event_type
      when 'result.published' then 'notification.resultPublished.title'
      when 'result.revised' then 'notification.resultRevised.title'
      else 'notification.resultVoided.title'
    end;
    body_key := case event_record.event_type
      when 'result.published' then 'notification.resultPublished.body'
      when 'result.revised' then 'notification.resultRevised.body'
      else 'notification.resultVoided.body'
    end;

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
      insert into public.user_notifications (
        recipient_user_id, league_id, source_event_id, notification_kind,
        title_key, body_key, payload, dedupe_key
      ) values (
        recipient.recipient_user_id, event_record.league_id, event_record.id, 'race_summary',
        title_key, body_key,
        jsonb_build_object(
          'event_type', event_record.event_type,
          'race_id', target_race_id,
          'race_name', coalesce(target_race_name, ''),
          'result_version_id', event_record.result_version_id,
          'result_version', event_record.payload -> 'version_number',
          'driver_identity_id', recipient.driver_identity_id,
          'driver_id', recipient.driver_id,
          'finish_position', recipient.finish_position,
          'classification_status', recipient.classification_status,
          'awarded_points', recipient.awarded_points
        ),
        format('race-result:%s:%s', event_record.id, recipient.recipient_user_id)
      ) on conflict (recipient_user_id, dedupe_key) do nothing;
    end loop;

  elsif event_record.event_type = 'steward.decision_finalized' then
    select sc.* into target_case
    from public.steward_cases sc
    where sc.id = event_record.aggregate_id
      and sc.league_id = event_record.league_id;
    if target_case.id is null then
      raise exception using errcode = '23514', message = 'Steward notification requires a tenant-bound case.';
    end if;
    select sdv.* into target_decision
    from public.steward_decision_versions sdv
    where sdv.case_id = target_case.id
      and sdv.result_version_id = event_record.result_version_id
    order by sdv.version_number desc
    limit 1;
    if target_decision.id is null then
      raise exception using errcode = '23514', message = 'Steward notification requires a finalized decision.';
    end if;
    select r.grand_prix_name into target_race_name from public.races r where r.id = target_case.race_id;

    for recipient in
      select distinct recipients.recipient_user_id
      from (
        select di.user_id as recipient_user_id
        from public.driver_identity_links dil
        join public.driver_identities di on di.id = dil.driver_identity_id
        where dil.driver_id in (target_case.accused_driver_id, target_case.reported_driver_id)
          and di.status = 'active' and di.user_id is not null
        union
        select lm.user_id
        from public.league_members lm
        where lm.league_id = target_case.league_id
          and lm.role in ('steward', 'league_admin')
      ) recipients
      where recipients.recipient_user_id is not null
    loop
      insert into public.user_notifications (
        recipient_user_id, league_id, source_event_id, notification_kind,
        title_key, body_key, payload, dedupe_key
      ) values (
        recipient.recipient_user_id, event_record.league_id, event_record.id, 'steward_decision',
        'notification.stewardDecision.title', 'notification.stewardDecision.body',
        jsonb_build_object(
          'case_id', target_case.id,
          'case_number', target_case.case_number,
          'race_id', target_case.race_id,
          'race_name', coalesce(target_race_name, ''),
          'outcome', target_decision.outcome,
          'decision_version', target_decision.version_number,
          'result_version_id', target_decision.result_version_id
        ),
        format('steward-decision:%s:%s', event_record.id, recipient.recipient_user_id)
      ) on conflict (recipient_user_id, dedupe_key) do nothing;
    end loop;

  else
    perform private.complete_domain_event_processing(p_processing_id, 'notifications', p_worker_id);
    return;
  end if;

  perform private.complete_domain_event_processing(p_processing_id, 'notifications', p_worker_id);
end;
$$;

revoke all on function private.process_notification_event(uuid, text)
  from public, anon, authenticated;
grant execute on function private.process_notification_event(uuid, text)
  to service_role;

comment on function private.process_notification_event(uuid, text) is
  'Creates private, deduplicated result and steward notifications without exposing votes or private evidence.';
