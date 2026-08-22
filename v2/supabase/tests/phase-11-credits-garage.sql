-- RaceVora V2 Phase 11 Credit ledger, reward correction, atomic purchase, idempotency, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if (select count(*) from public.cosmetic_definitions) <> 10 then
    raise exception 'Garage catalog baseline is incomplete';
  end if;
  if has_table_privilege('anon', 'public.credit_ledger', 'select')
     or has_table_privilege('anon', 'public.cosmetic_definitions', 'select')
     or has_table_privilege('authenticated', 'public.credit_ledger', 'insert')
     or has_table_privilege('authenticated', 'public.driver_wallets', 'update')
     or has_table_privilege('authenticated', 'public.driver_cosmetics', 'insert') then
    raise exception 'Credit or Garage browser privileges violate least privilege';
  end if;
  if has_table_privilege('service_role', 'public.credit_ledger', 'update')
     or has_table_privilege('service_role', 'public.credit_ledger', 'delete') then
    raise exception 'Credit ledger is not append-only at the grant layer';
  end if;
  if not has_function_privilege('authenticated', 'public.purchase_cosmetic(text,text)', 'execute')
     or has_function_privilege('anon', 'public.purchase_cosmetic(text,text)', 'execute') then
    raise exception 'Cosmetic purchase RPC exposure is incorrect';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'garage-driver@example.invalid', '{}', '{}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'garage-admin@example.invalid', '{}', '{}', now(), now()),
  ('b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'garage-other@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('b0100000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('b0100000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
  ('b0100000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values ('b1000000-0000-0000-0000-000000000001', 'Garage Alpha', 'garage-alpha', true, '{"published":true}');

insert into public.league_members (league_id, user_id, role)
values ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'league_admin');

insert into public.domain_events (
  id, event_type, aggregate_type, aggregate_id, league_id,
  payload, idempotency_key, occurred_at
)
values
  ('b2000000-0000-0000-0000-000000000001', 'result.published', 'result_version', 'b2100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '{}', 'phase11-achievement-source-one', now()),
  ('b2000000-0000-0000-0000-000000000002', 'result.revised', 'result_version', 'b2100000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', '{}', 'phase11-achievement-source-two', now()),
  ('b2000000-0000-0000-0000-000000000003', 'result.published', 'result_version', 'b2100000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', '{}', 'phase11-achievement-source-three', now()),
  ('b2000000-0000-0000-0000-000000000004', 'result.published', 'result_version', 'b2100000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', '{}', 'phase11-historical-source', now());

do $$
begin
  if not exists (
    select 1 from public.driver_wallets
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
      and balance = 500 and lifetime_earned = 500 and lifetime_spent = 0
  ) then
    raise exception 'agreed V2 Welcome Reward was not granted once';
  end if;

  insert into public.driver_achievement_events (
    driver_identity_id, achievement_code, event_type, source_event_id,
    observed_value, threshold_snapshot, reward_vc_snapshot, credit_eligible,
    rule_version, idempotency_key, occurred_at
  ) values (
    'b0100000-0000-0000-0000-000000000001', 'wins_1', 'unlocked',
    'b2000000-0000-0000-0000-000000000001',
    1, 1, 50, true, 1, 'phase11-achievement-unlock-one', now()
  );

  if (select balance from public.driver_wallets where driver_identity_id = 'b0100000-0000-0000-0000-000000000001') <> 550 then
    raise exception 'Achievement unlock did not append its Credit reward';
  end if;

  insert into public.driver_achievement_events (
    driver_identity_id, achievement_code, event_type, source_event_id,
    observed_value, threshold_snapshot, reward_vc_snapshot, credit_eligible,
    rule_version, idempotency_key, occurred_at
  ) values (
    'b0100000-0000-0000-0000-000000000001', 'wins_1', 'revoked',
    'b2000000-0000-0000-0000-000000000002',
    0, 1, 50, true, 1, 'phase11-achievement-revoke-one', now()
  );

  if (select balance from public.driver_wallets where driver_identity_id = 'b0100000-0000-0000-0000-000000000001') <> 500 then
    raise exception 'Achievement revoke did not append a signed Credit correction';
  end if;

  insert into public.driver_achievement_events (
    driver_identity_id, achievement_code, event_type, source_event_id,
    observed_value, threshold_snapshot, reward_vc_snapshot, credit_eligible,
    rule_version, idempotency_key, occurred_at
  ) values (
    'b0100000-0000-0000-0000-000000000001', 'wins_1', 'unlocked',
    'b2000000-0000-0000-0000-000000000003',
    1, 1, 50, true, 1, 'phase11-achievement-unlock-two', now()
  );

  insert into public.driver_achievement_events (
    driver_identity_id, achievement_code, event_type, source_event_id,
    observed_value, threshold_snapshot, reward_vc_snapshot, credit_eligible,
    rule_version, idempotency_key, occurred_at
  ) values (
    'b0100000-0000-0000-0000-000000000001', 'podiums_1', 'unlocked',
    'b2000000-0000-0000-0000-000000000004',
    1, 1, 50, false, 1, 'phase11-historical-achievement', now()
  );

  if (select balance from public.driver_wallets where driver_identity_id = 'b0100000-0000-0000-0000-000000000001') <> 550 then
    raise exception 'historical Achievement incorrectly generated retroactive VC';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  first_purchase record;
  repeated_purchase record;
begin
  select * into first_purchase
  from public.purchase_cosmetic('title_clean_racer', 'phase11-purchase-0001');

  if first_purchase.purchase_status <> 'completed'
     or first_purchase.amount_spent <> 150
     or first_purchase.balance_after <> 400 then
    raise exception 'atomic cosmetic purchase returned incorrect evidence';
  end if;

  select * into repeated_purchase
  from public.purchase_cosmetic('title_clean_racer', 'phase11-purchase-0001');

  if repeated_purchase.purchase_id <> first_purchase.purchase_id
     or repeated_purchase.balance_after <> 400 then
    raise exception 'repeated purchase idempotency key charged twice';
  end if;

  begin
    perform public.purchase_cosmetic('frame_apex_violet', 'phase11-purchase-0001');
    raise exception 'purchase idempotency key was reused for another cosmetic';
  exception when unique_violation then null;
  end;

  begin
    perform public.purchase_cosmetic('card_immortal', 'phase11-purchase-0002');
    raise exception 'insufficient balance purchase succeeded';
  exception when check_violation then null;
  end;

  if (select count(*) from public.cosmetic_purchases) <> 1
     or (select count(*) from public.driver_cosmetics) <> 1
     or (select count(*) from public.credit_ledger) <> 5 then
    raise exception 'double click or failed purchase left duplicate Garage state';
  end if;
  if not exists (
    select 1 from public.driver_wallets
    where balance = 400 and lifetime_earned = 600 and lifetime_spent = 200
  ) then
    raise exception 'wallet projection no longer equals the signed Credit ledger';
  end if;
end;
$$;

reset role;

do $$
begin
  begin
    update public.credit_ledger
    set amount = 999
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001';
    raise exception 'Credit ledger accepted an update';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.driver_wallets
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.credit_ledger
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Ligaleitung could read another global Driver wallet';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.cosmetic_purchases
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
  ) or exists (
    select 1 from public.driver_cosmetics
    where driver_identity_id = 'b0100000-0000-0000-0000-000000000001'
  ) then
    raise exception 'unrelated user could read another Driver Garage';
  end if;
end;
$$;

reset role;
rollback;
