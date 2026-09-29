# League team manager

## Intent
Operate. League administrators see named two-driver teams, each driver's gamertag and independent car, and edit the complete lineup together.

## Visual authority
Refine the incumbent Production interface described in DESIGN.md. Keep its theme tokens, typography, navigation and native controls. No Staging redesign, new imagery or decorative dashboard.

## Composition
Explicit current/next-season context precedes a team-first two-column list (one column on mobile). A single inline editor opens before the list. Unassigned drivers and previous tools are disclosures. Flat divided records avoid nested cards.

## Behaviour and constraints
No preselected effective race. Current-season edits require an explicitly chosen untouched race. Every departing driver requires a destination team; save the whole exchange atomically. Two drivers maximum, independent cars, unchanged historic results, scoring and XP. Next-season planning is separate. Preserve drafts on errors; stale state requires explicit reload.

## Verification
Exercise desktop and mobile overview/editor, empty/loading/error/retry, missing destination, next-season planning and stale changes. Browser mocks cover UI; database rollback fixtures verify authorization, race locks, simultaneous swaps, capacity and history.
