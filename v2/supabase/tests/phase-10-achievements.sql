-- RaceVora V2 Phase 10 Achievement unlock, revoke, identity, idempotency, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

-- Isolate synthetic claims from persistent Staging deliveries; rollback restores them.
update private.domain_event_processing
set status = 'succeeded', locked_by = null, locked_at = null, last_error = null,
    processed_at = coalesce(processed_at, now())
where status in ('pending', 'processing', 'failed');

do $$
begin
  if (select count(*) from public.achievement_definitions where is_core) <> 50 then
    raise exception 'Phase 10 does not contain exactly 50 Core Achievements';
  end if;
  if has_table_privilege('anon', 'public.achievement_definitions', 'select')
     or has_table_privilege('anon', 'public.driver_achievements', 'select')
     or has_table_privilege('authenticated', 'public.driver_achievement_events', 'insert')
     or has_table_privilege('authenticated', 'public.driver_achievements', 'update') then
    raise exception 'Achievement browser privileges violate least privilege';
  end if;
  if has_table_privilege('service_role', 'public.driver_achievement_events', 'update')
     or has_table_privilege('service_role', 'public.driver_achievement_events', 'delete') then
    raise exception 'Achievement history is not append-only at the grant layer';
  end if;
  if has_function_privilege('authenticated', 'private.process_achievement_event(uuid,text)', 'execute')
     or has_function_privilege('anon', 'private.process_achievement_event(uuid,text)', 'execute') then
    raise exception 'browser roles can execute the Achievement processor';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'achievement-driver@example.invalid', '{}', '{}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'achievement-admin@example.invalid', '{}', '{}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'achievement-other@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('a0100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('a0100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('a0100000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values ('a1000000-0000-0000-0000-000000000001', 'Achievement Alpha', 'achievement-alpha', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'league_admin');

insert into public.seasons (id, league_id, slug, name)
values ('a1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'achievement-one', 'Achievement One');

insert into public.races (id, season_id, round_number, grand_prix_name, race_date)
values ('a1200000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', 1, 'Achievement One', '2026-08-20');

insert into public.drivers (id, league_id, display_name)
values
  ('a1300000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Achievement Driver'),
  ('a1300000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Unclaimed Achievement Driver'),
  ('a1300000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Achievement Bot');

insert into public.driver_claims (
  id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by
)
values
  ('a1600000-0000-0000-0000-000000000001', 'a1300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), 'a0000000-0000-0000-0000-000000000002'),
  ('a1600000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'admin_verified', 'verified', now(), 'a0000000-0000-0000-0000-000000000002');

insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values
  ('a1800000-0000-0000-0000-000000000001', 'a0100000-0000-0000-0000-000000000001', 'a1300000-0000-0000-0000-000000000001', 'a1600000-0000-0000-0000-000000000001'),
  ('a1800000-0000-0000-0000-000000000002', 'a0100000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000003', 'a1600000-0000-0000-0000-000000000002');

do $$
declare
  result_v1 uuid;
  delivery record;
  first_processing_id uuid;
begin
  result_v1 := private.create_result_version(
    'a1200000-0000-0000-0000-000000000001',
    'Achievement perfect-win publication'
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, participation_status, classification_status, awarded_points, points
  ) values
    (result_v1, 1, 'a1300000-0000-0000-0000-000000000001', 1, 1, 90000, 'PLAYER', 'classified', 25, 25),
    (result_v1, 2, 'a1300000-0000-0000-0000-000000000002', 2, 2, 91000, 'PLAYER', 'classified', 18, 18),
    (result_v1, 3, 'a1300000-0000-0000-0000-000000000003', 3, 3, 92000, 'BOT', 'classified', 15, 15);
  perform private.validate_result_version(result_v1);
  perform private.activate_result_version(result_v1);

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('achievements', 'phase10-achievement-worker');
    exit when delivery.processing_id is null;

    if first_processing_id is null then
      first_processing_id := delivery.processing_id;
      begin
        perform private.process_achievement_event(
          delivery.processing_id, 'phase10-wrong-worker'
        );
        raise exception 'wrong worker processed an Achievement lease';
      exception when check_violation then null;
      end;
    end if;

    perform private.process_achievement_event(
      delivery.processing_id, 'phase10-achievement-worker'
    );
    perform private.process_achievement_event(
      delivery.processing_id, 'phase10-achievement-worker'
    );
  end loop;

  if (select count(*) from public.driver_achievement_events where event_type = 'unlocked') <> 6 then
    raise exception 'perfect win did not deterministically unlock exactly six Core Achievements';
  end if;
  if (select count(*) from public.driver_achievements where status = 'unlocked') <> 6 then
    raise exception 'Achievement projection does not match immutable unlock history';
  end if;
  if not exists (
    select 1
    from public.driver_achievements
    where driver_identity_id = 'a0100000-0000-0000-0000-000000000001'
      and achievement_code = 'wins_1'
      and status = 'unlocked'
      and current_value = 1
  ) then
    raise exception 'first-win Achievement was not unlocked';
  end if;
  if exists (
    select 1
    from public.driver_achievement_events
    where driver_identity_id = 'a0100000-0000-0000-0000-000000000002'
  ) then
    raise exception 'BOT participation entered Achievement progression';
  end if;
  if exists (
    select 1
    from public.driver_achievement_events dae
    join public.driver_identity_links dil
      on dil.driver_identity_id = dae.driver_identity_id
    where dil.driver_id = 'a1300000-0000-0000-0000-000000000002'
  ) then
    raise exception 'unclaimed driver entered Achievement progression';
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
  from public.races
  where id = 'a1200000-0000-0000-0000-000000000001';

  revised_version := private.create_result_version(
    'a1200000-0000-0000-0000-000000000001',
    'Achievement DSQ correction',
    prior_version
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    participation_status, classification_status, awarded_points, points
  ) values (
    revised_version, 1, 'a1300000-0000-0000-0000-000000000001',
    2, null, 'PLAYER', 'dsq', 0, 0
  );
  perform private.validate_result_version(revised_version);
  perform private.activate_result_version(revised_version);

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('achievements', 'phase10-achievement-worker');
    exit when delivery.processing_id is null;
    perform private.process_achievement_event(
      delivery.processing_id, 'phase10-achievement-worker'
    );
  end loop;

  if (select count(*) from public.driver_achievement_events where event_type = 'revoked') <> 5 then
    raise exception 'result revision did not append five deterministic Achievement revokes';
  end if;
  if (select count(*) from public.driver_achievements where status = 'unlocked') <> 1
     or not exists (
       select 1
       from public.driver_achievements
       where achievement_code = 'starts_1' and status = 'unlocked'
     ) then
    raise exception 'DSQ correction did not preserve only the start Achievement';
  end if;

  perform private.void_current_result_version(
    'a1200000-0000-0000-0000-000000000001',
    'Achievement source result withdrawn'
  );

  loop
    delivery := null;
    select * into delivery
    from private.claim_domain_event('achievements', 'phase10-achievement-worker');
    exit when delivery.processing_id is null;
    perform private.process_achievement_event(
      delivery.processing_id, 'phase10-achievement-worker'
    );
  end loop;

  if (select count(*) from public.driver_achievement_events where event_type = 'revoked') <> 6
     or exists (select 1 from public.driver_achievements where status = 'unlocked') then
    raise exception 'result void did not revoke the final current Achievement';
  end if;
  if (select count(*) from public.driver_achievement_events) <> 12 then
    raise exception 'Achievement history was duplicated during idempotent processing';
  end if;
end;
$$;

do $$
begin
  begin
    update public.driver_achievement_events
    set observed_value = 999
    where driver_identity_id = 'a0100000-0000-0000-0000-000000000001';
    raise exception 'Achievement event history accepted an update';
  exception when check_violation then null;
  end;

  begin
    delete from public.achievement_definitions where code = 'wins_1';
    raise exception 'Core Achievement definition accepted deletion';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"achievement-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.achievement_definitions) <> 61
     or (select count(*) from public.driver_achievements) <> 6
     or (select count(*) from public.driver_achievement_events) <> 12 then
    raise exception 'driver cannot read own global Achievement history and definitions';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.driver_achievements)
     or exists (select 1 from public.driver_achievement_events) then
    raise exception 'league admin could read another driver global Achievements';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.driver_achievements)
     or exists (select 1 from public.driver_achievement_events) then
    raise exception 'unrelated user could read another driver Achievements';
  end if;
end;
$$;

reset role;
rollback;
