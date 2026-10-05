# Home race day and notification badge

Scope: extend Home's upcoming-race region and the existing bell; do not redesign the global shell. Operate mode. The user's Monaco example supplies photo-led composition, large race title, date/time, track schematic and open-race action. Existing career actions and theme preferences remain available.

## Direction contract

THESIS: a race-day programme, showing every scheduled race on the next scheduled race date, including multiple rounds on that date. This means the next race day, not necessarily tomorrow.

OWN-WORLD: real venue photographs, dark legible overlay, a locally scoped expanded race-title face, teal action and violet GP emphasis inspired by the supplied example. Existing shell remains unchanged. This is an ordinary scoped extension, not a replacement visual world or a pixel-exact recreation of the Monaco reference.

STORY: identify the race day, switch between its races, open the exact round; unread notifications are counted at the bell.

FIRST VIEWPORT: full-width race photograph with a large wrapping title, date/time and action on the left, a smaller accurate schematic below, attribution at the foot. Numbered race tabs and previous/next controls expose all races. On phones the same content stacks without clipping or automatic movement.

FORM: precisely specified local extension, no concept seed required. User said to proceed. Code-led responsive implementation of the example's layout; real licensed photographs and existing circuit diagrams, no generated geography. Signature interaction is swipe/keyboard/manual race switching, no autoplay.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Historical team repairs are a separate data-correctness task. Onboarding remains deferred.

## Implemented region

Home places the race-day programme above the incumbent career dashboard. It groups upcoming races from the active season by the earliest scheduled date, orders them by date, start time and round, and exposes the complete selected day through numbered race buttons and previous/next controls. Arrow keys work while the carousel region itself has focus; a deliberate horizontal swipe changes races while vertical scrolling remains available. Navigation wraps, the current position is announced politely, and there is no autoplay or carousel animation. A single race has no redundant switching buttons; an empty day leaves the existing no-race/season state available.

Each selected race presents its name, circuit, localized date/time, a real venue photograph when mapped, and the existing circuit schematic and length when available. The open action includes the selected league, season and round. Failed or unmapped photography leaves the dark readable surface intact. Photography is decorative; the circuit schematic has a circuit-name alternative. Source and license links remain visible beneath the race content.

Track matching receives the active season's game key so venue and diagram selection respect the F1 25/F1 26 track catalogue. The title highlights a trailing `GP` only when it exists in the stored race name; custom race names retain their text without an invented suffix.

The header bell retains its existing destination and gains an unread count on desktop and mobile. Zero hides the badge; counts above 99 display `99+`, while the accessible link label retains the actual count. The count is scoped to the signed-in recipient and unread records, refreshes when the inbox changes or the window becomes visible/focused, and polls every 30 seconds while visible. User changes cannot display another user's cached count.

## Local visual implementation and assets

The photograph fills a rounded local surface with a dark directional overlay. A large wrapping title, date/time and teal action occupy the left content column; the compact schematic sits below them. The race selector scrolls horizontally within its own strip on narrow screens. Below 600px the image crop and overlay strengthen, the map becomes smaller, and footer content wraps. The surrounding header, career surfaces, navigation and personalization controls retain their incumbent composition.

`Special Gothic Expanded One` is self-hosted as `v2/public/assets/fonts/special-gothic-expanded-one.ttf`, with `SpecialGothicExpandedOne-OFL.txt` alongside it. Its `RaceDayDisplay` alias applies only to race titles, uses a sans-serif fallback and `font-display: swap`; it is not a new global typography rule.

The 25 venue JPGs were copied from existing licensed project assets. `v2/src/driver/venueMedia.json` records each public path, venue key, source, author and license link. These include circuit photographs, aerial views and location photographs; they are not presented as current photographic surveys of every circuit. Circuit diagrams remain the established trackmap assets. Documentation checked all 25 image paths and attribution entries: zero missing files, zero incomplete attribution records. The supplied provenance scan also reports 25 rasters and zero missing provenance.

## Review and documentation status

The finish reviewer disposition supplied to this pass is **ship**: scoped requirements match, with no material fixes requested. Documentation inspected the implementation and the desktop/mobile captures in `.impeccable/review/screenshots/home-desktop.png` and `home-mobile.png`. These show the photo-led Monaco programme, three manual race choices and the unread bell count within the incumbent shell.

The detailed evidence and limitations are recorded in `.impeccable/review/race-day-documentation.md`. Existing `DESIGN.md` is preserved; no `.impeccable/design.json` exists in this checkout and none is introduced. The generic FINISH line above does not authorize rewriting the global design system. This record establishes scoped completion, not deployment.
