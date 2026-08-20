# Phase 23 — User Journey E2E

Phase 23 converts the product’s role model into five explicit end-to-end acceptance journeys: signed-out visitor, Driver, Steward, League Admin, and Platform Owner.

## Acceptance matrix

| Journey | Entry | Critical completion |
| --- | --- | --- |
| Signed out | `/` | useful safe state without private data |
| Driver | `/` | latest official result, Career progression, next action |
| Steward | `/stewarding` | case → evidence → vote → decision → immutable result revision |
| League Admin | `/admin` | tenant operations → current-result Social Graphic |
| Platform Owner | `/owner` | Demo cockpit → Stewarding → operations → Social Graphics |

## Gates

- `src/journeys/userJourneys.ts` is the canonical role/entry/checkpoint/invariant matrix.
- Unit tests ensure every exact application role appears once and privileged entry points stay separate.
- The static integration contract verifies route gates, safe redirects, failure states, Steward actions, and cross-workspace Demo links.
- The SQL regression executes the Platform Owner journey against the real actor-bound RPCs in the Demo tenant, then proves a normal Driver cannot enter Owner Control, read the Demo snapshot, or see Demo progression rows.
- Every SQL fixture and authorization mutation is rolled back.

Run `npm run user-journey-e2e-contract` or the complete `npm run verify` gate.
