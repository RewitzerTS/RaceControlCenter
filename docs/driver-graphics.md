# Driver graphics (V2 development)

This feature is local development work, not live. Staging is planned; Production deployment and changes to Production V1 or the productive `rcc` league are not authorized by this work.

## Scope and entry point

The profile offers **Create graphic** at `/profile/graphics`, with a return link to `/profile`. Drivers can download a published race result, driver standings, team standings, or their own season statistics (starts, wins, podiums, points). Copy is available in German, English, Spanish and French.

The profile entry requires a league role and the `socialGraphics` feature. `AppShell` independently requires an authenticated user, resolved league access and that feature before rendering the route; otherwise it returns to the profile. The existing administrator studio remains at `/admin/graphics` with its existing permission gate.

## Data and authorization

`DriverGraphicsPage.tsx` reuses `loadHistory` and `loadResultsOwnDriver` with the current league client and signed-in account. League and season filters constrain history reads; current published result-version IDs determine the results used. Superseded versions do not contribute to the graphic. Statistics require the account's actual linked driver; there is no arbitrary driver picker or fallback to another driver's statistics.

This is a read-only consumer of existing data access and RLS. Client routing and league selection are presentation checks, not a replacement for server authorization. The feature introduces no new database writes, RLS policy, privileged credential, publication action or upload. Load failures offer retry; absent published data or a missing account-to-driver link produces an explanatory empty state.

## Downloads and pagination

| Choice | PNG dimensions |
| --- | --- |
| Square (1:1) | 1080 × 1080 |
| Feed (4:5, default) | 1080 × 1350 |
| Story (9:16) | 1080 × 1920 |

The shared graphics model paginates at ten rows per page, preserving the full table. Preview buttons select a page; download renders every page. A single page downloads directly as PNG; multiple pages download as one ZIP containing the PNGs. Files use `racevora-{kind}-{format}-{page}.png`, with `racevora-{kind}-{format}.zip` for the archive. Rendering and archive assembly happen in the browser through the existing graphics utilities.

## Inherited visual direction

The direction is **Operate**: select the season, content and format, inspect the preview, then download. The existing graphics workbench places controls on the left and preview on the right on desktop, stacking them on mobile. It inherits the RaceVora shell, typography, surfaces, buttons, personal theme and league branding. The canvas adapts its primary color for readable contrast. No new imagery, assets, tokens or visual world are introduced; `DESIGN.md` remains the visual authority.

## QA evidence and limits

`v2/src/graphics/driverGraphics.test.ts` covers full-table pagination, superseded result exclusion, season boundaries, linked-driver statistics, empty results, recorded race times and retirement labels. `v2/qa/beta-responsive.browser.spec.ts` includes a driver graphics journey checking the visible preview, viewport overflow, multi-page standings ZIP and personal-statistics PNG downloads. Its QA fixtures replace history and identity loading, and external Supabase requests are blocked.

These are functional coverage locations, not a claim that this documentation pass executed or passed them. The browser fixture does not prove live authentication, RLS or Staging integration. Actual run results and rendered visual review belong in the release evidence before Staging promotion.
