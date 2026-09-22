-- Owner privileges require a Supabase-signed AAL2 token and an active TOTP.
-- Enrollment deliberately remains accessible to an owner at AAL1.
create schema if not exists owner_security;
revoke all on schema owner_security from public, anon, authenticated;
grant usage on schema owner_security to authenticated;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal' = 'aal2', false)
    and exists (select 1 from public.platform_owners where user_id = (select auth.uid()))
    and exists (
      select 1 from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified' and factor_type = 'totp'
    );
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;

-- Reports only the calling user's enrollment requirement, never an owner directory.
create or replace function owner_security.status()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'is_owner', exists (select 1 from public.platform_owners where user_id = (select auth.uid())),
    'verified', public.is_platform_owner()
  );
$$;
revoke all on function owner_security.status() from public, anon, authenticated, service_role;
grant execute on function owner_security.status() to authenticated;

create or replace function public.get_owner_mfa_status()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select owner_security.status(); $$;
revoke all on function public.get_owner_mfa_status() from public, anon, authenticated, service_role;
grant execute on function public.get_owner_mfa_status() to authenticated;
