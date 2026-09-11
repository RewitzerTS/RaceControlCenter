# Five-digit league join codes

Each league has an immutable unique five-digit code, shown in league administration.
Internal UUIDs, statistics and membership relations remain unchanged. Onboarding accepts
codes, UUIDs and slugs; the original onboarding RPC stays available for old clients.
Codes only submit a request. They are not credentials and do not bypass approval.

Migration: `20260911142907_league_join_codes.sql`. Apply to an environment before
deploying this frontend there. Applied and rollback regression tested on Staging only.
Production requires separate approval and migration before release.

Allocation uses a non-cycling sequence (10000–99999). Deleted codes are not reused.
Numeric slugs are excluded during allocation; future slugs cannot shadow assigned codes.
Rolled-back allocations consume sequence values intentionally. Before exhaustion a longer
code format will be required; there is no silent reuse or UUID truncation.

Checks: `supabase/tests/league-join-codes.sql`, `src/operations/leagueJoinCode.test.ts`.
Database checks cover backfill, new leagues, immutable/unique codes, collision protection,
UUID/slug/old-client compatibility, pending requests, no duplicate requests, existing
members, archived/unknown codes and authentication/administrator access.
