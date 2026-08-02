---
name: Nudge
description: Training fits real life.
colors:
  signal-yellow: "#ffd400"
  ink: "#050505"
  line: "#101010"
  white: "#ffffff"
  concrete: "#f0eee7"
  muted-text: "#454545"
  focus-blue: "#1261a0"
  error-red: "#721c24"
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Atkinson Hyperlegible', sans-serif"
    fontSize: "clamp(2.8rem, 11vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Barlow Condensed', 'Atkinson Hyperlegible', sans-serif"
    fontSize: "clamp(1.9rem, 8vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Atkinson Hyperlegible', sans-serif"
    fontSize: "1.45rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "'Atkinson Hyperlegible', sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "'Barlow Condensed', 'Atkinson Hyperlegible', sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.03em"
rounded:
  sharp: "0"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "28px"
  2xl: "32px"
  3xl: "52px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.sharp}"
    padding: "24px 86px 24px clamp(22px, 7vw, 52px)"
    height: "116px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.line}"
    typography: "{typography.body}"
    rounded: "{rounded.sharp}"
    padding: "12px 16px"
    height: "52px"
  exercise-row:
    backgroundColor: "{colors.white}"
    textColor: "{colors.line}"
    rounded: "{rounded.sharp}"
    padding: "12px clamp(16px, 5vw, 32px)"
    height: "78px"
  set-input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.line}"
    rounded: "{rounded.sharp}"
    height: "58px"
  settings-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sharp}"
    height: "44px"
---

# Design System: Nudge

## Overview

**Creative North Star: "The Clear Signal"**

Nudge is a high-contrast operating interface for a trainee using a phone around equipment. Hard-edged black, white, pale-concrete, and signal-yellow planes establish context quickly; generous identifiers and condensed headings make the current state legible without decoration or motivational theater.

The system applies to the shared shell, the approved Plan → Perform → Cooldown → Review journey, the read-only Workout history disclosure, and Settings with its exercise catalog. Every active state answers three questions in order: what is happening, what is the one dominant next action, and which other exercises remain available. Guidance comes from hierarchy and plain language, never literal route, gate, airport, or destination terminology.

**Key Characteristics:**

- One unmistakable signal-yellow next action per state
- Flat, hard-edged planes separated by thin rules
- Condensed, oversized state labels paired with highly legible body copy
- Mobile-first stacking with alternatives present but visually quieter
- Calm, factual language that preserves trainee agency

## Colors

The palette uses signal yellow sparingly against ink, white, and pale concrete so state and action remain immediately distinguishable.

### Primary

