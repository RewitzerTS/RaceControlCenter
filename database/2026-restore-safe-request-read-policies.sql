-- Restore permissive SELECT policies without re-exposing is_league_member() to anon.
-- Each policy mirrors the existing restrictive request-scope guard. The effective
-- result remains tenant-scoped, while public reads no longer need the revoked
-- SECURITY DEFINER membership helper.

begin;

create policy "read league championship history"
on public.championship_history
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = championship_history.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league driver assignments"
on public.driver_season_assignments
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = driver_season_assignments.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league driver slot assignments"
on public.driver_slot_assignments
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = driver_slot_assignments.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league drivers"
on public.drivers
for select
to anon, authenticated
using (public.matches_requested_league(league_id));

create policy "read league content"
on public.league_content
for select
to anon, authenticated
using (public.matches_requested_league(league_id));

create policy "read league penalties"
on public.race_penalties
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_penalties.race_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league race results"
on public.race_results
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = race_results.race_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league races"
on public.races
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = races.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league season driver slots"
on public.season_driver_slots
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = season_driver_slots.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league season team slots"
on public.season_team_slots
for select
to anon, authenticated
using (
  exists (
    select 1 from public.seasons s
    where s.id = season_team_slots.season_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league seasons"
on public.seasons
for select
to anon, authenticated
using (public.matches_requested_league(league_id));

create policy "read league steward incidents"
on public.steward_incidents
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races r
    join public.seasons s on s.id = r.season_id
    where r.id = steward_incidents.race_id
      and public.matches_requested_league(s.league_id)
  )
);

create policy "read league teams"
on public.teams
for select
to anon, authenticated
using (public.matches_requested_league(league_id));

commit;
