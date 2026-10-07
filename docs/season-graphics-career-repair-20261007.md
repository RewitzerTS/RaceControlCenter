# Season graphics, Hall of Fame and Career repair — 2026-10-07

Scope: production bug corrections; no sporting results, points, XP, driver links or historical team memberships are changed.

## Causes and changes

- The legacy `supabaseClient.rpc` guard was async for every call, converting PostgREST query builders into promises. Both personal Career views failed at `.order()`. Only the three boolean role RPCs remain asynchronously guarded; other calls preserve their native builder and pagination. Anonymous role checks remain guarded.
- Standings graphics sliced rows to ten before pagination. Preserve every row, then balance pages of at most eleven: 20 = 10+10, 22 = 11+11. The separate driver graphics entry point uses the same page size. All 10/11 teams fit in one image.
- Season standings no longer carry the latest GP's name, date, round, flag or result version as source metadata. The protected graphics RPC selects the active season independently of the latest result and returns its name; explicit server-side ranking caps are removed. Existing RPC permissions and scoring expressions remain unchanged.
- Hall of Fame combines the RCC-only supplied archive (1–13) with completed, archived seasons and their current published results. Active seasons and incomplete archives cannot crown winners. Historical teams never fall back to today's driver profile team. Missing team evidence is clearly labelled and cannot create a constructor title.

## Production historical limitation

RCC season 14 has 24 published races and 451 result rows, all without `points_team_name`. The stored points identify Mo as driver champion (354 points, 5 wins). During this repair the owner explicitly confirmed Safety Car Specialists as constructor champion. `confirmedChampions.json` fills this title only for the exact RCC season ID, without inventing a full lineup or assigning Mo to that team. No sporting data is rewritten.

## Verification

- Targeted model/legacy RPC/history regression tests: 37 passed.
- Desktop/mobile Hall of Fame browser tests: 4 passed, including an archived season above RCC's legacy archive.
- Graphics browser tests cover 20/22 drivers, both preview pages and an actual ZIP containing both PNG files, with mocked backend writes only.
- Graphics migration applied first on Staging; transactional read verification confirmed active-season isolation. Then applied on Production and verified with an authenticated read and rollback; RCC returns at least 20 standings rows.
- Staging database advisor notices concern existing protected SECURITY DEFINER endpoints, private tables and password settings; the migration does not expand any grants or change RLS.

Run the mandatory production deployment gate and verify the live release before considering publication complete.
