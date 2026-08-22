# Phase 28 — Production Readiness and V1 Recovery Gate

Date: 2026-08-21

Status: in progress. The V1 code recovery point, clean V2 zero-state replay and the isolated encrypted V1 database/Auth/Storage restore are verified. External project configuration and final release-candidate gates remain required before Production traffic may change.

Production posture: V1 stays online. The productive `rcc` league remains unchanged and is never a restore-test target.

## Established recovery point

The current V1 Production source is pinned in `v1-recovery-manifest.json`:

- repository: `RewitzerTS/RaceControlCenter`
- production branch: `main`
- recovery branch: `recovery/v1-production-2026-08-21`
- recovery commit: `2da639e9b4907e226c1a2c9858320e4b73bebee0`
- state: V1 after the Phase 24 Performance Gate and before any V2 cutover

The recovery branch is a dedicated durable reference to the exact V1 source. It must not receive V2 commits. A code rollback may build and deploy this commit or select the corresponding retained Cloudflare deployment. Cloudflare rollback changes code deployment only; it does not reverse Supabase data or configuration changes.

## Data recovery boundary

The production database and the productive league are recovered separately from the frontend:

1. identify the latest encrypted off-site backup and its SHA-256 companion;
2. verify the encrypted object checksum before decryption;
3. retain the target project's protected Hosted Supabase roles and restore schema/data only into a separate non-production Supabase target;
4. validate central row counts, Auth identities, RLS, RPC grants and the `rcc` tenant contract;
5. restore and verify Storage objects separately;
6. reconfigure Auth, redirects, CAPTCHA, Edge Functions, secrets and Realtime explicitly;
7. record actual duration, recovery point and all manual steps;
8. only then consider the restore drill verified.

No database restore is executed against Production as part of Phase 28. Backup existence is not accepted as restore evidence.

## Automated gate

`npm run v1-recovery-gate` verifies that:

- the recovery manifest pins a full Git commit and a separate recovery branch;
- the protected Production project and `rcc` tenant are explicitly named;
- the encrypted off-site backup workflow, recovery runbook and checksum controls remain present;
- restore tests are constrained to a separate non-production target;
- Phase 29, Phase 30 and V1 shutdown remain denied while the restore drill is unverified;
- the Phase 27 Beta record is closed before production-readiness work advances.

## Verified zero-state replay

With explicit owner approval, V2 Staging was paused temporarily to free the second Supabase Free-plan project slot. A disposable project named `RaceVora V1 Restore Drill` was created in `eu-west-1`. No Production credentials or data were connected to it.

The first clean replay exposed one real ordering defect: the Phase 16 foreign-key index correction recreated six indexes already present in the main Steward migration. The correction now uses `create index if not exists`. After both V2 schemas and migration history were reset in the disposable target, the full replay succeeded from zero:

- 27 of 27 ordered migrations applied;
- 18 of 18 transactional SQL regression suites passed and rolled back;
- 44 public tables, all 44 with RLS enabled;
- 2 private tables and 62 public/private functions present;
- disposable project paused after evidence collection;
- original V2 Staging restored to `ACTIVE_HEALTHY` with its Auth users, league, owner and demo fixtures intact.

This proves the V2 schema can be reconstructed from the repository. The separate V1 database restore evidence below now covers the encrypted logical backup.

## Prepared encrypted V1 restore automation

The manual GitHub workflow `.github/workflows/v1-restore-drill.yml` and helpers `scripts/restore-v1-drill.sh` and `scripts/restore-public-storage.mjs` provide the guarded data proof. They fail closed unless `RESTORE_DRILL_DB_URL` identifies the dedicated project `lugedxtmfitxrkacmjpb`, reject both Production and Beta Staging refs, accept only a fresh recovery-format-v2 archive, verify both checksum layers, retain the target-managed Hosted Supabase schemas/roles, restore V1 Auth data and app schema/data, compare aggregate user/identity counts and a credential fingerprint, reset only the drill Storage buckets, upload all manifest objects, verify every object by download/SHA-256, require the restored `rcc` tenant, report aggregate counts only, and remove all local restore material. Old sessions are intentionally cleared so the target uses its own JWT secret and requires a fresh login. GitHub validation also rejects CRLF-contaminated restore helpers.

