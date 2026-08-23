# V1 migration completion

Status: complete. The production application combines the retained V1 operating model and presentation with the V2 platform features.

## Restored V1 administration surface

- league creation and workspace selection;
- member and role administration;
- driver administration, including profile, team and vehicle data;
- team rename and vehicle maintenance without rewriting historical results;
- race calendar administration and current standings/result overview;
- CSV result import into a validated draft and a separate explicit publish action;
- branding and social graphic publishing;
- stewarding cases;
- league rules and public FAQs;
- immutable league audit history.

Every Admin menu tile now opens a working route. There are no remaining `folgt in der V1-Migration` placeholders.

## Safety and data integrity

- All new database operations resolve the signed-in actor and requested league on the server.
- Anonymous execution is denied. Admin mutations require an active league admin or owner role.
- Imported results cannot become official during upload or validation; the separate publish action is required.
- Team changes affect current driver metadata only. Historical official result rows remain unchanged.
- The `rcc` production parity baseline remains 1 season, 24 races, 20 drivers and 451 race results.

## Verification

- Full V2 verification suite passed: 9 test files / 40 tests.
- Migration rehearsal passed: 34 additive migrations / 23 transactional regressions.
- Supabase security advisor: no errors after the completion migration.
- Supabase performance advisor: no actionable warnings after the completion migration.
- Anonymous execute access is denied for all five migration-completion RPCs.

## V1 recovery remains available

Migration completion does not delete V1. Recovery remains pinned to branch `recovery/v1-production-2026-08-21` and commit `2da639e9b4907e226c1a2c9858320e4b73bebee0`.

The verified archive `RaceVora-V1-recovery-2da639e9b490.zip` has SHA-256 `5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132`. The encrypted off-site database/Auth/Storage backup and Worker rollback route are retained. V1 deletion and pause remain forbidden.
