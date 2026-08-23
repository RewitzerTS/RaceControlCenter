# Phase 1 status — deployed staging foundation

Date: 2026-08-20

## Completed

- Created local branch `v2-development` from Production baseline commit `2835298a59128341b99a0b29ffa7f831caf29b21`.
- Added a standalone Vite/React/TypeScript application under `v2/`.
- Added fail-closed environment parsing that rejects the Production Supabase project reference.
- Added staging-only environment examples with no secrets.
- Added provider boundaries for league, authentication, role, feature flags, and i18n.
- Added independent Platform-Owner resolution and fail-closed legacy role mapping.
- Added German, English, Spanish, and French interface scaffolding.
- Added keyboard focus, skip navigation, reduced-motion support, mobile safe-area handling, minimum touch sizing, no-index headers, and a restrictive browser CSP.
- Added Cloudflare static-asset caching headers, Wrangler-native SPA routing, and a dedicated Workers configuration for V2.
- Added path-scoped GitHub Actions verification, including a Wrangler deployment dry run.
- Generated a locked dependency tree.
- Created the isolated Supabase staging project `RaceVora V2 Staging` (`znnkwjogtvzwfkwnmawp`).
- Published the foundation on `v2-development` and opened draft pull request #437.
- Deployed the isolated Worker at `https://racevora-v2-staging.richard-rewitzerzwhe.workers.dev`.
- Verified the root and arbitrary SPA routes, staging project reference, four-language selector, security headers, no-index policy, cache policy, and staging Supabase Auth settings endpoint.

## Verification evidence

| Gate | Result |
|---|---|
| TypeScript project build | passed |
| Unit tests | 9 passed |
| Production project isolation scan | passed |
| Vite production bundle | passed |
| Cloudflare Wrangler deployment dry run | passed |
| Live Worker root and SPA fallback | passed |
| Live CSP, no-index, and asset-cache headers | passed |
| Staging Supabase connectivity | passed |
| Existing tracked V1 files | unchanged |

Bundle output at this checkpoint: 0.67 kB HTML, 5.88 kB CSS, and 449.23 kB JavaScript (130.64 kB gzip). Source maps are enabled for staging diagnostics.

## Remaining external setup

1. Set the Supabase Auth Site URL to `https://racevora-v2-staging.richard-rewitzerzwhe.workers.dev`.
2. Add exact V2 recovery/confirmation/invitation callback routes to the redirect allowlist once those routes exist.

Cloudflare Git deployment, branch control, build root, and staging-only build variables are complete.

## Known prerequisite for the next data step

The repository has only partial database migrations relative to the live schema. Before staging data work, create and review a complete baseline migration, then seed synthetic test data. No Production data or credentials should be copied automatically.
