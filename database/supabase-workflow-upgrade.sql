-- Race Control Center · Supabase Migration (2026 workflow)
begin;

create extension if not exists pgcrypto;

alter table public.seasons
  add column if not exists is_active boolean not null default false;

update public.seasons
set is_active = coalesce(is_active, false)
where true;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seasons'
      and column_name = 'is_current'
  ) then
    execute 'update public.seasons set is_active = true where is_current = true and is_active = false';
  end if;
end $$;

drop index if exists public.seasons_one_current_idx;
drop index if exists public.seasons_one_active_idx;
create unique index if not exists seasons_one_active_idx
  on public.seasons (is_active)
  where is_active = true;

alter table public.championship_history
  add column if not exists created_at timestamptz not null default now();

alter table public.races
  add column if not exists season_id bigint references public.seasons(id) on delete cascade;

alter table public.races
  add column if not exists weather text;

alter table public.races
  add column if not exists status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'races_season_round_unique'
  ) then
    alter table public.races
      add constraint races_season_round_unique unique (season_id, round_number);
  end if;
end $$;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.race_result_imports (
  id uuid primary key default gen_random_uuid(),
  race_id bigint not null references public.races(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'under_review', 'published')),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (race_id)
);

create table if not exists public.race_result_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.race_result_imports(id) on delete cascade,
  driver_id bigint not null references public.drivers(id) on delete cascade,
  finish_position integer,
  grid_position integer,
  pit_stops integer not null default 0,
  fastest_lap_time text,
  race_time text,
  awarded_points integer not null default 0,
  participation_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.steward_cases (
  id uuid primary key default gen_random_uuid(),
  race_id bigint not null references public.races(id) on delete cascade,
  title text not null,
  description text,
  driver_1_id bigint references public.drivers(id) on delete set null,
  driver_2_id bigint references public.drivers(id) on delete set null,
  decision_text text,
  consequence text,
  status text not null default 'closed' check (status in ('open', 'reviewed', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.race_penalties (
  id uuid primary key default gen_random_uuid(),
  race_id bigint not null references public.races(id) on delete cascade,
  driver_id bigint not null references public.drivers(id) on delete cascade,
  steward_case_id uuid references public.steward_cases(id) on delete set null,
  penalty_type text not null check (penalty_type in ('time_penalty', 'time_credit')),
  time_delta_ms integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_race_result_import_rows_import_id on public.race_result_import_rows(import_id);
create index if not exists idx_steward_cases_race_id on public.steward_cases(race_id);
create index if not exists idx_race_penalties_race_id on public.race_penalties(race_id);
create index if not exists idx_race_results_race_id on public.race_results(race_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_race_result_imports_updated_at on public.race_result_imports;
create trigger trg_race_result_imports_updated_at
before update on public.race_result_imports
for each row execute function public.set_updated_at();

drop trigger if exists trg_steward_cases_updated_at on public.steward_cases;
create trigger trg_steward_cases_updated_at
before update on public.steward_cases
for each row execute function public.set_updated_at();

alter table public.seasons enable row level security;
alter table public.races enable row level security;
alter table public.drivers enable row level security;
alter table public.race_results enable row level security;
alter table public.championship_history enable row level security;
alter table public.race_result_imports enable row level security;
alter table public.race_result_import_rows enable row level security;
alter table public.steward_cases enable row level security;
alter table public.race_penalties enable row level security;
alter table public.app_admins enable row level security;

create or replace function public.is_app_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = check_user_id
  );
$$;

drop policy if exists "public read seasons" on public.seasons;
create policy "public read seasons" on public.seasons for select using (true);

drop policy if exists "public read races" on public.races;
create policy "public read races" on public.races for select using (true);

drop policy if exists "public read drivers" on public.drivers;
create policy "public read drivers" on public.drivers for select using (true);

drop policy if exists "public read race_results" on public.race_results;
create policy "public read race_results" on public.race_results for select using (true);

drop policy if exists "public read championship_history" on public.championship_history;
create policy "public read championship_history" on public.championship_history for select using (true);

drop policy if exists "public read steward_cases" on public.steward_cases;
create policy "public read steward_cases" on public.steward_cases for select using (true);

drop policy if exists "public read penalties" on public.race_penalties;
create policy "public read penalties" on public.race_penalties for select using (true);

drop policy if exists "admins manage seasons" on public.seasons;
create policy "admins manage seasons" on public.seasons for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage races" on public.races;
create policy "admins manage races" on public.races for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage drivers" on public.drivers;
create policy "admins manage drivers" on public.drivers for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage race_results" on public.race_results;
create policy "admins manage race_results" on public.race_results for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage championship_history" on public.championship_history;
create policy "admins manage championship_history" on public.championship_history for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage imports" on public.race_result_imports;
create policy "admins manage imports" on public.race_result_imports for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage import rows" on public.race_result_import_rows;
create policy "admins manage import rows" on public.race_result_import_rows for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage steward cases" on public.steward_cases;
create policy "admins manage steward cases" on public.steward_cases for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins manage penalties" on public.race_penalties;
create policy "admins manage penalties" on public.race_penalties for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "admins read admin list" on public.app_admins;
create policy "admins read admin list" on public.app_admins for select using (public.is_app_admin());

drop policy if exists "service manages admin list" on public.app_admins;
create policy "service manages admin list" on public.app_admins for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

commit;
