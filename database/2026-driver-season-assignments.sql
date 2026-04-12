begin;

create extension if not exists pgcrypto;

create table if not exists public.driver_season_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  season_id bigint references public.seasons(id) on delete cascade,
  effective_from_race_id uuid references public.races(id) on delete set null,
  league_team text,
  car_name text,
  ai_driver_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_season_assignments_driver_id
  on public.driver_season_assignments(driver_id);

create index if not exists idx_driver_season_assignments_season_id
  on public.driver_season_assignments(season_id);

create index if not exists idx_driver_season_assignments_effective_from_race_id
  on public.driver_season_assignments(effective_from_race_id);

alter table public.driver_season_assignments enable row level security;

drop policy if exists "public read driver season assignments" on public.driver_season_assignments;
create policy "public read driver season assignments"
on public.driver_season_assignments
for select
using (true);

drop policy if exists "admins manage driver season assignments" on public.driver_season_assignments;
create policy "admins manage driver season assignments"
on public.driver_season_assignments
for all
using (public.is_app_admin())
with check (public.is_app_admin());

commit;