The database URL remains only in `RESTORE_DRILL_DB_URL`; the target-only Storage/Admin key remains only in `RESTORE_DRILL_SECRET_KEY`. Neither is posted in issues, logs, commits or chat.

## Verified encrypted V1 database restore

The guarded workflow restored `racevora-backup-20260817T230508Z.tar.gz.gpg` into the dedicated project on 2026-08-21. The outer encrypted-object checksum and the inner `roles.sql`, `schema.sql` and `data.sql` checksums all passed. Hosted Supabase correctly refused modification of its protected platform roles in the first real attempt; the helper was corrected to verify but not replay those roles. The subsequent database restore reached PASS before a harmless trailing CR byte marked the job red; direct Supabase SQL independently confirmed the committed result. The CR byte was removed and CI now rejects any recurrence.

Recorded evidence:

- source recovery point: `2026-08-17T23:05:08Z`;
- observed backup age/RPO at validation: 305,732 seconds (3 days, 12 hours, 55 minutes, 32 seconds);
- database restore execution: approximately 105 seconds from verified archive to PASS;
- 5 restored leagues, including exactly one `rcc` tenant;
- 27 public tables and 27/27 with RLS enabled;
- 9 Auth users observed in the target, but not accepted as proof of V1 Auth credential recovery;
- 6 Storage files present in the encrypted archive (2 metadata files and 4 object files), but not yet restored to target buckets;
- Production and its live `rcc` data were never connected, reset or modified;
- drill project paused after evidence collection; V2 Staging restored to `ACTIVE_HEALTHY` with 8 Auth users, 1 league, 1 platform owner, 6 demo profiles, 27 migrations and 44/44 public RLS tables intact.

## Remaining Phase 28 exit criteria

- repeat the external configuration proof in the dedicated recovery target when Free-plan capacity permits;

Until every item is complete, Phase 29 and Phase 30 remain locked.

The external Auth/SMTP/CAPTCHA/redirect, Edge Function secret and Realtime proof is pinned in `v1-external-config-checklist.md`. It deliberately does not automate copying Production secrets into another project.

## Verified Staging external configuration

The Staging Auth review on 2026-08-21 found and removed the stale `http://localhost:3000` Site URL that had caused confirmation links to leave the Beta environment. The Site URL is the exact `racevora-v2-staging.richard-rewitzerzwhe.workers.dev` origin. The redirect allowlist contains that origin plus only the exact `/auth/confirm` and `/auth/reset` V2 routes. E-mail confirmation and secure e-mail change remain enabled. Secure password change is enabled and the minimum password length is eight characters, matching the V2 form contract.

The V2 frontend implements sign-up confirmation, password recovery, password update, token reset after every Auth request and a fail-closed Cloudflare Turnstile component. Its CSP permits only Cloudflare's canonical challenge script/frame origin. A persistent `RaceVora V2 Staging` Turnstile widget is now active in managed mode and restricted to the exact Staging Worker hostname. The public site key exists only as a Cloudflare Staging build variable; the secret exists only in Supabase Staging Auth. No Production hostname is attached and neither key is committed.

The branch build for commit `4db1c77f2a3616c0ccc4191580d0266cc83864db` was repeated successfully with the target-only variables. The live `/beta` form rendered Turnstile and completed a managed verification. Supabase rejected the first diagnostic attempts because the secret had been duplicated in the dashboard field; the value was corrected, compared internally with the newly created Cloudflare secret, saved and reloaded. A subsequent `/recover` request passed CAPTCHA and Supabase accepted the Recovery dispatch at `2026-08-21T18:36:46Z`.

The existing Beta account uses an iCloud address while the connected mailbox available to this task is Gmail. The user confirmed receipt and opened the Recovery message. Supabase Auth then recorded a successful `/verify` exchange for the exact Staging `/auth/reset` route at `2026-08-21T18:41:25Z`, a successful password update (`PUT /user`, status 200) at `18:43:52Z`, and a clean logout immediately afterward. This is the required end-to-end Recovery-session proof; no password value was read or handled by the task. Supabase leaked-password protection is unavailable on the current Free plan, so this advisor warning is recorded as plan-blocked rather than falsely marked fixed. V2 Staging currently has no Edge Functions, Realtime publication tables or Storage buckets, so there are no associated V2 secrets or resource policies to reconstruct at this revision.

