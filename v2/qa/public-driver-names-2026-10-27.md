# Name and public label — staging verification

Scope: replace the separately editable display name with Name / first name and a public choice of that name or the main gamertag. Preserve identity, driver links, aliases, results and rewards.

Initial authorization: database changes and rollback tests on RaceVora Staging (`nfvwarlowjqphytqqtxz`). After verification, the owner requested a Production push and publication on 2026-10-27. That release includes both tested migrations and the corresponding web changes.

## Database

- `20261027123827_public_driver_names.sql` applied through MCP as `public_driver_names` (remote version `20261027124736`).
- `20261027135455_public_name_projection_guard.sql` applied through MCP as `public_name_projection_guard`.
- `supabase/tests/public-driver-names.sql`: passed on Staging, transaction rolled back. Covers entry, explicit league linking, name/tag switching, duplicate first names, original matching labels, alias/link preservation, stale edits, invalid input, unauthorized edits, real authenticated-role grants and real-name column restrictions. Results, XP, credits and career rows are fingerprinted after fixture provisioning and remain unchanged through profile edits.
- No existing rows are backfilled. A null preference preserves the current presentation until the user confirms it.
- Existing `display_name` fields remain compatibility/matching data. New presentation reads use `drivers.public_name`. Existing historical text, exports and matching labels are not anonymized or rewritten.
- Direct public driver reads do not select `real_name`. Authorized personal/league-management RPCs provide the name where needed.

Existing-row fingerprints matched before and after migration and rollback testing:

| Dataset | MD5 |
| --- | --- |
| Driver identity links | `0795d234bc0027bd67b7c060cf841544` |
| Race results | `4387cc08d3006983d23dfb1bc9b79c36` |
| Driver identities, excluding added mode column | `71b8d410ad977e4ab1c47c0e75c69315` |
| Drivers, excluding added public-name column | `c4817ef222c0a7495e7612bbc2c758d1` |

## Application verification

- TypeScript check and staging build passed.
- 80 focused unit tests passed across name settings, entry, driver editor, graphics and racing data.
- Full regression suite: 87 files, 523 tests passed.
- 26 distinct browser checks passed across desktop/mobile: profile persistence and stale edits, entry/resume/league request, management editor, aliases and existing gamertag correction. The first run had two test-selector ambiguities after adding the new select; the corrected entry suite passed all six checks.
- Mobile and desktop profile captures inspected. Controls wrap within the available width. Existing bottom navigation remains scroll-accessible.
- Impeccable detector returned no findings for changed form components.
- Supabase security advisor reported existing restricted private-table/RPC notices and disabled leaked-password protection; none named the new functions.

## Release boundary

Apply both migrations before publishing the corresponding web build to another environment. Do not replace or regenerate driver IDs. Production release is authorized by the owner's follow-up request; synthetic database test cases remain confined to Staging.
