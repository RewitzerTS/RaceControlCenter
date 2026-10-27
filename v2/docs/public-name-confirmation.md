# One-time public-name confirmation

Implemented and approved for Production publication on 2026-10-27.

Authenticated visitors must confirm their real name / first name and explicitly
choose either that name or their main gamertag for public display before using
the app. Existing confirmed preferences pass through without another prompt.
The check uses `get_my_name_settings`, not auth metadata or browser storage.
Saving uses the existing revision-checked `save_my_name_settings` RPC. No new
migration or bulk update of user records is needed.

The gate sits after Owner MFA and before driver/role providers and the app shell.
This preserves the existing initialization sequence for league selection and
permissions after confirmation. Deep links are retained. A different account or
client cannot reuse an earlier account's confirmation. Failed checks and saves
keep the app closed and offer retry; stale data must be reloaded before saving.

Login, auth confirmation, password recovery, onboarding and legal routes remain
accessible. An account without an active driver identity is directed to setup.
Skipping setup returns to the gate when entering the app. Signout remains
available. This is a UI completion requirement, not a replacement for database
authorization or a restriction on public website content.

Driver IDs, links, results, points and XP are untouched. Existing server name
projection updates only when the user saves their preference. The choice can
still be changed later in the profile.

## Verification

- Staging-mode build and TypeScript compilation passed.
- 35 targeted unit tests passed (confirmation, name settings, entry, Owner MFA).
- 24 browser tests passed at desktop and mobile widths, including explicit
  selection, failed check/save retries, preserved deep links, reload persistence,
  missing identities, profile updates, league approval and MFA.
- Desktop and mobile screenshots inspected; no horizontal overflow, accessible
  native fields, legal links and signout retained, safe-area padding present.
- UI detector returned no findings for the new component and stylesheet.
- 102 further desktop/mobile regression tests passed for existing signed-in
  surfaces (teams, standings, result drafts, graphics, notifications, profile
  themes and stewarding). Details are recorded in
  `output/name-confirmation-regression.log` in the repository root.

Browser requests use synthetic accounts and mocked Supabase responses. No real
customer settings or Production data were modified by these checks.
