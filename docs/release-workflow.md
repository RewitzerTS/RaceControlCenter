# RaceVora release workflow

## Environments

- `racevora.com`: Worker `racevora-v2-production`, Supabase `RaceVora Production` (`znnkwjogtvzwfkwnmawp`).
- Test site: Worker `racevora-v2-staging`, Supabase `RaceVora Staging` (`nfvwarlowjqphytqqtxz`).
- Staging contains only synthetic demo/test data. Production user, league, race and result data are never copied into it.

## Normal change

1. Implement and verify locally.
2. Deploy the candidate only to `racevora-v2-staging` with `npm run deploy`.
3. The owner tests the staging URL and explicitly approves the exact candidate for live release.
4. Deploy that clean, unchanged commit manually with `npm run deploy:production`. The one-time environment variable `RACEVORA_APPROVED_LIVE_COMMIT` must exactly equal the commit being deployed.
5. Verify the public routes and record the deployed commit/version.

Production Git builds remain disconnected. The production deployment command rejects CI, a dirty checkout, a missing approval commit, target overrides, and staging artifacts. Staging has no `racevora.com` route, mail binding, or production database access.

## Database changes

Apply and test every migration in Staging first. Apply the same reviewed migration to Production only as part of an explicitly approved live release. Do not copy Production records, Auth users, secrets, Storage objects, or mail settings into Staging.
