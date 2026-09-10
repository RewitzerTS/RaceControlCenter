# Calendar and image-import corrections

## Calendar

Ligaleitung → Rennen → Rennkalender bearbeiten opens a lazy-loaded individual editor.
Upcoming races without any result version can change date, Berlin start time, weather,
sprint and track (only a track not already used in this season). Race IDs, ordering,
roster links and all result data remain intact. Completed/cancelled races and races
with draft or published results are protected. Adding/removing rounds or swapping
two occupied tracks is not part of this editor.

Staging migration: `20260910212157_editable_race_calendar.sql`.
Public invoker wrappers call capability-guarded functions in non-exposed
`calendar_editor`; no permissions are added to the existing private schema.
Writes lock the season and race and compare `updated_at` to reject stale edits.
The synthetic SQL regression rolls back every test record.

## Import

Matching uses unique exact names/gamertags first. A unique one-character OCR edit
for names at least six characters long or existing unambiguous substring matches
is marked as similar. Duplicate/ambiguous candidates stay unassigned. The original
OCR name remains visible. No driver identity is inferred from a team alone.
Red Bull / Red Bull Racing / Oracle Red Bull Racing normalize to the league's
unique actual team name; no new canonical team is invented.

The save gate now uses the same validation as draft creation and displays the
blocking message plus unmatched names. AI warning text itself does not block saving.
Manual reassignment clears the missing-driver blocker immediately.

Tests: matching unit cases, sequential import → save → publish → second import,
manual unresolved-name recovery, rollback SQL, and calendar browser flow at
1280/820/320 widths. AI responses in UI regression tests are fixtures; no claim
is made that an external model can recognize every screenshot perfectly.
