-- A later identity link must replay derived Career data, not republish race results.
-- Reuse the authoritative, delta-based processors and their normal retry worker.
do $migration$
declare signature text; definition text; guard text := $$('result.published', 'result.revised', 'result.voided')$$;
begin
  foreach signature in array array[
    'private.process_career_event(uuid,text)',
    'private.process_xp_event(uuid,text)',
    'private.process_achievement_event(uuid,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if strpos(definition, guard) = 0 then
      raise exception 'Unexpected processor contract: %', signature;
    end if;
    definition := replace(definition, guard,
      $$('result.published', 'result.revised', 'result.voided', 'driver.results_linked')$$);
    if signature = 'private.process_achievement_event(uuid,text)' then
      definition := replace(definition, 'is_historical := event_record.recorded_at < (',
        $$is_historical := coalesce((event_record.payload ->> 'source_recorded_at')::timestamptz, event_record.recorded_at) < ($$);
    end if;
    execute definition;
  end loop;
end;
$migration$;

create or replace function private.enqueue_linked_driver_career(p_link_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare queued integer;
begin
  -- Only server/validated-link-trigger access; this is not a browser RPC.
  with evidence as (
    select l.id link_id, l.driver_identity_id, l.driver_id, r.id race_id,
      s.league_id, r.current_result_version_id version_id,
      source.occurred_at, source.recorded_at
    from public.driver_identity_links l
    join public.driver_identities di on di.id = l.driver_identity_id and di.status = 'active'
    join public.drivers d on d.id = l.driver_id and d.is_active
    join public.result_version_rows rr on rr.driver_id = l.driver_id and upper(rr.participation_status) = 'PLAYER'
    join public.races r on r.current_result_version_id = rr.result_version_id
    join public.seasons s on s.id = r.season_id and s.league_id = d.league_id
    join lateral (
      select de.occurred_at, de.recorded_at from public.domain_events de
      where de.result_version_id = r.current_result_version_id
        and de.event_type in ('result.published', 'result.revised')
      order by de.recorded_at, de.id limit 1
    ) source on true
    where l.id = p_link_id
  ), inserted as (
    insert into public.domain_events (
      event_type, aggregate_type, aggregate_id, league_id, result_version_id,
      payload, idempotency_key, occurred_at
    )
    select 'driver.results_linked', 'result_version', version_id, league_id, version_id,
      jsonb_build_object('race_id', race_id, 'driver_identity_id', driver_identity_id,
        'driver_id', driver_id, 'link_id', link_id, 'source_recorded_at', recorded_at),
      format('linked-career:%s:%s', link_id, version_id), occurred_at
    from evidence on conflict (idempotency_key) do nothing returning id
  ), deliveries as (
    insert into private.domain_event_processing(event_id, processor)
    select id, processor from inserted cross join unnest(array['career','xp','achievements']) processor
    on conflict (event_id, processor) do nothing returning event_id
  ) select count(distinct event_id) into queued from deliveries;
  return queued;
end;
$$;
revoke all on function private.enqueue_linked_driver_career(uuid) from public, anon, authenticated, service_role;
grant execute on function private.enqueue_linked_driver_career(uuid) to service_role;

create or replace function private.on_driver_link_enqueue_career()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_linked_driver_career(new.id);
  return new;
end;
$$;
revoke all on function private.on_driver_link_enqueue_career() from public, anon, authenticated, service_role;
create trigger driver_identity_links_enqueue_career
after insert on public.driver_identity_links
for each row execute function private.on_driver_link_enqueue_career();

comment on function private.enqueue_linked_driver_career(uuid) is
  'Idempotent derived-data replay after verified linking. No result mutation, notification, graphics or historical challenge enrollment.';
