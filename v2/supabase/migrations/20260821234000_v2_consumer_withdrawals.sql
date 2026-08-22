-- V2-owned electronic consumer-withdrawal receipts.
-- Browser roles intentionally have no access; the public Edge Function writes
-- through the service role after validation and abuse checks.

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
revoke all on table public.consumer_withdrawals from public, anon, authenticated;
grant all on table public.consumer_withdrawals to service_role;

create index if not exists consumer_withdrawals_submitted_at_idx
  on public.consumer_withdrawals (submitted_at desc);

create index if not exists consumer_withdrawals_confirmation_email_idx
  on public.consumer_withdrawals (lower(confirmation_email));

create or replace function public.enforce_consumer_withdrawal_rate_limit()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_global_count integer;
  v_email_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('racevora:v2:consumer-withdrawal-rate-limit', 0)
  );

  select count(*)::integer into v_global_count
  from public.consumer_withdrawals cw
  where cw.submitted_at >= pg_catalog.now() - interval '15 minutes';

  if v_global_count >= 20 then
    raise exception using errcode = 'P0001', message = 'consumer_withdrawal_rate_limited_global';
  end if;

  select count(*)::integer into v_email_count
  from public.consumer_withdrawals cw
  where cw.submitted_at >= pg_catalog.now() - interval '15 minutes'
    and pg_catalog.lower(cw.confirmation_email) = pg_catalog.lower(new.confirmation_email);

  if v_email_count >= 3 then
    raise exception using errcode = 'P0001', message = 'consumer_withdrawal_rate_limited_email';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_consumer_withdrawal_rate_limit() from public, anon, authenticated;
grant execute on function public.enforce_consumer_withdrawal_rate_limit() to service_role;

drop trigger if exists consumer_withdrawals_rate_limit_before_insert on public.consumer_withdrawals;
create trigger consumer_withdrawals_rate_limit_before_insert
before insert on public.consumer_withdrawals
for each row execute function public.enforce_consumer_withdrawal_rate_limit();

comment on table public.consumer_withdrawals is
  'Server-only V2 records of consumer withdrawal declarations.';

comment on function public.enforce_consumer_withdrawal_rate_limit() is
  'Server-only 15-minute limiter: 20 accepted declarations globally and 3 per confirmation email.';
