# Phase 28 — Production Readiness and V1 Recovery Gate

Date: 2026-08-21

Status: in progress. The V1 code recovery point is established and automatically guarded. A separate restore project was explicitly approved and requested on 2026-08-21, but Supabase rejected its creation because the Free organization already has two active projects. Production and Staging were not changed.

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

## Remaining Phase 28 exit criteria

- replay all V2 migrations from zero in a disposable database and run the full transactional regression suite;
- restore a recent V1 encrypted backup into a separate non-production Supabase project;
- validate database, Auth, Storage and tenant isolation there;
- record the resulting RPO/RTO evidence and update the manifest to `verified` through a reviewed change;
- run final security, performance, accessibility and operational gates against the release candidate.

Until every item is complete, Phase 29 and Phase 30 remain locked.

## Capacity result and downstream preparation

The attempted zero-cost restore-project allocation returned the Supabase Free-plan active-project limit. Production and the Beta Staging project remain active and unchanged; neither is paused or reused as a destructive restore target.

The owner subsequently requested that Phase 29 and Phase 30 start. Their reversible preparation may proceed, but this does not waive the restore requirement: the V2 release candidate may be pinned, the cutover and rollback procedure may be prepared, and the V1 recovery surface may be preserved. Production traffic, destructive data operations and V1 shutdown remain locked.

