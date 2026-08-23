# Phase 26 — Migration Rehearsal

Date: 2026-08-20

Production posture: read-only inspection only. V1 and the productive `rcc` league remain unchanged.

## Rehearsal result

The dependency-ordered Staging regression found one cross-phase defect: after Phase 25 revoked anonymous access to the authenticated `is_platform_owner` RPC, the SQL implementation of `matches_requested_league` still referenced that RPC while evaluating anonymous public reads.

The additive Phase 26 migration separates the anonymous and authenticated paths in a `SECURITY INVOKER` PL/pgSQL helper. Anonymous requests can match only a published, non-owner-only tenant. Authenticated platform owners retain the deliberate owner-only Demo path. The protected owner RPC remains unavailable to anonymous callers.

## Automated gate

- exactly 27 uniquely versioned, additive V2 migrations
- no Production Supabase project reference in migrations or database regressions
- no table, schema, function or column removal and no truncation
- every SQL regression begins a transaction and ends with rollback
- explicit public-anonymous and owner-only tenant-path coverage
- the complete Phase 3–26 regression sequence executes against isolated V2 Staging

## Clean replay checkpoint

The current machine has no Docker runtime, and the free isolated Supabase Staging project has no database branches. Therefore a destructive reset of the shared Staging project is not used. Before production cutover, a disposable Supabase branch or equivalent fresh PostgreSQL environment must replay all migrations from zero, run all transactional regressions, record duration and schema/advisor output, then be deleted.

This clean replay checkpoint is a Phase 28 production-readiness prerequisite. It is not permission to copy Production data or disable V1.
