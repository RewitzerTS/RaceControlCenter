# Phase 30 — V1 Retirement

Status: complete. V1 operational retirement: reversible.

V1 no longer receives production traffic, but it has not been deleted, paused or destructively changed. Phase 30 is an operational retirement with a retained rollback surface, not a shutdown.

## Retained recovery assets

- Recovery branch: `recovery/v1-production-2026-08-21`
- Recovery commit: `2da639e9b4907e226c1a2c9858320e4b73bebee0`
- Recovery ZIP: `RaceVora-V1-recovery-2da639e9b490.zip`
- ZIP SHA-256: `5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132`
- Latest encrypted database/Auth/Storage backup: GitHub Actions run `32527928795`, verified in private EU R2
- V1 Supabase project: retained and not paused
- V1 Worker deployment and custom-domain configuration: retained

No automated job may pause or delete V1. `v1ShutdownAllowed` remains false, even though the owner authorized Phases 29 and 30.

## Production observation

The initial observation window completed after the route switch:

- nine production routes passed;
- no HTTP 5xx response was observed;
- normal navigation had no console error;
- LCP was 833 ms, TTFB 54 ms and CLS 0.00 under the mobile performance profile;
- V1 and V2 `rcc` counts matched exactly: 1 league, 1 season, 24 races, 20 drivers and 451 race results.

Continued monitoring remains appropriate, but the initial rollback gate did not trigger.

## Recovery procedure

For an application-level rollback, deploy the V2 production Worker without the cutover routes using `npm run deploy:production`. This removes the V2 overlay and restores traffic to the preserved V1 custom-domain Worker. Then verify the V1 root, legal routes, authentication and the protected `rcc` counts.

The V1 branch, ZIP, encrypted off-site backup, Worker and Supabase project must remain available until a later separately authorized destruction/retention decision. This phase grants no such authorization.
