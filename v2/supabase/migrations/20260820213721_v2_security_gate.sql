-- RaceVora V2 Phase 25: defense-in-depth for the private Steward case counter.
-- This migration is additive to V2 Staging and must never run on the V1 Production project.

alter table private.steward_case_counters enable row level security;
revoke all on table private.steward_case_counters from public, anon, authenticated;

comment on table private.steward_case_counters is
  'Internal SECURITY DEFINER sequence state. Browser roles have no grants or policies.';
