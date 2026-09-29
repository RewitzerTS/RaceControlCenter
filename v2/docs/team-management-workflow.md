# Team-centred league management — 2026-09-29

## Accepted rules
- A league team contains up to two human drivers, independently of the F1 cars they drive.
- Current-season lineup edits require an explicitly selected untouched race; no default effective round.
- A departing driver must be assigned to a different existing team in the same transaction. Create an empty destination team first if needed.
- Previous results, scoring algorithms, cars, identity links and career/XP records remain unchanged.
- Next-season preferences have a separate view. The established current-season assignment operation also retains its existing next-season preference update.

## User workflow
Ligaleitung → Liga → Teams opens the team-first overview. Current season is initially read-only. Select a race, then create a named team or edit its two driver places. Each driver shows the canonical gamertag and independent car. Required outgoing destinations appear in the same editor. The whole change either saves or rolls back.

Next season prepares preferences without changing active-season vehicle/team history. Unassigned drivers and previous administration tools remain available. No real league was automatically rearranged by this release.

## Implementation boundary
The read API combines the saved team catalogue with actual effective-dated season team names, so legacy teams are not hidden. Narrow private implementations authorize the league admin and expose authenticated invoker wrappers. Saves lock the league, season and drivers, compare a revision, validate two-driver capacity (including scheduled later arrivals), and reuse the existing assignment operation.

Published/draft result locks and later driver-change protections remain in effect. A stale form requires explicit reload. Network and validation failures retain the draft.

## Verification
- 13 helper/API unit tests passed.
- 12 targeted browser cases passed across 1280px desktop and 390px mobile, including existing directory/season-wizard regressions.
- Final contrast correction reran creation plus computed focus/selection contrast assertions on both viewports successfully.
- Synthetic transaction tests passed in Staging and Production, then rolled back: explicit round, duplicate/foreign profiles, destination requirement, simultaneous swap, capacity now and at future boundaries, stale revision, next-season separation, locked races, failed-operation atomicity, legacy team visibility, car/history preservation and outsider denial.
- Static Impeccable detector on changed UI targets returned no findings. Independent visual review requested contrast-safe focus/selection; the correction uses existing semantic text/surface tokens.
- Supabase security advisors: existing 44 authenticated public-definer warnings, 14 private deny-all RLS information notices and leaked-password-protection warning; no new public definer or exposed table.
- Production publication must run the repository's mandatory full verification/build/browser gate; it is not bypassed by these targeted checks.
