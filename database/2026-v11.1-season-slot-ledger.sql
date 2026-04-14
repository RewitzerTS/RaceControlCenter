begin;

create extension if not exists pgcrypto;

create table if not exists public.season_team_slots (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 10),
  slot_label text not null,
  is_bot_team boolean not null default false,
  created_at timestamptz not null default now(),
  unique (season_id, slot_number),
  unique (season_id, slot_label)
);

create table if not exists public.season_driver_slots (
  id uuid primary key default gen_random_uuid(),
  season_id bigint not null references public.seasons(id) on delete cascade,
  team_slot_id uuid not null references public.season_team_slots(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 20),
  seat_number integer not null check (seat_number in (1, 2)),
  created_at timestamptz not null default now(),
  unique (season_id, slot_number),
  unique (season_id, team_slot_id, seat_number)
);

create table if not exists public.driver_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_slot_id uuid not null references public.season_driver_slots(id) on delete cascade,
  season_id bigint not null references public.seasons(id) on delete cascade,
  participant_driver_id uuid references public.drivers(id) on delete set null,
  points_owner_driver_id uuid not null references public.drivers(id) on delete cascade,
  participation_mode text not null default 'player' check (participation_mode in ('player', 'bot')),
  effective_from_race_id uuid references public.races(id) on delete set null,
  effective_round_number integer,
  valid_until_race_id uuid references public.races(id) on delete set null,
  valid_until_round_number integer,
  created_at timestamptz not null default now(),
  check (
    effective_round_number is null
    or valid_until_round_number is null
    or effective_round_number <= valid_until_round_number
  )
);

create index if not exists idx_driver_slot_assignments_slot
  on public.driver_slot_assignments(driver_slot_id, effective_round_number, created_at);
create index if not exists idx_driver_slot_assignments_owner
  on public.driver_slot_assignments(points_owner_driver_id);
create index if not exists idx_driver_slot_assignments_season
  on public.driver_slot_assignments(season_id);

alter table public.race_results
  add column if not exists points_owner_driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists points_team_name text,
  add column if not exists points_car_name text,
  add column if not exists source_assignment_id uuid references public.driver_slot_assignments(id) on delete set null;

update public.race_results
set points_owner_driver_id = coalesce(points_owner_driver_id, driver_id)
where points_owner_driver_id is null;

create or replace view public.v_season_points_ledger as
select
  rr.race_id,
  r.season_id,
  rr.driver_id as source_driver_id,
  coalesce(rr.points_owner_driver_id, rr.driver_id) as points_owner_driver_id,
  coalesce(rr.points_team_name, d.league_team, 'Ohne Team') as points_team_name,
  coalesce(rr.points_car_name, d.car_name, '—') as points_car_name,
  rr.awarded_points,
  rr.finish_position,
  rr.fastest_lap_time,
  rr.created_at,
  rr.source_assignment_id
from public.race_results rr
join public.races r on r.id = rr.race_id
left join public.drivers d on d.id = rr.driver_id;

alter table public.season_team_slots enable row level security;
alter table public.season_driver_slots enable row level security;
alter table public.driver_slot_assignments enable row level security;

drop policy if exists "public read season team slots" on public.season_team_slots;
create policy "public read season team slots"
on public.season_team_slots
for select using (true);

drop policy if exists "public read season driver slots" on public.season_driver_slots;
create policy "public read season driver slots"
on public.season_driver_slots
for select using (true);

drop policy if exists "public read driver slot assignments" on public.driver_slot_assignments;
create policy "public read driver slot assignments"
on public.driver_slot_assignments
for select using (true);

drop policy if exists "admins manage season team slots" on public.season_team_slots;
create policy "admins manage season team slots"
on public.season_team_slots
for all
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "admins manage season driver slots" on public.season_driver_slots;
create policy "admins manage season driver slots"
on public.season_driver_slots
for all
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "admins manage driver slot assignments" on public.driver_slot_assignments;
create policy "admins manage driver slot assignments"
on public.driver_slot_assignments
for all
using (public.is_app_admin())
with check (public.is_app_admin());

commit;
