# Navigation, race-day carousel and circuit artwork

User scope: refine the Production navigation icons, compact the carousel controls,
rotate races every four seconds, enlarge the Home track outline, and replace old
maps with RaceVora artwork while retaining real circuit layouts.

- One authored 24-unit outline icon family; consistent strokes, clearer role
  symbols, unchanged links, role checks and navigation behavior.
- Compact counter and 32px pointer controls. Touch devices retain 44px targets.
  Rotation occurs only while visible, with pause/resume controls; focus, manual
  selection and touch stop it. Hover and background-tab visibility pause it.
  Reduced-motion users retain manual navigation with no automatic cycling.
- 25 MIT-sourced geographic circuit outlines, rendered offline as RaceVora SVGs.
  See assets/trackmaps/README.md for provenance, license and reproduction.
  Both catalogs now use the new maps. Madrid no longer points to Barcelona.
  No generated/imagined geometry or invented sector labels.
- Home map uses more space and thumbnail-aware line thickness; the rest of the
  dashboard layout, theme selection and business functions are unchanged.
- Follow-up: native maps use a shared CSS-mask renderer. Personal primary/accent
  colors (including custom logo palettes) update immediately on Home, calendar,
  the enlarged map, track cards and profiles. Safari's prefixed mask is included.
  A browser regression changes both theme tokens and verifies the same geometry
  repaints, with screenshot evidence. No preferences or database writes involved.

Impeccable polish/animate guidance informed consistent optical icon weight,
preserved theme tokens, keyboard/touch operation and interruptible motion.
The incumbent Production design, not the unrelated Staging redesign, is retained.

Checks: TypeScript, six fake-timer unit cases, source-vertex and catalog checks,
desktop/mobile carousel E2E, explicit touch E2E, all SVG responses, map dialog
close/focus restoration, and one batched visual comparison of all map outlines.
Use the existing complete deploy-safe gate for publication; no database changes.

## Follow-up: quieter slide transitions

The next picture crossfades over the previous picture in 420ms. Only the race
content enters with a 14px directional movement over 320ms; controls remain fixed.
The next picture is warmed when the carousel is visible. Previous pictures and
timers are cleaned up after rapid selection, preference changes and unmounting.
Reduced-motion users receive an immediate manual change without movement.
The four-second cycle and pause behavior stay unchanged. The redundant
“Streckenschema” caption is removed while the distance remains; the track-profile
link now uses the existing pill-shaped main-action style and personal colors.
Impeccable animate guidance informed the bounded crossfade, calm controls and
interruptible/reduced-motion behavior. Regression tests cover the intermediate
opacity, directional change, fixed controls, cleanup and reduced-motion fallback.
