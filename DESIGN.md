---
name: RaceVora
description: Incumbent Production administration and season setup, recorded from the scoped league-driver extension.
colors:
  brand-primary: "#35246a"
  brand-secondary: "#5a32a3"
  brand-accent: "#2c8fa6"
  brand-accent-2: "#2f6f8a"
  brand-background: "#021b34"
  brand-surface: "#0a1f37"
  brand-text: "#ffffff"
  brand-on-primary: "#ffffff"
  line: "rgba(255, 255, 255, 0.08)"
  line-strong: "rgba(255, 255, 255, 0.14)"
typography:
  body:
    fontFamily: '"Atkinson Hyperlegible", "Segoe UI", Inter, Arial, sans-serif'
  headline:
    fontSize: "3.25rem"
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontSize: "1.55rem"
    lineHeight: 1.18
rounded:
  field: "10px"
  navigation: "12px"
  team-panel: "14px"
  wizard: "16px"
  action: "999px"
spacing:
  label-gap: "0.5rem"
  compact-gap: "0.75rem"
  field-gap: "1rem"
  form-gap: "1.5rem"
---

# Design System: RaceVora

## Overview

This is a scoped record of the coherent incumbent Production administration system, not a new aesthetic direction or an inventory of every RaceVora surface. The league-driver and season-setup extension inherits the existing header, themed dark ground, readable information density, form controls and responsive records. Production is the visual authority; the unrelated Staging redesign supplies no design decisions here.

The source of truth is the final CSS cascade in `v2/src/styles.css`, `v2/src/beta-ux.css`, `v2/src/operations/beta-responsive.css` and `v2/src/operations/league-teams.css`, with the implemented administration and wizard components. The frontmatter records observed default primitives. Saved league and personal themes can override brand colors; extensions must consume the existing CSS variables rather than hardcode these defaults.

Key characteristics are dark layered surfaces, restrained purple/teal actions, strong page headings, persistent labels, and records that remain legible on narrow screens. No new creative metaphor, global composition rule, font pairing, or illustrative direction was introduced.

## Colors

The default palette combines deep blue ground and surfaces with purple and teal accents. Primary and secondary brand colors support the existing action treatment; accent colors provide active-state and contextual emphasis. Brand text and on-primary text preserve the theme's foreground roles. Fine translucent lines separate records and outline controls.

**The Theme Continuity Rule.** Consume the active theme's semantic surface, text, line and brand variables. In particular, distinguish the main surface from its stronger variant and use the incumbent muted-text mixture for supporting copy. The default values above are not fixed colors for all leagues.

## Typography

The body stack is inherited by native inputs and selects. Page headings use the incumbent large, tight line height; section titles are smaller and support scanning. Supporting copy, field labels, counts and table labels keep their existing roles rather than introducing a separate display face or typographic vocabulary.

The administration page heading adapts below the incumbent mobile breakpoint to `clamp(1.7rem, 7vw, 2.65rem)`. The wizard keeps its own established heading and field-label rules. This is descriptive evidence from the built surfaces, not a mandate to apply wizard typography to other pages.

## Layout

The shell uses a centered maximum width of 1280px with responsive gutters. Administration pages retain the existing heading/action arrangement, followed by compact local navigation and their working records. Forms use wrapping rows or grids with minimum-width protection on labels and controls. Long names and gamertags may wrap.

The scoped team list has a two-column desktop row and stacks below 640px. Calendar controls use three columns, two below 900px, and one below 640px. The incumbent record-table pattern converts directory rows into labeled mobile records. The calendar preserves its column relationships inside a keyboard-focusable horizontal scroll region; the entire page must not become horizontally scrollable.

Mobile operations retain the incumbent safe-area gutters, vertically arranged header actions and bottom navigation. Existing wizard actions stack where its responsive rules require them.

## Elevation & Depth

Depth comes from the existing atmospheric page ground, dark tonal surfaces, thin separators and action emphasis. The team panel adds no new shadow. The inherited primary action uses a soft brand-colored glow, with a small brightness/lift response on hover. This record does not extend that glow to tables, fields or general containers.

## Shapes

Fields and local navigation use moderately rounded corners; team panels and wizard containers use their observed larger radii. Primary and secondary actions retain the incumbent pill silhouette. Existing administration data panels may remain square-edged: this extension does not normalize every container to one radius.

## Components

### Actions and navigation

Primary actions reuse the branded gradient, on-primary foreground and heavy label weight, with a minimum height of 46px. Secondary actions retain the outlined treatment and minimum 44px target. The actual gradient can be supplied by the active theme's action-gradient variable. Disabled, busy, hover and reduced-motion behavior remain inherited.

Drivers/Teams navigation consists of real links. The active link uses the stronger surface and bold text; keyboard focus uses a visible two-pixel outline with a four-pixel offset. Advanced roster operations use native disclosure, with the same visible focus treatment on its summary.

### Records and forms

Team creation, naming and two-driver lineups share one central editor. Driver shortcuts select an existing team there, rather than opening another creation form. Vehicle/substitution controls stay in the driver view and do not edit the league team. Current-season edits retain the explicit effective-race selector. This is a scoped workflow simplification, not a new visual system.

The driver directory uses the existing administrative record table and mobile labels. Identity, current-season team/vehicle, AI assignment, status and actions occupy separate roles. There is no next-season preference tab. Free AI profiles are identified in the same two-place team editor; linked AI profiles are not duplicate members. The team form uses persistent labels, native text fields/selects, and minimum 44px controls. Empty teams and empty directories have plain-language states.

The season wizard reuses the existing step indicator, form hierarchy, draft recovery notice, native choices, review screen and save feedback. The pending September 30 change removes driver selection from this wizard: driver profile, platform gamertags and race-effective AI assignment share the driver editor; team management stays separate. Start numbers are read-only. This behavior and its release status are scoped in `.impeccable/surfaces/league-driver-teams.md` and are not a new global screen template.

## Do's and Don'ts

- Do extend the Production shell and its current theme variables.
- Do preserve persistent labels, readable supporting text and keyboard-visible focus.
- Do keep mobile records usable with long driver and team names.
- Do retain the distinction between page overflow and intentional calendar-table scrolling.
- Don't infer a new global aesthetic from this narrow administration extension.
- Don't turn existing section-label eyebrows into a prescribed decorative device. They remain inherited markup, not a new system rule.
- Don't rewrite unrelated system or product assertions as part of this scoped documentation pass.

Not canonized or repaired: inherited section-label eyebrows and pre-existing broad/stale PRODUCT.md assertions. They were outside this extension's repair scope. No new shipping raster assets were added. The documentation boundary for this pass is this file and the surface brief; no design sidecar was created.
