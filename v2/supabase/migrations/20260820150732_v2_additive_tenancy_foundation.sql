-- RaceVora V2 Phase 3: isolated staging tenancy foundation.
-- This migration is additive and must never be applied to the Production project.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  logo_url text,
  status text not null default 'active',
  is_public boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leagues_name_length check (char_length(name) between 3 and 80),
  constraint leagues_name_no_markup check (name !~ '[<>]'),
  constraint leagues_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint leagues_slug_length check (char_length(slug) between 3 and 50),
  constraint leagues_slug_unique unique (slug),
  constraint leagues_status_check check (status in ('active', 'suspended', 'archived'))
);

create unique index leagues_name_normalized_unique
  on public.leagues (lower(btrim(name)));
create index idx_leagues_created_by on public.leagues (created_by);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_members_pkey primary key (league_id, user_id),
  constraint league_members_role_check check (role in ('owner', 'admin', 'steward', 'member'))
);

create index idx_league_members_user_id on public.league_members (user_id);
create index idx_league_members_league_role on public.league_members (league_id, role);

create table public.platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.platform_owners enable row level security;

revoke all on table public.leagues from public, anon, authenticated;
revoke all on table public.league_members from public, anon, authenticated;
revoke all on table public.platform_owners from public, anon, authenticated;

grant select on table public.leagues to anon, authenticated;
grant select on table public.league_members to authenticated;
grant select, insert, update, delete on table public.leagues to service_role;
grant select, insert, update, delete on table public.league_members to service_role;
grant select, insert, update, delete on table public.platform_owners to service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;

create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function private.set_updated_at();

create trigger league_members_set_updated_at
before update on public.league_members
for each row execute function private.set_updated_at();

create or replace function public.requested_league_slug()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  request_headers jsonb := coalesce(
    nullif(current_setting('request.headers', true), ''),
    '{}'
  )::jsonb;
  requested_slug text := lower(nullif(btrim(request_headers ->> 'x-rcc-league-slug'), ''));
begin
  if requested_slug is null
     or char_length(requested_slug) not between 3 and 50
     or requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'A valid x-rcc-league-slug request header is required.';
  end if;

  return requested_slug;
end;
$$;

revoke all on function public.requested_league_slug() from public, anon, authenticated, service_role;
grant execute on function public.requested_league_slug() to anon, authenticated, service_role;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.platform_owners po
      where po.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_platform_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_platform_owner() to authenticated, service_role;

create or replace function private.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.league_members lm
      where lm.league_id = p_league_id
        and lm.user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_league_member(uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_league_member(uuid) to authenticated;

create or replace function public.matches_requested_league(p_league_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.slug = public.requested_league_slug()
      and coalesce(l.settings ->> 'owner_only', 'false') <> 'true'
  );
$$;

revoke all on function public.matches_requested_league(uuid) from public, anon, authenticated, service_role;
grant execute on function public.matches_requested_league(uuid) to anon, authenticated, service_role;

create policy "v2 public read requested published league"
on public.leagues
for select
to anon
using (
  is_public
  and status = 'active'
  and coalesce(settings ->> 'published', 'true') = 'true'
  and coalesce(settings ->> 'owner_only', 'false') <> 'true'
  and slug = (select public.requested_league_slug())
);

create policy "v2 authenticated read permitted leagues"
on public.leagues
for select
to authenticated
using (
  (select public.is_platform_owner())
  or (select private.is_league_member(id))
  or (
    is_public
    and status = 'active'
    and coalesce(settings ->> 'published', 'true') = 'true'
    and coalesce(settings ->> 'owner_only', 'false') <> 'true'
    and slug = (select public.requested_league_slug())
  )
);

create policy "v2 users read own membership"
on public.league_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_platform_owner())
);

comment on schema private is 'Internal RaceVora helpers. Not exposed through the Data API.';
comment on table public.leagues is 'V2 tenant registry; compatible with the V1 tenancy contract.';
comment on table public.league_members is 'Legacy-compatible membership foundation. V2 role normalization is Phase 5.';
comment on table public.platform_owners is 'Global RaceVora owner identities; never exposed as normal league members.';
comment on function public.requested_league_slug() is 'Fail-closed canonical tenant header resolver for V2.';
comment on function public.is_platform_owner() is 'Actor-bound client-callable owner check; returns only a boolean.';
