# Steward case corrections — 2026-10-27

## Behavior

Closed cases expose **Fall bearbeiten** beside **Fall löschen**. Stewards can correct the title, description, each accused driver's decision, and reasoning. A correction reason is required. Race and participants remain fixed. Each accused driver still receives exactly one decision.

**Abgelehnt** is a separate decision from **Keine Strafe**. Neither creates a penalty. Previous decision versions remain visible in the case history.

Corrections append a decision version and atomically replace its result effects. Applied time adjustments are reversed and combined with the replacement adjustment in one result revision. Unrelated cases remain effective. Pending adjustments use only the current decision when results are published. A later deletion reverses only the current decision. Stale edits and unsupported/divergent result histories are rejected rather than guessed.

## Database and rollout

- `20261027182920_steward_case_corrections.sql`
- `20261027183823_steward_correction_guard_fix.sql`

Both migrations were applied to **Staging only**. The second fixes a PL/pgSQL name ambiguity found during the first regression run. Do not fold it into the already-applied first migration.

The owner approved Production publication after the Staging checks. Production requires both migrations before the new frontend. The standard release verification still applies; deployment evidence records the released commit and Worker version separately.

The authenticated correction RPC intentionally uses SECURITY DEFINER with an empty search path and explicit league/capability checks. Private mutation helpers have no client grants. The incoming-grid RPC uses SECURITY INVOKER and existing RLS. The security advisor flags the public definer RPC as a review item; its restricted entry point and authorization were checked.

## Validation

- TypeScript check and Staging build passed.
- 30 focused desktop/mobile browser tests passed across steward corrections, race selection and draft championship preview.
- Existing steward workspace unit tests passed; six draft championship unit tests passed.
- `supabase/tests/steward-case-corrections.sql` passed on Staging with all fixture data rolled back: applied and pending corrections, unrelated penalties, idempotent retries, stale edits, time credits, dismissal, zero-net corrections, deletion, grid penalties and access restrictions.
- Desktop/mobile screenshots inspected. UI detector completed without reported findings; whitespace check passed.

The older multi-driver SQL script was not successfully rerun after the ambiguity fix because the connector rejected its request state. It is not included in the passing checks above.

## Separate Production team repair

Monday Night Racing, season 15: VCARB and ICExFischköppe were the same two-driver team under different names. The targeted repair was committed to Production after a rollback rehearsal. Four name-only result revisions consolidate 75 VCARB points and 59 ICExFischköppe points into **134 ICExFischköppe points**. The current standings now contain **10 teams**.

Previous result versions were preserved. Assertions verified unchanged sporting result fields, driver XP totals, and other seasons. The operation is recorded in `v2_audit_events` as `team.season_name_corrected`. This does not introduce a general-purpose team merge feature.
