-- RaceVora - registration availability and duplicate protection
-- Tenant-data preserving: existing leagues are not renamed, reset or deleted.
-- Availability is exposed through SHA-256 identity keys instead of an anonymous
-- SECURITY DEFINER RPC, so private league rows stay hidden behind RLS.

begin;

-- Treat league names case-insensitively and ignore surrounding whitespace.
-- Slugs already have leagues_slug_unique from the multi-tenant foundation.
create unique index if not exists leagues_name_normalized_unique
  on public.leagues ((lower(btrim(name))));

create table if not exists public.league_registration_keys (
  name_key text primary key,
  slug_key text not null unique,
  constraint league_registration_name_key_format check (name_key ~ '^[0-9a-f]{64}$'),
  constraint league_registration_slug_key_format check (slug_key ~ '^[0-9a-f]{64}$')
);

alter table public.league_registration_keys enable row level security;

revoke all on table public.league_registration_keys from public, anon, authenticated;
grant select on table public.league_registration_keys to anon, authenticated;
grant all on table public.league_registration_keys to service_role;

drop policy if exists "registration checks read hashed league keys" on public.league_registration_keys;
create policy "registration checks read hashed league keys"
on public.league_registration_keys
for select
to anon, authenticated
using (true);

-- Seed hashes for every current tenant without exposing the underlying names or
-- slugs through the registration endpoint.
insert into public.league_registration_keys (name_key, slug_key)
select
  encode(digest(lower(btrim(l.name)), 'sha256'), 'hex'),
  encode(digest(lower(btrim(l.slug)), 'sha256'), 'hex')
from public.leagues l
on conflict (name_key) do update
set slug_key = excluded.slug_key;

-- Keep the public hash registry transactionally aligned with league identities.
-- The trigger function is never directly executable from anon/authenticated.
create or replace function public.sync_league_registration_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_name_key text;
  v_new_name_key text;
  v_new_slug_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_name_key := encode(digest(lower(btrim(old.name)), 'sha256'), 'hex');
    delete from public.league_registration_keys where name_key = v_old_name_key;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  v_new_name_key := encode(digest(lower(btrim(new.name)), 'sha256'), 'hex');
  v_new_slug_key := encode(digest(lower(btrim(new.slug)), 'sha256'), 'hex');

  insert into public.league_registration_keys (name_key, slug_key)
  values (v_new_name_key, v_new_slug_key)
  on conflict (name_key) do update
  set slug_key = excluded.slug_key;

  return new;
end;
$$;

revoke all on function public.sync_league_registration_keys() from public, anon, authenticated;

drop trigger if exists trg_sync_league_registration_keys on public.leagues;
create trigger trg_sync_league_registration_keys
after insert or update or delete on public.leagues
for each row execute function public.sync_league_registration_keys();

-- Remove an earlier experimental availability RPC if this migration is replayed
-- on a database where it was created manually.
drop function if exists public.check_league_registration_availability(text, text);

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

  -- Friendly checks before INSERT. The unique index/constraint remain the
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
