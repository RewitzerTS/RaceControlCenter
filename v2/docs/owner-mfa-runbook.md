# Owner MFA (TOTP)

## Scope

Platform owners require a verified Supabase TOTP factor and a signed `aal2` session before `is_platform_owner()` grants elevated access. Existing RPCs and RLS policies using that predicate inherit the requirement. Ordinary league-member rights are not converted to platform-owner rights. Drivers and league admins do not acquire a new MFA requirement.

The frontend checks `get_owner_mfa_status()` before mounting the authenticated shell. This endpoint exposes only the current caller's owner requirement and verification state. AAL1 owners can enroll using Supabase Auth without privileged data access. Enrollment is explicit; confirming an authenticator code upgrades the session, followed by another server check. Raw errors, codes, secrets and real QR images must never enter logs or screenshots.

## Staging rollout

1. Verify the source, build and mocked browser tests first.
2. Apply `20260922193914_owner_totp_required.sql` to **nfvwarlowjqphytqqtxz** only.
3. Run `supabase/tests/owner-mfa.sql` before the real staging owner enrolls. It uses an uncommitted synthetic factor and rolls back every fixture change. Never run on Production or an already-enrolled real owner. It tests AAL1 denial, unverified-factor denial, AAL2 acceptance, directory denial, removed-factor denial, non-owner denial and anonymous denial.
4. Deploy the corresponding staging frontend immediately. Old owner sessions lose global privileges when step 2 runs; stale clients must reload to get the enrollment screen.
5. The user privately enrolls in an authenticator, secures the setup key or app backup, then verifies a six-digit code. Do not ask for the key or code in chat. Test sign-out and a fresh password sign-in using the authenticator again.
6. Confirm successful owner access and ordinary driver login. A retained verified session does not require a new code on every page navigation; this is login MFA, not per-action step-up.

Production requires separate explicit approval and a coordinated migration + frontend rollout. Do not deploy this frontend to an environment without the status RPC: authenticated access deliberately fails closed when the security check is missing or unavailable. Keep the database guard if a frontend release needs repair; do not disable MFA as an availability workaround.

## Authorized Production rollout

The owner explicitly approved committing, pushing and publishing this change on 2026-09-22. Use the existing safe Production release command for the exact clean commit. Apply the reviewed MFA migration to `znnkwjogtvzwfkwnmawp` before activating the frontend, after release tests pass. Check permissions with `supabase/tests/owner-mfa-production-readonly.sql`; do not use the Staging synthetic-factor regression on Production. Compare security advisors before/after and verify the deployed entry assets against the tested build. The real owner must independently enroll on Production; Staging factors are not copied.

## Lost authenticator / break-glass

- Prefer the securely stored authenticator backup or setup key. Never email the key or put it in a support ticket.
- No user-visible MFA bypass and no password-only removal endpoint are provided.
- A separately authorized Supabase project administrator, using a separately protected management account, verifies the person's identity through a trusted out-of-band channel and records the recovery decision without secrets.
- Revoke the affected user's sessions through supported Supabase Auth administration and remove the specific lost MFA factor using the supported Auth Admin MFA API. Inspect factor IDs/status only; do not query factor secrets or change `platform_owners`.
- Revoked access JWTs can remain usable until expiration. Keep owner access denied by the missing verified factor until the configured maximum access-token lifetime has elapsed, then have the user sign in afresh and enroll a replacement. Do not re-enable a factor early when compromise is suspected.
- Confirm that a fresh session requires TOTP, and that previous sessions no longer have owner access. This is a manual administrative recovery, not automatic backup-code functionality.

## Limits and verification evidence

This implements TOTP MFA, not passkeys or phishing-resistant authentication. It does not alter existing password/CAPTCHA/rate-limit settings. Supabase Auth validates codes and applies its existing verification limits. Do not brute-force live codes as a test. Synthetic browser tests exercise the real SDK/UI session transition but do not replace a private real-device enrollment test.

References: [Supabase TOTP guide](https://supabase.com/docs/guides/auth/auth-mfa/totp), [challengeAndVerify](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify).
