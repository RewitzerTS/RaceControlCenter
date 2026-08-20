-- RaceVora V2 Phase 8 Career reconciliation, correction, identity, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_table_privilege('anon', 'public.career_result_facts', 'select')
     or has_table_privilege('anon', 'public.driver_career_stats', 'select') then
    raise exception 'Career data is anonymously readable';
  end if;
  if has_table_privilege('authenticated', 'public.career_result_facts', 'insert')
     or has_table_privilege('authenticated', 'public.driver_career_stats', 'update') then
    raise exception 'browser roles can mutate Career projections';
  end if;
  if has_function_privilege('authenticated', 'private.process_career_event(uuid,text)', 'execute')
     or has_function_privilege('anon', 'private.process_career_event(uuid,text)', 'execute') then
    raise exception 'browser roles can execute the Career processor';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'career-driver@example.invalid', '{}', '{}', now(), now()),
  ('80000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'career-admin@example.invalid', '{}', '{}', now(), now()),
  ('80000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'career-other@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('80100000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'),
  ('80100000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002'),
  ('80100000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('81000000-0000-0000-0000-000000000001', 'Career Alpha', 'career-alpha', true, '{"published":true}'),
  ('82000000-0000-0000-0000-000000000002', 'Career Beta', 'career-beta', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role)
values ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', 'league_admin');

insert into public.seasons (id, league_id, slug, name)
values
  ('81100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'career-one', 'Career One'),
  ('82100000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'career-one', 'Career One');

insert into public.races (id, season_id, round_number, grand_prix_name, race_date)
values
  ('81200000-0000-0000-0000-000000000001', '81100000-0000-0000-0000-000000000001', 1, 'Alpha One', '2026-08-01'),
  ('81200000-0000-0000-0000-000000000002', '81100000-0000-0000-0000-000000000001', 2, 'Alpha Two', '2026-08-08'),
  ('82200000-0000-0000-0000-000000000001', '82100000-0000-0000-0000-000000000002', 1, 'Beta One', '2026-08-02'),
  ('82200000-0000-0000-0000-000000000002', '82100000-0000-0000-0000-000000000002', 2, 'Beta Two', '2026-08-09');

insert into public.drivers (id, league_id, display_name)
values
  ('81300000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Career Alpha Driver'),
  ('82300000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'Career Beta Driver'),
  ('81400000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'Unclaimed Historical Driver'),
  ('81500000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', 'Linked Bot Driver');

insert into public.driver_claims (
  id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by
)
values
  ('81600000-0000-0000-0000-000000000001', '81300000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), '80000000-0000-0000-0000-000000000002'),
  ('82600000-0000-0000-0000-000000000002', '82300000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'admin_verified', 'verified', now(), '80000000-0000-0000-0000-000000000002'),
  ('81700000-0000-0000-0000-000000000003', '81500000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'admin_verified', 'verified', now(), '80000000-0000-0000-0000-000000000002');

insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values
  ('81800000-0000-0000-0000-000000000001', '80100000-0000-0000-0000-000000000001', '81300000-0000-0000-0000-000000000001', '81600000-0000-0000-0000-000000000001'),
  ('82800000-0000-0000-0000-000000000002', '80100000-0000-0000-0000-000000000001', '82300000-0000-0000-0000-000000000002', '82600000-0000-0000-0000-000000000002'),
  ('81900000-0000-0000-0000-000000000003', '80100000-0000-0000-0000-000000000002', '81500000-0000-0000-0000-000000000004', '81700000-0000-0000-0000-000000000003');

do $$
declare
  alpha_one_v1 uuid;
  alpha_two_v1 uuid;
  beta_one_v1 uuid;
  delivery record;
  processed integer := 0;
begin
  alpha_one_v1 := private.create_result_version('81200000-0000-0000-0000-000000000001', 'Initial Alpha career publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, classification_status, awarded_points, points
  ) values (
    alpha_one_v1, 1, '81300000-0000-0000-0000-000000000001', 1, 1,
    90000, 'classified', 25, 25
  );
  perform private.validate_result_version(alpha_one_v1);
  perform private.activate_result_version(alpha_one_v1);

  alpha_two_v1 := private.create_result_version('81200000-0000-0000-0000-000000000002', 'Initial Alpha mixed publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    participation_status, classification_status, awarded_points, points
  ) values
    (alpha_two_v1, 1, '81300000-0000-0000-0000-000000000001', 3, null, 'PLAYER', 'dns', 0, 0),
    (alpha_two_v1, 2, '81400000-0000-0000-0000-000000000003', 1, 1, 'PLAYER', 'classified', 25, 25),
    (alpha_two_v1, 3, '81500000-0000-0000-0000-000000000004', 2, 2, 'BOT', 'classified', 18, 18);
  perform private.validate_result_version(alpha_two_v1);
  perform private.activate_result_version(alpha_two_v1);

  beta_one_v1 := private.create_result_version('82200000-0000-0000-0000-000000000001', 'Initial Beta career publication');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    beta_one_v1, 1, '82300000-0000-0000-0000-000000000002', 2, 4, 'dnf', 8, 8
  );
  perform private.validate_result_version(beta_one_v1);
  perform private.activate_result_version(beta_one_v1);

  loop
    delivery := null;
    select * into delivery from private.claim_domain_event('career', 'phase8-career-worker');
    exit when delivery.processing_id is null;
    if processed = 0 then
      begin
        perform private.process_career_event(delivery.processing_id, 'phase8-wrong-worker');
        raise exception 'wrong worker processed a Career lease';
      exception when check_violation then null;
      end;
    end if;
    perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');
    processed := processed + 1;
  end loop;

  if processed <> 3 then
    raise exception 'Career processor did not consume the three initial result events: %', processed;
  end if;
  if (select count(*) from public.career_result_facts where driver_identity_id = '80100000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'cross-league Career facts were not built for the global identity';
  end if;
  if exists (select 1 from public.career_result_facts where driver_id = '81400000-0000-0000-0000-000000000003') then
    raise exception 'unclaimed historical driver received active V2 progression';
  end if;
  if exists (select 1 from public.career_result_facts where driver_id = '81500000-0000-0000-0000-000000000004') then
    raise exception 'BOT participation entered Career progression';
  end if;
  if not exists (
    select 1 from public.driver_career_stats
    where driver_identity_id = '80100000-0000-0000-0000-000000000001'
      and starts = 2 and classified_finishes = 1 and wins = 1 and podiums = 1
      and poles = 1 and fastest_laps = 1 and dns = 1 and dnfs = 1 and dsqs = 0
      and total_points = 33 and best_finish = 1 and average_finish = 1
      and leagues_competed = 2 and seasons_competed = 2
  ) then
    raise exception 'initial global Career aggregate is incorrect';
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
  from public.races where id = '81200000-0000-0000-0000-000000000001';
  alpha_v2 := private.create_result_version(
    '81200000-0000-0000-0000-000000000001', 'Steward DSQ correction for Career', alpha_v1
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    classification_status, awarded_points, points
  ) values (
    alpha_v2, 1, '81300000-0000-0000-0000-000000000001', 2, null, 'dsq', 0, 0
  );
  perform private.validate_result_version(alpha_v2);
  perform private.activate_result_version(alpha_v2);

  select * into delivery from private.claim_domain_event('career', 'phase8-career-worker');
  perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');

  if exists (
    select 1 from public.career_result_facts
    where race_id = '81200000-0000-0000-0000-000000000001'
      and result_version_id <> alpha_v2
  ) then
    raise exception 'result revision left an obsolete Career fact';
  end if;
  if not exists (
    select 1 from public.driver_career_stats
    where driver_identity_id = '80100000-0000-0000-0000-000000000001'
      and starts = 2 and classified_finishes = 0 and wins = 0 and podiums = 0
      and total_points = 8 and dns = 1 and dnfs = 1 and dsqs = 1
  ) then
    raise exception 'result revision did not deterministically correct Career';
  end if;

  perform private.void_current_result_version(
    '82200000-0000-0000-0000-000000000001', 'Beta result withdrawn from Career'
  );
  select * into delivery from private.claim_domain_event('career', 'phase8-career-worker');
  perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');
  perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');

  if exists (select 1 from public.career_result_facts where race_id = '82200000-0000-0000-0000-000000000001') then
    raise exception 'voided result still contributes Career facts';
  end if;
  if not exists (
    select 1 from public.driver_career_stats
    where driver_identity_id = '80100000-0000-0000-0000-000000000001'
      and starts = 1 and total_points = 0 and dnfs = 0 and dsqs = 1 and dns = 1
      and leagues_competed = 1
  ) then
    raise exception 'result void did not correct Career totals';
  end if;
end;
$$;

do $$
declare
  beta_v1 uuid;
  beta_v2 uuid;
  delivery record;
begin
  beta_v1 := private.create_result_version('82200000-0000-0000-0000-000000000002', 'Beta publication awaiting Career');
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, classification_status, awarded_points, points
  ) values (
    beta_v1, 1, '82300000-0000-0000-0000-000000000002', 3, 3, 91000, 'classified', 15, 15
  );
  perform private.validate_result_version(beta_v1);
  perform private.activate_result_version(beta_v1);

  beta_v2 := private.create_result_version(
    '82200000-0000-0000-0000-000000000002', 'Beta correction before Career delivery', beta_v1
  );
  insert into public.result_version_rows (
    result_version_id, row_order, driver_id, grid_position, finish_position,
    fastest_lap_time_ms, classification_status, awarded_points, points
  ) values (
    beta_v2, 1, '82300000-0000-0000-0000-000000000002', 2, 2, 89000, 'classified', 18, 18
  );
  perform private.validate_result_version(beta_v2);
  perform private.activate_result_version(beta_v2);

  select * into delivery from private.claim_domain_event('career', 'phase8-career-worker');
  perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');

  if not exists (
    select 1 from public.career_result_facts
    where race_id = '82200000-0000-0000-0000-000000000002'
      and result_version_id = beta_v2 and finish_position = 2 and awarded_points = 18
  ) then
    raise exception 'stale event delivery did not converge to the explicit current result pointer';
  end if;

  select * into delivery from private.claim_domain_event('career', 'phase8-career-worker');
  perform private.process_career_event(delivery.processing_id, 'phase8-career-worker');

  if (select count(*) from public.career_result_facts where race_id = '82200000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'repeated Career reconciliation double-counted one race';
  end if;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"career-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.career_result_facts) <> 3 then
    raise exception 'driver cannot read own cross-league Career history';
  end if;
  if not exists (
    select 1 from public.driver_career_stats
    where starts = 2 and classified_finishes = 1 and podiums = 1
      and dns = 1 and dsqs = 1 and total_points = 18 and leagues_competed = 2
  ) then
    raise exception 'driver cannot read own global Career aggregate';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.career_result_facts) <> 2 then
    raise exception 'league admin Career facts escaped requested league scope';
  end if;
  if exists (select 1 from public.driver_career_stats) then
    raise exception 'league admin could read another driver global Career aggregate';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.career_result_facts)
     or exists (select 1 from public.driver_career_stats) then
    raise exception 'unrelated user could read another global Career';
  end if;
end;
$$;

reset role;
rollback;
