# Saved-draft Drivers’ Championship preview

## Scope

`/admin/results/import` now shows **Vorläufige Fahrer-WM** below saved drafts. Saving the first draft loads it automatically; multiple drafts have a selector and manual refresh. The newest saved draft is the default. Unsaved changes and other drafts are explicitly excluded. All season participants (including zero-point drivers) appear; there is no 10/11-row limit.

The table shows position, display name/gamertag, provisional total and the points difference from the official championship. It reuses `buildStandings`, including its existing tie-breaks and points-owner handling. A revision replaces that race’s official contribution instead of adding it twice. Preview requests are aborted on selection/league changes; loading and failed requests hide the previous table.

## Read-only boundary

`get_result_draft_championship_preview(uuid)` returns one consistent read snapshot for the selected draft’s season, with official results and projected draft rows. It requires an authenticated league administrator/owner and a matching requested-league scope. Anonymous execution and direct execution of its private helper are revoked. Only validated, non-discarded, unconsumed drafts based on the current official version are accepted.

Pending time penalties/credits are projected using the same timing, lapped-slot, scoring-scale, fastest-lap-bonus and manual-adjustment rules as publication. Missing/invalid correction times fail closed with an actionable message. Grid penalties do not change championship points. Deleted/applied decisions are excluded. Neither preview function activates results, inserts receipts, emits events, or awards XP/credits.

The isolated correction implementation is intentionally read-only; publication is unchanged. Keep its behavior in parity with `prepare_steward_time_corrections` if sporting rules change.

## Verification

- TypeScript build passed.
- Six standings tests cover 20/22 drivers, first result, revisions/negative differences, tie-breaks, AI/substitute points owners, departed drivers and localization.
- Existing result-import/recovery tests pass, including failure and retry paths.
- Browser workflow passed on desktop (1280 px) and mobile (390 px): save, automatic preview, 22 rows, long names, selection, refresh failure/retry and reload; no publication RPC is called.
- Transactionally rolled-back Staging SQL regression passed: role/tenant/anonymous denial, repeat-read invariance, no new result/event/audit/application records, combined credit/penalty, bonus boundary, retained manual points, lapped slots, exact publication parity, revision/discard/consumed lifecycle and grants.
- Production received the two additive preview migrations; no existing sporting data was rewritten. The missing, already-production `result_draft_recovery_and_ocr_times` prerequisite was installed on Staging before regression testing.

UI follows the incumbent Production administration design and personal-theme variables. No global design, publishing action, official championship rule or reward mechanism was changed.

The Production security advisor flags the new authenticated SECURITY DEFINER RPC by design ([advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)); it is intentionally callable with explicit tenant/admin checks, verified by the denial tests. The helper remains inaccessible. Existing unrelated advisor notices were not changed, including [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Impeccable finish review: **ship**, no material fixes, scoped to the new preview and its desktop/mobile integration. No change to the established design system.
