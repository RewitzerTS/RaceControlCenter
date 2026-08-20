-- RaceVora V2 Phase 7 outbox, processor, retry, partial-failure, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

-- Park pre-existing Staging deliveries inside this transaction so claims are
-- deterministic against the synthetic event created below. Rollback restores them.
update private.domain_event_processing
set status = 'succeeded', locked_by = null, locked_at = null, last_error = null,
    processed_at = coalesce(processed_at, now())
where status in ('pending', 'processing', 'failed');

do $$
begin
  if has_table_privilege('authenticated', 'public.domain_events', 'insert')
     or has_table_privilege('authenticated', 'public.domain_events', 'update')
     or has_table_privilege('authenticated', 'public.domain_events', 'delete') then
    raise exception 'browser roles can mutate the domain event outbox';
  end if;
  if has_function_privilege('authenticated', 'private.claim_domain_event(text,text)', 'execute')
     or has_function_privilege('anon', 'private.emit_domain_event(text,text,uuid,uuid,jsonb,text,uuid,uuid,timestamp with time zone)', 'execute') then
    raise exception 'browser roles can execute server-only event processing functions';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '71000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'phase7-admin@example.invalid', '{}', '{}', now(), now()
);

insert into public.driver_identities (id, user_id)
values ('71100000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('72000000-0000-0000-0000-000000000001', 'Phase Seven Alpha', 'phase-seven-alpha', true, '{"published": true}'),
  ('73000000-0000-0000-0000-000000000002', 'Phase Seven Beta', 'phase-seven-beta', true, '{"published": true}');

insert into public.league_members (league_id, user_id, role)
values (
  '72000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'league_admin'
);

insert into public.seasons (id, league_id, slug, name)
values
  ('72100000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'season-one', 'Season One'),
  ('73100000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 'season-one', 'Season One');

insert into public.races (id, season_id, round_number, grand_prix_name)
values
  ('72200000-0000-0000-0000-000000000001', '72100000-0000-0000-0000-000000000001', 1, 'Alpha Grand Prix'),
  ('73200000-0000-0000-0000-000000000002', '73100000-0000-0000-0000-000000000002', 1, 'Beta Grand Prix');

insert into public.drivers (id, league_id, display_name)
values
  ('72300000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Alpha Driver'),
  ('73300000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 'Beta Driver');

do $$
declare
  alpha_v1 uuid;
  alpha_v2 uuid;
  beta_v1 uuid;
  published_event public.domain_events%rowtype;
  duplicate_event_id uuid;
  graphics_claim record;
  graphics_retry record;
  career_claim record;
begin
  alpha_v1 := private.create_result_version(
    '72200000-0000-0000-0000-000000000001',
    'Initial reviewed publication'
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position, awarded_points, points
  ) values (
    alpha_v1, 1, '72300000-0000-0000-0000-000000000001', 1, 25, 25
  );
  perform private.validate_result_version(alpha_v1);
  perform private.activate_result_version(alpha_v1);

  select * into published_event
  from public.domain_events de
  where de.result_version_id = alpha_v1
    and de.event_type = 'result.published';

  if published_event.id is null then
    raise exception 'result publication did not emit a domain event';
  end if;
  if (select count(*) from private.domain_event_processing where event_id = published_event.id) <> 7 then
    raise exception 'result event did not create seven independent processor records';
  end if;

  duplicate_event_id := private.emit_domain_event(
    published_event.event_type,
    published_event.aggregate_type,
    published_event.aggregate_id,
    published_event.league_id,
    published_event.payload,
    published_event.idempotency_key,
    published_event.result_version_id,
    published_event.actor_user_id,
    published_event.occurred_at
  );
  if duplicate_event_id <> published_event.id
     or (select count(*) from public.domain_events where idempotency_key = published_event.idempotency_key) <> 1
     or (select count(*) from private.domain_event_processing where event_id = published_event.id) <> 7 then
    raise exception 'idempotent event emission created a duplicate';
  end if;

  select * into graphics_claim
  from private.claim_domain_event('graphics', 'phase7-graphics-worker');
  if graphics_claim.event_id <> published_event.id or graphics_claim.attempt_number <> 1 then
    raise exception 'graphics processor did not claim the first due event';
  end if;

  perform private.fail_domain_event_processing(
    graphics_claim.processing_id,
    'graphics',
    'phase7-graphics-worker',
    'Synthetic renderer outage',
    0
  );

  if (select current_result_version_id from public.races where id = '72200000-0000-0000-0000-000000000001') <> alpha_v1
     or (select count(*) from public.race_results where race_id = '72200000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'graphics failure damaged the official result';
  end if;
  if (select status from private.domain_event_processing where event_id = published_event.id and processor = 'career') <> 'pending' then
    raise exception 'processor failure changed another processor state';
  end if;

  select * into graphics_retry
  from private.claim_domain_event('graphics', 'phase7-graphics-worker');
  if graphics_retry.processing_id <> graphics_claim.processing_id
     or graphics_retry.attempt_number <> 2 then
    raise exception 'failed processor delivery was not retryable and auditable';
  end if;
  perform private.complete_domain_event_processing(
    graphics_retry.processing_id, 'graphics', 'phase7-graphics-worker'
  );
  perform private.complete_domain_event_processing(
    graphics_retry.processing_id, 'graphics', 'phase7-graphics-worker'
  );

  select * into career_claim
  from private.claim_domain_event('career', 'phase7-career-worker');
  perform private.complete_domain_event_processing(
    career_claim.processing_id, 'career', 'phase7-career-worker'
  );

  alpha_v2 := private.create_result_version(
    '72200000-0000-0000-0000-000000000001',
    'Steward reviewed correction',
    alpha_v1
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position, awarded_points, points
  ) values (
    alpha_v2, 1, '72300000-0000-0000-0000-000000000001', 1, 24, 24
  );
  perform private.validate_result_version(alpha_v2);
  perform private.activate_result_version(alpha_v2);

  if not exists (
    select 1 from public.domain_events
    where result_version_id = alpha_v2 and event_type = 'result.revised'
  ) then
    raise exception 'result revision did not emit its domain event';
  end if;

  perform private.void_current_result_version(
    '72200000-0000-0000-0000-000000000001',
    'Official result withdrawn for renewed review'
  );
  if not exists (
    select 1 from public.domain_events
    where result_version_id = alpha_v2 and event_type = 'result.voided'
  ) then
    raise exception 'result void did not emit its domain event';
  end if;

  beta_v1 := private.create_result_version(
    '73200000-0000-0000-0000-000000000002',
    'Beta initial reviewed publication'
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, finish_position, awarded_points, points
  ) values (
    beta_v1, 1, '73300000-0000-0000-0000-000000000002', 1, 25, 25
  );
  perform private.validate_result_version(beta_v1);
  perform private.activate_result_version(beta_v1);

  begin
    update public.domain_events
    set payload = payload || '{"tampered": true}'::jsonb
    where id = published_event.id;
    raise exception 'domain event evidence was mutable';
  exception when check_violation then null;
  end;

  begin
    perform private.emit_domain_event(
      'result.voided',
      published_event.aggregate_type,
      published_event.aggregate_id,
      published_event.league_id,
      published_event.payload,
      published_event.idempotency_key,
      published_event.result_version_id
    );
    raise exception 'conflicting idempotency evidence was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"phase-seven-alpha"}', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if (select count(*) from public.domain_events) <> 3 then
    raise exception 'domain event read crossed tenant context';
  end if;
end;
$$;

reset role;
select set_config('request.headers', '{"x-rcc-league-slug":"phase-seven-beta"}', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.domain_events) then
    raise exception 'domain event read ignored actor membership';
  end if;
end;
$$;

reset role;
rollback;
