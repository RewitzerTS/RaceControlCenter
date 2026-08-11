begin;

alter table public.teams add column if not exists league_id uuid references public.leagues(id) on delete cascade;

update public.teams t
set league_id = l.id
from public.leagues l
where t.league_id is null
  and l.slug = 'rcc';

alter table public.teams alter column league_id set not null;

alter table public.teams drop constraint if exists teams_display_name_key;
alter table public.teams drop constraint if exists teams_slug_key;

alter table public.teams
  add constraint teams_league_display_name_key unique (league_id, display_name),
  add constraint teams_league_slug_key unique (league_id, slug);

alter table public.teams enable row level security;

drop policy if exists "admins manage teams" on public.teams;
drop policy if exists "public read teams" on public.teams;

create policy "read league teams"
on public.teams
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = teams.league_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);

create policy "league admins manage teams"
on public.teams
for all
to authenticated
using (public.has_league_role(league_id, array['owner','admin']))
with check (public.has_league_role(league_id, array['owner','admin']));

alter table public.driver_season_assignments enable row level security;

drop policy if exists "admins manage driver assignments" on public.driver_season_assignments;
drop policy if exists "admins manage driver season assignments" on public.driver_season_assignments;
drop policy if exists "public read driver assignments" on public.driver_season_assignments;
drop policy if exists "public read driver season assignments" on public.driver_season_assignments;

create policy "read league driver assignments"
on public.driver_season_assignments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.seasons s
    join public.leagues l on l.id = s.league_id
    where s.id = driver_season_assignments.season_id
      and (l.is_public = true or public.is_league_member(l.id))
  )
);

create policy "league admins manage driver assignments"
on public.driver_season_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.seasons s
    where s.id = driver_season_assignments.season_id
      and public.has_league_role(s.league_id, array['owner','admin'])
  )
)
with check (
  exists (
    select 1
    from public.seasons s
    where s.id = driver_season_assignments.season_id
      and public.has_league_role(s.league_id, array['owner','admin'])
  )
);

create or replace function public.validate_driver_assignment_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_season_league uuid;
  v_driver_league uuid;
  v_team_league uuid;
  v_race_season uuid;
begin
  select s.league_id into v_season_league
  from public.seasons s
  where s.id = new.season_id;

  select d.league_id into v_driver_league
  from public.drivers d
  where d.id = new.driver_id;

  if v_season_league is null or v_driver_league is null or v_season_league <> v_driver_league then
    raise exception 'Driver and season must belong to the same league';
  end if;

  if new.team_id is not null then
    select t.league_id into v_team_league
    from public.teams t
    where t.id = new.team_id;

    if v_team_league is null or v_team_league <> v_season_league then
      raise exception 'Team and season must belong to the same league';
    end if;
  end if;

  if new.effective_from_race_id is not null then
    select r.season_id into v_race_season
    from public.races r
    where r.id = new.effective_from_race_id;

    if v_race_season is null or v_race_season <> new.season_id then
      raise exception 'Effective race must belong to the assignment season';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_driver_assignment_tenant() from public;

drop trigger if exists trg_validate_driver_assignment_tenant on public.driver_season_assignments;
create trigger trg_validate_driver_assignment_tenant
before insert or update of season_id, driver_id, team_id, effective_from_race_id
on public.driver_season_assignments
for each row execute function public.validate_driver_assignment_tenant();

commit;
