-- RaceVora V2 Phase 9 XP ledger, correction, Level / Rank, idempotency, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_table_privilege('anon', 'public.xp_ledger', 'select')
     or has_table_privilege('anon', 'public.driver_progression', 'select') then
    raise exception 'XP or progression data is anonymously readable';
  end if;
  if has_table_privilege('authenticated', 'public.xp_ledger', 'insert')
     or has_table_privilege('authenticated', 'public.driver_progression', 'update')
     or has_table_privilege('service_role', 'public.xp_ledger', 'update')
     or has_table_privilege('service_role', 'public.xp_ledger', 'delete') then
    raise exception 'XP ledger mutation privileges are broader than append-only server access';
  end if;
  if has_function_privilege('authenticated', 'private.process_xp_event(uuid,text)', 'execute')
     or has_function_privilege('anon', 'private.process_xp_event(uuid,text)', 'execute') then
    raise exception 'browser roles can execute the XP processor';
  end if;

  if private.level_from_lifetime_xp(0) <> 1
     or private.level_from_lifetime_xp(3999) <> 4
     or private.level_from_lifetime_xp(4000) <> 5
     or private.level_from_lifetime_xp(99000) <> 100 then
    raise exception 'deterministic Level boundaries are incorrect';
  end if;
  if private.rank_from_level(1) <> 'Rookie'
     or private.rank_from_level(5) <> 'Challenger'
     or private.rank_from_level(10) <> 'Racer'
     or private.rank_from_level(20) <> 'Contender'
     or private.rank_from_level(30) <> 'Front Runner'
     or private.rank_from_level(40) <> 'Elite'
     or private.rank_from_level(50) <> 'Apex'
     or private.rank_from_level(65) <> 'Master'
     or private.rank_from_level(80) <> 'Legend'
     or private.rank_from_level(95) <> 'Icon'
     or private.rank_from_level(100) <> 'Immortal' then
    raise exception 'Level 100 Immortal or another Rank boundary is incorrect';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'xp-driver@example.invalid', '{}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'xp-admin@example.invalid', '{}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'xp-other@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('90100000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001'),
  ('90100000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002'),
  ('90100000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('91000000-0000-0000-0000-000000000001', 'XP Alpha', 'xp-alpha', true, '{"published":true}'),
  ('92000000-0000-0000-0000-000000000002', 'XP Beta', 'xp-beta', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role)
values ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'league_admin');

