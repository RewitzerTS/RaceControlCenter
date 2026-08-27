-- The embedded V1 result and stewarding modules require a tenant-safe
-- race_penalties compatibility table. All checks are read-only and rolled back.

begin;

do $$
declare
  rls_enabled boolean;
begin
  if to_regclass('public.race_penalties') is null then
    raise exception 'race_penalties compatibility table is missing';
  end if;

  select c.relrowsecurity
    into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'race_penalties';

  if not coalesce(rls_enabled, false) then
    raise exception 'race_penalties does not enforce row level security';
  end if;
end;
$$;

do $$
begin
  if not has_table_privilege('anon', 'public.race_penalties', 'select')
     or has_table_privilege('anon', 'public.race_penalties', 'insert')
     or has_table_privilege('anon', 'public.race_penalties', 'update')
     or has_table_privilege('anon', 'public.race_penalties', 'delete') then
    raise exception 'anonymous race_penalties privileges are unsafe';
  end if;

  if not has_table_privilege('authenticated', 'public.race_penalties', 'select')
     or not has_table_privilege('authenticated', 'public.race_penalties', 'insert')
     or not has_table_privilege('authenticated', 'public.race_penalties', 'update')
     or not has_table_privilege('authenticated', 'public.race_penalties', 'delete') then
    raise exception 'authenticated race_penalties compatibility privileges are incomplete';
  end if;
end;
$$;

do $$
declare
  policy_source text;
begin
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), ' ')
    into policy_source
  from pg_policies
  where schemaname = 'public'
    and tablename = 'race_penalties';

  if policy_source not like '%matches_requested_league%'
     or policy_source not like '%has_league_capability%'
     or policy_source not like '%driver_id%'
     or policy_source not like '%steward_case_id%' then
    raise exception 'race_penalties policies do not enforce tenant, role, driver and case scope';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'race_penalties'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and roles @> array['authenticated']::name[]
  ) <> 3 then
    raise exception 'race_penalties write policies are incomplete';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'race_penalties'
      and indexname = 'race_penalties_steward_case_unique_idx'
      and indexdef like 'CREATE UNIQUE INDEX%WHERE (steward_case_id IS NOT NULL)'
  ) then
    raise exception 'one-penalty-per-steward-case compatibility invariant is missing';
  end if;
end;
$$;

rollback;
