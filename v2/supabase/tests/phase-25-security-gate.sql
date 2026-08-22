begin;

do $$
declare
  unexpected_function text;
  authenticated_definer_rpcs text[];
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname = 'steward_case_counters'
      and c.relrowsecurity
  ) then
    raise exception 'private.steward_case_counters must have RLS enabled';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'private'
      and g.table_name = 'steward_case_counters'
      and g.grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Browser role grant remains on private.steward_case_counters';
  end if;

  select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
  into unexpected_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and (
      p.proconfig is null
      or not ('search_path=""' = any(p.proconfig))
      or has_function_privilege('public', p.oid, 'execute')
      or (n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))
    )
  limit 1;

  if unexpected_function is not null then
    raise exception 'Unsafe SECURITY DEFINER exposure: %', unexpected_function;
  end if;

  select array_agg(p.proname order by p.proname)
  into authenticated_definer_rpcs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute');

  if authenticated_definer_rpcs <> array[
    'add_steward_evidence',
    'cast_steward_vote',
    'create_steward_case',
    'finalize_steward_decision',
    'get_demo_full_e2e_snapshot',
    'get_league_admin_workspace',
    'get_owner_control_snapshot',
    'get_social_graphics_workspace',
    'get_vora_companion_snapshot',
    'is_platform_owner',
    'mark_notification_read',
    'purchase_cosmetic',
    'record_social_graphic_render',
    'set_platform_feature_flag',
    'submit_steward_appeal'
  ]::text[] then
    raise exception 'Authenticated SECURITY DEFINER RPC allowlist changed: %', authenticated_definer_rpcs;
  end if;

  select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
  into unexpected_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc not ilike '%auth.uid%'
    and p.prosrc not ilike '%is_platform_owner%'
    and p.prosrc not ilike '%has_league_capability%'
  limit 1;

  if unexpected_function is not null then
    raise exception 'Authenticated SECURITY DEFINER RPC lacks an actor or capability check: %', unexpected_function;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and p.proconfig is null
  ) then
    raise exception 'SECURITY DEFINER function without hardened configuration exists';
  end if;
end;
$$;

rollback;
