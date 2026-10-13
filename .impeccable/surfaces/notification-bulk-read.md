# Notification bulk read

Mode: Operate. Narrow code-led extension to Production `/notifications`.

## Direction contract

THESIS: Clear the unread inbox in one explicit action, including entries beyond the displayed fifty. Remove the redundant In-App Inbox eyebrow.

OWN-WORLD: Inherit the Production themed header, pill actions, notification records and readable mobile layout. No new system decisions or raster assets.

STORY: Read the inbox or mark all existing notifications read. The bell refreshes after success. Errors keep the action retryable; no other user's records can change. Newly arriving notifications remain unread.

FIRST VIEWPORT: Existing title and description on the left, one labelled secondary action on the right, stacking within the mobile viewport. Inline success/error feedback precedes the unchanged list.

FORM: Precisely specified local extension, no seed or concept round. Native button, guarded busy state, 44px touch target and existing focus styles. No decorative motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record — 2026-10-13

The implementation removes the In-App Inbox eyebrow and adds the bulk-read action beside the existing desktop header, stacking below its copy on mobile. The action inherits the outlined pill treatment, has a 44px minimum height and wraps long labels. Busy, success and retryable error feedback remain local to this surface.

Documentation evidence: `NotificationCenterPage.tsx`, `notificationActions.css`, and the three `*notification-actions*.png` captures in `.impeccable/review/queue-inbox/`. The supplied finish review disposition is ship, with no material fixes. The screenshots use synthetic browser-test data and are review evidence, not shipping raster assets.

No durable visual-system decision changed; `DESIGN.md` and system files remain preserved. Production deployment is pending at this handoff.
