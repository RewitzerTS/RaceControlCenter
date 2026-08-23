-- RaceVora V2 Phases 10-12: covering indexes for gamification foreign keys.
-- Additive staging migration. Never execute against V1 Production.

create index idx_driver_achievement_events_achievement
  on public.driver_achievement_events (achievement_code);
create index idx_driver_achievements_achievement
  on public.driver_achievements (achievement_code);

create index idx_cosmetic_purchases_cosmetic
  on public.cosmetic_purchases (cosmetic_code);
create index idx_driver_cosmetics_cosmetic
  on public.driver_cosmetics (cosmetic_code);
create index idx_driver_cosmetics_purchase
  on public.driver_cosmetics (purchase_id)
  where purchase_id is not null;

create index idx_challenge_races_entered_by_event
  on public.challenge_races (entered_by_event_id);
create index idx_challenge_result_facts_race
  on public.challenge_result_facts (race_id);
create index idx_challenge_result_facts_result_version
  on public.challenge_result_facts (source_result_version_id);
create index idx_challenge_result_facts_reconciled_event
  on public.challenge_result_facts (reconciled_by_event_id);
create index idx_driver_challenge_events_challenge
  on public.driver_challenge_events (challenge_code);
create index idx_driver_challenge_events_result_version
  on public.driver_challenge_events (source_result_version_id)
  where source_result_version_id is not null;
create index idx_driver_challenges_challenge
  on public.driver_challenges (challenge_code);
