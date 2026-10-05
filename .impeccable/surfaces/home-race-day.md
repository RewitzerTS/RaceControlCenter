# Home race day and notification badge

## 2026-10-06 approved artwork replacement

The owner explicitly approved a generated photographic-style destination series and requested Production publication (correcting an initial Staging request). This supersedes this brief's earlier real-photograph-only constraint for the home race carousel only. Layout, controls, circuit diagrams, personal themes and race data are unchanged.

All 26 catalogue keys now map to 25 original generated destination illustrations, with Spain/Catalonia sharing Barcelona. Twelve images depict daylight; the remaining scenes use evening, blue hour or night. Files are versioned under `v2/public/assets/race-art/20261006/`, WebP quality 85 at the original 1672x941 resolution without cropping. The original PNGs remain in local `output/track-art-20261006/`. `docs/race-art-20261006.json` records prompts, generation method and the Madrid text-artifact correction. Prior licensed photos and their files are preserved; their attribution is not reused for generated imagery.

The carousel displays a localized AI-illustration label in DE/EN/ES/FR. The narrow artwork-only visual review is **ship**: desktop, 390px mobile, and 768px tablet captures retain compact sizing and readable text over night and day scenes. Tests additionally cover 320px overflow, themed controls, all 25 asset responses, race switching and profile navigation. Five targeted unit tests, 12 browser tests, TypeScript and the translation contract passed. The Impeccable detector returned no findings for the changed UI targets. This is Chromium emulation, not physical iPhone Safari testing. Full release-gate execution and deployment are recorded separately in the delivery response; this note does not claim a completed deployment.

Scope: extend Home's upcoming-race region and the existing bell; do not redesign the global shell. Operate mode. The user's Monaco example supplies photo-led composition, large race title, date/time, track schematic and open-race action. Existing career actions and theme preferences remain available.

## Direction contract

THESIS: a race-day programme, showing every scheduled race on the next scheduled race date, including multiple rounds on that date. This means the next race day, not necessarily tomorrow.

OWN-WORLD: real venue photographs, dark legible overlay and a locally scoped expanded race-title face. Controls inherit the personal theme. Existing shell remains unchanged. This is an ordinary scoped extension, not a replacement visual world or a pixel-exact recreation of the Monaco reference.

STORY: identify the race day, switch between its races, open the selected circuit profile; unread notifications are counted at the bell.

FIRST VIEWPORT: compact race programme directly below the greeting in the former next-race showcase slot, beside career statistics on desktop. The photo stays within that column. Date/time and action sit beside a small schematic; attribution is at the foot. Numbered race tabs and previous/next controls expose all races. Narrow containers reflow without clipping or automatic movement.

FORM: precisely specified local extension, no concept seed required. User said to proceed. Code-led responsive implementation of the example's layout; real licensed photographs and existing circuit diagrams, no generated geography. Signature interaction is swipe/keyboard/manual race switching, no autoplay.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Historical team repairs are a separate data-correctness task. Onboarding remains deferred.

## Implemented region

Home places the race-day programme inside the incumbent greeting card, replacing only its next-race showcase. It groups upcoming races from the active season by the earliest scheduled date, orders them by date, start time and round, and exposes the complete selected day through numbered race buttons and previous/next controls. Arrow keys work while the carousel region itself has focus; a deliberate horizontal swipe changes races while vertical scrolling remains available. Navigation wraps, the current position is announced politely, and there is no autoplay or carousel animation. A single race has no redundant switching buttons; an empty day leaves the existing no-race/season state available.

Each selected race presents its name, circuit, localized date/time, a real venue photograph when mapped, and the existing circuit schematic and length when available. The “Streckenprofil” action includes the selected league, season and catalog track key; unmapped circuits omit the action rather than invent a destination. Scheduled circuits now show their profile even before the first completed race, without counting upcoming races or borrowing statistics from another season. Failed or unmapped photography leaves the dark readable surface intact. Photography is decorative; the circuit schematic has a circuit-name alternative. Source and license links remain visible beneath the race content.

Track matching receives the active season's game key so venue and diagram selection respect the F1 25/F1 26 track catalogue. Custom race names retain their text without an invented GP suffix.

The header bell retains its existing destination and gains an unread count on desktop and mobile. Zero hides the badge; counts above 99 display `99+`, while the accessible link label retains the actual count. The count is scoped to the signed-in recipient and unread records, refreshes when the inbox changes or the window becomes visible/focused, and polls every 30 seconds while visible. User changes cannot display another user's cached count.

## Local visual implementation and assets

The photograph fills a rounded local surface with a dark directional overlay. A container-sized wrapping title tops date/time and the themed action; the compact schematic sits beside them. No fixed hero height remains. The race selector scrolls horizontally within its own strip on narrow screens. Below a 340px container width the map shrinks and the action spans both columns; footer content wraps. All controls remain at least 44px high. The surrounding header, career surfaces, navigation and personalization controls retain their incumbent composition.

`Special Gothic Expanded One` is self-hosted as `v2/public/assets/fonts/special-gothic-expanded-one.ttf`, with `SpecialGothicExpandedOne-OFL.txt` alongside it. Its `RaceDayDisplay` alias applies only to race titles, uses a sans-serif fallback and `font-display: swap`; it is not a new global typography rule.

The 25 venue JPGs were copied from existing licensed project assets. `v2/src/driver/venueMedia.json` records each public path, venue key, source, author and license link. These include circuit photographs, aerial views and location photographs; they are not presented as current photographic surveys of every circuit. Circuit diagrams remain the established trackmap assets. Documentation checked all 25 image paths and attribution entries: zero missing files, zero incomplete attribution records. The supplied provenance scan also reports 25 rasters and zero missing provenance.

## Review and documentation status

The compact revision's finish review is **ship**. Source and captures `home-compact-desktop.png`, `home-compact-mobile.png` and `home-compact-tablet.png` show the contained programme with three manual race choices and personalized controls. The original full-width captures are historical, not this revision's visual authority. The reviewer identified the pre-race profile empty-state defect; this revision fixes it and adds unit and actual navigation coverage. Validation: 23 targeted unit tests, 10 slider browser tests and 16 existing native-history browser tests passed; TypeScript, translation contract and Staging build passed. The new navigation fixture initially inherited a deliberately denied private-roster response from the public fixture; its authenticated mock now supplies the empty roster explicitly. No live database writes, commit, push or deployment were performed for this compact revision. Browser coverage is Chromium desktop/mobile emulation and a 768px intermediate width, not physical iPhone Safari.

The detailed evidence and limitations are recorded in `.impeccable/review/race-day-documentation.md`. Existing `DESIGN.md` is preserved; no `.impeccable/design.json` exists in this checkout and none is introduced. The generic FINISH line above does not authorize rewriting the global design system. This record establishes scoped completion, not deployment.
