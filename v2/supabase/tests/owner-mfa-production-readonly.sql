-- Production-safe permission checks: no fixture rows or factor changes.
begin read only;
do $$
begin
  perform set_config('test.owner_id', (select user_id::text from public.platform_owners limit 1), true);
  if nullif(current_setting('test.owner_id'), '') is null then raise exception 'Production owner missing'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.owner_id'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  if public.is_platform_owner() then raise exception 'AAL1 owner must be denied'; end if;
  if public.get_owner_mfa_status() <> '{"is_owner":true,"verified":false}'::jsonb then raise exception 'AAL1 enrollment status must remain available'; end if;
  begin
    perform public.get_owner_registered_users();
    raise exception 'AAL1 owner directory must be denied';
  exception when insufficient_privilege then null; end;
end;
$$;
do $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated', 'aal', 'aal2', 'user_metadata', jsonb_build_object('role','owner'))::text, true);
  if public.is_platform_owner() then raise exception 'Metadata cannot grant owner rights'; end if;
  if public.get_owner_mfa_status() <> '{"is_owner":false,"verified":false}'::jsonb then raise exception 'Non-owner status incorrect'; end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.get_owner_mfa_status();
    raise exception 'Anonymous MFA status must be denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'Read-only Production MFA permission checks passed' as result;
rollback;
