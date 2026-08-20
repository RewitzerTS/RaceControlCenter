-- RaceVora V2 Phase 6: immutable result versions and an explicit current projection.
-- This migration is additive to the isolated V2 staging model and must never run on V1 Production.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  championship_code text,
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  game_key text not null default 'f1_25',
  game_label text not null default 'F1 25',
  league_id uuid not null references public.leagues(id) on delete restrict,
  constraint seasons_league_slug_unique unique (league_id, slug),
  constraint seasons_league_name_unique unique (league_id, name),
  constraint seasons_date_order_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create index idx_seasons_league_id on public.seasons (league_id);

create table public.races (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  round_number integer not null,
  grand_prix_name text not null,
  circuit_name text,
  country_code text,
  weekend_start_date date,
  race_date date,
  race_start_at timestamptz,
  weather text,
  track_image text,
  status text not null default 'upcoming',
  race_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  race_time text,
  has_sprint boolean not null default false,
  current_result_version_id uuid,
  next_result_version_number integer not null default 1,
  constraint races_season_round_unique unique (season_id, round_number),
  constraint races_status_check check (status in ('upcoming', 'completed', 'cancelled')),
  constraint races_round_positive_check check (round_number > 0),
  constraint races_next_result_version_positive_check check (next_result_version_number > 0)
);

create index idx_races_season_id on public.races (season_id);
create unique index races_current_result_version_unique
  on public.races (current_result_version_id)
  where current_result_version_id is not null;

create table public.result_versions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  version_number integer not null,
  previous_version_id uuid references public.result_versions(id) on delete restrict,
  source_import_id uuid,
  status text not null default 'draft',
  change_reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  superseded_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  constraint result_versions_race_number_unique unique (race_id, version_number),
  constraint result_versions_number_positive_check check (version_number > 0),
  constraint result_versions_status_check
    check (status in ('draft', 'validated', 'active', 'superseded', 'void')),
  constraint result_versions_reason_length_check
    check (char_length(btrim(change_reason)) between 3 and 500),
  constraint result_versions_not_self_referential_check
    check (previous_version_id is null or previous_version_id <> id),
  constraint result_versions_validation_audit_check check (
    (status = 'draft' and validated_at is null)
    or (status <> 'draft' and validated_at is not null)
  ),
  constraint result_versions_activation_audit_check check (
    (status in ('active', 'superseded', 'void') and activated_at is not null)
    or (status in ('draft', 'validated') and activated_at is null)
  ),
  constraint result_versions_superseded_audit_check check (
    (status = 'superseded' and superseded_at is not null)
    or (status <> 'superseded' and superseded_at is null)
  ),
  constraint result_versions_void_audit_check check (
    (status = 'void' and voided_at is not null and char_length(btrim(void_reason)) between 3 and 500)
    or (status <> 'void' and voided_at is null and void_reason is null)
  )
);

create index idx_result_versions_race_id on public.result_versions (race_id);
create index idx_result_versions_previous_version_id
  on public.result_versions (previous_version_id)
  where previous_version_id is not null;
create unique index result_versions_one_active_per_race
  on public.result_versions (race_id)
  where status = 'active';

alter table public.races
  add constraint races_current_result_version_id_fkey
  foreign key (current_result_version_id)
  references public.result_versions(id)
  on delete restrict
  deferrable initially immediate;

