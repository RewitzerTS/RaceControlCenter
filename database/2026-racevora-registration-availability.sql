-- RaceVora - registration availability and duplicate protection
-- This migration is intentionally tenant-data preserving. It does not update or
-- delete existing leagues; it only adds uniqueness/lookup safeguards and updates
-- the self-service league creation RPC.

begin;

-- Treat league names case-insensitively and ignore surrounding whitespace.
-- Slugs already have the leagues_slug_unique constraint from the multi-tenant
-- foundation migration.
create unique index if not exists leagues_name_normalized_unique
  on public.leagues ((lower(btrim(name))));

-- Registration needs an exact-match availability check before an account is
-- created. The function returns booleans only, so private league rows are not
-- exposed to anonymous callers.
create or replace function public.check_league_registration_availability(
  p_name text,
  p_slug text
)
returns table (
  name_available boolean,
  slug_available boolean,
  slug_reserved boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_reserved boolean;
begin
  v_reserved := v_slug = any (array[
    'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
    'support', 'help', 'www', 'racecontrolcenter', 'racevora'
  ]);

  return query
  select
    not exists (
      select 1
      from public.leagues l
      where lower(btrim(l.name)) = v_name
    ),
    not v_reserved and not exists (
      select 1
      from public.leagues l
      where l.slug = v_slug
    ),
    v_reserved;
end;
$$;

revoke all on function public.check_league_registration_availability(text, text) from public;
grant execute on function public.check_league_registration_availability(text, text) to anon, authenticated;

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_is_public boolean default true
)
returns table (id uuid, name text, slug text, is_public boolean, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_league_id uuid;
  v_platform_owner boolean := false;
  v_new_role text;
  v_constraint_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.platform_owners po
    where po.user_id = v_user_id
  ) into v_platform_owner;

  if not v_platform_owner and exists (
    select 1
    from public.league_members lm
    where lm.user_id = v_user_id
  ) then
    raise exception 'Your account is already assigned to a league. Additional leagues can only be created by the platform owner';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    raise exception 'League name must be between 3 and 80 characters';
  end if;
  if v_name ~ '[<>]' then
    raise exception 'League name contains invalid characters';
  end if;
  if char_length(v_slug) < 3 or char_length(v_slug) > 50 then
    raise exception 'League slug must be between 3 and 50 characters';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'League slug may only contain lowercase letters, numbers and single hyphens';
  end if;
  if v_slug = any (array[
    'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
    'support', 'help', 'www', 'racecontrolcenter', 'racevora'
  ]) then
    raise exception 'This league slug is reserved';
  end if;

  -- Friendly pre-checks. The unique index/constraint below still remain the
  -- authoritative race-condition protection at the database boundary.
  if exists (
    select 1
    from public.leagues l
    where lower(btrim(l.name)) = lower(v_name)
  ) then
    raise exception 'League name already exists';
  end if;

  if exists (
    select 1
    from public.leagues l
    where l.slug = v_slug
  ) then
    raise exception 'League slug already exists';
  end if;

  insert into public.leagues (name, slug, is_public, created_by, settings)
  values (
    v_name,
    v_slug,
    coalesce(p_is_public, true),
    v_user_id,
    jsonb_build_object('published', false, 'onboarding_complete', false)
  )
  returning leagues.id into v_league_id;

  v_new_role := case when v_platform_owner then 'owner' else 'admin' end;

  insert into public.league_members (league_id, user_id, role)
  values (v_league_id, v_user_id, v_new_role);

  insert into public.league_content (league_id, id)
  values (v_league_id, 'default');

  return query
  select l.id, l.name, l.slug, l.is_public, v_new_role
  from public.leagues l
  where l.id = v_league_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'leagues_name_normalized_unique' then
      raise exception 'League name already exists';
    end if;
    raise exception 'League slug already exists';
end;
$$;

revoke all on function public.create_league(text, text, boolean) from public, anon;
grant execute on function public.create_league(text, text, boolean) to authenticated;

commit;
