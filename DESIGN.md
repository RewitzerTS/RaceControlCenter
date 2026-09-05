---
name: "RaceVora Control Deck"
description: "A calm, dense motorsport operations system built from matte deep-navy layers and precise cyan-to-violet action cues."
colors:
  page-ground: "#050b14"
  page-ground-deep: "#02070d"
  rail-ground: "#050d17"
  work-plane: "#0a1421"
  inset-plane: "#07111c"
  raised-plane: "#0e1a29"
  active-plane: "#122136"
  line-subtle: "rgba(181, 206, 227, 0.13)"
  line-strong: "rgba(181, 206, 227, 0.23)"
  text-primary: "#f3f6fa"
  text-muted: "#9baabd"
  action-cyan: "#28c8ee"
  action-blue: "#377df5"
  action-violet: "#843dff"
  success: "#32c77b"
  warning: "#f4c44e"
  danger: "#ef6d7b"
typography:
  display:
    fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif'
    fontSize: "clamp(2.7rem, 4vw, 4.25rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif'
    fontSize: "clamp(1.55rem, 2.1vw, 2rem)"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.012em"
  title:
    fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.1
  body:
    fontFamily: '"RaceVora UI", "Atkinson Hyperlegible", "Segoe UI", sans-serif'
    lineHeight: 1.62
  label:
    fontFamily: '"RaceVora UI", "Atkinson Hyperlegible", "Segoe UI", sans-serif'
    fontSize: "0.7rem"
    fontWeight: 760
    letterSpacing: "0.055em"
rounded:
  control: "7px"
  inset: "9px"
  compact-surface: "10px"
  surface: "12px"
  large: "16px"
  pill: "999px"
spacing:
  nav-gap: "5px"
  compact: "8px"
  grid: "14px"
  control-inline: "20px"
  panel-min: "20px"
  panel-max: "30px"
  page-inline: "clamp(20px, 3.2vw, 48px)"
  page-block: "clamp(30px, 4vw, 58px)"
components:
  button-primary:
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.inset-plane}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.inset-plane}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "48px"
  nav-item-active:
    backgroundColor: "rgba(29, 83, 157, 0.48)"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  mobile-bottom-navigation:
    backgroundColor: "{colors.rail-ground}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    height: "calc(64px + env(safe-area-inset-bottom))"
    width: "100%"
  panel-raised:
    backgroundColor: "{colors.raised-plane}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.surface}"
    padding: "clamp(20px, 3vw, 30px)"
  status-chip:
    backgroundColor: "rgba(50, 199, 123, 0.08)"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  data-table:
    backgroundColor: "{colors.inset-plane}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.inset}"
---

# Design System: RaceVora Control Deck

## Overview

**Creative North Star: "RaceVora Control Deck"**

RaceVora Control Deck is a calm, exacting motorsport operations environment: deep blue-black structure, disciplined information density, crisp authored linework, and just enough cyan-to-violet energy to mark state and consequence. It should feel like dependable race control software shaped by people who understand leagues, careers, stewarding, and live operations—not a themed entertainment dashboard.

Depth is physical but restrained. Matte navy planes separate navigation, work, controls, and active content through tone, edge light, and directed shadow. Runtime content, role boundaries, league identity, official marks, flags, and team art remain authoritative; the approved reference image establishes the visual world, not literal names, values, track art, actions, or a universal page composition.

**Key Characteristics:**

- Dense, professional motorsport operations character
- Four semantic depth layers with matte, non-glass surfaces
- Persistent desktop rail and slim, visible league context bar
- Safe-area-aware mobile bottom navigation and purposeful single-column reflow
- Barlow Condensed hierarchy paired with Inter under the RaceVora UI name
- Restrained cyan-to-violet emphasis reserved for active state and the primary action
- Compact authored SVG line icons and text-supported status signals

## Colors

The palette is a narrow deep-navy instrument panel with cool white information, blue-gray secondary text, and a deliberately scarce cyan-to-violet action spectrum.

### Primary

- **Apex Cyan** (`action-cyan`): begins the primary-action gradient, marks focus, and identifies the most immediate active signal.
- **Race Blue** (`action-blue`): carries the center of the action gradient and supports selected navigation without turning the whole interface blue.
- **Control Violet** (`action-violet`): closes the action gradient and connects the system to RaceVora's established identity.

### Secondary

- **Clear Green** (`success`): successful or healthy state, always paired with a text label or recognizable mark.
- **Caution Gold** (`warning`): attention and pending consequence without imitating the primary action.
- **Incident Red** (`danger`): errors and destructive consequence, never routine decoration.

