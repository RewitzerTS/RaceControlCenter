-- Keep the app's private schema inaccessible. This non-exposed schema only
-- contains the two guarded identity-link operations; public wrappers stay invoker.
create schema if not exists member_linking;
revoke all on schema member_linking from public, anon, authenticated;
grant usage on schema member_linking to authenticated;
alter function private.get_linkable_league_drivers() set schema member_linking;
alter function private.link_league_member_driver(uuid, uuid) set schema member_linking;
create or replace function public.get_linkable_league_drivers()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select member_linking.get_linkable_league_drivers();
$$;
create or replace function public.link_league_member_driver(p_user_id uuid, p_driver_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select member_linking.link_league_member_driver(p_user_id, p_driver_id);
$$;
