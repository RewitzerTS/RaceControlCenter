# Simplified steward workflow — Staging validation

Scope: Staging `nfvwarlowjqphytqqtxz` only. Production is unchanged. Five migrations dated 20261006 add signed time corrections, grid penalties, an authorized RPC boundary, pending-application receipts and hiding of consumed validated imports. Apply all five together when promoting; do not deploy the frontend alone to a database missing them.

## Semantics

- Discussion is external. Stewards record the reporting driver, accused driver, decision and reasoning. Voting is not required for the new path; old histories and RPCs remain for compatibility.
- Time penalties and credits change classified comparable times, finishing positions and points, including the configured fastest-lap bonus. Existing manual point adjustments are retained. Previous result versions remain immutable.
- Without a published result, the decision is closed but its time correction is pending. Publishing a validated import creates and activates the corrected version atomically, with one immutable application receipt per penalty. Retrying that source draft returns the same publication receipt.
- Missing/comparison-incompatible times stop publication without partial results or receipts. Lap deficits are not converted into seconds. A negative effective time is rejected.
- Grid penalties target the immediate following noncancelled/nonpostponed race, only before it starts. The penalty is displayed on that race; the league implements the grid in the game. There is no automatic carry-over for an absent driver.
- No-action and grid decisions do not fabricate result versions.

## Evidence

`supabase/tests/simplified-steward-decisions.sql` ran successfully against Staging inside BEGIN/ROLLBACK. Assertions cover direct penalty and credit, preserved old result, repeated requests, lapped rows, grid target, invalid credit rollback, cross-league rejection, combined pending penalty/credit, incomplete-import rollback, exactly-once publication, fastest-lap eligibility boundary, hidden consumed draft and ordinary-driver denial. The final fixture-league count is zero.

Local browser tests cover six form paths plus pending/applied/incoming decision display at desktop and mobile widths. All requests use intercepted test data; no real case was created. Native race/profile regression tests also passed. Full release gate and hosted smoke checks are separate deployment evidence.

## Advisor review

The public RPC is a deliberately authenticated, fixed-search-path security-definer boundary: anonymous execute is revoked; the delegated private helper verifies the authenticated actor, requested league and steward capability. Browser roles receive no mutation grants on application receipts. Ordinary-driver and cross-league denial are tested. Supabase flags this pattern for manual review: [authenticated security-definer function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The performance advisor found no missing foreign-key indexes on the new tables. It reports a newly created receipt index as [unused](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), which is expected before real usage and not a reason to remove it. Existing unrelated index and password-protection findings were not changed by this task.
