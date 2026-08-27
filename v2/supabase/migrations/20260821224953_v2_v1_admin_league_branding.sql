-- RaceVora V2: restore the V1 league creation and league branding workflows.
-- Additive V2-only migration. Never apply to the preserved V1 project.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'league-brand-assets',
  'league-brand-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "v2 public read league brand assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'league-brand-assets');

create policy "v2 admins upload league brand assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'league-brand-assets'
  and (
    (select public.is_platform_owner())
    or exists (
      select 1
      from public.leagues l
      join public.league_members lm on lm.league_id = l.id
      where l.slug = (storage.foldername(name))[1]
        and lm.user_id = (select auth.uid())
        and lm.role = 'league_admin'
    )
  )
);

create policy "v2 admins update league brand assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'league-brand-assets'
  and (
    (select public.is_platform_owner())
    or exists (
      select 1
      from public.leagues l
      join public.league_members lm on lm.league_id = l.id
      where l.slug = (storage.foldername(name))[1]
        and lm.user_id = (select auth.uid())
        and lm.role = 'league_admin'
    )
  )
)
with check (
  bucket_id = 'league-brand-assets'
  and (
    (select public.is_platform_owner())
    or exists (
      select 1
      from public.leagues l
      join public.league_members lm on lm.league_id = l.id
      where l.slug = (storage.foldername(name))[1]
        and lm.user_id = (select auth.uid())
        and lm.role = 'league_admin'
    )
  )
);

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_is_public boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_league public.leagues%rowtype;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if actor_id is null or not public.is_platform_owner() then
    raise exception using errcode = '42501', message = 'Platform owner access required.';
  end if;

  if char_length(normalized_name) not between 3 and 80 or normalized_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'League name must contain 3 to 80 safe characters.';
  end if;
  if char_length(normalized_slug) not between 3 and 50
     or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'League slug is invalid.';
  end if;

  insert into public.leagues (name, slug, is_public, status, settings, created_by)
  values (
    normalized_name,
    normalized_slug,
    coalesce(p_is_public, true),
    'active',
    jsonb_build_object(
      'published', false,
      'onboarding_complete', false,
      'theme_id', '1',
      'brand_name', normalized_name
    ),
    actor_id
  )
  returning * into created_league;

  insert into public.v2_audit_events (
    scope, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'platform', actor_id, 'league.created', 'league', created_league.id,
    jsonb_build_object('slug', created_league.slug, 'is_public', created_league.is_public)
  );

  return jsonb_build_object(
    'id', created_league.id,
    'name', created_league.name,
    'slug', created_league.slug,
    'status', created_league.status,
    'is_public', created_league.is_public,
    'settings', created_league.settings
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'League name or slug already exists.';
end;
$$;

revoke all on function public.create_league(text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.create_league(text, text, boolean)
  to authenticated, service_role;

create or replace function public.update_league_branding(
  p_brand_name text,
  p_brand_subtitle text default '',
  p_public_description text default '',
  p_public_website text default '',
  p_public_discord text default '',
  p_logo_url text default '',
  p_theme_id text default '1'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_league public.leagues%rowtype;
  updated_league public.leagues%rowtype;
  normalized_name text := btrim(coalesce(p_brand_name, ''));
  normalized_subtitle text := btrim(coalesce(p_brand_subtitle, ''));
  normalized_description text := btrim(coalesce(p_public_description, ''));
  normalized_website text := btrim(coalesce(p_public_website, ''));
  normalized_discord text := btrim(coalesce(p_public_discord, ''));
  normalized_logo text := btrim(coalesce(p_logo_url, ''));
  normalized_theme text := btrim(coalesce(p_theme_id, '1'));
  theme_settings jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select l.* into target_league
  from public.leagues l
  where l.slug = public.requested_league_slug();

  if target_league.id is null
     or not (
       public.is_platform_owner()
       or private.has_league_capability(target_league.id, 'league_admin')
     ) then
    raise exception using errcode = '42501', message = 'League branding access denied.';
  end if;

  if char_length(normalized_name) not between 3 and 80 or normalized_name ~ '[<>]' then
    raise exception using errcode = '22023', message = 'Brand name must contain 3 to 80 safe characters.';
  end if;
  if char_length(normalized_subtitle) > 120
     or char_length(normalized_description) > 500 then
    raise exception using errcode = '22023', message = 'Branding text is too long.';
  end if;
  if normalized_website <> '' and normalized_website !~* '^https?://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'Website URL is invalid.';
  end if;
  if normalized_discord <> '' and normalized_discord !~* '^https?://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'Discord URL is invalid.';
  end if;
  if normalized_logo <> '' and normalized_logo !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'Logo URL must use HTTPS.';
  end if;
  if normalized_theme !~ '^[0-7]$' then
    raise exception using errcode = '22023', message = 'Unknown RaceVora theme.';
  end if;

  theme_settings := case normalized_theme
    when '0' then '{"theme_id":"0","background_color":"#021B34","primary_color":"#35246A","secondary_color":"#5A32A3","accent_color":"#2C8FA6","accent_2_color":"#2F6F8A","surface_color":"#0A1F37","text_color":"#FFFFFF","text_on_primary_color":"#FFFFFF"}'::jsonb
    when '1' then '{"theme_id":"1","background_color":"#060809","primary_color":"#27F4D2","secondary_color":"#0B0D10","accent_color":"#C5C7C9","accent_2_color":"#FFFFFF","surface_color":"#15181B","text_color":"#F4F7F8","text_on_primary_color":"#08110F"}'::jsonb
    when '2' then '{"theme_id":"2","background_color":"#0D0F12","primary_color":"#FF8000","secondary_color":"#2B2D31","accent_color":"#00AEEF","accent_2_color":"#F5F5F5","surface_color":"#1A1D21","text_color":"#F6F6F6","text_on_primary_color":"#101010"}'::jsonb
    when '3' then '{"theme_id":"3","background_color":"#100003","primary_color":"#E8002D","secondary_color":"#FFFFFF","accent_color":"#FFD500","accent_2_color":"#111111","surface_color":"#240007","text_color":"#FFFFFF","text_on_primary_color":"#FFFFFF"}'::jsonb
    when '4' then '{"theme_id":"4","background_color":"#07131A","primary_color":"#00A1E8","secondary_color":"#FF87BC","accent_color":"#0057B8","accent_2_color":"#FFFFFF","surface_color":"#0E2530","text_color":"#FFFFFF","text_on_primary_color":"#081015"}'::jsonb
    when '5' then '{"theme_id":"5","background_color":"#071322","primary_color":"#3671C6","secondary_color":"#FFFFFF","accent_color":"#E10600","accent_2_color":"#FFD100","surface_color":"#10243D","text_color":"#FFFFFF","text_on_primary_color":"#FFFFFF"}'::jsonb
    when '6' then '{"theme_id":"6","background_color":"#061A16","primary_color":"#229971","secondary_color":"#00352F","accent_color":"#C7FF00","accent_2_color":"#D6D2C4","surface_color":"#0D2A24","text_color":"#FFFFFF","text_on_primary_color":"#08100D"}'::jsonb
    else '{"theme_id":"7","background_color":"#090909","primary_color":"#FF2D00","secondary_color":"#111111","accent_color":"#A6A6A6","accent_2_color":"#FFFFFF","surface_color":"#1A1A1A","text_color":"#FFFFFF","text_on_primary_color":"#111111"}'::jsonb
  end;

  update public.leagues
  set
    name = normalized_name,
    logo_url = nullif(normalized_logo, ''),
    settings = settings || theme_settings || jsonb_build_object(
      'brand_name', normalized_name,
      'brand_subtitle', normalized_subtitle,
      'public_description', normalized_description,
      'public_website', normalized_website,
      'public_discord', normalized_discord,
      'brand_logo_url', normalized_logo,
      'onboarding_complete', true
    )
  where id = target_league.id
  returning * into updated_league;

  insert into public.v2_audit_events (
    scope, league_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    'league', updated_league.id, actor_id, 'league.branding.updated', 'league', updated_league.id,
    jsonb_build_object('theme_id', normalized_theme, 'logo_changed', normalized_logo <> coalesce(target_league.logo_url, ''))
  );

  return jsonb_build_object(
    'id', updated_league.id,
    'name', updated_league.name,
    'slug', updated_league.slug,
    'logo_url', updated_league.logo_url,
    'settings', updated_league.settings
  );
end;
$$;

revoke all on function public.update_league_branding(text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_league_branding(text, text, text, text, text, text, text)
  to authenticated, service_role;

comment on function public.create_league(text, text, boolean) is
  'Actor-bound V1-compatible league creation. Only global platform owners may create tenants.';
comment on function public.update_league_branding(text, text, text, text, text, text, text) is
  'Actor-bound V1-compatible branding update for the requested tenant.';
