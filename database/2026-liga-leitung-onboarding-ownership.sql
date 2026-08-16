-- Race Control Center - platform ownership and Liga-Leitung onboarding
-- Platform ownership remains exclusive to platform_owners.
-- Customer league creators receive admin (= Liga-Leitung), never owner.

create or replace function public.enforce_platform_owner_league_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' and not exists (
    select 1
    from public.platform_owners po
    where po.user_id = new.user_id
  ) then
    raise exception 'League owner role is reserved for platform owners';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_platform_owner_league_role() from public, anon, authenticated;

drop trigger if exists trg_enforce_platform_owner_league_role on public.league_members;
create trigger trg_enforce_platform_owner_league_role
before insert or update of user_id, role on public.league_members
for each row execute function public.enforce_platform_owner_league_role();

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
  if v_slug = any (array['admin','api','app','auth','login','logout','signup','register','support','help','www','racecontrolcenter']) then
    raise exception 'This league slug is reserved';
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
    raise exception 'League slug already exists';
end;
$$;

revoke all on function public.create_league(text, text, boolean) from public, anon;
grant execute on function public.create_league(text, text, boolean) to authenticated;