create table public.result_version_rows (
  id uuid primary key default gen_random_uuid(),
  result_version_id uuid not null references public.result_versions(id) on delete cascade,
  row_order integer not null,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  team_id uuid,
  source_assignment_id uuid,
  car_name_snapshot text,
  ai_driver_reference_snapshot text,
  grid_position integer,
  finish_position integer,
  race_time_ms bigint,
  fastest_lap_time_ms bigint,
  pit_stops integer not null default 0,
  participation_status text not null default 'PLAYER',
  base_points numeric(7,2) not null default 0,
  penalty_time_delta_ms integer not null default 0,
  awarded_points numeric(7,2) not null default 0,
  notes text,
  fastest_lap_time text,
  race_time text,
  points_owner_driver_id uuid references public.drivers(id) on delete set null,
  points_team_name text,
  points_car_name text,
  points numeric not null default 0,
  fastest_lap_ms bigint,
  created_at timestamptz not null default now(),
  constraint result_version_rows_version_driver_unique unique (result_version_id, driver_id),
  constraint result_version_rows_version_order_unique unique (result_version_id, row_order),
  constraint result_version_rows_order_positive_check check (row_order > 0),
  constraint result_version_rows_grid_position_check check (grid_position is null or grid_position > 0),
  constraint result_version_rows_finish_position_check check (finish_position is null or finish_position > 0),
  constraint result_version_rows_race_time_check check (race_time_ms is null or race_time_ms >= 0),
  constraint result_version_rows_fastest_lap_check check (fastest_lap_time_ms is null or fastest_lap_time_ms >= 0),
  constraint result_version_rows_fastest_lap_compat_check check (fastest_lap_ms is null or fastest_lap_ms >= 0),
  constraint result_version_rows_pit_stops_check check (pit_stops >= 0),
  constraint result_version_rows_participation_status_check
    check (upper(participation_status) in ('PLAYER', 'BOT'))
);

create index idx_result_version_rows_version_id
  on public.result_version_rows (result_version_id);
create index idx_result_version_rows_driver_id
  on public.result_version_rows (driver_id);

