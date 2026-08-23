-- RaceVora V2 Phase 11: append-only Vora Credits and cosmetic-only Garage.
-- Additive staging migration. Never execute against V1 Production.

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete restrict,
  source_event_id uuid references public.domain_events(id) on delete restrict,
  league_id uuid references public.leagues(id) on delete restrict,
  entry_type text not null,
  reason_code text not null,
  amount integer not null,
  source_scope text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint credit_ledger_entry_type_check check (
    entry_type in (
      'welcome_reward', 'achievement_reward', 'achievement_reversal',
      'challenge_reward', 'challenge_reversal', 'cosmetic_purchase',
      'manual_adjustment'
    )
  ),
  constraint credit_ledger_reason_code_format_check check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint credit_ledger_amount_nonzero_check check (amount <> 0),
  constraint credit_ledger_source_scope_length_check check (char_length(source_scope) between 5 and 180),
  constraint credit_ledger_idempotency_key_unique unique (idempotency_key),
  constraint credit_ledger_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index idx_credit_ledger_identity_recorded
  on public.credit_ledger (driver_identity_id, recorded_at desc);
create index idx_credit_ledger_identity_scope
  on public.credit_ledger (driver_identity_id, source_scope);
create index idx_credit_ledger_source_event
  on public.credit_ledger (source_event_id)
  where source_event_id is not null;
create index idx_credit_ledger_league
  on public.credit_ledger (league_id)
  where league_id is not null;

