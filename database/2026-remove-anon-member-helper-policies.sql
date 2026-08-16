-- Remove legacy mixed public/member read policies that invoke is_league_member().
-- Anonymous EXECUTE on that SECURITY DEFINER helper is intentionally revoked.
-- Tenant-scoped reads remain covered by the existing "request scope ..." policies,
-- which resolve the requested league through leagues RLS; authenticated staff keep
-- their existing management policies.

begin;

drop policy if exists "read league championship history" on public.championship_history;
drop policy if exists "read league driver assignments" on public.driver_season_assignments;
drop policy if exists "read league driver slot assignments" on public.driver_slot_assignments;
drop policy if exists "read league drivers" on public.drivers;
drop policy if exists "read league content" on public.league_content;
drop policy if exists "read league penalties" on public.race_penalties;
drop policy if exists "read league race results" on public.race_results;
drop policy if exists "read league races" on public.races;
drop policy if exists "read league season driver slots" on public.season_driver_slots;
drop policy if exists "read league season team slots" on public.season_team_slots;
drop policy if exists "read league seasons" on public.seasons;
drop policy if exists "read league steward incidents" on public.steward_incidents;
drop policy if exists "read league teams" on public.teams;

commit;
