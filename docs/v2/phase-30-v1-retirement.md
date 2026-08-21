# Phase 30 — V1 Retirement

Status: preservation in progress. V1 retirement: locked.

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

## Preservation started on 2026-08-21

- The exact V1 source remains on the dedicated recovery branch and is not merged with V2 work.
- Existing production health checks, encrypted off-site backups and the recovery runbook remain active.
- The V1 application, migrations, assets and legal/public routes remain in the repository.
- No Cloudflare Worker, production domain, Supabase project, user, Storage object or `rcc` record is deleted or paused.

Phase 30 is therefore underway only as preservation work. Retirement cannot proceed until a successful V2 production observation window exists, and V1 shutdown remains explicitly denied.

