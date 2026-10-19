# Einstieg 2.0

Primary target: `v2/src/driver/OnboardingPage.tsx`.
Related targets: EntryHome, DriverIdentityProvider, profile summary, auth routing and league-member request review.

Mode: Operate. Extend the incumbent visual system; no new brand, logo, raster assets or global layout rewrite. User approved the identity-first onboarding proposal and explicitly authorized the database changes on Staging only. Production remains unchanged.

## Direction

First value is a durable RaceVora driver identity, followed by an understandable league request. The identifier is distinct from the existing 0–99 profile/start-number convention. Registration and email confirmation remain owned by Supabase. An idempotent authenticated call provisions the identity after confirmed sign-in; no signup trigger can break registration.

Three short steps: saved display name/main gamertag; optional personal theme and platform aliases; five-digit league request, league creation or explore later. Completed steps persist on the server. A failed league code never rolls back the profile. Skipping dismisses the wizard but leaves incomplete profile fields resumable. The existing alias editor retains EA/PlayStation/Xbox/Steam labels and safe matching semantics.

The surface is a narrow, readable column with a compact identity row, numbered progress (a genuine sequence), native labeled fields and incumbent themed pill actions. Mobile places step number above its label; no horizontal clipping at 320px. Focus moves to the new step heading, errors are announced and saved data survives retries. Personal colors preview on onboarding and on the no-league Home even if the previous context was the demo league. Demo racing pages remain standard-branded.

Home no longer requires a league membership merely to show the account's identity and join-request status. Membership, missing driver link and technical access errors remain distinct. The established race-day dashboard and statistics are unchanged for linked drivers. Password recovery is no longer intercepted by a global onboarding redirect. Signup/signin tab state follows the URL.

## Explicit driver approval

League management opens a request, sees league-scoped candidates and exact normalized gamertag/alias hints, and explicitly selects an existing driver or creates a new one. Nothing is preselected, including an exact match. Existing driver names, results and links are never rewritten by the matching query. Old automatic-approval calls are rejected; rejection remains compatible. The established transactional member-link helper enforces authorization, league scope and ownership. One committed review generates one notification and audit record.

## Verification and limitations

Staging migrations `20261018214442_entry_two.sql` and `20261018220102_entry_main_tag_candidates.sql` applied (remote ledger versions `20261018214954` and `20261018220142`). The second migration covers a main gamertag equal to the display name. Rollback-only synthetic scenarios verify provisioning, immutable unique IDs, saved/resumed steps, invalid inputs/codes, request deduplication, actor isolation, explicit approval, cross-league rejection, occupied drivers and intentional new-driver creation. An additional transaction executes provisioning under the actual `authenticated` database role. Before/after fingerprints of existing results and links match.

Targeted unit tests, TypeScript and build checks pass. Desktop/mobile browser fixtures cover save failure, resume, theme selection, join confirmation, pending Home, skip/recovery, 320px width and non-preselected admin linking. Browser calls are intercepted synthetic fixtures, not real account signups or actual email delivery. Physical iPhone Safari and human comprehension testing remain outside this verification. Manual visual review and the final release gate are recorded in the handoff; no Production release is authorized by this brief.

Impeccable manual detector: no findings. Root PRODUCT.md still contains legacy pre-cutover assumptions; this scoped change does not silently rewrite that document or DESIGN.md. No raster provenance is needed because no new raster ships.

Manual visual review: **ship for Staging**. Desktop and 320/390px captures were inspected. Identity, setup fields and current step are readable; the four-theme chooser previews the selected theme and the admin selection keeps its explicit confirmation. Mobile progress labels use consistent stacked alignment. Full-page captures include the existing fixed navigation at its viewport position; this is not an extra in-flow navigation bar. The existing footer, safe-area rules and support controls were not redesigned. Browser testing is Chromium emulation, not physical-device Safari.

Advisors after schema change: no findings on `entry_private`. Existing Staging advisories remain: deny-by-default internal tables without RLS policies, older authenticated SECURITY DEFINER entry points, leaked-password protection disabled, six unindexed foreign-key reports and unused indexes. No broad permission or database-tuning changes were made as part of onboarding.

## Staging release verification

Released on 2026-10-19 (Europe/Berlin) using the complete mandatory Staging release gate: 503 unit tests passed, 195 browser tests passed and one duplicate mobile WebKit case was intentionally skipped. Type checks, build and source/security contracts passed. Existing large-bundle warnings remain.

Worker version: `0e0f9d25-5271-4479-a95e-163d61990fa4`. Hosted `/onboarding` responds with HTTP 200 and the expected `index-BFTNTwFk.js` / `index--uUMx4Zk.css` assets. Hosted `build-target.json` confirms `staging` and Supabase project `nfvwarlowjqphytqqtxz`. All six new entry browser scenarios also passed against the hosted Staging assets, with synthetic intercepted backend calls. The hosted 320px capture was inspected. No live-user signup or email-delivery claim is made.

Source changes remain uncommitted and unpushed. The build metadata commit is the unchanged base HEAD `bbc8f23182ee8db6012b6c96a3b265f9a3c2b260`, not a commit containing this working-tree release. Production code and database were not changed.
