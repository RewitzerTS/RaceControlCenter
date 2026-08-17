-- RaceVora public consumer-withdrawal abuse protection
-- Caps accepted declarations before any confirmation/operator email can be sent.
-- No IP address or additional personal data is stored for rate limiting.

create or replace function public.enforce_consumer_withdrawal_rate_limit()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_global_count integer;
  v_email_count integer;
begin
  -- Serialize the small public withdrawal intake window so parallel requests
  -- cannot race past the global/email limits.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('racevora:consumer-withdrawal-rate-limit', 0)
  );

  select count(*)::integer
    into v_global_count
  from public.consumer_withdrawals cw
  where cw.submitted_at >= pg_catalog.now() - interval '15 minutes';

  if v_global_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'consumer_withdrawal_rate_limited_global';
  end if;

  select count(*)::integer
    into v_email_count
  from public.consumer_withdrawals cw
  where cw.submitted_at >= pg_catalog.now() - interval '15 minutes'
    and pg_catalog.lower(cw.confirmation_email) = pg_catalog.lower(new.confirmation_email);

  if v_email_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'consumer_withdrawal_rate_limited_email';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_consumer_withdrawal_rate_limit() from public, anon, authenticated;
grant execute on function public.enforce_consumer_withdrawal_rate_limit() to service_role;

drop trigger if exists consumer_withdrawals_rate_limit_before_insert
  on public.consumer_withdrawals;

create trigger consumer_withdrawals_rate_limit_before_insert
before insert on public.consumer_withdrawals
for each row execute function public.enforce_consumer_withdrawal_rate_limit();

comment on function public.enforce_consumer_withdrawal_rate_limit() is
  'Server-only 15-minute rate limiter for the public consumer withdrawal endpoint. Limits 20 accepted declarations globally and 3 per confirmation email before insert/email delivery.';