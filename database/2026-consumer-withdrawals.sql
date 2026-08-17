-- RaceVora consumer withdrawal receipts
-- Stores only the information required to evidence the electronic withdrawal flow.

create table if not exists public.consumer_withdrawals (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  consumer_name text not null,
  contract_identifier text not null,
  confirmation_email text not null,
  statement text not null,
  submitted_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  confirmation_provider_id text,
  operator_notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consumer_withdrawals_consumer_name_len check (char_length(consumer_name) between 2 and 160),
  constraint consumer_withdrawals_contract_identifier_len check (char_length(contract_identifier) between 3 and 240),
  constraint consumer_withdrawals_confirmation_email_len check (char_length(confirmation_email) between 5 and 320),
  constraint consumer_withdrawals_statement_len check (char_length(statement) between 10 and 1200)
);

alter table public.consumer_withdrawals enable row level security;

revoke all on table public.consumer_withdrawals from anon, authenticated;
grant all on table public.consumer_withdrawals to service_role;

create index if not exists consumer_withdrawals_submitted_at_idx
  on public.consumer_withdrawals (submitted_at desc);

create index if not exists consumer_withdrawals_confirmation_email_idx
  on public.consumer_withdrawals (lower(confirmation_email));

comment on table public.consumer_withdrawals is
  'Server-only records of consumer withdrawal declarations submitted through the RaceVora electronic withdrawal function.';
