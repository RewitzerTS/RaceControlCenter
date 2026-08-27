-- Restore the tenant-safe compatibility projection used by embedded V1 result
-- and stewarding modules. The immutable V2 steward_penalties history remains
-- the canonical V2 decision record and is deliberately left unchanged.

begin;

create table public.race_penalties (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  steward_case_id uuid references public.steward_cases(id) on delete set null,
  penalty_type text not null,
  time_delta_ms integer not null default 0,
  points_delta numeric(7,2) not null default 0,
  grid_positions integer not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_penalties_type_check check (
    penalty_type in (
      'time_penalty',
      'time_credit',
      'points_penalty',
      'warning',
      'grid_penalty',
      'dsq'
    )
  ),
  constraint race_penalties_grid_positions_check check (
    (penalty_type = 'grid_penalty' and grid_positions > 0)
    or (penalty_type <> 'grid_penalty' and grid_positions >= 0)
  ),
  constraint race_penalties_reason_length_check check (
    reason is null or char_length(btrim(reason)) between 3 and 500
  )
);

create unique index race_penalties_steward_case_unique_idx
  on public.race_penalties (steward_case_id)
  where steward_case_id is not null;

create index race_penalties_effective_race_type_idx
  on public.race_penalties (race_id, penalty_type, driver_id);

create trigger race_penalties_set_updated_at
before update on public.race_penalties
for each row execute function private.set_updated_at();

alter table public.race_penalties enable row level security;

revoke all on table public.race_penalties from public, anon, authenticated;
grant select on table public.race_penalties to anon, authenticated;
grant insert, update, delete on table public.race_penalties to authenticated;
grant select, insert, update, delete on table public.race_penalties to service_role;

create policy "v2 public read requested league race penalties"
on public.race_penalties
for select
to anon
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
  )
);

create policy "v2 authenticated read requested league race penalties"
on public.race_penalties
for select
to authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
  )
);

create policy "v2 league stewards insert race penalties"
on public.race_penalties
for insert
to authenticated
with check (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    join public.drivers d
      on d.id = race_penalties.driver_id
     and d.league_id = s.league_id
    left join public.steward_cases sc
      on sc.id = race_penalties.steward_case_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
      and (select private.has_league_capability(s.league_id, 'steward'))
      and (
        race_penalties.steward_case_id is null
        or (
          sc.league_id = s.league_id
          and sc.race_id = r.id
        )
      )
  )
);

create policy "v2 league stewards update race penalties"
on public.race_penalties
for update
to authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    join public.drivers d
      on d.id = race_penalties.driver_id
     and d.league_id = s.league_id
    left join public.steward_cases sc
      on sc.id = race_penalties.steward_case_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
      and (select private.has_league_capability(s.league_id, 'steward'))
      and (
        race_penalties.steward_case_id is null
        or (
          sc.league_id = s.league_id
          and sc.race_id = r.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    join public.drivers d
      on d.id = race_penalties.driver_id
     and d.league_id = s.league_id
    left join public.steward_cases sc
      on sc.id = race_penalties.steward_case_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
      and (select private.has_league_capability(s.league_id, 'steward'))
      and (
        race_penalties.steward_case_id is null
        or (
          sc.league_id = s.league_id
          and sc.race_id = r.id
        )
      )
  )
);

create policy "v2 league stewards delete race penalties"
on public.race_penalties
for delete
to authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    join public.drivers d
      on d.id = race_penalties.driver_id
     and d.league_id = s.league_id
    left join public.steward_cases sc
      on sc.id = race_penalties.steward_case_id
    where r.id = race_penalties.race_id
      and (select public.matches_requested_league(s.league_id))
      and (select private.has_league_capability(s.league_id, 'steward'))
      and (
        race_penalties.steward_case_id is null
        or (
          sc.league_id = s.league_id
          and sc.race_id = r.id
        )
      )
  )
);

comment on table public.race_penalties is
  'Tenant-safe mutable compatibility projection for embedded V1 result and stewarding modules; immutable V2 decision history remains in steward_penalties.';

commit;
