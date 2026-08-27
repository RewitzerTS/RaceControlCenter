-- Phase 16 staging correction: cover every stewarding foreign key used by audit and lifecycle queries.

create index if not exists idx_steward_cases_reported on public.steward_cases (reported_driver_id) where reported_driver_id is not null;
create index if not exists idx_steward_votes_supersedes on public.steward_votes (supersedes_vote_id) where supersedes_vote_id is not null;
create index if not exists idx_steward_decisions_result_version on public.steward_decision_versions (result_version_id);
create index if not exists idx_steward_penalties_driver on public.steward_penalties (driver_id);
create index if not exists idx_steward_appeals_resolved_by on public.steward_appeals (resolved_by) where resolved_by is not null;
create index if not exists idx_steward_case_events_actor on public.steward_case_events (actor_user_id) where actor_user_id is not null;

