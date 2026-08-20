-- Phase 16 stewarding lifecycle, tenant isolation, immutable history, appeal, and result revision regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.steward_cases', 'insert')
     or has_table_privilege('authenticated', 'public.steward_votes', 'update')
     or has_table_privilege('authenticated', 'public.steward_decision_versions', 'delete') then
    raise exception 'browser roles can mutate steward history directly';
  end if;
  if has_function_privilege('anon', 'public.finalize_steward_decision(uuid,text,text,text,text,jsonb,text)', 'execute') then
    raise exception 'anonymous users can finalize steward decisions';
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1600000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'steward-one@example.invalid', '{}', '{}', now(), now()),
  ('f1600000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'steward-two@example.invalid', '{}', '{}', now(), now()),
  ('f1600000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'driver@example.invalid', '{}', '{}', now(), now()),
  ('f1600000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other-admin@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id) values
  ('f1610000-0000-0000-0000-000000000001', 'f1600000-0000-0000-0000-000000000001'),
  ('f1610000-0000-0000-0000-000000000002', 'f1600000-0000-0000-0000-000000000002'),
  ('f1610000-0000-0000-0000-000000000003', 'f1600000-0000-0000-0000-000000000003'),
  ('f1610000-0000-0000-0000-000000000004', 'f1600000-0000-0000-0000-000000000004');

insert into public.leagues (id, name, slug, is_public, settings) values
  ('f1620000-0000-0000-0000-000000000001', 'Steward Alpha', 'steward-alpha', true, '{"published":true}'),
  ('f1620000-0000-0000-0000-000000000002', 'Steward Beta', 'steward-beta', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role) values
  ('f1620000-0000-0000-0000-000000000001', 'f1600000-0000-0000-0000-000000000001', 'steward'),
  ('f1620000-0000-0000-0000-000000000001', 'f1600000-0000-0000-0000-000000000002', 'steward'),
  ('f1620000-0000-0000-0000-000000000001', 'f1600000-0000-0000-0000-000000000003', 'driver'),
  ('f1620000-0000-0000-0000-000000000002', 'f1600000-0000-0000-0000-000000000004', 'league_admin');

insert into public.seasons (id, league_id, slug, name) values
  ('f1630000-0000-0000-0000-000000000001', 'f1620000-0000-0000-0000-000000000001', 'alpha-season', 'Alpha Season'),
  ('f1630000-0000-0000-0000-000000000002', 'f1620000-0000-0000-0000-000000000002', 'beta-season', 'Beta Season');
insert into public.races (id, season_id, round_number, grand_prix_name, race_date) values
  ('f1640000-0000-0000-0000-000000000001', 'f1630000-0000-0000-0000-000000000001', 1, 'Alpha GP', current_date),
  ('f1640000-0000-0000-0000-000000000002', 'f1630000-0000-0000-0000-000000000002', 1, 'Beta GP', current_date);
insert into public.drivers (id, league_id, display_name) values
  ('f1650000-0000-0000-0000-000000000001', 'f1620000-0000-0000-0000-000000000001', 'Accused Driver'),
  ('f1650000-0000-0000-0000-000000000002', 'f1620000-0000-0000-0000-000000000001', 'Reporting Driver'),
  ('f1650000-0000-0000-0000-000000000003', 'f1620000-0000-0000-0000-000000000002', 'Other Driver');

insert into public.driver_claims (id, driver_id, claimant_user_id, verification_method, status, resolved_at, resolved_by)
values ('f1660000-0000-0000-0000-000000000001', 'f1650000-0000-0000-0000-000000000001', 'f1600000-0000-0000-0000-000000000003', 'admin_verified', 'verified', now(), 'f1600000-0000-0000-0000-000000000001');
insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values ('f1670000-0000-0000-0000-000000000001', 'f1610000-0000-0000-0000-000000000003', 'f1650000-0000-0000-0000-000000000001', 'f1660000-0000-0000-0000-000000000001');

do $$
declare version_id uuid;
begin
  version_id := private.create_result_version('f1640000-0000-0000-0000-000000000001', 'Initial official steward test result');
  insert into public.result_version_rows (result_version_id, row_order, driver_id, finish_position, race_time_ms, awarded_points, points)
  values
    (version_id, 1, 'f1650000-0000-0000-0000-000000000001', 1, 100000, 25, 25),
    (version_id, 2, 'f1650000-0000-0000-0000-000000000002', 2, 103000, 18, 18);
  perform private.validate_result_version(version_id);
  perform private.activate_result_version(version_id);
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"steward-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"f1600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare response jsonb;
begin
  response := public.create_steward_case(
    'f1640000-0000-0000-0000-000000000001', 'f1650000-0000-0000-0000-000000000002',
    'f1650000-0000-0000-0000-000000000001', 'Unsafe return to the circuit',
    'The accused driver returned to the racing line without sufficient control.', 'SC-4.1', '2026.1', 'phase16-create-alpha'
  );
  if response ->> 'case_number' <> 'RV-2026-0001' then raise exception 'RaceVora case number was not generated deterministically'; end if;
  perform public.add_steward_evidence((response ->> 'id')::uuid, 'video', 'https://example.invalid/evidence', 'Public onboard evidence', true, 'phase16-evidence-public');
  perform public.add_steward_evidence((response ->> 'id')::uuid, 'telemetry', null, 'Private telemetry evidence', false, 'phase16-evidence-private');
  perform public.cast_steward_vote((response ->> 'id')::uuid, 'penalty', 'The public and private evidence supports a time penalty.', false, 'phase16-vote-one');
end;
$$;

reset role;
select set_config('request.headers', '{"x-rcc-league-slug":"steward-beta"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.create_steward_case('f1640000-0000-0000-0000-000000000001', null, 'f1650000-0000-0000-0000-000000000001', 'Cross tenant case', 'This case must never be accepted across tenants.', 'SC-4.1', '2026.1', 'phase16-cross-tenant');
    raise exception 'steward created a case through a manipulated tenant header';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.headers', '{"x-rcc-league-slug":"steward-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"f1600000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.cast_steward_vote((select id from public.steward_cases where case_number = 'RV-2026-0001'), 'penalty', 'Independent review confirms the incident and penalty.', false, 'phase16-vote-two');
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"f1600000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare case_id uuid; previous_result uuid; response jsonb;
begin
  select id into case_id from public.steward_cases where case_number = 'RV-2026-0001';
  select current_result_version_id into previous_result from public.races where id = 'f1640000-0000-0000-0000-000000000001';
  response := public.finalize_steward_decision(
    case_id, 'penalty', 'Both steward votes and the recorded evidence support a five-second penalty.',
    'SC-4.1', '2026.1',
    '[{"driver_id":"f1650000-0000-0000-0000-000000000001","penalty_type":"time_penalty","time_delta_ms":5000,"reason":"Unsafe return"}]',
    'phase16-finalize-one'
  );
  if (select status from public.steward_cases where id = case_id) <> 'closed' then raise exception 'final decision did not close the case'; end if;
  if (select status from public.result_versions where id = previous_result) <> 'superseded' then raise exception 'prior official result was not superseded'; end if;
  if (select penalty_time_delta_ms from public.race_results where race_id = 'f1640000-0000-0000-0000-000000000001' and driver_id = 'f1650000-0000-0000-0000-000000000001') <> 5000 then raise exception 'structured penalty did not reach the official result projection'; end if;
  if (select finish_position from public.race_results where race_id = 'f1640000-0000-0000-0000-000000000001' and driver_id = 'f1650000-0000-0000-0000-000000000001') <> 2 then raise exception 'time penalty did not recalculate finishing order'; end if;
  if not exists (select 1 from public.domain_events where aggregate_id = case_id and event_type = 'steward.decision_finalized') then raise exception 'steward finalization event was not emitted'; end if;
  if response ->> 'result_version_id' is null then raise exception 'finalization did not return the result revision'; end if;
end;
$$;

do $$
begin
  begin
    update public.steward_votes set reasoning = 'rewritten' where id = (select id from public.steward_votes limit 1);
    raise exception 'steward vote history was rewritten';
  exception when check_violation or insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"f1600000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare response jsonb;
begin
  response := public.submit_steward_appeal((select id from public.steward_cases where case_number = 'RV-2026-0001'), 'The involved driver requests review of the penalty evidence.', 'phase16-driver-appeal');
  if response ->> 'status' <> 'submitted' then raise exception 'involved driver appeal was not accepted'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  if (select count(*) from public.steward_cases) <> 1 then raise exception 'public closed case is not visible in the requested league'; end if;
  if (select count(*) from public.steward_evidence) <> 1 then raise exception 'private evidence leaked or public evidence is hidden'; end if;
  if (select count(*) from public.steward_decision_versions) <> 1 then raise exception 'public finalized decision is not visible'; end if;
end;
$$;
reset role;

rollback;
