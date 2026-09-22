-- Staging regression only. Synthetic factor exists inside this transaction only.
-- No real factor is updated; no emails, passwords or TOTP secrets are read.
begin;
select set_config('test.owner_id', (select user_id::text from public.platform_owners limit 1), true);
select set_config('test.factor_id', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.owner_id'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
set local role authenticated;
do $$
begin
  if public.is_platform_owner() then raise exception 'AAL1 owner must be denied'; end if;
  if public.get_owner_mfa_status() <> '{"is_owner":true,"verified":false}'::jsonb then raise exception 'Enrollment must remain available at AAL1'; end if;
  begin
    perform public.get_owner_registered_users();
    raise exception 'AAL1 owner directory leaked';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
-- Unconfirmed enrollment is insufficient even with an AAL2 claim.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (current_setting('test.factor_id')::uuid, current_setting('test.owner_id')::uuid, 'TRANSACTION-ONLY MFA TEST', 'totp', 'unverified', now(), now());
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.owner_id'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
set local role authenticated;
do $$
begin
  -- This assertion is for an owner that has not enrolled a real TOTP yet.
  if public.is_platform_owner() then raise exception 'Unverified factor must not grant owner rights'; end if;
end;
$$;
reset role;
update auth.mfa_factors set status = 'verified' where id = current_setting('test.factor_id')::uuid;
set local role authenticated;
do $$
begin
  if not public.is_platform_owner() then raise exception 'Verified AAL2 owner must pass'; end if;
  if public.get_owner_mfa_status() <> '{"is_owner":true,"verified":true}'::jsonb then raise exception 'Verified owner status incorrect'; end if;
  -- Only validate permission and shape. Never print directory contents.
  if not (public.get_owner_registered_users() ? 'users') then raise exception 'Verified owner directory should be available'; end if;
end;
$$;
reset role;
delete from auth.mfa_factors where id = current_setting('test.factor_id')::uuid;
set local role authenticated;
do $$
begin
  if public.is_platform_owner() then raise exception 'Removed factor must invalidate owner elevation'; end if;
end;
$$;
select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated', 'aal', 'aal2', 'user_metadata', jsonb_build_object('role','owner'))::text, true);
do $$
begin
  if public.is_platform_owner() then raise exception 'AAL2 and metadata do not make a user an owner'; end if;
  if public.get_owner_mfa_status() <> '{"is_owner":false,"verified":false}'::jsonb then raise exception 'Non-owner status incorrect'; end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.get_owner_mfa_status();
    raise exception 'Anonymous status access must be denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'Owner MFA assertions passed; all fixture changes rolled back' as result;
rollback;
