-- Race Control Center - Multi-tenant foundation
-- Step 1: introduce league tenants and per-league memberships.
-- This migration is intentionally additive and does not yet attach existing RCC data to a league.

begin;

create extension if not exists pgcrypto;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  is_public boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leagues_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint leagues_slug_unique unique (slug)
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'steward', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists idx_league_members_user_id
  on public.league_members(user_id);

create index if not exists idx_league_members_league_role
  on public.league_members(league_id, role);

create or replace function public.touch_multi_tenant_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_multi_tenant_updated_at() from public;

drop trigger if exists trg_leagues_updated_at on public.leagues;
create trigger trg_leagues_updated_at
before update on public.leagues
for each row execute function public.touch_multi_tenant_updated_at();

drop trigger if exists trg_league_members_updated_at on public.league_members;
create trigger trg_league_members_updated_at
before update on public.league_members
for each row execute function public.touch_multi_tenant_updated_at();

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

revoke all on table public.leagues from anon, authenticated;
revoke all on table public.league_members from anon, authenticated;
grant select on table public.leagues to anon, authenticated;
grant select on table public.league_members to authenticated;
grant all on table public.leagues to service_role;
grant all on table public.league_members to service_role;

drop policy if exists "public read public leagues" on public.leagues;
create policy "public read public leagues"
on public.leagues
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "members read their leagues" on public.leagues;
create policy "members read their leagues"
on public.leagues
for select
to authenticated
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id = leagues.id
      and lm.user_id = (select auth.uid())
  )
);

drop policy if exists "users read own league memberships" on public.league_members;
create policy "users read own league memberships"
on public.league_members
for select
to authenticated
using (user_id = (select auth.uid()));

commit;
