# Simplified steward workflow — Staging validation

## October 18 extension: multiple drivers per case

Production promotion approved by the owner after the hosted Staging handoff. The identical migration was applied to Production (`znnkwjogtvzwfkwnmawp`) as ledger version `20261018211337`. All seven affected function definitions match Staging. Before/after fingerprints of the 8 existing cases, 35 result versions and 590 result rows are identical. RLS is enabled on all three new tables; anonymous RPC execution, direct authenticated table writes and direct private-helper execution remain denied. No synthetic cases were created in Production. The same intentional advisor notices described below were reviewed; existing unrelated warnings were not changed. The frontend release must still complete the mandatory safe-deployment gate and hosted asset checks.

Staging release record:

Current scope: database migration `20261018200212_multi_driver_steward_cases.sql` applied only to Staging (`nfvwarlowjqphytqqtxz`), with explicit owner approval. Following separate owner approval, the matching frontend was published to `racevora-v2-staging` on October 18 as Worker version `0b63dc06-76b0-48bc-8f21-88fff93024c0`. Production is unchanged. This Staging candidate includes the uncommitted feature changes on baseline `fb50403dd6a35484c5c3b009a6757b9d18d2d59f`; the build metadata's baseline commit is not a claim that these changes have been committed or pushed.

A case has one or more reporters and accused drivers. The same driver may appear in both roles, but cannot be duplicated within a role. Each accused driver has exactly one decision and an individual reason: time penalty, time credit, grid penalty, or no action. An open case stores participants and incident only; decisions are entered when closing it. Existing singleton cases remain readable without a backfill.

`save_steward_group_case` locks and authorizes the race, validates league membership and the active season, binds retries to their exact payload, and stores every individual outcome atomically. Multiple immediate time adjustments produce one corrected result version. Existing deferred-publication and withdrawal paths apply/reverse the affected drivers together; unrelated penalties survive withdrawal. Old single-driver finalizers cannot partially close a new group case. Participant access, appeals and decision notification recipients include additional drivers.

Validation on October 18:

- `multi-driver-steward-cases.sql` passed on Staging as two isolated BEGIN/ROLLBACK batches (mixed direct decisions and deferred/authorization checks). Covers exactly-one decision, self-reporting, foreign-driver and tenant denial, atomic failure, exact retry, open-case closure, no-action, combined times/order/fastest-lap points, grid target, exactly-once publication, and complete withdrawal preserving an unrelated penalty.
- `multi-driver-steward-access.sql` passed with full rollback: the second reporter can read the open case, receives the decision notification, and can appeal; another tenant cannot read participants. Only the synthetic event is processed, never a global notification worker.
- Post-test counts match the preflight: 2 existing cases, 9 result versions and 19 result rows. No synthetic users/leagues, participant rows or individual decisions remain.
- 15 scoped unit tests, TypeScript check, Staging build and the Steward contract passed. 28 intercepted browser checks passed on desktop and mobile, including draft/reopen, independent outcomes, retries, old cases and current-season queue filtering. No physical Safari test is claimed.
- Full safe-deployment gate passed: 496 unit tests, all contracts, Staging build and 189 browser tests; one duplicate WebKit run was intentionally skipped in the mobile project (the explicit touch-WebKit test passed in the desktop project). The user-journey source contract was updated from the retired single-driver page flow to require the grouped command, payload-bound retry and grouped draft/readback browser assertions; no checks were bypassed.
- Post-deployment checks: `/stewarding` returned HTTP 200; the environment metadata points only to Staging. SHA-256 hashes of the main JS, CSS, runtime chunks and `StewardWorkspacePage-VMznufQQ.js` match the local tested build. Four additional intercepted group/group-draft checks passed against the hosted Staging site on desktop and mobile without real database writes. A clean signed-out browser correctly redirects the protected route to Home; missing league branding emits a 406 warning in that unselected-league context, without preventing the sign-in fallback. No Production deployment or Git push was performed.

The new public RPC deliberately uses the established authenticated SECURITY DEFINER facade, with tenant and capability checks inside the inaccessible private helper. The private retry table intentionally has default-deny RLS and no client grants. The advisor's [SECURITY DEFINER notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [private-table RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) were reviewed against these guards and rollback authorization tests. Unrelated existing notices (including leaked-password protection) were not changed.

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
