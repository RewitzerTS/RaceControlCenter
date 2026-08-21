# Phase 29 — Controlled Cutover

Status: preparation in progress. Traffic cutover: locked.

Phase 29 may begin only after Phase 28 records a successful clean V2 replay and a successful V1 backup restore in a separate non-production environment.

## Required cutover properties

- V1 remains deployable from the pinned recovery branch throughout the cutover window.
- The productive `rcc` league receives no destructive migration, reset or rehearsal.
- Database changes are additive and forward-compatible with the V1 rollback window.
- V2 traffic is introduced through an explicit deployment/domain change with monitored health checks.
- A failed gate returns traffic to the pinned V1 deployment before any further data change.
- Cutover approval and the exact V1/V2 commits are recorded before traffic changes.

The recovery manifest currently denies Phase 29 authorization. Documentation or a green build alone cannot override that flag.

## Preparation started on 2026-08-21

- V1 rollback source remains pinned to `recovery/v1-production-2026-08-21` at `2da639e9b4907e226c1a2c9858320e4b73bebee0`.
- V2 release candidate is pinned to `release/v2-cutover-candidate-2026-08-21` at `92da4515e1c90e802e1b264f7de559c5cf841dfe`.
- The candidate remains isolated on `racevora-v2-staging`; it is not connected to the Production Supabase project or `racevora.com`.
- All 20 GitHub checks for the candidate passed before it was pinned.
- Production traffic, DNS, Cloudflare routes, Supabase configuration and the `rcc` tenant remain unchanged.

The next executable cutover action is intentionally absent until Phase 28 records restore evidence. This makes a premature domain switch fail closed instead of relying on an operator reminder.

