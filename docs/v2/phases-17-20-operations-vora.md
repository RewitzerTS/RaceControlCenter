# RaceVora V2 Phases 17–20

Status: implemented and verified on the isolated V2 staging stack.

## Phase 17 — Ligaleitung/Admin

- Admin is an explicit context; league administrators still start in Driver Experience.
- The actor-bound workspace resolves the requested league from the signed tenant header and requires `league_admin` capability.
- Race operations, participants, stewarding, content, league settings, permissions, and audit are grouped in a responsive operational surface.
- Platform owners entering a league see a persistent `OWNER MODE` marker.

## Phase 18 — Owner Control

- Owner Control is a separate global surface and does not depend on league membership.
- Global league, driver, processing, error, feature-flag, and audit summaries are exposed only after `platform_owners` verification.
- Server feature-flag mutations use an actor-bound RPC and append an immutable platform audit event.
- League roles cannot grant, remove, or emulate the global Owner role.

## Phase 19 — Notifications

- The in-app inbox is private to `auth.uid()` and browser clients have no direct insert/update/delete grants.
- Race summaries bundle Result, XP, VC, Level, Achievements, and Challenges into one deduplicated notification.
- Enqueue is backend-only; read-state changes use an actor-bound RPC.
- Email remains outside the core flow and no notification fan-out runs in the browser.

## Phase 20 — Vora

- Vora uses one controlled Context Service and never accepts SQL, table names, filters, or arbitrary queries from the client.
- The service resolves the current active Driver Identity and returns only that actor's authorized Career projections.
- Deterministic rules provide useful insights when no LLM is available; the V2 app has no AI runtime dependency.
- The response names its provenance and context fields. Context access is recorded in a minimal immutable audit without prompts or free-form private content.
- A server feature flag can disable Vora without affecting the rest of RaceVora.

## Verification

- TypeScript build and production Vite build pass.
- 27 component/unit tests pass.
- All V2 contract checks pass, including isolation, roles, i18n, operations, stewarding, and Vora.
- SQL transaction regressions for Phases 17–19 and 20 pass against V2 staging and roll back all fixtures.
- Supabase security and performance advisors were reviewed; the new feature-flag actor foreign key is indexed. Security-definer notices are intentional actor-bound RPC endpoints with explicit revokes and narrow grants.

## Safety

- Migrations are additive and were applied only to staging project `znnkwjogtvzwfkwnmawp`.
- V1 Production and project `rcc` were not read from, migrated, tested, or changed.
