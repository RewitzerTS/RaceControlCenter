# Phase 25 — Security Gate

Date: 2026-08-20

Production posture: read-only inspection only. V1 and the productive `rcc` league remain unchanged.

## Gate result

- The V2 dependency lock resolves with zero known npm vulnerabilities.
- Public browser source maps are disabled.
- The browser CSP connects only to the isolated V2 Staging Supabase project instead of every `*.supabase.co` project.
- HSTS, legacy frame denial, COOP and CORP complement the existing restrictive CSP, no-index policy and MIME protection.
- Browser source contains no dynamic HTML or runtime code-evaluation sink.
- The internal Steward case counter now has RLS as defense in depth and no browser-role grants or policies.
- The cross-platform isolation contract now works on both Windows and Linux.

## Privileged database surface

Supabase Security Advisor reports 15 authenticated `SECURITY DEFINER` RPCs. They are intentional application commands or actor-bound snapshots, not anonymous endpoints. The gate verifies that every privileged function has an empty `search_path`, no `PUBLIC` execution, no anonymous execution in the exposed `public` schema, and an unchanged reviewed allowlist.

The three RLS-without-policy notices are intentional server-only tables (`platform_owners`, `driver_claims`, and `challenge_races`). RLS plus missing browser policies is their default-deny contract.

Leaked Password Protection remains a documented external Auth hardening item because it is unavailable on the current free Staging plan. It must be enabled before a paid production cutover if the selected Supabase plan exposes the control.

## Verification

- `npm audit`: zero vulnerabilities
- 37 unit/component tests
- all existing Phase 1–23 static contracts
- Phase 25 static security contract
- Phase 25 transactional database regression on isolated Staging
- live header, source-map and signed-out browser checks after Staging deployment
