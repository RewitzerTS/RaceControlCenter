# Simplified steward decisions

Mode: Operate. Scope: steward workspace and the steward section of a race. Preserve the incumbent shell, theme and navigation. This is a workflow simplification, not a visual redesign.

The league discusses incidents externally. One form records race, reporting driver, accused driver, decision and reasoning. The primary action publishes the reviewed decision; the secondary action saves an open case. No voting or technical rule/version inputs in the new workflow. Previous evidence, votes and appeals remain readable under a disclosure. Historical database functions remain for compatibility.

Time penalties and credits carry seconds. Without a published result the interface clearly says the correction is pending; at publication the server atomically adjusts times, positions and points and records an application receipt. Pending and applied states remain visible beside the decision. Grid penalties identify the immediate next scheduled race and explain that league management implements its grid in the game. No fabricated result is needed for a grid penalty or no-action decision.

Form: two columns on desktop, one on mobile, explicit labels, 16px entry text, 44px actions, one primary action, inline error/status feedback. Palette, controls and fonts inherit the existing product. No new imagery or ornamental assets. Existing global styling is not replaced.

Verification: transactional Staging SQL covers direct and deferred changes, combined credit/penalty, retry idempotence, missing-time rollback, fastest-lap bonus boundary, cross-league rejection and driver-role rejection. Synthetic fixtures are rolled back. Browser coverage uses intercepted data on desktop and mobile. Physical iPhone Safari is not tested. Deployment status is reported separately.

Visual finish: **ship** for this scoped form simplification. Desktop/mobile screenshots were reviewed in one batch, then confirmed after one consolidated adjustment (two-column desktop fields and readable mobile input sizing). Fixed header/footer positions in full-page screenshots are browser-capture artifacts, not extra page sections. The scoped Impeccable detector returned no findings. Existing global editorial heading, floating helpers and navigation remain outside this change.
