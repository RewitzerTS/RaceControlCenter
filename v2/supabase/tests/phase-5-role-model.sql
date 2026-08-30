-- RaceVora V2 Phase 5 exact-role, hierarchy, owner-separation, and RLS regressions.
-- Synthetic fixtures are always rolled back.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.current_app_role()', 'execute') then
    raise exception 'anonymous callers can resolve application roles';
  end if;

  if not has_function_privilege('authenticated', 'public.current_app_role()', 'execute') then
    raise exception 'authenticated callers cannot resolve their actor-bound role';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'current_app_role'
      and p.prosecdef
  ) then
    raise exception 'current_app_role must remain security invoker';
  end if;

  if has_table_privilege('authenticated', 'public.league_members', 'insert')
     or has_table_privilege('authenticated', 'public.league_members', 'update')
     or has_table_privilege('authenticated', 'public.league_members', 'delete') then
    raise exception 'league role mutations must remain server-controlled';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase5-driver@example.invalid', '{}', '{}', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase5-steward@example.invalid', '{}', '{}', now(), now()),
  ('a3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'phase5-admin@example.invalid', '{}', '{}', now(), now()),
  ('a4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'phase5-owner@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002'),
  ('b3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000003');

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('c1000000-0000-0000-0000-000000000001', 'Phase Five Alpha', 'phase-five-alpha', true, '{"published": true}'),
  ('c2000000-0000-0000-0000-000000000002', 'Phase Five Beta', 'phase-five-beta', true, '{"published": true}');

insert into public.league_members (league_id, user_id, role)
values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'driver'),
  ('c1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'steward'),
  ('c1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'league_admin');

insert into public.platform_owners (user_id)
values ('a4000000-0000-0000-0000-000000000004');

do $$
begin
  insert into public.league_members (league_id, user_id, role)
  values (
    'c1000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000004',
    'driver'
  );
  raise exception 'a user without active driver identity received a league role';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  insert into public.league_members (league_id, user_id, role)
  values (
    'c2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'platform_owner'
  );
  raise exception 'platform_owner was assigned through league membership';
exception
  when check_violation then null;
end;
$$;

do $$
declare
  role_values text[];
begin
  select array_agg(distinct role order by role) into role_values
  from public.league_members;
  if role_values is distinct from array['driver', 'league_admin', 'steward'] then
    raise exception 'league membership contains the wrong visible roles: %', role_values;
  end if;
end;
$$;

select set_config('request.headers', '{"x-rcc-league-slug":"phase-five-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  if public.current_app_role() <> 'driver' then
    raise exception 'driver role did not resolve';
  end if;
  if not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'driver') then
    raise exception 'driver capability did not resolve';
  end if;
  if private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'steward')
     or private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'league_admin') then
    raise exception 'driver inherited an elevated capability';
  end if;
  if private.has_league_capability('c2000000-0000-0000-0000-000000000002', 'driver') then
    raise exception 'driver capability crossed the requested tenant';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  member_count integer;
begin
  select count(*) into member_count from public.league_members;
  if member_count <> 1 then
    raise exception 'driver read another league member: % rows', member_count;
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public.current_app_role() <> 'steward' then
    raise exception 'steward role did not resolve';
  end if;
  if not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'driver')
     or not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'steward')
     or private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'league_admin') then
    raise exception 'steward hierarchy is incorrect';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  if public.current_app_role() <> 'league_admin' then
    raise exception 'league_admin role did not resolve';
  end if;
  if not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'driver')
     or not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'steward')
     or not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'league_admin') then
    raise exception 'league_admin hierarchy is incorrect';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  member_count integer;
begin
  select count(*) into member_count from public.league_members;
  if member_count <> 3 then
    raise exception 'league_admin cannot read league members: % rows', member_count;
  end if;
end;
$$;
reset role;

select set_config('request.headers', '{"x-rcc-league-slug":"phase-five-beta"}', true);
do $$
begin
  if public.current_app_role() is not null then
    raise exception 'non-member identity received a tenant role outside membership';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  if public.current_app_role() <> 'platform_owner' then
    raise exception 'separate platform owner role did not resolve';
  end if;
  if not private.has_league_capability('c1000000-0000-0000-0000-000000000001', 'league_admin')
     or not private.has_league_capability('c2000000-0000-0000-0000-000000000002', 'league_admin') then
    raise exception 'platform owner did not receive global capability';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  member_count integer;
begin
  select count(*) into member_count from public.league_members;
  if member_count <> 3 then
    raise exception 'platform owner cannot read all league memberships: % rows', member_count;
  end if;
end;
$$;
reset role;

rollback;
