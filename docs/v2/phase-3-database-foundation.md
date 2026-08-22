# Phase 3 — Additive V2 Database Foundation

Date: 2026-08-20

Status: implemented and verified in the isolated V2 staging project

## Implemented

- Added the initial V2 tenancy foundation to Supabase staging migration `20260820150732_v2_additive_tenancy_foundation`.
- Created live-compatible `leagues`, `league_members`, and `platform_owners` tables without copying Production rows.
- Added primary keys, foreign keys, validation constraints, timestamp triggers, and indexes for every foundation foreign key.
- Enabled RLS immediately on all three exposed tables.
- Added fail-closed canonical tenant resolution through `x-rcc-league-slug`; there is no implicit `rcc` fallback in V2 staging.
- Added public tenant-read policies for the requested published league and authenticated self-membership reads.
- Kept `platform_owners` separate from league membership and unavailable through direct browser table access.
- Generated project-specific TypeScript database types and connected them to the V2 Supabase client.
- Added a CI-runnable static database contract check and a transactional SQL regression suite.

## Files

- `v2/supabase/migrations/20260820150732_v2_additive_tenancy_foundation.sql`
- `v2/supabase/tests/phase-3-foundation.sql`
- `v2/src/types/database.ts`
- `v2/scripts/assert-database-foundation.mjs`
- `v2/src/lib/supabase.ts`
- `v2/src/auth/AuthProvider.tsx`
- `v2/src/league/LeagueProvider.tsx`
- `v2/src/roles/RoleProvider.tsx`
- `v2/src/components/AppShell.tsx`
- `v2/src/i18n/I18nProvider.tsx`
- `v2/package.json`

## Database

### Public Data API surface

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `leagues` | `SELECT`, requested public tenant only | `SELECT`, requested public tenant/member/owner | full table access |
| `league_members` | none | `SELECT`, own row or platform owner | full table access |
| `platform_owners` | none | none | full table access |
| `requested_league_slug()` | execute | execute | execute |
| `matches_requested_league(uuid)` | execute | execute | execute |
| `is_platform_owner()` | none | execute | execute |

No browser role has insert, update, or delete access in Phase 3. Those workflows belong to later actor-bound APIs and role phases.

### Compatibility boundary

- Table columns and legacy membership role values match the V1 tenancy contract so later data migration remains additive.
- V2 intentionally differs in one security-relevant detail: a missing or malformed tenant header raises SQLSTATE `22023` instead of falling back to the productive `rcc` slug.
- Driver identity, normalized V2 roles, user-management writes, demo fixtures, and result tables are not part of this phase.

## Security

- RLS and explicit least-privilege grants were created in the same migration as the tables.
- Default privileges for future `public` objects were changed to opt-in rather than automatic browser exposure.
- All helper functions use an empty `search_path` and fully qualified object names.
- `private.is_league_member(uuid)` is `SECURITY DEFINER`, stored outside the exposed schema, actor-bound to `auth.uid()`, and only usable by authenticated policy evaluation.
- `public.is_platform_owner()` is the single intentional class-A `SECURITY DEFINER` function. It takes no actor parameter and returns only whether the current `auth.uid()` is present in `platform_owners`.
- `platform_owners` has RLS enabled and no policy by design. The table is service-role-only; the browser receives only the boolean RPC result.
- No user metadata participates in authorization.

### Advisor interpretation

The staging Security Advisor reports two explained notices:

1. `platform_owners` has RLS but no policy. This is intentional default-deny for a service-role-only table.
2. Signed-in users can execute `is_platform_owner()`. This is intentional class-A behavior documented in Phase 2; the function is actor-bound, zero-argument, search-path hardened, and returns a boolean only.

The Performance Advisor reports three unused indexes. This is expected on an empty database and is not a deletion signal; the indexes cover foreign keys and planned membership lookups.

## Tests

| Gate | Result |
|---|---|
| Migration syntax and DDL in rollback transaction | passed |
| RLS enabled on all foundation tables | passed |
| Browser grant matrix | passed |
| Anonymous League A vs League B isolation | passed |
| Authenticated League A vs League B isolation | passed |
| Missing tenant header fails closed | passed |
| Platform-owner table browser exposure | blocked as expected |
| Direct Data API tenant read with canonical header | `200`, tenant-scoped empty result |
| Direct Data API read without tenant header | `400`, SQLSTATE `22023` |
| Direct anonymous `platform_owners` access | `401`, permission denied |
| Direct anonymous `is_platform_owner()` RPC | `401`, permission denied |
| Direct anonymous tenant resolver RPC | `200`, canonical slug returned |
| Public `SECURITY DEFINER` default execute check | passed |
| Foundation foreign-key index coverage | passed |
| SQL fixtures removed by rollback | passed |
| Generated TypeScript schema integration | passed |
| TypeScript, unit tests, isolation, and Vite build | passed |

The SQL test creates only temporary transaction fixtures and always rolls them back. Staging remains free of user, league, and Production data.

## Result

**PASS.** The isolated staging project now has a minimal, additive, fail-closed multi-tenant foundation suitable for Phase 4.

## Open points

- Supabase Auth Site URL and exact callback allowlist still require dashboard configuration before auth E2E.
- Full registered-user and manipulated-driver test cases require the Phase 4 identity model.
- The final V2 role vocabulary and actor-bound membership write APIs belong to Phase 5.

## Next step

Phase 4 — Global Driver Identity: add a registered-user-backed driver identity without name-based automatic merges, then verify identity claims and cross-tenant links with synthetic staging accounts only.
