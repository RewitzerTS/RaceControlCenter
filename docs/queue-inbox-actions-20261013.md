# Steward race filter and inbox bulk read

Scope: Production UI extension, explicitly requested by the owner. No sporting decisions, results or points change.

## Steward queue

- Default All races; native labelled race selector includes round and date and archive races.
- The race ID is a server-side equality filter, applied before stable created_at/id ordering and 25-row pagination. A 26th lookahead row controls Next without displaying duplicate rows.
- Existing tenant client and RLS remain authoritative. Race metadata is paginated rather than limited to races appearing in the first case page.
- Filter changes reset the page and selected detail; request sequence guards prevent a slow prior response from overriding a later selection. League changes remount the workspace. Load errors expose retry, not stale cases.
- Creation, decision, deletion and penalty commands remain unchanged. Only active-season eligible races remain available for new cases.

## Notifications

- Removed the In-App Inbox eyebrow. Added a themed, responsive Mark all as read action, localized DE/EN/ES/FR.
- `mark_all_notifications_read()` atomically marks the authenticated recipient's unread rows, including rows beyond the 50-entry inbox display. Existing read timestamps are preserved. Notifications newer than the statement timestamp are excluded.
- No client-supplied recipient is accepted, no direct table UPDATE privilege is granted, anonymous execution is revoked and unauthenticated callers fail closed. This narrowly guarded SECURITY DEFINER API follows the existing `mark_notification_read` boundary.
- Success updates visible rows and dispatches the existing inbox event so the bell recounts. Busy guard prevents repeated submits; failure remains retryable.

## Verification

- Unit tests exercise filtered/paged query shape, lookahead, existing race eligibility and bulk RPC contract.
- Transactional Staging SQL fixture rolls back two synthetic users and 64 notifications. It tests more than 50 unread messages, recipient isolation, old read timestamps, future notifications, repeat calls, anonymous privilege and missing authentication. Passed before Production rollout.
- Browser fixtures cover pagination, archived races, empty matches, failure/retry, out-of-order responses, bulk-read retry, bell update and reload persistence on desktop/mobile. No real user notifications are marked during tests.
- Database advisor flags authenticated SECURITY DEFINER execution by design; explicit actor checks and rollback tests cover this boundary. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Existing unrelated advisory: [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

UI extends the incumbent Production system. No new rasters or global visual changes. Release receipt is reported separately after the mandatory full deployment gate and live build verification.
