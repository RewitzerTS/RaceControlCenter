-- RaceVora V2 Phase 4 identity, claim, and tenant-isolation regressions.
-- Synthetic fixtures are inserted inside one transaction and always rolled back.

begin;

do $$
declare
  rls_count integer;
  missing_fk_indexes integer;
begin
  select count(*) into rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'drivers',
      'driver_identities',
      'driver_claims',
      'driver_identity_links',
      'driver_aliases'
    )
    and c.relrowsecurity;
  if rls_count <> 5 then
    raise exception 'expected RLS on all 5 driver identity tables, found %', rls_count;
  end if;

  if has_table_privilege('anon', 'public.driver_claims', 'select')
     or has_table_privilege('authenticated', 'public.driver_claims', 'select') then
    raise exception 'driver_claims must remain server-only';
  end if;

  if has_table_privilege('anon', 'public.driver_identities', 'select')
     or has_table_privilege('anon', 'public.driver_identity_links', 'select')
     or has_table_privilege('anon', 'public.driver_aliases', 'select') then
    raise exception 'global driver identity data must not be anonymously readable';
  end if;

  if has_table_privilege('authenticated', 'public.driver_identities', 'insert')
     or has_table_privilege('authenticated', 'public.driver_identity_links', 'insert')
     or has_table_privilege('authenticated', 'public.driver_aliases', 'insert') then
    raise exception 'identity mutations must remain server-controlled';
  end if;

  select count(*) into missing_fk_indexes
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and rel.relname in (
      'drivers',
      'driver_identities',
      'driver_claims',
      'driver_identity_links',
      'driver_aliases'
    )
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and c.conkey[1] = any(i.indkey)
    );
  if missing_fk_indexes <> 0 then
    raise exception 'driver identity schema contains % unindexed foreign keys', missing_fk_indexes;
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'phase4-a@example.invalid',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'phase4-b@example.invalid',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('11000000-0000-0000-0000-000000000001', 'Phase Four Alpha', 'phase-four-alpha', true, '{"published": true}'),
  ('12000000-0000-0000-0000-000000000002', 'Phase Four Beta', 'phase-four-beta', true, '{"published": true}');

insert into public.drivers (id, league_id, display_name, gamertag)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'Synthetic Alpha Driver',
    'SharedSyntheticTag'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000002',
    'Synthetic Beta Driver',
    'SharedSyntheticTag'
  );

insert into public.driver_identities (id, user_id)
values
  ('31000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002');

do $$
begin
  insert into public.driver_identities (user_id)
  values ('91000000-0000-0000-0000-000000000001');
  raise exception 'one registered user received multiple global identities';
exception
  when unique_violation then null;
end;
$$;

insert into public.driver_aliases (driver_identity_id, alias, alias_type)
values
  ('31000000-0000-0000-0000-000000000001', ' SharedSyntheticTag ', 'gamertag'),
  ('32000000-0000-0000-0000-000000000002', 'sharedsynthetictag', 'gamertag');

do $$
begin
  insert into public.driver_aliases (driver_identity_id, alias, alias_type)
  values ('31000000-0000-0000-0000-000000000001', 'sharedsynthetictag', 'spelling_variant');
  raise exception 'normalized duplicate alias was accepted for one identity';
exception
  when unique_violation then null;
end;
$$;

do $$
begin
  if exists (select 1 from public.driver_identity_links) then
    raise exception 'aliases created an identity link without verified evidence';
  end if;
end;
$$;

insert into public.driver_claims (
  id,
  driver_id,
  claimant_user_id,
  verification_method,
  status,
  proof_token_hash
)
values (
  '41000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'unique_claim_link',
  'pending',
  repeat('a', 64)
);

do $$
begin
  insert into public.driver_identity_links (driver_identity_id, driver_id, claim_id)
  values (
    '31000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001'
  );
  raise exception 'an unverified claim created a driver identity link';
exception
  when check_violation then null;
end;
$$;

update public.driver_claims
set status = 'verified', resolved_at = now()
where id = '41000000-0000-0000-0000-000000000001';

insert into public.driver_identity_links (id, driver_identity_id, driver_id, claim_id)
values (
  '51000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001'
);

do $$
begin
  update public.driver_claims
  set status = 'cancelled', resolved_at = now()
  where id = '41000000-0000-0000-0000-000000000001';
  raise exception 'linked verified evidence was mutated';
exception
  when check_violation then null;
end;
$$;

do $$
begin
  insert into public.driver_identity_links (driver_identity_id, driver_id, claim_id)
  values (
    '32000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001'
  );
  raise exception 'one legacy driver was linked to multiple global identities';
exception
  when check_violation then null;
  when unique_violation then null;
end;
$$;

set local request.headers = '{"x-rcc-league-slug":"phase-four-alpha"}';
set local role anon;

do $$
declare
  visible_ids uuid[];
begin
  select array_agg(id order by id) into visible_ids from public.drivers;
  if visible_ids is distinct from array['21000000-0000-0000-0000-000000000001'::uuid] then
    raise exception 'anonymous cross-tenant driver isolation failed: %', visible_ids;
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  identity_ids uuid[];
  link_ids uuid[];
  alias_count integer;
begin
  select array_agg(id order by id) into identity_ids from public.driver_identities;
  if identity_ids is distinct from array['31000000-0000-0000-0000-000000000001'::uuid] then
    raise exception 'authenticated identity self-read failed: %', identity_ids;
  end if;

  select array_agg(id order by id) into link_ids from public.driver_identity_links;
  if link_ids is distinct from array['51000000-0000-0000-0000-000000000001'::uuid] then
    raise exception 'authenticated identity-link self-read failed: %', link_ids;
  end if;

  select count(*) into alias_count from public.driver_aliases;
  if alias_count <> 1 then
    raise exception 'authenticated alias self-read leaked another identity: % rows', alias_count;
  end if;
end;
$$;

reset role;
rollback;
