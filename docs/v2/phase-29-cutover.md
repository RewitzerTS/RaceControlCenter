# Phase 29 — Controlled Cutover

Status: complete. V2 production traffic: active.

RaceVora V2 replaced V1 on `racevora.com` and `www.racevora.com` on 2026-08-22 after explicit owner authorization of the production switch, its outage risk and the prepared rollback.

## Production release

- Release branch: `release/v2-r10-production-cutover`
- Release commit: `2ea5030ceba2343698cddb1ebaa7b4f669a1720a`
- Cloudflare Worker: `racevora-v2-production`
- Cloudflare version: `a9f1791b-fcb9-44a0-86ef-e3d72021f5a6`
- Active route overlay: `racevora.com/*` and `www.racevora.com/*`
- `www.racevora.com` canonical redirect to `racevora.com`: verified

The overlay is intentionally reversible. Deploying `wrangler.production.jsonc` for `racevora-v2-production` removes its route triggers, allowing the preserved V1 custom-domain Worker to receive production traffic again.

## Live cutover gate

The following routes returned HTTP 200 on the production domain after activation:

- `/`, `/beta`, `/racing`, `/notifications`
- `/impressum.html`, `/datenschutz.html`, `/agb.html`, `/widerruf.html`
- `/robots.txt`

Normal navigation produced no console error and all five initial application resources returned HTTP 200. The withdrawal route contains the dedicated V2 electronic withdrawal form and production endpoint.

Chrome DevTools under mobile viewport, Fast 4G and 4× CPU slowdown measured:

- LCP: 833 ms
- TTFB: 54 ms
- CLS: 0.00
- Lighthouse Accessibility: 100
- Lighthouse SEO: 100

Lighthouse's own inline inspection was blocked by the restrictive production CSP and therefore reduced the synthetic Best Practices score to 92. The error was absent on normal navigation and does not indicate an application failure.

## Protected `rcc` parity

Read-only post-cutover queries returned the same V1 and V2 counts:

- 1 league
- 1 season
- 24 races
- 20 drivers
- 451 race results

V1 received no write. A 100-entry V2 API log sample contained 99 HTTP 200 responses, one expected HTTP 401 response and no HTTP 5xx response.

## Rollback rule

Any core-route 5xx, fatal application error, failed authentication/legal path, `rcc` mismatch, LCP above 2.5 seconds or CLS of at least 0.1 during the initial gate requires immediate route removal and V1 verification. No rollback trigger occurred.
