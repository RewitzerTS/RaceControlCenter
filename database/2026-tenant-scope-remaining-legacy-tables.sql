begin;

-- ai_profiles is a global catalogue. Keep it readable, but no longer writable by league admins.
drop policy if exists "admins manage ai profiles" on public.ai_profiles;

-- Season team slots
alter table public.season_team_slots enable row level security;
drop policy if exists "admins manage season team slots" on public.season_team_slots;
drop policy if exists "public read season team slots" on public.season_team_slots;
create policy "read league season team slots"
on public.season_team_slots for select to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    join public.leagues l on l.id = s.league_id
    where s.id = season_team_slots.season_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);
create policy "league admins manage season team slots"
on public.season_team_slots for all to authenticated
using (
  exists (select 1 from public.seasons s where s.id = season_team_slots.season_id and public.has_league_role(s.league_id, array['owner','admin']))
)
with check (
  exists (select 1 from public.seasons s where s.id = season_team_slots.season_id and public.has_league_role(s.league_id, array['owner','admin']))
);

-- Season driver slots
alter table public.season_driver_slots enable row level security;
drop policy if exists "admins manage season driver slots" on public.season_driver_slots;
drop policy if exists "public read season driver slots" on public.season_driver_slots;
create policy "read league season driver slots"
on public.season_driver_slots for select to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    join public.leagues l on l.id = s.league_id
    where s.id = season_driver_slots.season_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);
create policy "league admins manage season driver slots"
on public.season_driver_slots for all to authenticated
using (
  exists (select 1 from public.seasons s where s.id = season_driver_slots.season_id and public.has_league_role(s.league_id, array['owner','admin']))
)
with check (
  exists (select 1 from public.seasons s where s.id = season_driver_slots.season_id and public.has_league_role(s.league_id, array['owner','admin']))
);

create or replace function public.validate_season_driver_slot_tenant()
returns trigger language plpgsql set search_path = '' as $$
declare v_team_slot_season uuid;
begin
  select sts.season_id into v_team_slot_season
  from public.season_team_slots sts where sts.id = new.team_slot_id;
  if v_team_slot_season is null or v_team_slot_season <> new.season_id then
    raise exception 'Driver slot and team slot must belong to the same season';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_season_driver_slot_tenant() from public;
drop trigger if exists trg_validate_season_driver_slot_tenant on public.season_driver_slots;
create trigger trg_validate_season_driver_slot_tenant
before insert or update of season_id, team_slot_id on public.season_driver_slots
for each row execute function public.validate_season_driver_slot_tenant();

-- Driver slot assignments
alter table public.driver_slot_assignments enable row level security;
drop policy if exists "admins manage driver slot assignments" on public.driver_slot_assignments;
drop policy if exists "public read driver slot assignments" on public.driver_slot_assignments;
create policy "read league driver slot assignments"
on public.driver_slot_assignments for select to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    join public.leagues l on l.id = s.league_id
    where s.id = driver_slot_assignments.season_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);
create policy "league admins manage driver slot assignments"
on public.driver_slot_assignments for all to authenticated
using (
  exists (select 1 from public.seasons s where s.id = driver_slot_assignments.season_id and public.has_league_role(s.league_id, array['owner','admin']))
)
with check (
  exists (select 1 from public.seasons s where s.id = driver_slot_assignments.season_id and public.has_league_role(s.league_id, array['owner','admin']))
);

create or replace function public.validate_driver_slot_assignment_tenant()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_league uuid;
  v_slot_season uuid;
  v_participant_league uuid;
  v_owner_league uuid;
  v_effective_season uuid;
  v_valid_until_season uuid;