### Neutral

- **Night Circuit** (`page-ground`, with `page-ground-deep` for the outermost void): the recessed page environment behind all work.
- **Rail Navy** (`rail-ground`): persistent navigation and mobile navigation grounding.
- **Work Navy** (`work-plane`): the main content plane and stable panel body.
- **Instrument Well** (`inset-plane`): controls, lists, table wells, and recessed subregions.
- **Raised Navy** (`raised-plane`, with `active-plane` for selected or highest-emphasis surfaces): the forward layer for active work and important containers.
- **Signal White** (`text-primary`): primary content and headings.
- **Telemetry Gray** (`text-muted`): supporting copy, metadata, and inactive navigation.
- **Edge Light** (`line-subtle`, `line-strong`): low-contrast separation; strong edges are reserved for focusable or floating boundaries.

### Named Rules

**The Accent Economy Rule.** Reserve the cyan-to-violet spectrum for active state, focus, progress, and the single primary action cluster; its scarcity creates authority.

**The Status Requires Language Rule.** Success, warning, and danger colors never carry meaning alone; pair them with a label, icon, mark, or explicit copy.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallbacks)
**Body Font:** RaceVora UI, the self-hosted Inter variable face (with Atkinson Hyperlegible, Segoe UI, and sans-serif fallbacks)
**Label Font:** RaceVora UI

**Character:** Barlow Condensed gives headings a compact technical confidence without resorting to racing clichés. Inter/RaceVora UI keeps dense controls, tables, and multilingual operational copy quiet, legible, and credible; figures use tabular numerals wherever alignment matters.

### Hierarchy

- **Display** (600, fluid 2.7–4.25rem, 0.95): page titles, limited to about 22 characters per line on wide screens and released to the viewport on mobile.
- **Headline** (650, fluid 1.55–2rem, 1.05): major panel and section headings.
- **Title** (650, 1.25rem, 1.1): compact card and workflow titles.
- **Body** (variable weight, 1.62): operational explanation and supporting copy, generally held to about 72 characters per line.
- **Label** (760, 0.7rem, 0.055em): field labels and compact metadata; uppercase is functional and limited to short control labels.

### Named Rules

**The Plain Heading Rule.** Use Barlow Condensed for real hierarchy; never add decorative pre-headlines, gradient text, slogan fragments, or ornamental all-caps above a clear title.

## Layout

Authenticated desktop surfaces use a fixed left rail (254px), a slim top league-context bar (80px), and a centered work region capped at 1480px. The rail narrows at 1180px and 980px; below 900px it becomes a compact top header plus a fixed four-item bottom navigation that respects safe-area insets. At 700px, work regions reflow to one deliberate column, page padding becomes 14px, and record tables become labeled stacked records instead of forcing horizontal scanning.

Use a 14px inter-panel rhythm for dense operational layouts, fluid page insets, and 44–48px control heights. The current route, role, and active league remain visible in the shell. A wide primary workspace paired with a narrow status lane is appropriate for overview pages when the information warrants it, but it is not a global template: page hierarchy must follow the real task, content volume, and existing behavior.

Public, embedded, and legal surfaces inherit the palette, type, depth, controls, and responsive discipline without inheriting the authenticated rail. Preserve semantic landmarks, keyboard order, and the single most important action when the layout changes.

## Elevation & Depth

The system uses four semantic layers: recessed page ground, the stable work plane, inset controls and lists, and a raised active plane. `raised-plane` and `active-plane` are calibrated variants within that final layer, not permission to keep stacking cards. Tonal separation does most of the work; a subtle white top edge and directed black shadow make the hierarchy palpable without translucency.

### Shadow Vocabulary

- **Low structural lift** (`0 8px 24px rgba(0, 0, 0, 0.22)`): compact cards, selected navigation, and discrete controls.
- **Work-plane lift** (`0 18px 46px rgba(0, 0, 0, 0.3)`): standard operational panels.
- **Active-plane lift** (`0 28px 74px rgba(0, 0, 0, 0.42)`): dialogs, previews, and genuinely dominant workspaces.
- **Restrained edge light** (`inset 0 1px rgba(255, 255, 255, 0.028)`): a matte top edge on raised surfaces.
- **Inset control depth** (`inset 0 2px 8px rgba(0, 0, 0, 0.24)`): fields and recessed work wells.

### Named Rules

