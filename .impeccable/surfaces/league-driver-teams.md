# League driver and team administration

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
