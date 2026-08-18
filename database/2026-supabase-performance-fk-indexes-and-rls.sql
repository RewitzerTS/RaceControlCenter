-- RaceVora Supabase performance hardening
-- 2026-08-18
-- Goals:
--   1) add covering indexes for every currently unindexed public foreign key
--   2) avoid per-row auth function evaluation in flagged RLS policies
--   3) remove exact duplicate request-scope SELECT policies
--
-- This migration does not modify business data.

-- ---------------------------------------------------------------------------
-- Foreign-key covering indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_ai_analysis_usage_league_id
  on public.ai_analysis_usage (league_id);

create index if not exists idx_driver_season_assignments_ai_profile_id
  on public.driver_season_assignments (ai_profile_id);
create index if not exists idx_driver_season_assignments_team_id
  on public.driver_season_assignments (team_id);

create index if not exists idx_driver_slot_assignments_effective_from_race_id
  on public.driver_slot_assignments (effective_from_race_id);
create index if not exists idx_driver_slot_assignments_participant_driver_id
  on public.driver_slot_assignments (participant_driver_id);
create index if not exists idx_driver_slot_assignments_valid_until_race_id
  on public.driver_slot_assignments (valid_until_race_id);

create index if not exists idx_leagues_created_by
  on public.leagues (created_by);

create index if not exists idx_race_penalties_steward_case_id
  on public.race_penalties (steward_case_id);

create index if not exists idx_race_result_import_rows_driver_id
  on public.race_result_import_rows (driver_id);

create index if not exists idx_race_result_imports_imported_by
  on public.race_result_imports (imported_by);
create index if not exists idx_race_result_imports_published_by
  on public.race_result_imports (published_by);

create index if not exists idx_race_results_points_owner_driver_id
  on public.race_results (points_owner_driver_id);
create index if not exists idx_race_results_source_assignment_id
  on public.race_results (source_assignment_id);

create index if not exists idx_race_substitutions_assignment_id
  on public.race_substitutions (assignment_id);
create index if not exists idx_race_substitutions_created_by
  on public.race_substitutions (created_by);
create index if not exists idx_race_substitutions_driver_slot_id
  on public.race_substitutions (driver_slot_id);
create index if not exists idx_race_substitutions_points_owner_driver_id
  on public.race_substitutions (points_owner_driver_id);
create index if not exists idx_race_substitutions_primary_driver_id
  on public.race_substitutions (primary_driver_id);

create index if not exists idx_season_driver_slots_team_slot_id
  on public.season_driver_slots (team_slot_id);

create index if not exists idx_steward_cases_created_by
  on public.steward_cases (created_by);
create index if not exists idx_steward_cases_driver_1_id
  on public.steward_cases (driver_1_id);
create index if not exists idx_steward_cases_driver_2_id
  on public.steward_cases (driver_2_id);

create index if not exists idx_steward_incidents_accused_driver_id
  on public.steward_incidents (accused_driver_id);
create index if not exists idx_steward_incidents_race_id
  on public.steward_incidents (race_id);
create index if not exists idx_steward_incidents_submitter_driver_id
  on public.steward_incidents (submitter_driver_id);

-- ---------------------------------------------------------------------------
-- RLS init-plan optimizations
-- auth.uid()/auth.role() are statement-stable for these policies, so wrapping
-- them in scalar SELECTs lets PostgreSQL evaluate them once per statement.
-- ---------------------------------------------------------------------------
alter policy "Users can read own admin profile"
  on public.admin_profiles
  using (id = (select auth.uid()));

-- Preserve the legacy service-role-only policy without deprecated auth.role().
drop policy if exists "service manages admin list" on public.app_admins;
create policy "service manages admin list"
  on public.app_admins
  for all
  to service_role
  using (true)
  with check (true);

alter policy "read permitted league memberships"
  on public.league_members
  using (
    user_id = (select auth.uid())
    or (select public.is_platform_owner())
    or public.can_manage_league(league_id)
  );

alter policy "members read own track notes"
  on public.driver_track_notes
  using (
    user_id = (select auth.uid())
    and public.matches_requested_league(league_id)
    and (
      (select public.is_platform_owner())
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = driver_track_notes.league_id
          and lm.user_id = (select auth.uid())
      )
    )
  );

alter policy "members insert own track notes"
  on public.driver_track_notes
  with check (
    user_id = (select auth.uid())
    and public.matches_requested_league(league_id)
    and (
      (select public.is_platform_owner())
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = driver_track_notes.league_id
          and lm.user_id = (select auth.uid())
      )
    )
  );

alter policy "members update own track notes"
  on public.driver_track_notes
  using (
    user_id = (select auth.uid())
    and public.matches_requested_league(league_id)
    and (
      (select public.is_platform_owner())
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = driver_track_notes.league_id
          and lm.user_id = (select auth.uid())
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.matches_requested_league(league_id)
    and (
      (select public.is_platform_owner())
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = driver_track_notes.league_id
          and lm.user_id = (select auth.uid())
      )
    )
  );

alter policy "members delete own track notes"
  on public.driver_track_notes
  using (
    user_id = (select auth.uid())
    and public.matches_requested_league(league_id)
    and (
      (select public.is_platform_owner())
      or exists (
        select 1
        from public.league_members lm
        where lm.league_id = driver_track_notes.league_id
          and lm.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Exact duplicate SELECT policies
-- The corresponding "read league ..." policy has the same roles and USING
-- expression, so dropping these removes redundant RLS evaluation only.
-- ---------------------------------------------------------------------------
drop policy if exists "request scope championship history" on public.championship_history;
drop policy if exists "request scope driver season assignments" on public.driver_season_assignments;
drop policy if exists "request scope driver slot assignments" on public.driver_slot_assignments;
drop policy if exists "request scope drivers" on public.drivers;
drop policy if exists "request scope league content" on public.league_content;
drop policy if exists "request scope race penalties" on public.race_penalties;
drop policy if exists "request scope race results" on public.race_results;
drop policy if exists "request scope races" on public.races;
drop policy if exists "request scope season driver slots" on public.season_driver_slots;
drop policy if exists "request scope season team slots" on public.season_team_slots;
drop policy if exists "request scope seasons" on public.seasons;
drop policy if exists "request scope steward incidents" on public.steward_incidents;
drop policy if exists "request scope teams" on public.teams;
