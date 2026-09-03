# Season roster workflows — release checks

## Product rules

- A human substitute is the actual race participant. Driver championship points
  belong to the represented driver; team points follow the represented seat.
- Substitutions apply to one race and can be removed before any result draft exists.
- Vehicle/team changes apply from an explicit round, with optional F1-seat mapping.
- Both workflows require the active league's administrator capability on the server.
- Imported, completed and published rounds are locked for roster changes. Existing
  result revisions retain their original owner/team/vehicle snapshots.
- Later scheduled switches are not silently overwritten. An existing switch can be
  edited at its own round while no affected race has an imported result.
- The import must identify the actual substitute. It never silently replaces a
  selected participant. Explicit driver IDs take precedence over name matching.

## Automated verification

- `npm exec vitest -- run src/operations/RosterWorkflowPanel.test.tsx`
- `supabase/tests/phase-39-season-roster-workflows.sql`: transactional fixtures,
  cancellation, idempotency, circular/double assignments, BOT exclusion, locked
  drafts, publication, historical revisions, deferred vehicles and tenant access.
- `supabase/tests/phase-37-driver-ai-points-attribution.sql`: existing AI attribution
  and legacy human/BOT regression suite. Both SQL suites end with `rollback`.
- Full frontend suite and production build.
- The release migration was preflighted together with the phase-39 fixtures in a
  savepoint; all fixture writes were rolled back before committing the migration.
- Existing 675 versioned result rows retained their pre-release fingerprint.

## Responsive QA

Run `node node_modules/vite/bin/vite.js --config qa/roster-vite.config.ts`, then open
`http://127.0.0.1:4173/qa/roster-responsive.html`. The harness uses fixture-only
providers and cannot contact Supabase. It shows 375/430 px frames; `?frame=1` shows
the full-width form. QA files are not production build entry points.

## Security review

- Both private tables have RLS enabled and no direct browser/service-role grants.
  No policies is intentional deny-by-default, not missing public access.
- Three new public SECURITY DEFINER RPCs deliberately expose narrowly scoped
  operations. Every entry point checks `auth.uid`, requested league and server-side
  `league_admin` capability. Every function fixes `search_path` to empty. Anonymous
  execute is revoked. The old unguarded seat writer is now private, without caller
  execute grants.
- Security advisor notices for these three deliberate authenticated RPCs were
  reviewed; no grant of access to the private schema was introduced to silence them.
  [Advisor background](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Race locks serialize roster edits with result import. Vehicle mutations lock the
  season first and then affected races in round order. No published data backfill.

## Rollback

Revert the frontend commit or restore the preceding Worker version if necessary.
Keep the additive ledger and historical snapshots; do not delete roster history
or reverse published point ownership. Any database rollback should be a separate,
reviewed forward migration preserving those records.
