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
- V2 release candidate revision 3 is pinned to `release/v2-cutover-candidate-2026-08-21-r3` at `3e7edf689bc1ad85e8c5b4c45998c5504a6647b2`.
- The candidate remains isolated on `racevora-v2-staging`; it is not connected to the Production Supabase project or `racevora.com`.
- The candidate includes the clean-replay index correction and passed the complete local/static contract suite plus the fresh-database migration and transactional regression suite before it was pinned.
- Production traffic, DNS, Cloudflare routes, Supabase configuration and the `rcc` tenant remain unchanged.
- The encrypted V1 database, Auth credential and Storage object restore is verified. The final live security, performance, accessibility and operational gates are green; external project configuration proof in the dedicated recovery target remains open in Phase 28.

## Automated readiness gate

The `V2 cutover readiness (no deployment)` workflow is readiness-only. It requires the exact pinned V2 release commit, the exact pinned V1 recovery commit and an explicit confirmation that this is a check only. It runs the complete V2 verification suite and a Cloudflare Worker dry-run, but performs no DNS, route or production deployment and does not use Production secrets.

The gate fails while any traffic, retirement or V1-shutdown authorization remains enabled unexpectedly. Passing this workflow is evidence for review, not authorization to switch traffic. The actual cutover action remains intentionally absent until the remaining external-configuration evidence, final approval and rollback-window decision are recorded.

## Staging advisor review on 2026-08-21

- Supabase reports the Staging project as `ACTIVE_HEALTHY` with no security error and no actionable performance warning.
- The 15 authenticated `SECURITY DEFINER` RPCs exactly match the reviewed Phase 25 allowlist and retain authentication, tenant and capability checks. Four RLS tables intentionally have no browser policy and therefore deny access by default.
- The 106 unused-index notices are informational on this new, low-traffic Beta dataset. Indexes are not removed before representative production observation data exists.
- Leaked-password protection remains an external Auth setting to confirm. This open item keeps actual cutover authorization denied.

## External Staging configuration progress

- The stale localhost Auth Site URL is removed. The Site URL points to the exact V2 Staging Worker origin; the allowlist contains only that origin and its exact `/auth/confirm` and `/auth/reset` routes.
- E-mail confirmation, secure e-mail change and secure password change are enabled; the password minimum is eight characters.
- Leaked-password protection is unavailable on the Supabase Free plan and is recorded as plan-blocked. The target-only Staging CAPTCHA is active and live-verified.
- V2 contains the complete Turnstile-aware sign-in/sign-up/recovery frontend, exact Auth-link routes and restrictive CSP. The persistent managed widget is limited to the exact Staging Worker hostname; its public site key is a Staging build variable and its secret is held only by Supabase Staging Auth.
- This V2 revision requires no Edge Function, Realtime publication or Storage bucket configuration. Live Staging reports zero of each.
- A protected Recovery request passed Turnstile and Supabase accepted the mail dispatch. The user confirmed receipt in iCloud and completed the flow. Supabase Auth recorded the Staging reset-link verification, a successful password update and a clean logout; the end-to-end Recovery gate is passed without exposing the password. Traffic authorization nevertheless stays denied until the remaining release and cutover gates are explicitly satisfied.
- Release candidate revision 3 passed its Cloudflare Staging build, all 26 GitHub checks and the full local suite. The live Chrome DevTools gate measured 391 ms LCP, 51 ms TTFB and 0.00 CLS; mobile Lighthouse Accessibility is 100 after the two confirmed ARIA/name issues were repaired. Production stayed `ACTIVE_HEALTHY` with exactly one `rcc`.

