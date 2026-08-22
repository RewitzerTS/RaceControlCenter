# Phase 22 — Demo Full E2E

Phase 22 introduces one deterministic, Platform-Owner-only Demo league for end-to-end testing, screenshots, landing-page material, and product demonstrations.

## Isolation

- League slug: `demo`
- `owner_only: true`, `is_public: false`, `published: false`
- Demo progression is stored only in `demo_driver_profiles` with `progression_scope: demo_only`.
- Demo users are synthetic `@demo.invalid` identities without passwords.
- No Demo driver is linked to a global Driver Identity, so Demo results cannot affect global XP, rank, credits, achievements, challenges, or cosmetics.
- Snapshot access is actor-bound through `get_demo_full_e2e_snapshot()` and requires `platform_owner`.

## Scenario coverage

The fixture includes six registered drivers, three teams, four calendar rounds, DNS, DNF, DSQ, a substitute, a team change, a closed Steward case, a disqualification, an original and revised official result, plus representative Demo-only achievements, challenges, XP, credits, and cosmetics.

The Owner Control opens `/owner/demo`, where all 13 required scenarios are exposed as an explicit coverage checklist. From there the owner can move directly into league operations, Stewarding, and deterministic Social Graphics while retaining the Demo league context.

## Verification

- Database migration: `20260820193531_v2_demo_full_e2e.sql`
- Static contract: `npm run demo-full-e2e-contract`
- Unit coverage: `src/demo/demo.test.ts`
- Full gate: `npm run verify`
