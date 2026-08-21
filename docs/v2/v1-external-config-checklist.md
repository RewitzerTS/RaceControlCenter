# V1 External Configuration Recovery Checklist

Date: 2026-08-21

This checklist covers Supabase project state that is intentionally not copied from Production by a logical database backup. It is performed only in the dedicated restore project `lugedxtmfitxrkacmjpb`. Secret values are taken from the approved secret manager and are never written to GitHub logs, issues, commits or this document.

## Before the drill

- Confirm Production `kjccstcbqygxuqkvdaqw` remains `ACTIVE_HEALTHY` and is not selected as a restore target.
- Confirm Beta Staging `znnkwjogtvzwfkwnmawp` contains the expected Beta users and demo data before it is temporarily paused for Free-plan capacity.
- Activate only the dedicated restore project and record its project ref.
- Store a target-only Supabase secret key as GitHub Actions secret `RESTORE_DRILL_SECRET_KEY`.
- Run a fresh `Encrypted Off-site Backup`; accept only format version 2 with Auth data, Auth evidence and the Storage manifest/object bytes.

## Auth configuration

- Set the drill Site URL and exact allowed redirect URLs to drill-only origins; never use the Production domain for the drill.
- Recreate the required SMTP/template settings from the secret/configuration inventory without logging secret values.
- Recreate CAPTCHA/Turnstile settings with drill-appropriate keys and confirm failure is closed when CAPTCHA is invalid.
- Confirm sign-up policy, e-mail confirmation policy and password policy match the documented Production behavior.
- Confirm the target keeps its own JWT secret. Old V1 sessions must be invalid; users sign in again with the restored credential hash.
- Verify aggregate user and identity counts plus the credential fingerprint through the guarded workflow. Do not print e-mail addresses or password hashes.
- Perform one password sign-in and one password-recovery flow using an authorized recovery test account only.

## Storage configuration

- Confirm the workflow finds no unexpected bucket in the dedicated target.
- Recreate every backed-up bucket with its original visibility, size limit and MIME allowlist.
- Empty/recreate target buckets, upload every manifest object and verify every downloaded object against its archived SHA-256 and byte count.
- Confirm an expected public asset is readable and an unauthorized write is denied.

## Edge Functions, Realtime and secrets

- Deploy the pinned V1 Edge Function versions to the drill target only if they are required for the selected recovery journeys.
- Recreate target-scoped function secrets from the secret manager; never copy project JWT/API keys from Production.
- Verify function authentication/authorization and one safe no-op or test-account path.
- Confirm required Realtime tables/publications and database settings are present after restore.
- Confirm no drill URL, key or project ref is present in the Production deployment.

## Evidence and close-out

- Record the fresh backup timestamp, observed RPO, restore duration, workflow run URL, aggregate Auth counts and exact Storage bucket/object counts.
- Record each checklist item as pass/fail without secret values or personal data.
- Pause the dedicated drill project after evidence collection and restore Beta Staging to `ACTIVE_HEALTHY`.
- Re-check Beta user/demo aggregate counts and login before closing Phase 28.
- Keep Phase 29 traffic, Phase 30 retirement and V1 shutdown locked if any item is not proven.
