-- Defense in depth for private database objects identified by the Supabase
-- security advisor. This migration changes no application or league data.

begin;

alter table private.ai_analysis_usage enable row level security;

revoke all on function private.assign_driver_profile_number()
  from public, anon, authenticated, service_role;

comment on table private.ai_analysis_usage is
  'Internal AI quota ledger. Browser access is revoked and RLS is enabled as defense in depth.';

comment on function private.assign_driver_profile_number() is
  'Internal trigger-only allocator. Direct execution is revoked from all API roles.';

commit;
