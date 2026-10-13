# Steward case race filter

Mode: Operate. Extend Production `/stewarding`; no changes to decisions, penalties, permissions or results.

## Direction contract

THESIS: Find the cases belonging to a race without scanning the entire queue. Filter before server pagination, not just the 25 visible records.

OWN-WORLD: Inherit Production theme tokens, native selects, typography and existing case list. No new imagery or visual identity.

STORY: Default to all races in the active season. Select a round and date, inspect its cases, page through matches or return to all races of that season. Previous-season races and cases are excluded; no active season shows an empty queue. Failed loads offer retry without displaying a stale case under a new filter.

FIRST VIEWPORT: A labelled full-width race selector sits immediately below the queue title, above its records. Compact previous/next controls appear only when pagination is needed. Desktop split pane and mobile stacked queue remain intact.

FORM: Precisely scoped code-led extension; no concept seed or comp is applicable. Selection is keyboard/touch native; loading and empty feedback are inline, with no new decorative motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish record — 2026-10-13

The implementation retains the incumbent split queue/detail layout on desktop and stacked layout on mobile. The labelled native race selector reuses theme variables, the established 10px field radius and a 44px minimum control height. Queue pagination, loading, empty and retry states remain local to this surface.

Documentation evidence: `StewardWorkspacePage.tsx`, `simpleSteward.css`, and the three `*steward-filter*.png` captures in `.impeccable/review/queue-inbox/`. The supplied finish review disposition is ship, with no material fixes. The screenshots use synthetic browser-test data and are review evidence, not shipping raster assets.

No durable visual-system decision changed; `DESIGN.md` and system files remain preserved. Production deployment is pending at this handoff.