create table public.driver_wallets (
  driver_identity_id uuid primary key references public.driver_identities(id) on delete cascade,
  balance bigint not null default 0,
  lifetime_earned bigint not null default 0,
  lifetime_spent bigint not null default 0,
  last_ledger_entry_id uuid references public.credit_ledger(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint driver_wallets_lifetime_earned_nonnegative_check check (lifetime_earned >= 0),
  constraint driver_wallets_lifetime_spent_nonnegative_check check (lifetime_spent >= 0),
  constraint driver_wallets_balance_equation_check check (
    balance = lifetime_earned - lifetime_spent
  )
);

create index idx_driver_wallets_last_ledger
  on public.driver_wallets (last_ledger_entry_id)
  where last_ledger_entry_id is not null;

create table public.cosmetic_definitions (
  code text primary key,
  category text not null,
  title_key text not null,
  description_key text not null,
  price_vc integer not null,
  sort_order integer not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cosmetic_definitions_code_format_check check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint cosmetic_definitions_category_check check (
    category in ('frames', 'banners', 'titles', 'effects', 'cards')
  ),
  constraint cosmetic_definitions_price_positive_check check (price_vc > 0),
  constraint cosmetic_definitions_sort_order_positive_check check (sort_order > 0),
  constraint cosmetic_definitions_sort_order_unique unique (sort_order),
  constraint cosmetic_definitions_title_key_format_check check (title_key ~ '^cosmetic\.[a-z0-9_.]+$'),
  constraint cosmetic_definitions_description_key_format_check check (description_key ~ '^cosmetic\.[a-z0-9_.]+$'),
  constraint cosmetic_definitions_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

insert into public.cosmetic_definitions (
  code, category, title_key, description_key, price_vc, sort_order
) values
  ('frame_apex_violet', 'frames', 'cosmetic.item.title', 'cosmetic.item.description', 250, 1),
  ('frame_grid_teal', 'frames', 'cosmetic.item.title', 'cosmetic.item.description', 400, 2),
  ('banner_night_circuit', 'banners', 'cosmetic.item.title', 'cosmetic.item.description', 300, 3),
  ('banner_podium_lights', 'banners', 'cosmetic.item.title', 'cosmetic.item.description', 500, 4),
  ('title_clean_racer', 'titles', 'cosmetic.item.title', 'cosmetic.item.description', 150, 5),
  ('title_racecraft', 'titles', 'cosmetic.item.title', 'cosmetic.item.description', 350, 6),
  ('effect_purple_wake', 'effects', 'cosmetic.item.title', 'cosmetic.item.description', 650, 7),
  ('effect_teal_pulse', 'effects', 'cosmetic.item.title', 'cosmetic.item.description', 800, 8),
  ('card_carbon', 'cards', 'cosmetic.item.title', 'cosmetic.item.description', 700, 9),
  ('card_immortal', 'cards', 'cosmetic.item.title', 'cosmetic.item.description', 1200, 10);

create table public.cosmetic_purchases (
  id uuid primary key default gen_random_uuid(),
  driver_identity_id uuid not null references public.driver_identities(id) on delete restrict,
  cosmetic_code text not null references public.cosmetic_definitions(code) on delete restrict,
  price_vc_snapshot integer not null,
  idempotency_key text not null,
  status text not null default 'pending',
  ledger_entry_id uuid references public.credit_ledger(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint cosmetic_purchases_price_positive_check check (price_vc_snapshot > 0),
  constraint cosmetic_purchases_idempotency_key_length_check
    check (char_length(idempotency_key) between 12 and 180),
  constraint cosmetic_purchases_identity_idempotency_unique
    unique (driver_identity_id, idempotency_key),
  constraint cosmetic_purchases_status_check check (status in ('pending', 'completed')),
  constraint cosmetic_purchases_completed_state_check check (
    (status = 'pending' and completed_at is null and ledger_entry_id is null)
    or (status = 'completed' and completed_at is not null and ledger_entry_id is not null)
  )
);

create index idx_cosmetic_purchases_identity_created
  on public.cosmetic_purchases (driver_identity_id, created_at desc);
create index idx_cosmetic_purchases_ledger
  on public.cosmetic_purchases (ledger_entry_id)
  where ledger_entry_id is not null;

create table public.driver_cosmetics (
  driver_identity_id uuid not null references public.driver_identities(id) on delete cascade,
  cosmetic_code text not null references public.cosmetic_definitions(code) on delete restrict,
  acquisition_type text not null,
  purchase_id uuid references public.cosmetic_purchases(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  primary key (driver_identity_id, cosmetic_code),
  constraint driver_cosmetics_acquisition_type_check check (
    acquisition_type in ('purchase', 'achievement', 'challenge', 'welcome', 'manual')
  ),
  constraint driver_cosmetics_purchase_evidence_check check (
    (acquisition_type = 'purchase' and purchase_id is not null)
    or (acquisition_type <> 'purchase')
  )
);

create index idx_driver_cosmetics_identity_acquired
  on public.driver_cosmetics (driver_identity_id, acquired_at desc);

create or replace function private.protect_credit_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'Credit ledger entries are immutable; corrections require a new ledger entry.';
end;
$$;

revoke all on function private.protect_credit_ledger()
  from public, anon, authenticated, service_role;

create trigger credit_ledger_protect_history
before update or delete on public.credit_ledger
for each row execute function private.protect_credit_ledger();

create or replace function private.rebuild_driver_wallet(p_driver_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_total bigint;
  earned_total bigint;
  spent_total bigint;
  latest_entry_id uuid;
begin
  select
    coalesce(sum(cl.amount), 0),
    coalesce(sum(cl.amount) filter (where cl.amount > 0), 0),
    coalesce(-sum(cl.amount) filter (where cl.amount < 0), 0),
    (
      select cl2.id
      from public.credit_ledger cl2
      where cl2.driver_identity_id = p_driver_identity_id
      order by cl2.recorded_at desc, cl2.id desc
      limit 1
    )
  into ledger_total, earned_total, spent_total, latest_entry_id
  from public.credit_ledger cl
  where cl.driver_identity_id = p_driver_identity_id;

  insert into public.driver_wallets (
    driver_identity_id, balance, lifetime_earned, lifetime_spent,
    last_ledger_entry_id, updated_at
  ) values (
    p_driver_identity_id, ledger_total, earned_total, spent_total,
    latest_entry_id, now()
  )
  on conflict (driver_identity_id) do update
  set balance = excluded.balance,
      lifetime_earned = excluded.lifetime_earned,
      lifetime_spent = excluded.lifetime_spent,
      last_ledger_entry_id = excluded.last_ledger_entry_id,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function private.rebuild_driver_wallet(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.grant_welcome_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and new.status = 'active' then
    insert into public.credit_ledger (
      driver_identity_id, entry_type, reason_code, amount, source_scope,
      idempotency_key, metadata, occurred_at
    ) values (
      new.id, 'welcome_reward', 'v2_welcome_reward', 500,
      format('welcome:%s', new.id),
      format('credit:welcome:%s', new.id),
      jsonb_build_object('reward_version', 1),
      new.created_at
    )
    on conflict (idempotency_key) do nothing;

    perform private.rebuild_driver_wallet(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.grant_welcome_credit()
  from public, anon, authenticated, service_role;

create trigger driver_identities_grant_welcome_credit
after insert on public.driver_identities
for each row execute function private.grant_welcome_credit();

create or replace function private.credit_achievement_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  outstanding_reward bigint;
  credit_delta integer;
begin
  if not new.credit_eligible or new.reward_vc_snapshot <= 0 then
    return new;
  end if;

  select coalesce(sum(cl.amount), 0)
  into outstanding_reward
  from public.credit_ledger cl
  where cl.driver_identity_id = new.driver_identity_id
    and cl.source_scope = format('achievement:%s', new.achievement_code)
    and cl.entry_type in ('achievement_reward', 'achievement_reversal');

  if new.event_type = 'unlocked' and outstanding_reward <= 0 then
    credit_delta := new.reward_vc_snapshot;
  elsif new.event_type = 'revoked' and outstanding_reward > 0 then
    credit_delta := -least(outstanding_reward, new.reward_vc_snapshot)::integer;
  else
    return new;
  end if;

  insert into public.credit_ledger (
    driver_identity_id, source_event_id, entry_type, reason_code, amount,
    source_scope, idempotency_key, metadata, occurred_at
  ) values (
    new.driver_identity_id, new.source_event_id,
    case when credit_delta > 0 then 'achievement_reward' else 'achievement_reversal' end,
    case when credit_delta > 0 then 'achievement_unlocked' else 'achievement_revoked' end,
    credit_delta,
    format('achievement:%s', new.achievement_code),
    format('credit:achievement-event:%s', new.id),
    jsonb_build_object(
      'achievement_code', new.achievement_code,
      'achievement_event_id', new.id,
      'rule_version', new.rule_version
    ),
    new.occurred_at
  )
  on conflict (idempotency_key) do nothing;

  perform private.rebuild_driver_wallet(new.driver_identity_id);
  return new;
end;
$$;

revoke all on function private.credit_achievement_event()
  from public, anon, authenticated, service_role;

create trigger driver_achievement_events_credit_reward
after insert on public.driver_achievement_events
for each row execute function private.credit_achievement_event();

create or replace function public.purchase_cosmetic(
  p_cosmetic_code text,
  p_idempotency_key text
)
returns table (
  purchase_id uuid,
  purchased_cosmetic_code text,
  amount_spent integer,
  balance_after bigint,
  purchase_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid;
  identity_record public.driver_identities%rowtype;
  cosmetic_record public.cosmetic_definitions%rowtype;
  existing_purchase public.cosmetic_purchases%rowtype;
  target_purchase_id uuid;
  target_ledger_id uuid;
  wallet_balance bigint;
begin
  actor_user_id := auth.uid();
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required to purchase a cosmetic.';
  end if;
  if p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 12 and 180 then
    raise exception using errcode = '22023', message = 'A purchase idempotency key between 12 and 180 characters is required.';
  end if;

  select * into identity_record
  from public.driver_identities di
  where di.user_id = actor_user_id
    and di.status = 'active'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'An active registered Driver Identity is required.';
  end if;

  select * into existing_purchase
  from public.cosmetic_purchases cp
  where cp.driver_identity_id = identity_record.id
    and cp.idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if existing_purchase.cosmetic_code <> p_cosmetic_code then
      raise exception using errcode = '23505', message = 'Purchase idempotency key was reused for another cosmetic.';
    end if;

    select dw.balance into wallet_balance
    from public.driver_wallets dw
    where dw.driver_identity_id = identity_record.id;

    return query
    select existing_purchase.id, existing_purchase.cosmetic_code,
           existing_purchase.price_vc_snapshot, wallet_balance,
           existing_purchase.status;
    return;
  end if;

  select * into cosmetic_record
  from public.cosmetic_definitions cd
  where cd.code = p_cosmetic_code
    and cd.is_active
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active cosmetic not found.';
  end if;

  perform private.rebuild_driver_wallet(identity_record.id);
  select dw.balance into wallet_balance
  from public.driver_wallets dw
  where dw.driver_identity_id = identity_record.id
  for update;

  if exists (
    select 1
    from public.driver_cosmetics dc
    where dc.driver_identity_id = identity_record.id
      and dc.cosmetic_code = cosmetic_record.code
  ) then
    raise exception using errcode = '23505', message = 'Cosmetic is already owned.';
  end if;
  if wallet_balance < cosmetic_record.price_vc then
    raise exception using errcode = '23514', message = 'Insufficient Vora Credits.';
  end if;

  insert into public.cosmetic_purchases (
    driver_identity_id, cosmetic_code, price_vc_snapshot, idempotency_key
  ) values (
    identity_record.id, cosmetic_record.code, cosmetic_record.price_vc,
    btrim(p_idempotency_key)
  )
  returning id into target_purchase_id;

  insert into public.credit_ledger (
    driver_identity_id, entry_type, reason_code, amount, source_scope,
    idempotency_key, metadata, occurred_at
  ) values (
    identity_record.id, 'cosmetic_purchase', 'garage_cosmetic_purchase',
    -cosmetic_record.price_vc,
    format('purchase:%s', target_purchase_id),
    format('credit:purchase:%s', target_purchase_id),
    jsonb_build_object(
      'purchase_id', target_purchase_id,
      'cosmetic_code', cosmetic_record.code,
      'price_vc', cosmetic_record.price_vc
    ),
    now()
  )
  returning id into target_ledger_id;

  insert into public.driver_cosmetics (
    driver_identity_id, cosmetic_code, acquisition_type, purchase_id
  ) values (
    identity_record.id, cosmetic_record.code, 'purchase', target_purchase_id
  );

  update public.cosmetic_purchases
  set status = 'completed',
      ledger_entry_id = target_ledger_id,
      completed_at = now()
  where id = target_purchase_id;

  perform private.rebuild_driver_wallet(identity_record.id);

  select dw.balance into wallet_balance
  from public.driver_wallets dw
  where dw.driver_identity_id = identity_record.id;

  return query
  select target_purchase_id, cosmetic_record.code, cosmetic_record.price_vc,
         wallet_balance, 'completed'::text;
end;
$$;

revoke all on function public.purchase_cosmetic(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.purchase_cosmetic(text, text)
  to authenticated;

alter table public.credit_ledger enable row level security;
alter table public.driver_wallets enable row level security;
alter table public.cosmetic_definitions enable row level security;
alter table public.cosmetic_purchases enable row level security;
alter table public.driver_cosmetics enable row level security;

revoke all on table public.credit_ledger from public, anon, authenticated;
revoke all on table public.driver_wallets from public, anon, authenticated;
revoke all on table public.cosmetic_definitions from public, anon, authenticated;
revoke all on table public.cosmetic_purchases from public, anon, authenticated;
revoke all on table public.driver_cosmetics from public, anon, authenticated;

grant select on table public.credit_ledger to authenticated;
grant select on table public.driver_wallets to authenticated;
grant select on table public.cosmetic_definitions to authenticated;
grant select on table public.cosmetic_purchases to authenticated;
grant select on table public.driver_cosmetics to authenticated;

grant select, insert on table public.credit_ledger to service_role;
grant select, insert, update, delete on table public.driver_wallets to service_role;
grant select, insert, update on table public.cosmetic_definitions to service_role;
grant select, insert, update, delete on table public.cosmetic_purchases to service_role;
grant select, insert, update, delete on table public.driver_cosmetics to service_role;

create policy "users read own Credit ledger"
on public.credit_ledger
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "users read own Vora wallet"
on public.driver_wallets
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "registered users read active cosmetics"
on public.cosmetic_definitions
for select
to authenticated
using (is_active);

create policy "users read own cosmetic purchases"
on public.cosmetic_purchases
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

create policy "users read own cosmetics"
on public.driver_cosmetics
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1 from public.driver_identities di
    where di.id = driver_identity_id
      and di.user_id = (select auth.uid())
  )
);

comment on table public.credit_ledger is
  'Append-only source of truth for Vora Credits; signed corrections preserve history.';
comment on table public.driver_wallets is
  'Rebuildable Credit projection; purchase eligibility uses the locked ledger-derived balance.';
comment on table public.cosmetic_definitions is
  'Cosmetic-only Garage catalog without XP, performance boosts, lootboxes, or pay-to-win.';
comment on function public.purchase_cosmetic(text, text) is
  'Actor-bound atomic purchase: locked balance debit and cosmetic ownership commit together or not at all.';