begin
  select s.league_id into v_league from public.seasons s where s.id = new.season_id;
  if v_league is null then raise exception 'Season not found'; end if;

  select sds.season_id into v_slot_season from public.season_driver_slots sds where sds.id = new.driver_slot_id;
  if v_slot_season is null or v_slot_season <> new.season_id then
    raise exception 'Driver slot must belong to the assignment season';
  end if;

  if new.participant_driver_id is not null then
    select d.league_id into v_participant_league from public.drivers d where d.id = new.participant_driver_id;
    if v_participant_league is null or v_participant_league <> v_league then
      raise exception 'Participant driver must belong to the assignment league';
    end if;
  end if;

  select d.league_id into v_owner_league from public.drivers d where d.id = new.points_owner_driver_id;
  if v_owner_league is null or v_owner_league <> v_league then
    raise exception 'Points owner driver must belong to the assignment league';
  end if;

  if new.effective_from_race_id is not null then
    select r.season_id into v_effective_season from public.races r where r.id = new.effective_from_race_id;
    if v_effective_season is null or v_effective_season <> new.season_id then
      raise exception 'Effective race must belong to the assignment season';
    end if;
  end if;

  if new.valid_until_race_id is not null then
    select r.season_id into v_valid_until_season from public.races r where r.id = new.valid_until_race_id;
    if v_valid_until_season is null or v_valid_until_season <> new.season_id then
      raise exception 'Valid-until race must belong to the assignment season';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.validate_driver_slot_assignment_tenant() from public;
drop trigger if exists trg_validate_driver_slot_assignment_tenant on public.driver_slot_assignments;
create trigger trg_validate_driver_slot_assignment_tenant
before insert or update of driver_slot_id, season_id, participant_driver_id, points_owner_driver_id, effective_from_race_id, valid_until_race_id
on public.driver_slot_assignments
for each row execute function public.validate_driver_slot_assignment_tenant();

-- Legacy steward incidents: retain for compatibility, but tenant-scope by race.
alter table public.steward_incidents enable row level security;
alter table public.steward_incidents drop constraint if exists steward_incidents_race_id_fkey;
alter table public.steward_incidents add constraint steward_incidents_race_id_fkey foreign key (race_id) references public.races(id) on delete cascade;

drop policy if exists "Admins can manage steward_incidents" on public.steward_incidents;
drop policy if exists "Public read steward_incidents" on public.steward_incidents;
drop policy if exists "steward_incidents_admin_all" on public.steward_incidents;
drop policy if exists "steward_incidents_public_read" on public.steward_incidents;

create policy "read league steward incidents"
on public.steward_incidents for select to anon, authenticated
using (
  exists (
    select 1 from public.races r
    join public.seasons s on s.id = r.season_id
    join public.leagues l on l.id = s.league_id
    where r.id = steward_incidents.race_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);
create policy "league staff manage steward incidents"
on public.steward_incidents for all to authenticated
using (
  exists (
    select 1 from public.races r join public.seasons s on s.id = r.season_id
    where r.id = steward_incidents.race_id
      and public.has_league_role(s.league_id, array['owner','admin','steward'])
  )
)
with check (
  exists (
    select 1 from public.races r join public.seasons s on s.id = r.season_id
    where r.id = steward_incidents.race_id
      and public.has_league_role(s.league_id, array['owner','admin','steward'])
  )
);

create or replace function public.validate_steward_incident_tenant()
returns trigger language plpgsql set search_path = '' as $$
declare v_league uuid; v_driver_league uuid;
begin
  select s.league_id into v_league
  from public.races r join public.seasons s on s.id = r.season_id
  where r.id = new.race_id;
  if v_league is null then raise exception 'Race not found'; end if;

  if new.submitter_driver_id is not null then
    select d.league_id into v_driver_league from public.drivers d where d.id = new.submitter_driver_id;
    if v_driver_league is null or v_driver_league <> v_league then raise exception 'Submitter must belong to the race league'; end if;
  end if;
  if new.accused_driver_id is not null then
    select d.league_id into v_driver_league from public.drivers d where d.id = new.accused_driver_id;
    if v_driver_league is null or v_driver_league <> v_league then raise exception 'Accused driver must belong to the race league'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_steward_incident_tenant() from public;
drop trigger if exists trg_validate_steward_incident_tenant on public.steward_incidents;
create trigger trg_validate_steward_incident_tenant
before insert or update of race_id, submitter_driver_id, accused_driver_id on public.steward_incidents
for each row execute function public.validate_steward_incident_tenant();

commit;
