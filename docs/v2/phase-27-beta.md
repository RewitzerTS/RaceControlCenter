# Phase 27 — Protected Beta

Date: 2026-08-21

Status: complete. A real Staging-only tester account is active, synthetic role and Driver fixtures are connected, and the tester authorized continuation to the next phases on 2026-08-21.

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

## Acceptance evidence

- one real Staging-only account was created and confirmed;
- the account resolves server-side as Platform Owner and also has an isolated synthetic Driver Identity;
- Driver Home, Vora, Notifications, Stewarding, League Admin, Social Graphics, Owner Control and the owner-only Demo cockpit return actor-bound data;
- the Demo fixture covers six drivers, three teams, four races, official and revised results, DNS/DNF/DSQ, substitute and team-change cases, XP, Credits, Achievements, Challenges, Cosmetics and a complete steward decision lifecycle;
- signed-in RLS/RPC verification passed without using the Production project or productive `rcc` tenant;
- the tester accepted the V1-aligned visual direction and explicitly requested continuation with the remaining phases.

Completion of this Beta does not authorize Phase 29 cutover or Phase 30 V1 shutdown. Those phases remain locked by the Phase 28 V1 Recovery Gate.

