# Phase 2 — Security Foundation

Date: 2026-08-20

Status: completed locally; CI and live deployment are merge gates

Production posture: read-only inspection only

## Implemented

- Audited the V1 client, live Production catalog, RLS/grants, views, triggers, storage, Edge Functions, and Security Advisor findings.
- Defined the canonical V2 tenant request contract as `x-rcc-league-slug`.
- Added fail-closed slug validation before the header reaches the Supabase client.
- Added a regression test that rejects malformed tenant values and prevents the obsolete `x-racevora-league` header from returning.
- Classified every relevant Production `SECURITY DEFINER` function and recorded the target hardening action.

## Files

- `v2/src/lib/supabase.ts`
- `v2/src/lib/supabase.test.ts`
- `docs/v2/v1-contract-report.md`
- `docs/v2/phase-1-status.md`
- `docs/v2/staging-isolation.md`
- `docs/v2/phase-2-security-foundation.md`

## Database

No database changes were made. Staging is intentionally empty; Production was queried only for catalog metadata and aggregate counts.

Phase 3 must create an additive, reviewed database baseline in staging. It must not replay partial historical SQL blindly or modify Production.

## Security

### Critical client contract correction

Production helper `requested_league_slug()` reads `x-rcc-league-slug` and otherwise falls back to `rcc`. V1 and tenant-aware Edge Functions use that header. The initial V2 client used `x-racevora-league`, so V2 requests could silently resolve to the protected Production tenant if they were ever pointed at the Production database.

Three independent controls now address this class of error:

1. V2 rejects the Production Supabase project reference at environment parsing time.
2. V2 sends the canonical `x-rcc-league-slug` header.
3. V2 rejects empty or malformed league slugs before creating the request client.

### `SECURITY DEFINER` classification

Classification is based on live function definitions, execute grants, `auth.uid()`/tenant checks, V1 call sites, trigger bindings, and Edge Function use.

#### A — intentionally client-callable

These are external browser/RPC surfaces in V1. Keeping them callable requires explicit `authenticated` grants, actor binding, tenant binding, hardened `search_path`, and negative cross-tenant tests.

| Function | Current boundary | Required V2 action |
|---|---|---|
| `add_driver_to_active_season` | Authenticated league workflow | Add explicit request-tenant match; preserve actor membership check |
| `add_existing_league_member_by_email` | Authenticated manager workflow | Prefer Edge Function; avoid exposing email lookup directly |
| `can_manage_race_workflow` | Browser authorization probe | Remove caller-supplied actor option from public variant |
| `complete_league_onboarding` | Authenticated admin workflow | Add request-tenant match and audit event |
| `consume_ai_analysis_quota` | Authenticated quota mutation | Keep atomic; bind actor to `auth.uid()` and tenant header |
| `create_league` | Authenticated onboarding | Keep explicit authenticated grant; validate reserved slugs and audit |
| `create_next_league_season` | League admin workflow | Add request-tenant match and idempotency test |
| `finalize_league_season` | League admin workflow | Preserve atomicity; add audit and tenant regression |
| `is_platform_owner` | Browser role resolution | Keep zero-argument actor-bound shape; expose no owner rows |
| `list_league_members` | League manager UI | Replace for V2 with server-filtered output that never returns platform owners |
| `remove_league_member` | League manager UI | Protect global owner and last-admin invariants; audit |
| `remove_race_substitution` | League admin workflow | Add request-tenant and race/season consistency checks |
| `set_league_member_role` | League manager UI | Accept only V2 roles; global owner remains unassignable; audit |
| `set_race_substitution` | League admin workflow | Preserve temporal/slot consistency and tenant checks |
| `set_season_driver_status` | League admin workflow | Bind season and driver to requested tenant |

#### B — backend/internal only

These functions must not be directly executable by `anon` or ordinary `authenticated` callers. Trigger functions need no direct API grant. RLS helpers should move to a private schema or be wrapped by actor-bound public APIs.