## Final live release-candidate gates

Release candidate revision 3 is pinned at `3e7edf689bc1ad85e8c5b4c45998c5504a6647b2`. Its Cloudflare Staging build `39e67f62-8396-404e-bf49-28eea7f4582d` passed, all 26 GitHub checks passed, and the complete local verification suite passed 9 test files with 38 tests plus every contract, isolation, recovery and Phase 29/30 readiness gate.

Chrome DevTools measured the live `/beta` candidate at 391 ms LCP, 51 ms TTFB and 0.00 CLS. The only render-blocking stylesheet and the Turnstile cache observation both had 0 ms estimated LCP/FCP savings, so no speculative resource rewrite was made. The targeted accessibility repair removed the invalid ARIA use on the Turnstile container and the visible-label mismatch on the product link; the repeated mobile Lighthouse audit reached 100 Accessibility with zero application accessibility failures. A real `robots.txt` now preserves the deliberate Staging-wide `Disallow: /`. The remaining Lighthouse findings are the intentional Staging `noindex` policy and Cloudflare Turnstile's third-party cookie behavior, not RaceVora application defects.

Production and Staging both remained `ACTIVE_HEALTHY`. A read-only Production count returned exactly one `rcc`, and no Production write, route or deployment occurred.

## Fresh full-recovery backup

GitHub Actions run `32488426222` created recovery format 2 on 2026-08-21 at `13:46:21Z`. The run completed every gate: database and separate Auth data export, Auth evidence checksum, one Storage bucket with four objects, AES-256 packaging, EU R2 upload, remote-size verification and runner cleanup. The encrypted object is 709,002 bytes. This proves the new recovery material exists and is intact; it does not by itself prove that Auth credentials and Storage objects can be restored.

## Verified full V1 restore

GitHub Actions run `32494480356` restored the fresh format-v2 backup into the dedicated project `lugedxtmfitxrkacmjpb` on 2026-08-21. Both checksum layers passed. The workflow restored and matched 1 Auth user, 1 identity and the aggregate credential fingerprint; restored 2 leagues including exactly one `rcc`; restored 29 public tables with 29/29 RLS; recreated 1 Storage bucket; and downloaded/hash-verified all 4 restored objects. The guarded job completed in about 165 seconds, with an observed recovery-point age of 4,132 seconds at completion.

The real drill exposed and fixed three portability details: Supabase CLI's portable data dump included managed Auth COPY data, included managed Storage metadata, and the Storage API encoded `ResourceNotEmpty` as HTTP 400 with an embedded 409 while asynchronous emptying settled. The restore now removes only managed Auth/Storage COPY blocks from a temporary replay copy, preserves the checksum-verified original dump, restores Auth and Storage through their dedicated paths, and retries bucket deletion within a bounded window.

After evidence collection the drill project was paused. V2 Staging returned to `ACTIVE_HEALTHY` with 8 Auth users, 1 isolated Beta league, 1 platform owner, 6 demo profiles, 27 migrations and 44/44 public RLS tables. The Beta registration/login surface loaded successfully. Production remained `ACTIVE_HEALTHY`; it still contains exactly one protected `rcc` league and was never used as a restore target.

## Capacity result and downstream preparation

The initial zero-cost restore-project allocation returned the Supabase Free-plan active-project limit. After explicit owner approval, Beta Staging was paused, the disposable project was used for the V2 clean replay, the disposable project was paused, and the original Staging project was restored. Production was never paused or modified.

The owner subsequently requested that Phase 29 and Phase 30 start. Their reversible preparation may proceed, but this does not waive the restore requirement: the V2 release candidate may be pinned, the cutover and rollback procedure may be prepared, and the V1 recovery surface may be preserved. Production traffic, destructive data operations and V1 shutdown remain locked.

