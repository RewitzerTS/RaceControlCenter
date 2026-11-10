begin;
-- Keep private schema inaccessible. Expose only these guarded entry points through
-- a dedicated, non-API schema, with invoker wrappers in public.
create schema race_control_private;
revoke all on schema race_control_private from public,anon,authenticated,service_role;
grant usage on schema race_control_private to authenticated;
alter function private.annul_league_race(uuid,uuid,timestamptz,text) set schema race_control_private;
alter function private.reverse_grid_workspace(boolean) set schema race_control_private;
create or replace function public.annul_league_race(p_race_id uuid,p_expected_version_id uuid,p_expected_updated_at timestamptz,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
  select race_control_private.annul_league_race(p_race_id,p_expected_version_id,p_expected_updated_at,p_reason);
$$;
create or replace function public.get_reverse_grid_workspace(p_include_drafts boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$ select race_control_private.reverse_grid_workspace(p_include_drafts); $$;
commit;
