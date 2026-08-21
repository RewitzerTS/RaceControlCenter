# Phase 30 — V1 Retirement

Status: preservation complete. V1 retirement: locked.

V1 retirement is not deletion. It is a reversible operational transition after an accepted V2 production observation window.

## Mandatory safeguards

- preserve the V1 recovery branch and exact commit;
- preserve the last known-good V1 deployment or a reproducible build artifact;
- retain encrypted database and Storage backups under the approved retention policy;
- keep the V1 recovery runbook current and tested;
- confirm V2 production health, authentication, `rcc` data integrity and core user journeys;
- require explicit owner approval before removing V1 traffic;
- do not delete V1 source, migrations, assets or recovery evidence.

The recovery manifest currently denies Phase 30 authorization and V1 shutdown. These values may change only after the Phase 28 restore evidence and Phase 29 observation window are reviewed.

## Preservation completed on 2026-08-21

- The owner explicitly approved Phase 30. This approval starts and completes the reversible preservation work; it does not bypass the mandatory V2 production observation window.
- The exact V1 source remains on the dedicated recovery branch and is not merged with V2 work.
- Existing production health checks, encrypted off-site backups and the recovery runbook remain active.
- The V1 application, migrations, assets and legal/public routes remain in the repository.
- No Cloudflare Worker, production domain, Supabase project, user, Storage object or `rcc` record is deleted or paused.
- The V1 recovery branch was re-verified remotely at `2da639e9b4907e226c1a2c9858320e4b73bebee0`.
- The downloadable recovery ZIP contains 504 entries, is 6,836,338 bytes and matches SHA-256 `5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132`.
- A fresh database/Auth/Storage backup completed in GitHub run `32527928795`. Its 709,588-byte AES-256 archive and checksum were uploaded to private EU R2 and verified; the backup contains one bucket and four Storage objects.
- V1 Worker and both V1 Production and V2 Staging Supabase projects were `ACTIVE_HEALTHY`; Production still contained exactly one `rcc` and received no write.
- No automated job may pause or delete V1. The Phase 29/30 gate fails unless both actions remain explicitly denied and the recovery branch remains mandatory.

Phase 30 preservation is complete. Operational retirement cannot proceed until V2 has replaced V1 in Production and completed a successful observation window. V1 shutdown therefore remains explicitly denied and was not executed.