create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  result_version_id uuid not null references public.result_versions(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  team_id uuid,
  source_assignment_id uuid,
  car_name_snapshot text,
  ai_driver_reference_snapshot text,
  grid_position integer,
  finish_position integer,
  race_time_ms bigint,
  fastest_lap_time_ms bigint,
  pit_stops integer not null default 0,
  participation_status text not null default 'PLAYER',
  base_points numeric(7,2) not null default 0,
  penalty_time_delta_ms integer not null default 0,
  awarded_points numeric(7,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fastest_lap_time text,
  race_time text,
  points_owner_driver_id uuid references public.drivers(id) on delete set null,
  points_team_name text,
  points_car_name text,
  points numeric not null default 0,
  fastest_lap_ms bigint,
  constraint race_results_race_driver_unique unique (race_id, driver_id),
  constraint race_results_participation_status_check
    check (upper(participation_status) in ('PLAYER', 'BOT'))
);

create index idx_race_results_race_id on public.race_results (race_id);
create index idx_race_results_result_version_id on public.race_results (result_version_id);
create index idx_race_results_driver_id on public.race_results (driver_id);

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function private.set_updated_at();

create trigger races_set_updated_at
before update on public.races
for each row execute function private.set_updated_at();

create trigger race_results_set_updated_at
before update on public.race_results
for each row execute function private.set_updated_at();

create or replace function private.validate_result_version_lineage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_race_id uuid;
begin
  if new.previous_version_id is null then
    return new;
  end if;

  select rv.race_id into previous_race_id
  from public.result_versions rv
  where rv.id = new.previous_version_id;

  if previous_race_id is distinct from new.race_id then
    raise exception using
      errcode = '23514',
      message = 'A result version may only follow a version of the same race.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_result_version_lineage()
  from public, anon, authenticated, service_role;

create trigger result_versions_validate_lineage
before insert or update of race_id, previous_version_id on public.result_versions
for each row execute function private.validate_result_version_lineage();

create or replace function private.protect_result_version_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using
        errcode = '23514',
        message = 'An official result version cannot be deleted.';
    end if;
    return old;
  end if;

  if new.id <> old.id
     or new.race_id <> old.race_id
     or new.version_number <> old.version_number
     or new.previous_version_id is distinct from old.previous_version_id
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception using
      errcode = '23514',
      message = 'Result version identity and lineage are immutable.';
  end if;

  if old.status <> 'draft' and (
    new.source_import_id is distinct from old.source_import_id
    or new.change_reason <> old.change_reason
  ) then
    raise exception using
      errcode = '23514',
      message = 'Official result version metadata is immutable.';
  end if;

  if not (
    (old.status = 'draft' and new.status in ('draft', 'validated'))
    or (old.status = 'validated' and new.status in ('validated', 'active'))
    or (old.status = 'active' and new.status in ('active', 'superseded', 'void'))
    or (old.status = 'superseded' and new.status = 'superseded')
    or (old.status = 'void' and new.status = 'void')
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invalid result version lifecycle transition.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_result_version_history()
  from public, anon, authenticated, service_role;

create trigger result_versions_protect_history
before update or delete on public.result_versions
for each row execute function private.protect_result_version_history();

create or replace function private.protect_result_version_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid := case when tg_op = 'DELETE' then old.result_version_id else new.result_version_id end;
  target_status text;
  target_league_id uuid;
  driver_league_id uuid;
begin
  if tg_op = 'UPDATE' and new.result_version_id <> old.result_version_id then
    raise exception using
      errcode = '23514',
      message = 'A result row cannot move between versions.';
  end if;

  select rv.status, s.league_id
    into target_status, target_league_id
  from public.result_versions rv
  join public.races r on r.id = rv.race_id
  join public.seasons s on s.id = r.season_id
  where rv.id = target_version_id;

  if target_status is distinct from 'draft' then
    raise exception using
      errcode = '23514',
      message = 'Rows of a validated or official result version are immutable.';
  end if;

  if tg_op <> 'DELETE' then
    select d.league_id into driver_league_id
    from public.drivers d
    where d.id = new.driver_id;

    if driver_league_id is distinct from target_league_id then
      raise exception using
        errcode = '23514',
        message = 'A result row driver must belong to the race league.';
    end if;

    if new.points_owner_driver_id is not null and not exists (
      select 1 from public.drivers d
      where d.id = new.points_owner_driver_id
        and d.league_id = target_league_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'A points owner must belong to the race league.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_result_version_row()
  from public, anon, authenticated, service_role;

create trigger result_version_rows_protect_history
before insert or update or delete on public.result_version_rows
for each row execute function private.protect_result_version_row();

create or replace function private.validate_race_current_result_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_race_id uuid;
  target_status text;
begin
  if new.current_result_version_id is null then
    return new;
  end if;

  select rv.race_id, rv.status
    into target_race_id, target_status
  from public.result_versions rv
  where rv.id = new.current_result_version_id;

  if target_race_id is distinct from new.id or target_status is distinct from 'active' then
    raise exception using
      errcode = '23514',
      message = 'The current result pointer must reference an active version of this race.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_race_current_result_version()
  from public, anon, authenticated, service_role;

create trigger races_validate_current_result_version
before insert or update of current_result_version_id on public.races
for each row execute function private.validate_race_current_result_version();

create or replace function private.create_result_version(
  p_race_id uuid,
  p_change_reason text,
  p_previous_version_id uuid default null,
  p_source_import_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  race_record public.races%rowtype;
  new_version_id uuid := gen_random_uuid();
begin
  select * into race_record
  from public.races r
  where r.id = p_race_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Race not found.';
  end if;

  if race_record.current_result_version_id is distinct from p_previous_version_id then
    raise exception using
      errcode = '40001',
      message = 'The revision base is no longer the current official version.';
  end if;

  insert into public.result_versions (
    id, race_id, version_number, previous_version_id, source_import_id,
    change_reason, created_by
  ) values (
    new_version_id, p_race_id, race_record.next_result_version_number,
    p_previous_version_id, p_source_import_id, btrim(p_change_reason), auth.uid()
  );

  update public.races
  set next_result_version_number = next_result_version_number + 1
  where id = p_race_id;

  return new_version_id;
end;
$$;

revoke all on function private.create_result_version(uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.create_result_version(uuid, text, uuid, uuid)
  to service_role;

create or replace function private.validate_result_version(p_result_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
begin
  select rv.status into target_status
  from public.result_versions rv
  where rv.id = p_result_version_id
  for update;

  if target_status is distinct from 'draft' then
    raise exception using
      errcode = '23514',
      message = 'Only a draft result version can be validated.';
  end if;

  if not exists (
    select 1 from public.result_version_rows rvr
    where rvr.result_version_id = p_result_version_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'An official result version requires at least one row.';
  end if;

  update public.result_versions
  set status = 'validated',
      validated_by = auth.uid(),
      validated_at = now()
  where id = p_result_version_id;
end;
$$;

revoke all on function private.validate_result_version(uuid)
  from public, anon, authenticated;
grant execute on function private.validate_result_version(uuid)
  to service_role;

create or replace function private.activate_result_version(p_result_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_record public.result_versions%rowtype;
  race_record public.races%rowtype;
begin
  select * into version_record
  from public.result_versions rv
  where rv.id = p_result_version_id;

  if not found or version_record.status <> 'validated' then
    raise exception using
      errcode = '23514',
      message = 'Only a validated result version can be activated.';
  end if;

  select * into race_record
  from public.races r
  where r.id = version_record.race_id
  for update;

  if race_record.current_result_version_id is distinct from version_record.previous_version_id then
    raise exception using
      errcode = '40001',
      message = 'The validated revision is based on a stale official version.';
  end if;

  if race_record.current_result_version_id is not null then
    update public.result_versions
    set status = 'superseded', superseded_at = now()
    where id = race_record.current_result_version_id
      and status = 'active';

    if not found then
      raise exception using
        errcode = '23514',
        message = 'The current result pointer is inconsistent.';
    end if;
  end if;

  update public.result_versions
  set status = 'active',
      activated_by = auth.uid(),
      activated_at = now()
  where id = p_result_version_id;

  delete from public.race_results
  where race_id = version_record.race_id;

  insert into public.race_results (
    race_id, result_version_id, driver_id, team_id, source_assignment_id,
    car_name_snapshot, ai_driver_reference_snapshot, grid_position, finish_position,
    race_time_ms, fastest_lap_time_ms, pit_stops, participation_status,
    base_points, penalty_time_delta_ms, awarded_points, notes,
    fastest_lap_time, race_time, points_owner_driver_id, points_team_name,
    points_car_name, points, fastest_lap_ms
  )
  select
    version_record.race_id, rvr.result_version_id, rvr.driver_id, rvr.team_id,
    rvr.source_assignment_id, rvr.car_name_snapshot, rvr.ai_driver_reference_snapshot,
    rvr.grid_position, rvr.finish_position, rvr.race_time_ms,
    rvr.fastest_lap_time_ms, rvr.pit_stops, rvr.participation_status,
    rvr.base_points, rvr.penalty_time_delta_ms, rvr.awarded_points, rvr.notes,
    rvr.fastest_lap_time, rvr.race_time, rvr.points_owner_driver_id,
    rvr.points_team_name, rvr.points_car_name, rvr.points, rvr.fastest_lap_ms
  from public.result_version_rows rvr
  where rvr.result_version_id = p_result_version_id
  order by rvr.row_order;

  update public.races
  set current_result_version_id = p_result_version_id,
      status = 'completed'
  where id = version_record.race_id;
end;
$$;

revoke all on function private.activate_result_version(uuid)
  from public, anon, authenticated;
grant execute on function private.activate_result_version(uuid)
  to service_role;

create or replace function private.void_current_result_version(
  p_race_id uuid,
  p_void_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  race_record public.races%rowtype;
begin
  select * into race_record
  from public.races r
  where r.id = p_race_id
  for update;

  if not found or race_record.current_result_version_id is null then
    raise exception using
      errcode = '23514',
      message = 'The race has no current official result to void.';
  end if;

  if p_void_reason is null or char_length(btrim(p_void_reason)) not between 3 and 500 then
    raise exception using
      errcode = '22023',
      message = 'A void reason between 3 and 500 characters is required.';
  end if;

  update public.result_versions
  set status = 'void',
      voided_by = auth.uid(),
      voided_at = now(),
      void_reason = btrim(p_void_reason)
  where id = race_record.current_result_version_id
    and race_id = p_race_id
    and status = 'active';

  if not found then
    raise exception using
      errcode = '23514',
      message = 'The current result pointer is inconsistent.';
  end if;

  delete from public.race_results where race_id = p_race_id;

  update public.races
  set current_result_version_id = null
  where id = p_race_id;
end;
$$;

revoke all on function private.void_current_result_version(uuid, text)
  from public, anon, authenticated;
grant execute on function private.void_current_result_version(uuid, text)
  to service_role;

alter table public.seasons enable row level security;
alter table public.races enable row level security;
alter table public.result_versions enable row level security;
alter table public.result_version_rows enable row level security;
alter table public.race_results enable row level security;

revoke all on table public.seasons from public, anon, authenticated;
revoke all on table public.races from public, anon, authenticated;
revoke all on table public.result_versions from public, anon, authenticated;
revoke all on table public.result_version_rows from public, anon, authenticated;
revoke all on table public.race_results from public, anon, authenticated;

grant select on table public.seasons to anon, authenticated;
grant select on table public.races to anon, authenticated;
grant select on table public.result_versions to anon, authenticated;
grant select on table public.result_version_rows to anon, authenticated;
grant select on table public.race_results to anon, authenticated;

grant select, insert, update, delete on table public.seasons to service_role;
grant select, insert, update, delete on table public.races to service_role;
grant select, insert, update, delete on table public.result_versions to service_role;
grant select, insert, update, delete on table public.result_version_rows to service_role;
grant select, insert, update, delete on table public.race_results to service_role;

create policy "v2 public read requested league seasons"
on public.seasons for select to anon
using ((select public.matches_requested_league(league_id)));

create policy "v2 authenticated read requested league seasons"
on public.seasons for select to authenticated
using ((select public.matches_requested_league(league_id)));

create policy "v2 public read requested league races"
on public.races for select to anon
using (exists (
  select 1 from public.seasons s
  where s.id = season_id
    and (select public.matches_requested_league(s.league_id))
));

create policy "v2 authenticated read requested league races"
on public.races for select to authenticated
using (exists (
  select 1 from public.seasons s
  where s.id = season_id
    and (select public.matches_requested_league(s.league_id))
));

create policy "v2 public read requested official result versions"
on public.result_versions for select to anon
using (
  status in ('active', 'superseded', 'void')
  and exists (
    select 1 from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_id
      and (select public.matches_requested_league(s.league_id))
  )
);

create policy "v2 authenticated read requested official result versions"
on public.result_versions for select to authenticated
using (
  status in ('active', 'superseded', 'void')
  and exists (
    select 1 from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_id
      and (select public.matches_requested_league(s.league_id))
  )
);

create policy "v2 public read requested official result rows"
on public.result_version_rows for select to anon
using (exists (
  select 1 from public.result_versions rv
  join public.races r on r.id = rv.race_id
  join public.seasons s on s.id = r.season_id
  where rv.id = result_version_id
    and rv.status in ('active', 'superseded', 'void')
    and (select public.matches_requested_league(s.league_id))
));

create policy "v2 authenticated read requested official result rows"
on public.result_version_rows for select to authenticated
using (exists (
  select 1 from public.result_versions rv
  join public.races r on r.id = rv.race_id
  join public.seasons s on s.id = r.season_id
  where rv.id = result_version_id
    and rv.status in ('active', 'superseded', 'void')
    and (select public.matches_requested_league(s.league_id))
));

create policy "v2 public read requested current result projection"
on public.race_results for select to anon
using (exists (
  select 1 from public.races r
  join public.seasons s on s.id = r.season_id
  where r.id = race_id
    and r.current_result_version_id = result_version_id
    and (select public.matches_requested_league(s.league_id))
));

create policy "v2 authenticated read requested current result projection"
on public.race_results for select to authenticated
using (exists (
  select 1 from public.races r
  join public.seasons s on s.id = r.season_id
  where r.id = race_id
    and r.current_result_version_id = result_version_id
    and (select public.matches_requested_league(s.league_id))
));

comment on column public.races.current_result_version_id is
  'Explicit authoritative current official result. Never infer current state from version_number.';
comment on column public.races.next_result_version_number is
  'Race-local monotonic counter allocated under row lock; not a current-state selector.';
comment on table public.result_versions is
  'Immutable result revision history. Official versions are superseded or voided, never overwritten.';
comment on table public.result_version_rows is
  'Immutable rows once their result version leaves draft status.';
comment on table public.race_results is
  'Fast current official projection, atomically rebuilt from races.current_result_version_id.';
comment on function private.activate_result_version(uuid) is
  'Server-only atomic publish/revision boundary: activate version, rebuild projection, update explicit pointer.';
comment on function private.void_current_result_version(uuid, text) is
  'Server-only withdrawal boundary: preserve history, clear current projection and explicit pointer.';
