-- RaceVora V2 Phase 3 structural and tenant-isolation regression tests.
-- The transaction is always rolled back; no fixture survives.

begin;
do $$
declare
  rls_count integer;
  policy_count integer;
  missing_fk_indexes integer;
  exposed_definers integer;
begin
  select count(*) into rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('leagues', 'league_members', 'platform_owners')
    and c.relrowsecurity;
  if rls_count <> 3 then
    raise exception 'expected RLS on 3 foundation tables, found %', rls_count;
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('leagues', 'league_members', 'platform_owners');
  if policy_count <> 3 then
    raise exception 'expected exactly 3 foundation policies, found %', policy_count;
  end if;

  if has_table_privilege('anon', 'public.platform_owners', 'select')
     or has_table_privilege('authenticated', 'public.platform_owners', 'select') then
    raise exception 'platform_owners must not be browser-readable';
  end if;

  if has_table_privilege('anon', 'public.league_members', 'select') then
    raise exception 'league_members must not be anonymously readable';
  end if;

  select count(*) into exposed_definers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('public', p.oid, 'execute');
  if exposed_definers <> 0 then
    raise exception 'public execute remains on a security definer function';
  end if;

  select count(*) into missing_fk_indexes
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and rel.relname in ('leagues', 'league_members', 'platform_owners')
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and c.conkey[1] = any(i.indkey)
    );
  if missing_fk_indexes <> 0 then
    raise exception 'foundation contains % unindexed foreign keys', missing_fk_indexes;
  end if;
end;
$$;

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('10000000-0000-0000-0000-000000000001', 'Alpha League', 'alpha-league', true, '{"published": true}'),
  ('20000000-0000-0000-0000-000000000002', 'Beta League', 'beta-league', true, '{"published": true}'),
  ('30000000-0000-0000-0000-000000000003', 'Owner League', 'owner-league', true, '{"published": true, "owner_only": true}');

set local role anon;
set local request.headers = '{"x-rcc-league-slug":"alpha-league"}';

do $$
declare
  visible_ids uuid[];
begin
  select array_agg(id order by id) into visible_ids from public.leagues;
  if visible_ids is distinct from array['10000000-0000-0000-0000-000000000001'::uuid] then
    raise exception 'anon tenant isolation failed: %', visible_ids;
  end if;
end;
$$;

set local request.headers = '{}';

do $$
begin
  perform count(*) from public.leagues;
  raise exception 'missing tenant header did not fail closed';
exception
  when sqlstate '22023' then null;
end;
$$;


reset role;
set local role authenticated;
set local request.headers = '{"x-rcc-league-slug":"alpha-league"}';

do $$
declare
  visible_ids uuid[];
begin
  select array_agg(id order by id) into visible_ids from public.leagues;
  if visible_ids is distinct from array['10000000-0000-0000-0000-000000000001'::uuid] then
    raise exception 'authenticated tenant isolation failed: %', visible_ids;
  end if;
  if public.is_platform_owner() then
    raise exception 'anonymous authenticated context resolved as platform owner';
  end if;
end;
$$;

reset role;

do $$
begin
  perform set_config('request.headers', '{"x-rcc-league-slug":"alpha-league"}', true);
  if public.requested_league_slug() <> 'alpha-league' then
    raise exception 'canonical tenant header resolver returned the wrong slug';
  end if;
end;
$$;

rollback;