insert into public.seasons (id, league_id, slug, name)
values
  ('91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'xp-one', 'XP One'),
  ('92100000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'xp-one', 'XP One');

insert into public.races (id, season_id, round_number, grand_prix_name, race_date)
values
  ('91200000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000001', 1, 'XP Alpha One', '2026-08-01'),
  ('91200000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000001', 2, 'XP Alpha Two', '2026-08-08'),
  ('92200000-0000-0000-0000-000000000001', '92100000-0000-0000-0000-000000000002', 1, 'XP Beta One', '2026-08-02'),
  ('92200000-0000-0000-0000-000000000002', '92100000-0000-0000-0000-000000000002', 2, 'XP Beta Two', '2026-08-09');

insert into public.drivers (id, league_id, display_name)
values
  ('91300000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'XP Alpha Driver'),
  ('92300000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'XP Beta Driver'),
  ('91400000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'Unclaimed XP Driver'),
  ('91500000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', 'Linked XP Bot');

insert into public.driver_claims (
  id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by
)
values
  ('91600000-0000-0000-0000-000000000001', '91300000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), '90000000-0000-0000-0000-000000000002'),
  ('92600000-0000-0000-0000-000000000002', '92300000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), '90000000-0000-0000-0000-000000000002'),
  ('91700000-0000-0000-0000-000000000003', '91500000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'admin_verified', 'verified', now(), '90000000-0000-0000-0000-000000000002');

insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values
  ('91800000-0000-0000-0000-000000000001', '90100000-0000-0000-0000-000000000001', '91300000-0000-0000-0000-000000000001', '91600000-0000-0000-0000-000000000001'),
  ('92800000-0000-0000-0000-000000000002', '90100000-0000-0000-0000-000000000001', '92300000-0000-0000-0000-000000000002', '92600000-0000-0000-0000-000000000002'),
  ('91900000-0000-0000-0000-000000000003', '90100000-0000-0000-0000-000000000002', '91500000-0000-0000-0000-000000000004', '91700000-0000-0000-0000-000000000003');

do $$
declare
  alpha_one_v1 uuid;
  alpha_two_v1 uuid;
  beta_one_v1 uuid;
  delivery record;
  processed integer := 0;
begin
  alpha_one_v1 := private.create_result_version('91200000-0000-0000-0000-000000000001', 'Initial Alpha XP publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, classification_status, awarded_points, points
  ) values (
    alpha_one_v1, 1, '91300000-0000-0000-0000-000000000001', 1, 1,
    90000, 'classified', 25, 25
  );
  perform private.validate_result_version(alpha_one_v1);
  perform private.activate_result_version(alpha_one_v1);

  alpha_two_v1 := private.create_result_version('91200000-0000-0000-0000-000000000002', 'Initial Alpha zero XP publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    participation_status, classification_status, awarded_points, points
  ) values
    (alpha_two_v1, 1, '91300000-0000-0000-0000-000000000001', 3, null, 'PLAYER', 'dns', 0, 0),
    (alpha_two_v1, 2, '91400000-0000-0000-0000-000000000003', 1, 1, 'PLAYER', 'classified', 25, 25),
    (alpha_two_v1, 3, '91500000-0000-0000-0000-000000000004', 2, 2, 'BOT', 'classified', 18, 18);
  perform private.validate_result_version(alpha_two_v1);
  perform private.activate_result_version(alpha_two_v1);

  beta_one_v1 := private.create_result_version('92200000-0000-0000-0000-000000000001', 'Initial Beta XP publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    beta_one_v1, 1, '92300000-0000-0000-0000-000000000002', 2, 4, 'dnf', 8, 8
  );
  perform private.validate_result_version(beta_one_v1);
  perform private.activate_result_version(beta_one_v1);

  loop
    delivery := null;
    select * into delivery from private.claim_domain_event('xp', 'phase9-xp-worker');
    exit when delivery.processing_id is null;
    if processed = 0 then
      begin
        perform private.process_xp_event(delivery.processing_id, 'phase9-wrong-worker');
        raise exception 'wrong worker processed an XP lease';
      exception when check_violation then null;
      end;
    end if;
    perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');
    if processed = 0 then
      perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');
    end if;
    processed := processed + 1;
  end loop;

  if processed <> 3 then
    raise exception 'XP processor did not consume the three initial result events: %', processed;
  end if;
  if (select count(*) from public.xp_ledger) <> 2 then
    raise exception 'zero, BOT, or unclaimed result produced an XP ledger entry';
  end if;
  if not exists (
    select 1 from public.xp_ledger
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and race_id = '91200000-0000-0000-0000-000000000001'
      and entry_type = 'result_award' and reason_code = 'official_race_result'
      and amount = 305 and rule_version = 1
  ) then
    raise exception 'classified win XP rule or auditable reward evidence is incorrect';
  end if;
  if not exists (
    select 1 from public.xp_ledger
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and race_id = '92200000-0000-0000-0000-000000000001'
      and amount = 40
  ) then
    raise exception 'DNF XP rule is incorrect';
  end if;
  if not exists (
    select 1 from public.driver_progression
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and lifetime_xp = 345 and level = 1 and rank = 'Rookie'
      and xp_into_level = 345 and xp_to_next_level = 655
  ) then
    raise exception 'cross-league Lifetime XP projection is incorrect';
  end if;
end;
$$;

do $$
declare
  alpha_v1 uuid;
  alpha_v2 uuid;
  delivery record;
begin
  select current_result_version_id into alpha_v1
  from public.races where id = '91200000-0000-0000-0000-000000000001';
  alpha_v2 := private.create_result_version(
    '91200000-0000-0000-0000-000000000001', 'DSQ requires negative XP adjustment', alpha_v1
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    alpha_v2, 1, '91300000-0000-0000-0000-000000000001', 2, null, 'dsq', 0, 0
  );
  perform private.validate_result_version(alpha_v2);
  perform private.activate_result_version(alpha_v2);

  select * into delivery from private.claim_domain_event('xp', 'phase9-xp-worker');
  perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');

  if (select count(*) from public.xp_ledger where race_id = '91200000-0000-0000-0000-000000000001') <> 2
     or not exists (
       select 1 from public.xp_ledger
       where race_id = '91200000-0000-0000-0000-000000000001'
         and entry_type = 'result_adjustment' and amount = -305
     ) then
    raise exception 'result revision hid history instead of appending negative XP';
  end if;
  if not exists (
    select 1 from public.driver_progression
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and lifetime_xp = 40 and level = 1 and rank = 'Rookie'
  ) then
    raise exception 'result revision did not correct Lifetime XP';
  end if;

  perform private.void_current_result_version(
    '92200000-0000-0000-0000-000000000001', 'Beta result withdrawn from XP'
  );
  select * into delivery from private.claim_domain_event('xp', 'phase9-xp-worker');
  perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');
  perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');

  if not exists (
    select 1 from public.xp_ledger
    where race_id = '92200000-0000-0000-0000-000000000001'
      and entry_type = 'result_adjustment' and amount = -40
  ) then
    raise exception 'result void did not append an XP reversal';
  end if;
  if not exists (
    select 1 from public.driver_progression
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and lifetime_xp = 0 and level = 1 and rank = 'Rookie'
      and xp_into_level = 0 and xp_to_next_level = 1000
  ) then
    raise exception 'result void did not restore deterministic zero progression';
  end if;
end;
$$;

do $$
declare
  beta_v1 uuid;
  beta_v2 uuid;
  delivery record;
  stale_source_event_id uuid;
begin
  beta_v1 := private.create_result_version('92200000-0000-0000-0000-000000000002', 'Beta XP publication awaiting delivery');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    beta_v1, 1, '92300000-0000-0000-0000-000000000002', 3, 3, 'classified', 15, 15
  );
  perform private.validate_result_version(beta_v1);
  perform private.activate_result_version(beta_v1);

  beta_v2 := private.create_result_version(
    '92200000-0000-0000-0000-000000000002', 'Beta correction before XP delivery', beta_v1
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    beta_v2, 1, '92300000-0000-0000-0000-000000000002', 2, 2, 'classified', 18, 18
  );
  perform private.validate_result_version(beta_v2);
  perform private.activate_result_version(beta_v2);

  select * into delivery from private.claim_domain_event('xp', 'phase9-xp-worker');
  stale_source_event_id := delivery.event_id;
  perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');

  if not exists (
    select 1 from public.xp_ledger
    where source_event_id = stale_source_event_id
      and race_id = '92200000-0000-0000-0000-000000000002'
      and result_version_id = beta_v2
      and amount = 220
  ) then
    raise exception 'stale XP event did not converge to the explicit current result pointer';
  end if;

  select * into delivery from private.claim_domain_event('xp', 'phase9-xp-worker');
  perform private.process_xp_event(delivery.processing_id, 'phase9-xp-worker');

  if (select count(*) from public.xp_ledger where race_id = '92200000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'repeated XP reconciliation double-counted one race';
  end if;
  if not exists (
    select 1 from public.driver_progression
    where driver_identity_id = '90100000-0000-0000-0000-000000000001'
      and lifetime_xp = 220 and level = 1 and rank = 'Rookie'
      and xp_into_level = 220 and xp_to_next_level = 780
  ) then
    raise exception 'stale XP reconciliation produced an inconsistent progression projection';
  end if;
end;
$$;

do $$
declare
  ledger_record public.xp_ledger%rowtype;
begin
  select * into ledger_record from public.xp_ledger order by recorded_at, id limit 1;

  begin
    update public.xp_ledger set amount = amount + 1 where id = ledger_record.id;
    raise exception 'XP ledger entry was mutable';
  exception when check_violation then null;
  end;

  begin
    delete from public.xp_ledger where id = ledger_record.id;
    raise exception 'XP ledger entry was deletable';
  exception when check_violation then null;
  end;

  begin
    insert into public.xp_ledger (
      driver_identity_id, source_event_id, processing_id, league_id, race_id,
      result_version_id, entry_type, reason_code, amount, rule_version,
      idempotency_key, metadata, occurred_at
    ) values (
      ledger_record.driver_identity_id, ledger_record.source_event_id,
      ledger_record.processing_id, ledger_record.league_id, ledger_record.race_id,
      ledger_record.result_version_id, ledger_record.entry_type,
      ledger_record.reason_code, ledger_record.amount, ledger_record.rule_version,
      'xp-event:duplicate-evidence', '{}', ledger_record.occurred_at
    );
    raise exception 'duplicate XP source evidence bypassed idempotency protection';
  exception when unique_violation then null;
  end;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"xp-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.xp_ledger) <> 5 then
    raise exception 'driver cannot read own cross-league XP history';
  end if;
  if not exists (
    select 1 from public.driver_progression
    where lifetime_xp = 220 and level = 1 and rank = 'Rookie'
  ) then
    raise exception 'driver cannot read own global Level and Rank';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.xp_ledger) <> 2 then
    raise exception 'league admin XP ledger escaped requested league scope';
  end if;
  if exists (select 1 from public.driver_progression) then
    raise exception 'league admin could read another driver global progression';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.xp_ledger)
     or exists (select 1 from public.driver_progression) then
    raise exception 'unrelated user could read another global progression';
  end if;
end;
$$;

reset role;
rollback;
