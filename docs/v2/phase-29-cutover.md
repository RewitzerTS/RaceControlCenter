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
- The encrypted V1 database, Auth credential and Storage object restore is verified. External project configuration and final release-candidate gates remain open in Phase 28.

## Automated readiness gate

The `V2 cutover readiness (no deployment)` workflow is readiness-only. It requires the exact pinned V2 release commit, the exact pinned V1 recovery commit and an explicit confirmation that this is a check only. It runs the complete V2 verification suite and a Cloudflare Worker dry-run, but performs no DNS, route or production deployment and does not use Production secrets.

The gate fails while any traffic, retirement or V1-shutdown authorization remains enabled unexpectedly. Passing this workflow is evidence for review, not authorization to switch traffic. The actual cutover action remains intentionally absent until the remaining external-configuration evidence, final approval and rollback-window decision are recorded.

## Staging advisor review on 2026-08-21

- Supabase reports the Staging project as `ACTIVE_HEALTHY` with no security error and no actionable performance warning.
- The 15 authenticated `SECURITY DEFINER` RPCs exactly match the reviewed Phase 25 allowlist and retain authentication, tenant and capability checks. Four RLS tables intentionally have no browser policy and therefore deny access by default.
- The 106 unused-index notices are informational on this new, low-traffic Beta dataset. Indexes are not removed before representative production observation data exists.
- Leaked-password protection remains an external Auth setting to confirm. This open item keeps actual cutover authorization denied.

## External Staging configuration progress

- The stale localhost Auth Site URL is removed. Site URL and the redirect allowlist now point only to the exact V2 Staging Worker origin.
- E-mail confirmation, secure e-mail change and secure password change are enabled; the password minimum is eight characters.
- Leaked-password protection is unavailable on the Supabase Free plan and is recorded as plan-blocked. CAPTCHA needs target-only keys and remains open.
- This V2 revision requires no Edge Function, Realtime publication or Storage bucket configuration. Live Staging reports zero of each.
- One authorized e-mail confirmation/recovery journey is still required before traffic authorization can change.

