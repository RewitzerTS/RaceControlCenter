-- RaceVora contract confirmation receipts
-- Server-only evidence that the registration contract confirmation was sent on a durable medium.
-- This migration is additive and does not modify existing league, race, season or RCC production data.

create table if not exists public.contract_confirmations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null,
  league_id uuid references public.leagues(id) on delete set null,
  account_email text not null,
  league_name text not null,
  league_slug text not null,
  price_cents integer not null default 0,
  currency text not null default 'EUR',
  contract_version text not null,
  terms_version text not null,
  withdrawal_version text not null,
  contract_started_at timestamptz not null,
  status text not null default 'pending',
  confirmation_sent_at timestamptz,
  confirmation_provider_id text,
  send_attempts integer not null default 0,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_confirmations_account_email_len check (char_length(account_email) between 5 and 320),
  constraint contract_confirmations_league_name_len check (char_length(league_name) between 3 and 80),
  constraint contract_confirmations_league_slug_len check (char_length(league_slug) between 3 and 50),
  constraint contract_confirmations_price_nonnegative check (price_cents >= 0),
  constraint contract_confirmations_currency_len check (char_length(currency) = 3),
  constraint contract_confirmations_status_check check (status in ('pending', 'sent', 'failed')),
  constraint contract_confirmations_attempts_nonnegative check (send_attempts >= 0),
  constraint contract_confirmations_user_league_contract_unique unique (user_id, league_id, contract_version)
);

alter table public.contract_confirmations enable row level security;

-- Deliberately no client policies. Contract receipts are legal/audit evidence and are
-- written/read only by the authenticated Edge Function through the service role.
revoke all on table public.contract_confirmations from public, anon, authenticated;
grant all on table public.contract_confirmations to service_role;

create index if not exists contract_confirmations_created_at_idx
  on public.contract_confirmations (created_at desc);

create index if not exists contract_confirmations_account_email_idx
  on public.contract_confirmations (lower(account_email));

create index if not exists contract_confirmations_league_id_idx
  on public.contract_confirmations (league_id);

comment on table public.contract_confirmations is
  'Server-only evidence of RaceVora registration contract confirmations sent by email.';
