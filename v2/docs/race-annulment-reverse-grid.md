# Race annulment and reverse grid

Initial release target: Staging only. No real race was annulled during implementation.

## League management

- **Saison & Rennen → Rennen → Rennen annullieren** requires a reason and explicit confirmation. Only an administrator of the selected league or a verified platform owner can annul an active-season race.
- The calendar retains the race as **Annulliert**. Other race dates and round numbers are untouched. This action has no restore control.
- The current result is voided, not erased from history. All pending drafts are discarded and cannot be published or reimported. Current championship projections, career facts, XP, achievements and challenge rewards are reconciled through the existing void-event processors.
- The entire operation is transactional, including reconciliation. An incomplete event delivery raises an error and rolls everything back. A stale result version or race timestamp also rejects the operation. A repeated successful request is idempotent.
- The result-import picker and local draft recovery exclude cancelled races.

## Reversegrid-Aufstellung

- Available to league administrators and verified platform owners under **Saison & Rennen**.
- Defaults to **Vorläufige Fahrer-WM mit Entwürfen**, as requested for multiple races per race day. An explicit selector also offers the published championship.
- Uses the same `buildStandings` function and current AI-point inheritance as the championship. All rows, including ties, are reversed exactly; there is no top-10/11 limit.
- Displays start position, current AI driver, main gamertag, public driver name, WM position and points. Missing AI assignments are visible and flagged rather than silently dropping drivers.
- For each race, only its latest non-discarded, non-published draft is included. Its contribution replaces that race's published contribution. Pending steward time corrections use the existing preview calculation. Stale or uncalculable drafts fail the preview without showing an old grid.
- The preview publishes nothing. Start-position penalties are not applied to this pure reverse-WM order and the page explicitly says so.

## Database and verification

Apply migrations `20261110112345`, `20261110114512`, `20261110114804` in order. The two API wrappers use invoker rights and call guarded functions in `race_control_private`; the broad `private` schema remains inaccessible to authenticated clients. `race_annulments` is private, immutable, RLS-enabled, and intentionally has no direct-client policies.

Staging SQL regression scripts `supabase/tests/race-annulment.sql` and `supabase/tests/reverse-grid.sql` create synthetic users/leagues and finish with `ROLLBACK`. They verify reward/stat reversals, unchanged following races, replay/draft guards, league isolation, permissions and AI/gamertag pairing. No synthetic leagues or actual annulments remain after testing.

Unit tests cover exact ordering for 20/22 drivers, inherited AI points, draft replacement and rejected malformed sources. Browser tests cover desktop/mobile, source selection, stale-result errors, required reasons and confirmation. Security advisors added no new warnings; the additional RLS-without-policy information is the intentionally private history table.
