# Phase 28 — Production Readiness and V1 Recovery Gate

Date: 2026-08-21

Status: in progress. The V1 code recovery point is established and automatically guarded. The clean V2 zero-state replay is verified. A real encrypted V1 backup restore remains required before Production traffic may change.

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
3. restore roles, schema and data only into a separate non-production Supabase target;
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

This proves the V2 schema can be reconstructed from the repository. It does not claim that encrypted V1 Production data was restored.

## Prepared encrypted V1 restore automation

The manual GitHub workflow `.github/workflows/v1-restore-drill.yml` and helper `scripts/restore-v1-drill.sh` now prepare the final data proof. They fail closed unless `RESTORE_DRILL_DB_URL` identifies the dedicated project `lugedxtmfitxrkacmjpb`, reject both Production and Beta Staging refs, download only the latest encrypted backup from the private EU R2 prefix, verify both checksum layers, decrypt in runner-temporary storage, restore roles/schema/data in one transaction, require the restored `rcc` tenant and Auth users, report aggregate counts only, and remove all local restore material.

The workflow is manual and cannot run until the target project is active and its database URL is stored as the GitHub Actions secret `RESTORE_DRILL_DB_URL`. The URL must never be posted in issues, logs, commits or chat.

## Remaining Phase 28 exit criteria

- restore a recent V1 encrypted backup into a separate non-production Supabase project;
- validate database, Auth, Storage and tenant isolation there;
- record the resulting RPO/RTO evidence and update the manifest to `verified` through a reviewed change;
- run final security, performance, accessibility and operational gates against the release candidate.

Until every item is complete, Phase 29 and Phase 30 remain locked.

## Capacity result and downstream preparation

The initial zero-cost restore-project allocation returned the Supabase Free-plan active-project limit. After explicit owner approval, Beta Staging was paused, the disposable project was used for the V2 clean replay, the disposable project was paused, and the original Staging project was restored. Production was never paused or modified.

The owner subsequently requested that Phase 29 and Phase 30 start. Their reversible preparation may proceed, but this does not waive the restore requirement: the V2 release candidate may be pinned, the cutover and rollback procedure may be prepared, and the V1 recovery surface may be preserved. Production traffic, destructive data operations and V1 shutdown remain locked.