**The Four-Layer Rule.** Every surface must resolve to page ground, work plane, inset content, or raised active work; a new navy shade needs a semantic layer, not decorative novelty.

**The Structural Shadow Rule.** Shadows communicate containment and active hierarchy; they never become neon glow, glass haze, fake perspective, or inflated 3D.

## Shapes

Control Deck geometry is compact and engineered: 7px controls, 9–10px inset containers and mobile records, 12px primary surfaces, and 16px only where a larger enclosing silhouette genuinely needs it. Borders are crisp, cool, and low contrast. Pills are reserved for statuses and compact badges, not ordinary buttons or cards.

Panels may use a restrained tonal diagonal inside the same matte material, but never skew, perspective, floating bubbles, exaggerated bevels, or arbitrary clipping. Existing RaceVora logos, league marks, flags, and team art keep their original geometry and are not redrawn to fit a container trend.

## Components

Components feel tactile and controlled: compact targets, immediate states, and no decorative chrome that competes with the work.

### Buttons

- **Shape:** compact control corners (7px), with a 48px primary height and a 44px secondary minimum.
- **Primary:** white text over one cyan-to-blue-to-violet gradient, 20px inline padding, and a restrained directional shadow; use once per action cluster.
- **Hover / Focus:** lift by 1–2px over 180ms, brighten slightly, and retain a visible cyan focus outline; active returns to the resting plane and disabled removes lift.
- **Secondary / Ghost:** inset navy, strong edge, quiet white-blue text, and no competing gradient.

### Chips

- **Style:** compact pill only for status or phase, using a low-alpha state tint and text plus a small mark.
- **State:** selected choices use an inset rectangular control with a cyan-violet wash; they do not masquerade as status pills.

### Cards / Containers

- **Corner Style:** 12px for primary surfaces, 9–10px for inset subdivisions.
- **Background:** work or raised navy, with inset navy reserved for controls, lists, and tables.
- **Shadow Strategy:** low, work-plane, or active-plane lift according to semantic depth; no card-by-card improvisation.
- **Border:** one cool low-contrast edge, strengthened only for focus, dominant work, or floating layers.
- **Internal Padding:** generally 20–30px, fluid where the panel spans a broad workspace.

### Inputs / Fields

- **Style:** 48px minimum height, 7px corners, strong edge, inset navy, and an internal shadow.
- **Focus:** the edge shifts toward cyan and receives a restrained 3px focus ring; keyboard focus remains independently visible.
- **Error / Disabled:** error uses red tint plus explicit copy; disabled state reduces emphasis without hiding its label.

### Navigation

Desktop navigation is a persistent matte rail with 21px authored SVG line icons, 48px rows, and a strong active item marked by a slim cyan leading edge and contained blue depth. The top context bar keeps league context and account tools visible. Mobile navigation becomes a fixed four-column bottom bar with 20px icons, text labels, 52px targets, safe-area padding, and a separate “more” layer for secondary routes.

### Data and Status

Tables use a recessed ledger surface, compact uppercase headers, tabular figures, restrained row hover, and stable labels. On narrow screens, record tables become stacked labeled rows. Status is always a compact row or chip with text plus a dot, check, or line icon.

### Iconography and Motion

Use compact, authored inline SVG with `currentColor`, rounded line joins, and a 16–24px optical size; navigation uses a 1.65 stroke at 21px. State movement stays on one axis for 140–220ms, never loops for decoration, and collapses to effectively instant transitions under reduced-motion preferences.

## Do's and Don'ts

### Do:

- Do preserve runtime content, routes, role boundaries, league context, and existing official identity assets.
- Do make the next meaningful action obvious while keeping the accent spectrum visually scarce.
- Do assign every region to one of the four semantic depth layers and use directed shadows consistently.
- Do keep operational layouts dense, aligned, and scan-friendly with tabular figures and stable labels.
- Do pair every status color with explicit language or an authored SVG mark.
- Do recompose for mobile with safe-area-aware bottom navigation, labeled records, and 44–48px targets.

### Don't:

- Don't produce AI-slop dashboard patterns, generic metric-card grids, or ornamental bento layouts.
- Don't use glass, blur-backed translucency, neon glow, fake 3D, perspective tricks, or inflated controls.
- Don't use gradient text or decorative pre-headlines.
- Don't use Unicode glyphs as interface icons; use compact authored SVG line icons.
- Don't promote the owner-control screenshot's proportions, invented data, or wide-plus-narrow arrangement into a global invariant.
- Don't let cyan, violet, success, warning, or danger color become decoration without operational meaning.
