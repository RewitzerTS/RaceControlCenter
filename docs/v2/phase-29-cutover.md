# Phase 29 — Controlled Cutover

Status: preparation in progress. Traffic cutover: locked.

Phase 29 traffic may begin only after Phase 28 records a successful clean V2 replay and complete database, Auth, Storage and configuration recovery evidence in a separate non-production environment.

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
- V2 release candidate revision 2 is pinned to `release/v2-cutover-candidate-2026-08-21-r2` at `c850b4291988d9c8cfec57d24a163ad0cf54a307`.
- The candidate remains isolated on `racevora-v2-staging`; it is not connected to the Production Supabase project or `racevora.com`.
- The candidate includes the clean-replay index correction and passed the complete local/static contract suite plus the fresh-database migration and transactional regression suite before it was pinned.
- Production traffic, DNS, Cloudflare routes, Supabase configuration and the `rcc` tenant remain unchanged.
- The encrypted V1 logical database restore is verified, but Auth credential recovery and Storage object replay remain open Phase 28 gates.

The next executable cutover action is intentionally absent until Phase 28 records restore evidence. This makes a premature domain switch fail closed instead of relying on an operator reminder.
