-- League branding remains writable only for the requested tenant's administration.
-- Synthetic fixtures are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('f3600000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase36-admin@example.invalid', '{}', '{}', now(), now()),
  ('f3600000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase36-driver@example.invalid', '{}', '{}', now(), now());

insert into public.driver_identities (id, user_id)
values
  ('f3610000-0000-0000-0000-000000000001', 'f3600000-0000-0000-0000-000000000001'),
  ('f3610000-0000-0000-0000-000000000002', 'f3600000-0000-0000-0000-000000000002');

insert into public.leagues (id, name, slug, is_public, settings)
values
  ('f3620000-0000-0000-0000-000000000001', 'Branding Alpha', 'branding-alpha', true, '{"published":true,"theme_id":"1"}'),
  ('f3620000-0000-0000-0000-000000000002', 'Branding Beta', 'branding-beta', true, '{"published":true,"theme_id":"1"}');

insert into public.league_members (league_id, user_id, role)
values
  ('f3620000-0000-0000-0000-000000000001', 'f3600000-0000-0000-0000-000000000001', 'league_admin'),
  ('f3620000-0000-0000-0000-000000000001', 'f3600000-0000-0000-0000-000000000002', 'driver');

select set_config('request.headers', '{"x-rcc-league-slug":"branding-alpha"}', true);
select set_config('request.jwt.claims', '{"sub":"f3600000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  updated jsonb;
begin
  if not private.can_manage_league_brand_asset('branding-alpha/logo.png') then
    raise exception 'league administration cannot upload to its requested branding folder';
  end if;
  if private.can_manage_league_brand_asset('branding-beta/logo.png') then
    raise exception 'branding upload authorization crossed the requested tenant';
  end if;

  updated := public.update_league_branding(
    'Branding Alpha Updated', '', '', 'https://racevora.com/',
    'https://discord.gg/rcc', '', '1'
  );
  if updated ->> 'name' <> 'Branding Alpha Updated' then
    raise exception 'guarded branding RPC did not update the requested league';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"f3600000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if private.can_manage_league_brand_asset('branding-alpha/logo.png') then
    raise exception 'driver received league branding upload access';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'can_manage_league_brand_asset' and p.prosecdef
  ) then
    raise exception 'branding asset helper must remain security definer';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_league_branding' and p.prosecdef
  ) then
    raise exception 'branding RPC must remain security definer';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('v2 admins upload league brand assets', 'v2 admins update league brand assets')) <> 2 then
    raise exception 'branding storage write policies are incomplete';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'v2 admins update league brand assets'
      and qual like '%can_manage_league_brand_asset%'
      and with_check like '%can_manage_league_brand_asset%'
  ) then
    raise exception 'branding storage update must guard both existing and replacement objects';
  end if;
end;
$$;

rollback;
