# Member driver linking

## Direction contract

THESIS: League administrators connect an existing account to its existing league driver without recreating results. The member table remains the starting point.

OWN-WORLD: Preserve the incumbent dark admin table, typography, league accent and standard form controls. No new visual identity or decorative assets.

STORY: Select “Fahrer verknüpfen”, choose an unlinked driver, review the named account and driver, then confirm. Existing links are read-only; conflicts explain how to recover.

FIRST VIEWPORT: Keep current membership and request sections. Open a compact inline form in the driver-profile cell, with a labelled select and explicit confirmation. On mobile use the existing record-table layout; controls must fit 320px.

FORM: Narrow extension of the existing Operate surface; no concept seed required. Loading, empty, saving, success and failure states are explicit. Production is outside this release.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implementation handoff — 2026-09-09

This is a narrow extension of the incumbent member-management surface. `PRODUCT.md` establishes V1 visual continuity, visible league context, keyboard access and practical 44px touch targets. The implementation keeps the existing page header, membership and join-request sections, table/record layout, typography and action language. No visual-world replacement, global design-system documentation or repair of pre-existing context drift is in scope; the earlier generic FINISH wording does not expand this scope. No raster assets ship with this feature.

`LeagueMembersPage.tsx` places `MemberDriverLink.tsx` in the existing driver-profile cell and refreshes the member list after a successful link. The inline form names the account and selected driver before confirmation, focuses the select after loading, and returns focus to its trigger on cancel. Existing links remain read-only; inactive identities cannot start linking. Loading, empty selection, saving, success and recoverable error states have explicit text. A committed link stays successful even if refreshing the list fails.

The local stylesheet reuses the incumbent brand colors and form controls, keeps confirmation emphasis inline, gives controls a minimum 44px height, and allows long content and actions to wrap. Below 760px the driver-profile field spans the full record width. The primary-action foreground/background pairing and the inline confirmation emphasis were corrected following the initial finish review.

## Verification and release boundary

- Seven unit tests passed. Six isolated browser tests passed at desktop (1280px) and mobile (320px), covering exact account/driver mapping, conflict recovery, retry, cancel/focus behavior, absence of horizontal overflow and computed primary-action contrast of at least 4.5:1.
- An independent transactional Staging database test passed authorization guards, idempotence, refusal to overwrite existing links, same-league enforcement and AI filtering while retaining legacy human references. Temporary fixtures were rolled back.
- Migrations `20260909200102_member_driver_linking` and `20260909201305_member_driver_link_rpc_boundary` were applied only to Staging (`nfvwarlowjqphytqqtxz`). Production is outside this release.
- Browser coverage uses a synthetic UI harness; the database test runs independently. These checks do not establish a complete end-to-end flow using a real user's credentials.
- The automated design detector was unavailable because its engine installation/cache access was denied. Screenshot review substituted for that check. The final independent review scored both findings resolved and returned **ship** for the scoped visual review.

The release uses the mandatory Staging deployment gate; no Production release is authorized here.

Repeat feature checks with `npx vitest run src/operations/MemberDriverLink.test.tsx` and `npx playwright test --config qa/member-link.playwright.config.ts` from `v2`. The SQL test is `v2/supabase/tests/member-driver-linking.sql` and always rolls back its synthetic fixtures.
