# League driver and team administration

## Current change — unified team management, 2026-09-30

Scope and release target: Staging only. The user confirmed consolidating the overlapping team editors, not changing Production or the points calculation.

The sole team creation and editing surface is `/admin/teams`. Legacy links redirect here while preserving the driver query. Driver actions choose an existing team in this same surface; a new team is created only with the primary “Team erstellen” action. Team names and the two driver seats share one editor. Current-season changes still require an explicitly selected unrun race, and removing a driver requires another team. Vehicle changes live only in the driver view and preserve the effective independent league team server-side.

Visual finish review: SHIP for this scoped simplification. Desktop overview and narrow-mobile editor captures were inspected; labels, native controls, wrapping and action hierarchy remain usable within the incumbent design. No new image assets or global visual rules. Detector findings: `[]`. Targeted verification: 19 unit tests and 16 desktop/mobile browser tests passed. The Staging migration and rollback-only integration test passed, covering central rename, existing-team assignment guards, team-preserving vehicle changes and unchanged historical results. Advisors match the prior baseline. Full release verification and Staging deployment are recorded in the task handoff.

## Previous change — unified driver editor, 2026-09-30

The user superseded the earlier season-profile-selection requirement: season setup now contains only Season, Calendar and Review. Driver seating happens afterward in Drivers & Teams. The earlier review below describes the preceding release, not this pending change.

Driver editing groups display name, main gamertag, read-only start number, nationality, platform gamertags and season AI selection in one form. There is no separate “Weitere Gamertags” disclosure in league administration. Personal account aliases remain visible but are not editable by the league administrator. AI changes require an explicitly chosen unrun race and preserve the independent league team.

The incumbent visual system is retained. Native controls, grouped fieldsets, persistent labels, a single save action and responsive layouts are used. Local build, 12 targeted unit tests and 22 mocked desktop/mobile browser tests pass. Desktop and mobile editor captures were inspected; undersized selects were corrected to 44px touch targets in one visual correction pass. The owner explicitly authorized direct Production application and testing. The migration is applied, and transactionally rolled-back Production integration tests pass (20/22 AI seats, aliases, read-only numbers, explicit effective race, occupied seats, tenant denial and unchanged published results). No synthetic users or leagues remain; before/after counts are 23 aliases and 510 results. Advisor findings match the prior baseline. The final website release remains subject to the mandatory deployment gate.

Mode: Operate. Extend Production's established administration, not the unrelated Staging redesign. Confirmed: select existing league driver profiles in season setup, reuse their gamertags and identity, and manage independent named league teams and F1 vehicles. Preserve results and career history. Target desktop and mobile.

Additional user requirement: races per selected weekday, e.g. two races each Monday. Add a native numeric field to the existing calendar controls and generate repeated dates; each race retains an individually editable start time.

## Direction contract

THESIS: One driver directory leads to team allocation and season seating; refuse repeated name entry and scattered team editors.

OWN-WORLD: Inherit Production typography, themed dark surfaces, native controls and responsive record tables. No new visual system or illustrative assets.

STORY: Find a driver by name or gamertag, see their team and vehicle separately, create an empty league team, and assign it explicitly. Season setup selects that same profile by ID.

FIRST VIEWPORT: Heading and primary add-profile action, compact Drivers/Teams navigation, search and driver records. Teams view has a short create form followed by existing teams. Advanced race substitutions remain below the directory in a disclosure. Mobile records stack without horizontal page overflow.

FORM: Scoped extension of incumbent admin and wizard. Seed: not applicable; structure confirmed by user. Signature interaction is profile selection with automatic gamertag and preferred-team context. Native disclosure only; respect reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented scope and durable distinctions

This is an ordinary scoped extension of incumbent Production administration and season setup. It adds a searchable driver directory, separate named league-team management, explicit team assignment and selection of existing driver profiles during season setup. It introduces no broad aesthetic direction and takes no visual authority from the Staging redesign.

- Driver identity is the existing profile ID; name and gamertag are reused rather than entered again for each season. Duplicate seating is prevented, and an assigned active profile must have a gamertag.
- A next-season team preference is separate from the driver's current race assignment. The directory presents both distinctly.
- An active-season team change names its effective race. Earlier results and career history stay intact.
- A league-team name is independent of the F1 vehicle. Assigning a team leaves the vehicle unchanged; advanced roster/vehicle operations remain in their own disclosure.
- Calendar generation supports multiple races per chosen weekday, including repeated dates. Each race still has an individually editable start time.

Implementation evidence: `v2/src/operations/LeagueDriversPage.tsx`, `LeagueTeamPanel.tsx`, `SeasonSetupPage.tsx` and `league-teams.css`. Shared Production styling and existing wizard patterns remain authoritative. `DESIGN.md` records only confirmed incumbent rules from these surfaces and shared sources.

## Final review and verification

Independent final reviewer disposition: **SHIP**. Persistence passed against the brief and final artifacts; TYPE, MATERIAL and GROUND match the incumbent system. Directory, profile-selection, team and calendar fidelity matched the intended scoped extension. Mobile adaptation was valid. The ceiling for this narrow extension was reached; `material_fixes: none`.

Final review artifacts, all under `v2/.impeccable/review/`:

- `driver-teams-desktop.png` and `driver-teams-mobile.png`
- `teams-desktop.png` and `teams-mobile.png`
- `season-profiles-desktop.png` and `season-profiles-mobile.png`
- `season-calendar-desktop.png` and `season-calendar-mobile.png`

Verification recorded by the implementation pass: 11 unit tests and 6 browser tests passed. Staging backend verification ran inside rolled-back transactions and covered the 20- and 22-seat presets, reuse of existing driver IDs, and preservation of earlier history. The coordinating implementation agent also confirmed that the Production migration and rollback tests passed before documentation completion. These are validation records, not a claim that the complete release gate has passed or that Staging supplied the visual design.

Launch detector result supplied to documentation: `[]`. No detector or reviewer rerun was needed for this documentation-only pass. The captures are review evidence; no shipping raster assets were added, so no new raster provenance records are required.

Documentation completion: `DESIGN.md` and this surface brief. No implementation files, broad PRODUCT.md assertions, or design sidecar were changed by the documenter. Existing section-label eyebrows were not promoted to new system guidance.
