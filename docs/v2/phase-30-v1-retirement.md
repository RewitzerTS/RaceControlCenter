# Phase 30 — V1 Retirement

Status: locked.

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

