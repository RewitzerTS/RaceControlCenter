# Simplified steward workflow — Staging validation

## October 7 extension: self-reports and deletion

The initial October 6 release was promoted to Production as commit `6e42891`. The scope statement below describes its earlier Staging validation, not the current deployment status.

The October 7 migration permits the reporting and accused driver to be the same league driver. Deletion is an audited withdrawal: immutable decisions, evidence and application receipts are preserved privately while deleted cases and their child records disappear through the existing RLS helpers. Pending corrections are excluded at publication, incoming grid penalties disappear, and applied time corrections are inverted against the current result, producing a new validated result version and normal downstream result events. Browser UI asks for confirmation and a reason; stewards, league admins and verified owners use the existing server capability checks.

The server locks race then case, compares the displayed decision/result versions, and returns the same deletion receipt on retry. Manual/imported time-delta inconsistencies or disconnected result histories block automatic inversion rather than guessing. Historical disqualification/points-only penalties require separately reviewed correction; no such penalty rows existed in Production during preflight. Previously served in-game grid changes cannot be physically undone by RaceVora; the confirmation makes the league's responsibility explicit.

`steward-self-reports-and-withdrawal.sql` covers self-reported credit, open/closed case deletion, penalty and credit inversion, retaining unrelated corrections, fastest-lap bonus boundaries, deferred publication followed by deletion, ignoring deleted pending corrections, grid removal, stale state, retry idempotency, cross-league and driver denial, and rollback of incompatible history. All fixtures roll back. The 20 scoped browser tests use intercepted data on desktop and mobile; they do not write real cases. No physical Safari test is claimed.

Advisor review: the signed-in SECURITY DEFINER facade is intentional, with auth, tenant and capability checks in the inaccessible private implementation. No anonymous RPC execution, browser table writes or access to private deletion receipts is granted. RLS without a policy on the private receipt table is intentional default-deny. Unrelated pre-existing advisor findings are outside this release. References: [RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [default-deny RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

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
