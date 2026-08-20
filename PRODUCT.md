# RaceVora Product Context

## Product

RaceVora is a web platform for organized sim-racing careers and league operations. It gives drivers a coherent career home while providing stewards, league administrators, and the platform owner with precise operational tools.

## Users and roles

- **Driver:** follows a personal sim-racing career, results, standings, calendar, contracts, and progression.
- **Steward:** reviews incidents and supports fair, traceable sporting decisions.
- **League administrator:** operates one league, its members, events, seasons, rules, and communications.
- **Platform owner:** manages the platform independently of membership in any individual league.

Frontend roles are presentation and navigation context only. Authorization is enforced server-side by Supabase RLS, narrowly scoped RPCs, and Edge Functions. Ambiguous or failed authorization checks default to no access.

## Core value

RaceVora should make a driver feel that their races form a real career, not a loose collection of league pages. For organizers, it should turn league operations into a dependable workflow with clear responsibility and an audit-friendly data model.

## Brand and personality

RaceVora moves leagues forward. The product is professional, calm, precise, motorsport-adjacent, and technically credible without becoming artificially aggressive.

The visual language is dark and focused, using the established RaceVora purple-to-teal spectrum, crisp typography, restrained motion, and high-information surfaces. It must avoid chaotic neon-gaming aesthetics, excessive glow, ornamental dashboards, and generic card grids.

## Design principles

1. **Career first:** driver-facing surfaces tell a coherent story of progress and upcoming action.
2. **Precision over spectacle:** data, state, and consequence must be legible before decoration.
3. **One clear next action:** every operational view makes the next meaningful step obvious.
4. **Tenant context is visible:** users should always understand which league they are acting in.
5. **Mobile is a first-class cockpit:** layouts work on current iPhones, respect safe areas, and never depend on hover.
6. **Motion communicates state:** brief transitions may reinforce direction or completion; reduced-motion preferences are respected.

## Accessibility baseline

- Complete keyboard operation and visible focus states.
- Programmatic labels and meaningful landmarks.
- Contrast suitable for dark interfaces.
- Touch targets of at least 44 by 44 CSS pixels where practical.
- State is never communicated by color alone.
- Reduced-motion support and no essential hover-only interaction.
- Plain, action-oriented interface language.

## Technical constraints

- Production V1 remains live and unchanged while V2 is built in parallel.
- V2 uses a separate Supabase project and a separate Cloudflare Pages project.
- V2 must refuse to start when configured with the Production Supabase project.
- No service-role credential is ever exposed to the browser.
- Tenant isolation is enforced server-side; client-selected league context is not authorization.
- The solution should remain resource-conscious enough for the initial Supabase and Cloudflare tiers.

## V2 foundation scope

The first V2 increment establishes an isolated React/TypeScript/Vite application shell, environment guards, auth/league/role provider boundaries, four-language scaffolding (German, English, Spanish, French), accessibility foundations, and automated isolation checks. It does not yet replace V1 routes or mutate Production data.
