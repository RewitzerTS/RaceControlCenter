# Additional gamertags

Profiles expose a closed-by-default additional-gamertag disclosure. Drivers manage personal names, optionally marked EA, PlayStation, Xbox or Steam. League administrators can add local driver aliases; linked personal aliases are readable but not editable there. Changing a personal main gamertag retains the previous name as an alias. Main names, driver IDs and historical results are not rewritten by alias changes.

The driver administration workspace supplies local and linked personal aliases to image and CSV import. Exact normalized unique matches resolve to an existing driver ID. Ambiguous matches are never assigned automatically. Similar image matches require explicit confirmation; CSV names must resolve uniquely. The unrouted legacy import component is unchanged.

## Authorization and verification

Migration `20260929140426_driver_gamertag_aliases.sql` was applied to Staging and Production. The transactional SQL test suite passed on both and rolled back its synthetic fixtures. It checks personal ownership, administrator league scope, duplicate rejection, read-only personal aliases, retained former names, and denial of anonymous or direct client writes.

The private import-target table is intentionally inaccessible directly: RLS without client policies is deny-all, not a missing public policy. Redirects are explicit support corrections, not inferred duplicate merges.

Six intercepted browser scenarios cover personal add/reload/remove, failed-save retry and administrator scope at desktop and mobile sizes, without creating real user data. Independent visual review: ship. Incumbent DESIGN.md preserved. Unit tests cover alias matching, collisions, explicit duplicate redirects, fuzzy confirmation, CSV resolution and API behavior.

## Owner-approved RCC correction

The empty D4RK driver's existing account link was moved to Aaron / Darkqz in a guarded Production transaction. D4RK had no results or season assignments and was deactivated, not deleted. All 14 Aaron result rows were compared before and after and remained identical. The previous claim remains in the audit trail; a new verified claim records the corrected target. Personal names Darkqz, D4RK and Fabiylolboi were retained/added. Existing idempotent career processing was enqueued for the corrected link; no XP or historical results were deleted. An explicit import redirect prevents the retired duplicate name from creating ambiguity.
