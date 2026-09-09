-- Staging-only synthetic publication/settlement regression. Everything rolls back.
begin;
select pg_advisory_xact_lock(hashtextextended('racevora-active-challenge-limit',0));
update private.domain_event_processing set status='succeeded', locked_by=null, locked_at=null,
 processed_at=coalesce(processed_at,now()) where status in ('pending','processing','failed');
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
  ('c1200000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000001', 31, 'Challenge One', '2026-08-20'),
  ('c1200000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000001', 32, 'Challenge Two', '2026-08-21'),
  ('c1200000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000001', 33, 'Challenge Three', '2026-08-22'),
  ('c1200000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000001', 34, 'Challenge Four', '2026-08-23'),
  ('c1200000-0000-0000-0000-000000000005', 'c1100000-0000-0000-0000-000000000001', 35, 'Historical Challenge Exclusion', '2026-01-01');

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
  version_id uuid;
  delivery record;
  identity_id uuid := 'c0100000-0000-0000-0000-000000000001';
  net bigint;
begin
  if (select count(*) from public.challenge_definitions where is_active and active_from<=now() and active_until>now())<>3 then
    raise exception 'expected three current challenges';
  end if;
  if has_function_privilege('authenticated','private.maintain_weekly_challenges()','execute')
    or has_function_privilege('anon','private.settle_weekly_challenge(uuid,text)','execute') then
    raise exception 'browser can settle rewards';
  end if;
  version_id := private.create_result_version('c1200000-0000-0000-0000-000000000001','Weekly challenge regression');
  insert into public.result_version_rows (
    result_version_id,row_order,driver_id,grid_position,finish_position,fastest_lap_time_ms,
    participation_status,classification_status,awarded_points,points
  ) values
    (version_id,1,'c1300000-0000-0000-0000-000000000001',1,1,90000,'PLAYER','classified',25,25),
    (version_id,2,'c1300000-0000-0000-0000-000000000003',2,2,91000,'BOT','classified',18,18);
  perform private.validate_result_version(version_id);
  perform private.activate_result_version(version_id);
  loop
    select * into delivery from private.claim_domain_event('challenges','weekly-regression');
    exit when delivery.processing_id is null;
    perform private.process_challenge_event(delivery.processing_id,'weekly-regression');
    perform private.process_challenge_event(delivery.processing_id,'weekly-regression');
  end loop;
  if (select count(*) from public.driver_challenges where driver_identity_id=identity_id and status='completed')<>3 then
    raise exception 'publication did not complete three tasks';
  end if;
  if exists(select 1 from public.credit_ledger where driver_identity_id=identity_id and entry_type='challenge_reward') then
    raise exception 'early reward before expiry';
  end if;
  if exists(select 1 from public.driver_challenges where driver_identity_id='c0100000-0000-0000-0000-000000000002') then
    raise exception 'BOT received challenge progress';
  end if;

  -- Move only this transaction's catalogue deadline; rollback restores real times.
  update public.challenge_definitions set active_until=now()
  where rule_version=2 and active_from<now() and active_until>now();
  perform private.maintain_weekly_challenges();
  perform private.maintain_weekly_challenges();
  select coalesce(sum(amount),0) into net from public.credit_ledger
    where driver_identity_id=identity_id and entry_type in ('challenge_reward','challenge_reversal');
  if net<>500 or (select count(*) from public.credit_ledger where driver_identity_id=identity_id and entry_type='challenge_reward')<>3 then
    raise exception 'settlement not exactly once: %',net;
  end if;
  perform private.void_current_result_version('c1200000-0000-0000-0000-000000000001','Weekly correction regression');
  loop
    select * into delivery from private.claim_domain_event('challenges','weekly-regression');
    exit when delivery.processing_id is null;
    perform private.process_challenge_event(delivery.processing_id,'weekly-regression');
  end loop;
  perform private.maintain_weekly_challenges();
  select coalesce(sum(amount),0) into net from public.credit_ledger
    where driver_identity_id=identity_id and entry_type in ('challenge_reward','challenge_reversal');
  if net<>0 then raise exception 'correction did not reverse paid rewards: %',net; end if;

  -- Simulate a missed week, not a backdated race. Generate exactly three successors.
  update public.challenge_definitions set is_active=false where rule_version=2;
  update private.challenge_rotation_state set anchor_at=anchor_at-interval '28 days';
  perform private.maintain_weekly_challenges();
  perform private.maintain_weekly_challenges();
  if (select count(*) from public.challenge_definitions where is_active and active_from<=now() and active_until>now())<>3 then
    raise exception 'rotation did not recover with three tasks';
  end if;
end;
$$;
select 'weekly rotation, no early payout, completed-only, no BOT, idempotency, correction and recovery passed' as result;
rollback;
