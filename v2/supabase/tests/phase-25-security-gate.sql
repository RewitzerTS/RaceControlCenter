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

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname = 'ai_analysis_usage'
      and c.relrowsecurity
  ) then
    raise exception 'private.ai_analysis_usage must have RLS enabled';
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

  if exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'private'
      and g.table_name = 'ai_analysis_usage'
      and g.grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Browser role grant remains on private.ai_analysis_usage';
  end if;

  if has_function_privilege('public', 'private.assign_driver_profile_number()', 'execute')
     or has_function_privilege('anon', 'private.assign_driver_profile_number()', 'execute')
     or has_function_privilege('authenticated', 'private.assign_driver_profile_number()', 'execute') then
    raise exception 'Profile-number trigger function remains directly executable by browser roles';
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
    'add_existing_league_member_by_email',
    'assign_season_driver_ai',
    'add_steward_evidence',
    'cast_steward_vote',
    'complete_driver_onboarding',
    'complete_league_season',
    'configure_league_season_calendar',
    'consume_ai_analysis_quota',
    'create_league',
    'create_league_result_draft',
    'create_steward_case',
    'finalize_steward_decision',
    'get_demo_full_e2e_snapshot',
    'get_league_admin_workspace',
    'get_league_configuration_workspace',
    'get_league_driver_admin_workspace',
    'get_league_member_admin_workspace',
    'get_league_race_admin_workspace',
    'get_my_league_join_requests',
    'get_owner_control_snapshot',
    'get_season_setup_workspace',
    'get_social_graphics_workspace',
    'get_vora_companion_snapshot',
    'is_platform_owner',
    'mark_notification_read',
    'publish_league_result_draft',
    'purchase_cosmetic',
    'record_social_graphic_render',
    'remove_league_member',
    'rename_league_team',
    'review_league_join_request',
    'set_league_member_role',
    'set_platform_feature_flag',
    'start_league_season',
    'start_league_season_with_calendar',
    'submit_steward_appeal',
    'update_league_branding',
    'update_league_rules',
    'upsert_league_driver'
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
    and not (
      p.proname = 'start_league_season_with_calendar'
      and p.prosrc ilike '%public.start_league_season(%'
      and p.prosrc ilike '%public.configure_league_season_calendar(%'
    )
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
