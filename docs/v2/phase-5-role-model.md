# Phase 5 — Role Model

Date: 2026-08-20

Status: implemented and verified in the isolated V2 staging project

## Implemented

- Normalized league memberships to the exact V2 roles `driver`, `steward`, and `league_admin`.
- Added controlled legacy mappings: `member` → `driver`, `admin` → `league_admin`, and league `owner` → `league_admin`.
- Kept `platform_owner` exclusively in `platform_owners`; it cannot be stored in or assigned through `league_members`.
- Required every league-role holder to have an active, registered global driver identity.
- Added an actor-bound, tenant-aware internal capability hierarchy.
- Added the zero-argument `current_app_role()` RPC as a `SECURITY INVOKER` role resolver.
- Made the platform-owner path global and independent from normal league membership.
- Allowed league admins to read their own league's normal membership rows without exposing the separate owner table.
- Replaced the browser's multi-query role reconstruction with the actor-bound database resolver.
- Localized all four visible role names in German, English, Spanish, and French.

## Files

- `v2/supabase/migrations/20260820154039_v2_normalize_role_model.sql`
- `v2/supabase/tests/phase-5-role-model.sql`
- `v2/scripts/assert-role-model.mjs`
- `v2/src/types/database.ts`
- `v2/src/roles/RoleProvider.tsx`
- `v2/src/roles/roleMapping.ts`
- `v2/src/roles/roleMapping.test.ts`
- `v2/src/App.tsx`
- `v2/src/components/AppShell.tsx`
- `v2/src/i18n/I18nProvider.tsx`
- `v2/package.json`

## Exact role contract

| Visible role | Internal code | Capability inheritance | Source |
|---|---|---|---|
| Driver | `driver` | normal driver functions | active `driver_identities` row; optional league membership |
| Steward | `steward` | Driver + Steward | tenant-bound `league_members` row |
| Ligaleitung | `league_admin` | Driver + Steward + league administration | tenant-bound `league_members` row |
| Owner | `platform_owner` | global access across leagues | separate `platform_owners` row only |

The global owner needs no league membership, never appears in the normal membership table, and cannot be assigned or removed through future league-role dropdowns.

## Actor and tenant binding

- `current_app_role()` accepts no user ID or league ID from the browser.
- Actor identity always comes from `auth.uid()`.
- A normal league role resolves only for the canonical `x-rcc-league-slug` request context.
- An active registered identity without a membership resolves to the base `driver` role.
- `platform_owner` is checked first and resolves globally without membership.
- `private.has_league_capability(uuid, text)` is callable only during authenticated policy evaluation; the private schema remains outside the Data API.
- Unknown capabilities return false.

## Security boundaries

- Browser roles retain no insert, update, or delete grants on `league_members`.
- `current_app_role()` is `SECURITY INVOKER`, search-path hardened, and executable only by authenticated/service roles.
- The internal capability helper is `SECURITY DEFINER` because it must evaluate membership without recursive RLS; it is actor-bound, tenant-bound for non-owners, stored in `private`, and not an RPC surface.
- User metadata is not used for role or capability decisions.
- Owner rows remain service-role-only and are never returned through member-list policies.

## Verification

| Gate | Result |
|---|---|
| Migration plus complete role regression in rollback transaction | passed |
| Applied staging migration `20260820154039` | passed |
| Post-apply SQL regression | passed |
| Driver receives Steward capability | blocked |
| Steward receives league-admin capability | blocked |
| League admin inherits Driver and Steward capabilities | passed |
| Non-owner capability crosses requested tenant | blocked |
| Platform owner accesses both synthetic leagues without membership | passed |
| Platform owner assigned through league membership | blocked |
| League role assigned without active driver identity | blocked |
| Driver reads other membership rows | blocked |
| League admin reads own league membership rows | passed |
| Anonymous role-resolution RPC | blocked |
| Role resolver remains `SECURITY INVOKER` | passed |
| Generated TypeScript schema integration | passed |

The regression uses four synthetic auth users, three active driver identities, two leagues, three league memberships, and one separate platform owner inside a transaction that always rolls back. Staging remains empty after the test.

## Advisor interpretation

No new Security Advisor notice was introduced by Phase 5. The existing explained notices remain:

1. `driver_claims` and `platform_owners` have RLS with no browser policy by design.
2. `is_platform_owner()` is the documented actor-bound, zero-argument boolean `SECURITY DEFINER` RPC.

Unused-index notices are expected on the empty staging database and remain insufficient evidence for removal.

Advisor references:

- <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>
- <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>
- <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>

## Result

**PASS.** V2 now has one exact, fail-closed role vocabulary with hierarchical league capabilities and a fully separate global owner.

## Deferred by design

- Role assignment and member-management write APIs remain server-controlled future workflows.
- Owner action auditing is required when owner mutation workflows are implemented.
- Steward case creation/finalization UI belongs to the Steward Experience phase.
- League administration UI belongs to the Ligaleitung/Admin phase.
- No Production membership row or V1 role was changed.

## Next step

Phase 6 — Result Versioning: preserve one authoritative current result while making publication, correction, revision, and void history explicit and auditable.
