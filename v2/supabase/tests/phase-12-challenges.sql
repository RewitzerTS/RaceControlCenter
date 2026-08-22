-- RaceVora V2 Phase 12 Challenge eligibility, reward cap, correction, idempotency, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

-- Isolate synthetic claims from persistent Staging deliveries; rollback restores them.
update private.domain_event_processing
set status = 'succeeded', locked_by = null, locked_at = null, last_error = null,
    processed_at = coalesce(processed_at, now())
where status in ('pending', 'processing', 'failed');

do $$
begin
  if (select count(*) from public.challenge_definitions where is_active) <> 3 then
    raise exception 'Challenge baseline does not expose exactly three active Racing Challenges';
  end if;
  if has_table_privilege('anon', 'public.challenge_definitions', 'select')
     or has_table_privilege('authenticated', 'public.challenge_result_facts', 'insert')
     or has_table_privilege('authenticated', 'public.driver_challenges', 'update')
     or has_table_privilege('authenticated', 'public.driver_challenge_events', 'insert') then
    raise exception 'Challenge browser privileges violate least privilege';
  end if;
  if has_table_privilege('service_role', 'public.challenge_races', 'delete')
     or has_table_privilege('service_role', 'public.driver_challenge_events', 'update')
     or has_table_privilege('service_role', 'public.driver_challenge_events', 'delete') then
    raise exception 'Challenge eligibility or event history is not append-only';
  end if;
  if has_function_privilege('authenticated', 'private.process_challenge_event(uuid,text)', 'execute')
     or has_function_privilege('anon', 'private.process_challenge_event(uuid,text)', 'execute') then
    raise exception 'browser roles can execute the Challenge processor';
  end if;

  begin
    insert into public.challenge_definitions (
      code, metric, target_value, title_key, description_key,
      reward_vc, rule_version, active_from, sort_order
    ) values (
      'fourth_active_rejected', 'wins', 1, 'challenge.metric.title',
      'challenge.metric.description', 100, 1, now(), 4
    );
    raise exception 'fourth simultaneous active Challenge was accepted';
  exception when check_violation then null;
  end;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'challenge-driver@example.invalid', '{}', '{}', now(), now()),
  ('c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'challenge-admin@example.invalid', '{}', '{}', now(), now()),
  ('c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'challenge-other@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('c0100000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('c0100000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002'),
  ('c0100000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values ('c1000000-0000-0000-0000-000000000001', 'Challenge Alpha', 'challenge-alpha', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role)
values ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'league_admin');

insert into public.seasons (id, league_id, slug, name)
values ('c1100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'challenge-one', 'Challenge One');

insert into public.races (id, season_id, round_number, grand_prix_name, race_date)
values
  ('c1200000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000001', 1, 'Challenge One', '2026-08-20'),
  ('c1200000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000001', 2, 'Challenge Two', '2026-08-21'),
  ('c1200000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000001', 3, 'Challenge Three', '2026-08-22'),
  ('c1200000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000001', 4, 'Challenge Four', '2026-08-23'),
  ('c1200000-0000-0000-0000-000000000005', 'c1100000-0000-0000-0000-000000000001', 5, 'Historical Challenge Exclusion', '2026-01-01');

insert into public.drivers (id, league_id, display_name)
values
  ('c1300000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Challenge Driver'),
  ('c1300000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Unclaimed Challenge Driver'),
  ('c1300000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Challenge Bot');

insert into public.driver_claims (
  id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by
)
values
  ('c1600000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), 'c0000000-0000-0000-0000-000000000002'),
  ('c1600000-0000-0000-0000-000000000002', 'c1300000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'admin_verified', 'verified', now(), 'c0000000-0000-0000-0000-000000000002');

insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values
  ('c1800000-0000-0000-0000-000000000001', 'c0100000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-000000000001', 'c1600000-0000-0000-0000-000000000001'),
  ('c1800000-0000-0000-0000-000000000002', 'c0100000-0000-0000-0000-000000000002', 'c1300000-0000-0000-0000-000000000003', 'c1600000-0000-0000-0000-000000000002');

do $$
declare
  target_race_id uuid;
  target_driver_id uuid := 'c1300000-0000-0000-0000-000000000001';
  version_id uuid;
  delivery record;
  race_index integer := 0;
begin
  foreach target_race_id in array array[
    'c1200000-0000-0000-0000-000000000001'::uuid,
    'c1200000-0000-0000-0000-000000000002'::uuid,
    'c1200000-0000-0000-0000-000000000003'::uuid
  ]
  loop
    race_index := race_index + 1;
    version_id := private.create_result_version(
      target_race_id, format('Challenge win publication %s', race_index)
    );
    insert into public.result_version_rows (
      result_version_id, row_order, driver_id, grid_position, finish_position,
      fastest_lap_time_ms, participation_status, classification_status,
      awarded_points, points
    ) values (
      version_id, 1, target_driver_id, 1, 1,
      90000 + race_index, 'PLAYER', 'classified', 25, 25
    );

    if race_index = 1 then
      insert into public.result_version_rows (
        result_version_id, row_order, driver_id, grid_position, finish_position,
        participation_status, classification_status, awarded_points, points
      ) values
        (version_id, 2, 'c1300000-0000-0000-0000-000000000002', 2, 2, 'PLAYER', 'classified', 18, 18),
        (version_id, 3, 'c1300000-0000-0000-0000-000000000003', 3, 3, 'BOT', 'classified', 15, 15);
    end if;

    perform private.validate_result_version(version_id);
    perform private.activate_result_version(version_id);

    loop
      delivery := null;
      select * into delivery
      from private.claim_domain_event('challenges', 'phase12-challenge-worker');
      exit when delivery.processing_id is null;

      if race_index = 1 and delivery.event_type = 'result.published' then
        begin
          perform private.process_challenge_event(
            delivery.processing_id, 'phase12-wrong-worker'
          );
          raise exception 'wrong worker processed a Challenge lease';
        exception when check_violation then null;
        end;
      end if;

      perform private.process_challenge_event(
        delivery.processing_id, 'phase12-challenge-worker'
      );
      perform private.process_challenge_event(
        delivery.processing_id, 'phase12-challenge-worker'
      );
    end loop;
  end loop;

  if (select count(*) from public.driver_challenges where status = 'completed') <> 3
     or (select count(*) from public.driver_challenge_events where event_type = 'completed') <> 3 then
    raise exception 'three Racing Challenges did not complete deterministically';
  end if;
  if exists (
    select 1 from public.driver_challenge_events
    where driver_identity_id = 'c0100000-0000-0000-0000-000000000002'
  ) then
    raise exception 'BOT participation entered Challenge progression';
  end if;
  if exists (
    select 1 from public.challenge_result_facts
    where driver_identity_id <> 'c0100000-0000-0000-0000-000000000001'
  ) then
    raise exception 'unclaimed or BOT result entered Challenge facts';
  end if;
  if not exists (
    select 1 from public.driver_wallets
    where driver_identity_id = 'c0100000-0000-0000-0000-000000000001'
      and balance = 1000
  ) then
    raise exception 'three eligible Challenge rewards did not produce the expected wallet balance';
  end if;
end;
$$;

update public.challenge_definitions
set is_active = false
where code = 'classified_launch';

insert into public.challenge_definitions (
  code, metric, target_value, title_key, description_key,
  reward_vc, rule_version, active_from, sort_order
) values (
  'win_finish', 'wins', 1, 'challenge.metric.title',
  'challenge.metric.description', 300, 1, now(), 4
);

do $$
declare
  version_id uuid;
  delivery record;
begin
  version_id := private.create_result_version(
    'c1200000-0000-0000-0000-000000000004',
    'Fourth completion inside rolling reward window'
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, participation_status, classification_status,
    awarded_points, points
  ) values (
    version_id, 1, 'c1300000-0000-0000-0000-000000000001',
    1, 1, 89000, 'PLAYER', 'classified', 25, 25
  );
  perform private.validate_result_version(version_id);
  perform private.activate_result_version(version_id);

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('challenges', 'phase12-challenge-worker');
    exit when delivery.processing_id is null;
    perform private.process_challenge_event(
      delivery.processing_id, 'phase12-challenge-worker'
    );
  end loop;

  if not exists (
    select 1 from public.driver_challenge_events
    where challenge_code = 'win_finish'
      and event_type = 'completed'
      and reward_eligible = false
  ) then
    raise exception 'fourth rolling seven-day Challenge completion was rewarded';
  end if;
  if (select balance from public.driver_wallets where driver_identity_id = 'c0100000-0000-0000-0000-000000000001') <> 1000 then
    raise exception 'reward cap did not protect the Vora Credit balance';
  end if;
end;
$$;

do $$
declare
  prior_version uuid;
  revised_version uuid;
  delivery record;
begin
  select current_result_version_id into prior_version
  from public.races where id = 'c1200000-0000-0000-0000-000000000002';

  revised_version := private.create_result_version(
    'c1200000-0000-0000-0000-000000000002',
    'Challenge DNS correction one',
    prior_version
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    participation_status, classification_status, awarded_points, points
  ) values (
    revised_version, 1, 'c1300000-0000-0000-0000-000000000001',
    null, null, 'PLAYER', 'dns', 0, 0
  );
  perform private.validate_result_version(revised_version);
  perform private.activate_result_version(revised_version);

  perform private.void_current_result_version(
    'c1200000-0000-0000-0000-000000000003',
    'Challenge result withdrawn'
  );

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('challenges', 'phase12-challenge-worker');
    exit when delivery.processing_id is null;
    perform private.process_challenge_event(
      delivery.processing_id, 'phase12-challenge-worker'
    );
  end loop;

  if not exists (
    select 1 from public.driver_challenge_events
    where challenge_code = 'race_starts_three'
      and event_type = 'revoked'
      and reward_eligible
  ) then
    raise exception 'result revision/void did not revoke corrected Challenge completion';
  end if;
  if not exists (
    select 1 from public.driver_challenges
    where challenge_code = 'race_starts_three'
      and status = 'active'
      and progress = 2
  ) then
    raise exception 'Challenge projection did not converge after result corrections';
  end if;
  if (select balance from public.driver_wallets where driver_identity_id = 'c0100000-0000-0000-0000-000000000001') <> 850 then
    raise exception 'Challenge revoke did not append the signed VC correction';
  end if;
end;
$$;

do $$
declare
  historical_event_id uuid := 'c2000000-0000-0000-0000-000000000001';
  processing_id uuid := 'c2100000-0000-0000-0000-000000000001';
begin
  insert into public.domain_events (
    id, event_type, aggregate_type, aggregate_id, league_id,
    payload, idempotency_key, occurred_at
  ) values (
    historical_event_id, 'result.published', 'result_version',
    'c2200000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    '{"race_id":"c1200000-0000-0000-0000-000000000005"}',
    'phase12-historical-result-event',
    '2026-01-01T12:00:00Z'
  );

  insert into private.domain_event_processing (
    id, event_id, processor, status, attempts, locked_by, locked_at
  ) values (
    processing_id, historical_event_id, 'challenges', 'processing', 1,
    'phase12-challenge-worker', now()
  );

  perform private.process_challenge_event(
    processing_id, 'phase12-challenge-worker'
  );

  if exists (
    select 1 from public.challenge_races
    where race_id = 'c1200000-0000-0000-0000-000000000005'
  ) then
    raise exception 'historical race entered Challenge eligibility';
  end if;
end;
$$;

do $$
begin
  begin
    delete from public.challenge_races
    where race_id = 'c1200000-0000-0000-0000-000000000001';
    raise exception 'Challenge eligibility history accepted deletion';
  exception when check_violation then null;
  end;

  begin
    update public.driver_challenge_events
    set progress_snapshot = 999
    where driver_identity_id = 'c0100000-0000-0000-0000-000000000001';
    raise exception 'Challenge event history accepted update';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.challenge_definitions) <> 3
     or (select count(*) from public.driver_challenges) <> 4
     or (select count(*) from public.driver_challenge_events) <> 5 then
    raise exception 'driver cannot read own active Challenges and immutable history';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.driver_challenges
    where driver_identity_id = 'c0100000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.driver_challenge_events
    where driver_identity_id = 'c0100000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Ligaleitung could read another global Driver Challenges';
  end if;
end;
$$;

reset role;
rollback;
