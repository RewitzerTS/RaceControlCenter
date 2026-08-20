# Phase 27 — Protected Beta

Date: 2026-08-21

Status: in progress. Beta access is implemented; first real tester activation and role-based acceptance remain open.

Production posture: V1 remains online and unchanged. The productive `rcc` league is not a Beta tenant and is never written by V2.

## Beta entry

- `/beta` provides isolated Supabase email/password sign-up and sign-in.
- Passwords are submitted directly to Supabase Auth and are never stored by RaceVora.
- The form exposes stable labels, names, autocomplete modes, keyboard focus, loading state and generic localized errors.
- Signed-out Home and the top bar both lead to the Beta entry.
- German, English, Spanish and French copy remain key-parity complete.
- Staging remains `noindex` and continues to reject the Production Supabase project reference.

## Acceptance sequence

1. Create and confirm one real Staging-only test account.
2. Verify the signed-in no-identity state contains no private data.
3. Link only synthetic Beta identities and roles in Staging.
4. Execute Driver, Steward, League Admin and Platform Owner journeys on desktop and mobile.
5. Record defects without changing V1 or `rcc`.
6. Keep Phase 27 open until the tester accepts the journeys or all findings are resolved.

No result from this Beta authorizes Phase 29 cutover or Phase 30 V1 shutdown.