| Function | Internal use | Required V2 action |
|---|---|---|
| `apply_dsq_after_published_result` | Result publish trigger | Revoke external execute; retain trigger owner access |
| `apply_race_dsq_penalties` | Privileged result consequence path | Keep service/backend only; record audit outcome |
| `can_manage_league` | Authorization helper | Move internal or keep private wrapper; do not treat as UI authority |
| `enforce_platform_owner_league_role` | Membership trigger | Revoke external execute; preserve owner separation |
| `has_league_role` | RLS/helper with optional user ID | Move internal; public callers must not probe arbitrary actors |
| `is_app_admin` | Legacy RLS helper | Keep only while referenced; revoke unnecessary direct API execution |
| `is_league_member` | RLS/helper with optional user ID | Move internal; expose actor-bound zero-argument variant if needed |
| `is_league_owner` | Authorization helper | Replace legacy league-owner semantics with `league_admin` plus separate platform owner |
| `sync_league_registration_keys` | League trigger | Revoke external execute; retain trigger owner access |

#### C — legacy/unused

| Function | Evidence | Required V2 action |
|---|---|---|
| `is_rcc_admin` | Legacy `app_admins`/RCC naming; no V2 role-model fit | Confirm no remaining policy/call dependency, then deprecate additively before later removal |

#### D — switch to security invoker

No existing `SECURITY DEFINER` function is safe to switch blindly. The internal authorization helpers read RLS-protected membership/owner data, so an invoker conversion could break policies or create recursive access. Phase 3 should instead introduce private internal helpers and narrow actor-bound external wrappers, then prove whether any wrapper can be `SECURITY INVOKER`.

Already-invoker request helpers `requested_league_slug()` and `matches_requested_league()` remain compatibility contracts. All four public views already have `security_invoker=true`.

### Execute-grant policy for Phase 3

For every new function:

```sql
revoke all on function ... from public, anon, authenticated;
grant execute on function ... to authenticated; -- only for classified A APIs
```

- Class A functions must derive actor identity from `auth.uid()` and match the requested tenant.
- Class B functions must live outside exposed schemas where practical and have no browser role grants.
- Class C functions stay only until dependency checks and a compatible replacement are complete.
- No permission problem may be “fixed” by adding `SECURITY DEFINER` without a documented threat model.

### Edge Function findings

| Function | Role | Phase 2 finding |
|---|---|---|
| `manage-league-member` | Member lookup/invitation/management | Authenticates actor and checks owner/membership; V2 response must hide platform owners server-side |
| `analyze-race-result-images` | AI parsing and quota use | Canonical tenant header is included; actor membership and platform-owner paths are checked |
| `finalize-consumer-registration` | Registration and league creation | Uses user and admin clients; pending metadata must never become authorization state |
| `submit-consumer-withdrawal` | Compliance request | Server-only table and database rate limiter reduce direct abuse |
| `f1-news` | External content/cache | Cache table is service-role only; output remains untrusted external content |

Service-role credentials are server-only and are not present in V2 browser code.

### Remaining auth configuration

The staging project still needs dashboard-level Auth URL configuration before password recovery, invitations, or email confirmation can be considered end-to-end verified:

- Site URL: `https://racevora-v2-staging.richard-rewitzerzwhe.workers.dev`
- Redirect allowlist: exact V2 callback/recovery routes once those routes exist; staging preview patterns only where intentionally required

The available Supabase integration exposes read/query/deploy operations but not Auth URL configuration, so this remains an external setup item rather than an inferred database change.

## Tests

| Gate | Result |
|---|---|
| TypeScript project check | passed |
| Unit tests, including tenant-header regression | 14 passed |
| Production reference/service-role isolation scan | passed |
| Vite production bundle | passed |
| Staging Security Advisor | clean, zero lints |
| Wrangler dry-run | required in GitHub Actions; local runner classified it as a deployment action |
| Existing draft PR checks | required before merge |
| Live Worker smoke check | required after branch deployment |

## Result

Local implementation: **PASS**. Merge recommendation remains conditional on the V2 GitHub workflow and the post-deployment live smoke check passing.

## Open points

1. Auth Site URL and redirect allowlist require dashboard configuration.
2. Full SQL/RLS attack-matrix tests require the additive staging schema planned for Phase 3.
3. Leaked-password protection is unavailable on the current Free plan.

## Next step

Phase 3 — create a complete reviewed staging database foundation additively, with RLS, grants, policies, private helpers, actor-bound public APIs, synthetic tenant fixtures, and cross-tenant SQL tests in the same change set.
