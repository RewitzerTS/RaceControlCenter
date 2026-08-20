-- RaceVora V2 Phase 26 migration-rehearsal regression.
-- All fixtures are synthetic and rolled back.

begin;

do $$
declare
  helper_oid oid;
begin
  select p.oid into helper_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'matches_requested_league'
    and pg_get_function_identity_arguments(p.oid) = 'p_league_id uuid';

  if helper_oid is null then
    raise exception 'tenant match helper is missing';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = helper_oid) then
    raise exception 'tenant match helper must remain SECURITY INVOKER';
  end if;
  if (select l.lanname from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = helper_oid) <> 'plpgsql' then
    raise exception 'tenant match helper must isolate anonymous and authenticated paths';
  end if;
  if not has_function_privilege('anon', helper_oid, 'execute')
     or not has_function_privilege('authenticated', helper_oid, 'execute') then
    raise exception 'tenant match helper lost a required browser execution grant';
  end if;
end;
$$;

insert into public.leagues (id, name, slug, status, is_public, settings)
values (
  '26000000-1000-4000-8000-000000000001',
  'Phase 26 Public Rehearsal',
  'phase-26-public',
  'active',
  true,
  '{"published":true,"owner_only":false,"synthetic":true}'::jsonb
);

select set_config('request.headers', '{"x-rcc-league-slug":"phase-26-public"}', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  if not public.matches_requested_league('26000000-1000-4000-8000-000000000001') then
    raise exception 'anonymous public tenant read was blocked by an authenticated-only helper';
  end if;
  if public.matches_requested_league('22000000-1000-4000-8000-000000000001') then
    raise exception 'anonymous actor could match the owner-only Demo league';
  end if;
end;
$$;

reset role;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values (
  '26000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'phase26-owner@demo.invalid',
  now(),
  '{"provider":"demo","providers":["demo"]}'::jsonb,
  '{"synthetic":true}'::jsonb,
  now(),
  now(),
  false,
  false
);

insert into public.platform_owners (user_id)
values ('26000000-0000-4000-8000-000000000001');

select set_config('request.headers', '{"x-rcc-league-slug":"demo"}', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"26000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not public.matches_requested_league('22000000-1000-4000-8000-000000000001') then
    raise exception 'platform owner lost access to the owner-only Demo league';
  end if;
end;
$$;

reset role;
rollback;
