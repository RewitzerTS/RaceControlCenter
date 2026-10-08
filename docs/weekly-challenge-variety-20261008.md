# Weekly Challenge variety and Home cleanup

## Scope

- Remove the redundant hero kicker above the Home greeting; retain results actions and the storyline ticker.
- Replace the fixed starts/finishes pair plus one rotating task with an eight-week plan containing twelve metrics.
- Existing six metrics keep their historic semantics. New metrics: top ten, top five, total positions gained, races gaining three places, outside-top-ten to top-ten finishes, and classified finishes at or ahead of grid position.
- All new finish-based metrics require classified results and valid positions. Gains are measured from grid to finish, not inferred on-track overtakes. No telemetry-only goals.
- Each week contains three tasks, worth 100/150/250 VC. No adjacent new weeks share a metric, including cycle wraparound. Some second-half goals require two races or more gained positions.

## Safe rollout

The running cycle, deadline, targets, progress and completion history stay unchanged. A stored cutoff selects the next weekly boundary. The first new set is chosen to avoid the current legacy metrics. Only unused future weekly definitions are deactivated (not deleted). A guard refuses replacement if any future definition already has recorded history. Existing private Cron, result processing, expiry settlement, correction and ledger idempotency remain in use. No browser mutation privileges are added.

Schema migration: `20261008090344_varied_weekly_challenges.sql`, created with the existing Supabase CLI. Production and Staging have different existing weekly anchors; preserve both rather than shifting user deadlines.

## Verification

- Staging transaction rehearsal and post-migration regression: twelve metrics; sixteen sequential plan weeks including wraparound; three tasks and 500 VC per week; no adjacent metric repeats; zero/null grid and invalid finishing statuses; publication completion; BOT exclusion; no payout before expiry; repeated settlement exactly once; voided result reverses rewards; missed-week recovery.
- Synthetic users, races, results and ledger writes are rolled back.
- Private helper ACLs checked. Supabase advisors report no new challenge-helper warning; existing unrelated warnings were not changed.
- Browser regression covers all six new labels on Home and Career, Desktop and mobile, no horizontal overflow, and absence of the hero kicker. Batched screenshots reviewed in both viewport sizes.
- Full mandatory release gate runs before website publication.

User-facing note: the currently active challenges intentionally remain until their original deadline; increased variety begins with the next rotation.