- **Signal Yellow** (#ffd400): Reserved for the dominant next action, the current journey step, selected planning constraints, and small active-state identifiers.

### Neutral

- **Ink** (#050505): Primary high-contrast panels, active rows, and strongest text.
- **Rule Black** (#101010): Thin structural borders and secondary text requiring maximum contrast.
- **White** (#ffffff): Main working surfaces and text on ink panels.
- **Pale Concrete** (#f0eee7): Quieter planning, exercise-list, history, and action-supporting regions.
- **Muted Graphite** (#454545): Supporting descriptions, metadata, and inactive status copy.
- **Focus Blue** (#1261a0): Keyboard focus outlines; it stays distinct from yellow action state.
- **Error Red** (#721c24): Actionable warning and error feedback only, on white for readable contrast.

### Named Rules

**The One Signal Rule.** Signal yellow identifies the current state or the one dominant next action; do not distribute it across competing controls.

**The Structural Contrast Rule.** Use black, white, concrete, and thin rules to separate regions before introducing any additional color.

## Typography

**Display Font:** Barlow Condensed (with Atkinson Hyperlegible and sans-serif fallbacks)
**Body Font:** Atkinson Hyperlegible (with a sans-serif fallback)

**Character:** Condensed display type makes phases, actions, timers, and exercise identifiers fast to scan. Atkinson Hyperlegible carries instructions, values, status, and recovery-sensitive details without sacrificing clarity.

### Hierarchy

- **Display** (700, responsive 2.8rem–5rem, 0.94 line-height): Phase headings, review headings, and the strongest current-context statements.
- **Headline** (700, responsive 1.9rem–3rem, 1 line-height): Dominant action labels.
- **Title** (700, 1.45rem, 1.4 line-height): Section prompts and compact group headings.
- **Body** (400, 18px, 1.4 line-height): Instructions, descriptions, input labels, and feedback.
- **Label** (700, 0.72rem, 0.03em letter-spacing, uppercase): Journey steps and compact status labels.

### Named Rules

**The State Before Detail Rule.** Lead with the phase, action, timer, or exercise identifier; supporting explanation follows in body type.

**The One Page Heading Rule.** The shared Nudge wordmark is the page’s sole first-level heading; each active surface or workout state begins at the second level without changing its visual scale.

## Layout

The application is a single 760px maximum-width working column on a pale-concrete page. Within it, regions run edge to edge as stacked sign-like planes. Content padding repeatedly scales from 22px on phones to 52px on wider screens; 8px, 12px, 16px, 22px, 28px, and 32px provide the supporting rhythm.

The four-step journey path stays in one equal-width row. Planner choices use two columns until 520px, then stack. Exercise rows reduce from three columns to two at the same breakpoint, moving status beneath the exercise name. Settings forms wrap related labeled fields as a group and stack them at 600px without separating tracking controls from their labels. Dominant actions span the available width and retain at least 116px height; ordinary interactive targets, including the native time slider, retain at least 44–48px.

**The Decision Order Rule.** Place current context first, the dominant next action second, and alternate exercises or disclosures after it.

## Elevation & Depth

Nudge is flat by default and uses no shadows. Depth and grouping come from alternating tonal planes, 1–2px rules, and direct black/white inversion for active work. The current journey marker uses a compact concentric ring because it communicates state, not elevation.

### Named Rules

**The Flat Signal Rule.** Do not use shadows to manufacture importance; use plane contrast, rules, and scale.

## Shapes

The form language is deliberately hard-edged. Panels, buttons, fields, planning constraints, and exercise rows use square corners. Circles are reserved for the journey-step markers. The dominant action’s arrow is authored with CSS geometry and reinforces forward motion without becoming themed copy.

## Components

### Buttons

- **Primary next action:** A full-width signal-yellow panel with square corners, left-aligned condensed uppercase type, and a large right arrow. It inverts to ink with yellow text on hover and keeps a blue 4px keyboard focus outline. Disabled states become neutral gray rather than dim yellow.
- **Secondary action:** A compact transparent or white control with a thin black rule and sentence-case label. It must remain visibly subordinate to the primary action.
- **Motion:** Primary actions arrive once with a 420ms clipped reveal using a fast deceleration curve. Remove the animation when reduced motion is requested.

### Chips

- **Planning constraint:** A square white field with a thin black border and a native 22px checkbox. Selection changes the field to signal yellow; hover uses pale yellow. Labels remain factual and do not imply readiness.

### Cards / Containers

- **Working plane:** White or pale concrete, square corners, no shadow, and a 1–2px structural rule where separation is required.
- **Active work plane:** Ink with white text; signal yellow is reserved for the action inside it.

### Inputs / Fields

- **Set input:** A white, square, 58px-minimum field with a thin black border and bold 1.6rem value. The shared blue focus outline remains visible against every plane.
- **Settings field:** Native text, number, and select controls sit beneath explicit 18px labels, use a white square 44px-minimum field with a thin black border, and stack at phone widths. Related tracking fields remain a wrapping group rather than collapsing into an unlabeled row.
- **Feedback:** Invalid fields keep their label and control visible, link to a square white error block in error red, and use live status or alert semantics for asynchronous and blocking feedback.

### Navigation

- **Journey progress:** Four equal columns on an ink plane. White connected markers show the full journey; the current step alone changes to signal yellow and uses `aria-current="step"`.
- **Shared shell:** A white Nudge wordmark bar separated from the current surface by a 2px black rule. Settings and sign-out use quiet square 44px-minimum controls that invert to ink on hover.

### Settings & Catalog

Settings uses an ink title plane followed by General defaults, Add exercise, and Current catalog regions. White and concrete planes alternate, section headings use condensed headline type, labeled fields wrap without losing their grouping, and catalog items use simple black rules instead of cards or badges. Add and save are the only signal-yellow actions; edit, activate, deactivate, cancel, and close remain neutral.

### Workout History

Workout history is a neutral, full-width disclosure on pale concrete. Square white workout cards use black rules, condensed date and exercise headings, quieter factual metadata, compact concrete set rows, and neutral recovery controls. It never uses signal yellow or outranks the current workout action; phase durations use three columns when space permits and stack for phone and 200% reflow.

### Exercise Row

Exercise rows carry a large two-digit identifier, exercise name, muscle group, confirmed-set count, timing, and disclosure state. The selected row inverts to ink and white, with only its number in signal yellow. A focused ready set appears before alternate exercise rows; remaining set details stay available in quieter disclosures below.

## Do's and Don'ts

### Do:

- **Do** make one worthwhile next action unmistakable in every journey state.
- **Do** keep other exercises visible and reachable without asking the trainee to re-plan.
- **Do** preserve visible keyboard focus, readable timing and status, reduced-motion behavior, and phone-sized touch targets.
- **Do** keep settings controls explicitly labeled and keep warning, error, loading, and mutation feedback adjacent to the affected region.
- **Do** use plain labels such as “Exercises,” “Start set,” “Cooldown,” and “Review.”

### Don't:

- **Don't** use route, gate, destination, next-stop, or other literal airport terminology.
- **Don't** introduce streak pressure, guilt, gamification, faux precision, unsupported readiness, invented recommendations, or authoritative coaching.
- **Don't** turn Settings or the catalog into a separate visual language of rounded cards, decorative badges, or competing accent actions.
- **Don't** make alternate actions compete in scale, color, or placement with the dominant next action.
