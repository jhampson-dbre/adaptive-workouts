# Nudge Interface System

**Status:** Approved planning amendment; fresh production design not started

**Epic:** EPIC-13

**Branch:** `codex/resolve-interface-system`

**Initial charter commit:** `9f7c9b4a1489c8a98c9f4440d1f428b71bdd89e3`

**Initial charter approved:** 2026-07-19

**Seven-task redesign approved:** 2026-07-26

**Nudge identity pivot approved:** 2026-07-26

## Purpose

Give Adaptive Workouts its first coherent product identity and interface system without
changing the workout engine, stored data, authentication, recovery semantics, or current
navigation model.

The working name is **Nudge**. Its working descriptor is **adaptive strength training
partner**:

> An adaptive strength training partner that remembers what the user has done, decides
> what is worth doing next, and turns the time available into a focused workout.

The central promise is:

> **Whenever the user has time to train, a relevant workout is already ready.**

This identity expresses current behavior only. It does not authorize new recommendations,
coaching logic, readiness claims, state, routes, navigation, or data. The current
implementation remains authoritative.

## Fresh-design directive

Production design starts from the product's existing behavior and boundaries, not from
the concept-generation or translation-bake-off artifacts. Those artifacts are retained
only as historical evidence. Future EPIC-13 tasks must not require, prompt with, or
evaluate against their mockups, palettes, tokens, layout patterns, named visual
directions, or tool-generated rationales.

The redesign is intentionally unconstrained within the product boundary. It may establish
any coherent visual and interaction direction for Nudge provided it does not add product
features, gamification, routes, navigation, stored data, recommendations, coaching logic,
readiness claims, or other unsupported behavior. Accessibility and the preserved product
contracts remain requirements because they protect outcomes rather than aesthetics.

This document replaces the original B2–B13 execution sequence. The original charter's
identity principles and behavior protections remain useful evidence; its mandatory
prototype, three-root navigation, custom-skill, and separate validation/integration
machinery are superseded.

Approval of this amendment authorizes updating the durable plan only. Each implementation
task still requires explicit authorization before it starts.

## Current evidence

- The app has real Plan, active-workout, Review, history, Settings, recovery, loading,
  error, offline, and authentication states to design around.
- The current shell routes between Plan, Settings, and a workout forced by active or
  recoverable session state.
- Saved workout history is an existing `WorkoutHistory` disclosure inside
  `WorkoutView`; it is not a root destination.
- Existing timing, recovery, coordination, immutable-save, storage, and access work
  defines behavior that presentation changes must preserve.
- The translation bake-off is complete. Its disposable implementations, experiment-scoped
  hooks, and generated product context are not retained. Impeccable was selected for the
  production redesign; its post-selection workflow and generated production artifacts are.

## Product relationship

Nudge is not a passive workout log, an authoritative coach, or a recovery system. It is
an attentive training partner: it remembers previous sessions, notices exercises that
have been out of rotation, recommends loads, and builds around the time available using
the product's existing behavior.

Its defining posture is:

> **I've been paying attention, and I've already done the planning.**

Recommendations remain recommendations. The user retains agency, and the product must
never create guilt, fake urgency, or pressure.

## Historical identity exploration — non-binding

The following identity, rhythm, voice, and visual-direction sections record earlier
discovery. They are not acceptance criteria or prompts for production design and are
superseded by the fresh-design directive above.

## Journal × Instrument × Training Partner

1. **Journal provides memory and continuity.** History, progression, and prior decisions
   are chronological, structured, and easy to understand without notebook decoration.
2. **Instrument provides precision and trust.** Loads, repetitions, timers, progression
   states, and explanations are primary visual material. Typography, alignment, spacing,
   and motion make the system feel dependable.
3. **Training Partner provides warmth, initiative, and presence.** The product uses
   grounded observations and collaborative suggestions rather than commands. Warmth
   comes from attention, never simulated intimacy.

## Emotional rhythm

- **Prepare and reflect:** calm, attentive, and information-rich for planning, history,
  settings, exercise selection, progression explanations, and post-workout review.
- **Train together:** focused, present, and energetic for workout generation, active
  sets, rest periods, and completion.

Energy increases because the user is actively training, not because Nudge is pressuring
them to train harder.

## Voice principles

Nudge is observant, practical, reliable, quietly confident, serious but approachable,
encouraging without exaggeration, accommodating of real life, and slightly nerdy.
Language should favor grounded observations and clear suggestions, such as:

- “You completed the target last time. Let's move this one up.”
- “We can fit three exercises into 20 minutes.”
- “This hasn't been trained in 12 days, so I brought it back.”
- “Hold at 65 lb for another session.”

Avoid generic hype, guilt, streak pressure, fake urgency, and artificial intimacy. Nudge
may use first-person language for actual system preparation or initiative, such as
“I've got one ready,” but must not pretend to have feelings, needs, or physical
experiences.

## Identity principles

1. **Training fits real life.** Workouts adapt to available time and training history.
2. **The partner carries the planning burden.** Remove decisions whenever current
   behavior has enough evidence to make a useful recommendation.
3. **Serious does not mean intimidating.** Expertise appears through dependable
   decisions and clear explanations.
4. **Calm by default, energized through participation.**
5. **Precision creates trust.**
6. **Warmth comes from attention, not artificial intimacy.**
7. **Recommendations remain recommendations.** The user retains agency.
8. **Flexibility is not failure.** Short workouts and irregular schedules are normal.
9. **Progress is earned and explained.**
10. **The user remains the protagonist.**
11. **One hierarchy per state.** The primary action and current state are obvious.
12. **State is explicit.** Loading, empty, offline, failure, recovery, conflict, pending,
    and completion states are designed outcomes.
13. **Accessibility is structural.** Semantics, focus, keyboard use, target size,
    contrast, reflow, reduced motion, and non-color cues are part of the design.
14. **A small system, not a component catalog.** Add only tokens and patterns proven
    useful on real screens.

## Visual direction

- Precise numerals, structured spacing, progression lines, and meaningful calibration
  marks form the visual vocabulary.
- Energy comes from contrast, scale, language, and measured motion, not neon or
  spectacle.
- Typography stays upright and disciplined.
- Warm paper, graphite, ink, and oxidized-metal tones may influence the palette without
  literal skeuomorphism.
- Motion makes values advance and states resolve with control.
- Data must always communicate something real.

## Experience standard

The defining moment is simple: the user has time to train, opens Nudge, finds a relevant
workout already prepared with appropriate exercises and loads, and begins without
planning. The experience succeeds when the user thinks:

> **I had time to train, and I immediately knew what to do.**

## Explicit anti-goals

- Streak pressure, punishment for missed days, trophy-heavy gamification, generic praise,
  faux scientific precision, or invented recommendations.
- Unsupported recovery or readiness claims.
- Guilt, fake urgency, pressure to exert harder, simulated intimacy, or authoritative
  coaching language that removes agency.
- Excessive configuration that returns planning work to the user.
- Tiny labels, weak contrast, motion-dependent meaning, or color-only state.
- A new Journal route or broader navigation redesign.
- A parallel prototype application or permanent experimental route.
- Persisting either disposable implementation or its experiment-scoped hooks and generated
  product context from the bake-off. This does not exclude post-selection Impeccable
  workflow artifacts created for the production redesign.
- Changing product behavior while restyling it.

## Goals

- Retain the completed concept and bake-off evidence as a historical decision record.
- Design Nudge afresh from current product behavior and boundaries.
- Establish coherence through the production surfaces themselves rather than by
  reproducing an experimental mockup or pre-extracted token system.
- Validate the cumulative product once and publish a reviewable draft PR.

## Non-goals

- New workout-generation, timing, history, recovery, storage, authentication, or
  authorization behavior.
- New analytics, recommendations, progression calculations, or data migrations.
- New coaching logic, recovery or readiness claims, or implied intelligence unsupported
  by current behavior.
- A new root Journal destination.
- A product-wide internal package or technical identifier rename.
- A design-tool supply-chain framework or retained third-party design workflow.
- A mandatory project skill, design-review agent, or pre-production token extraction.
- A speculative component library or token taxonomy.
- Using the historical concept or bake-off artifacts as production design requirements.

## Preserved product contracts

The current implementation and the approved source tasks remain authoritative for exact
behavior. EPIC-13 changes presentation only.

- **Plan and generation:** readiness inputs, time budget, unrecovered groups, generation,
  and transition into a workout retain their current meaning.
- **Workout phases and timing:** active exercise, set timing, concurrent rest,
  transitions, cooldown, focus behavior, and completion retain their state and timing
  semantics.
- **Review and save:** exertion, reflection, immutable save, pending/indeterminate
  states, retry, conflict, reconciliation, and completion remain truthful.
- **Recovery and coordination:** recovery offers, takeover, stale or invalid sessions,
  account mismatch, lock or storage failure, discard, cleanup, and offline behavior
  remain explicit and actionable.
- **History:** newest-first pagination, schema compatibility, malformed records,
  loading, retry, empty, error, exhaustion, per-set disclosure, and existing progression
  explanations remain unchanged.
- **Settings and catalog:** validation, inherited and overridden values, dirty edits,
  destructive actions, replacement behavior, and immediate saves remain unchanged.
- **Shell and access:** login, approval, verification failure, sign out, lazy loading,
  retry, PWA, and forced-workout routing remain unchanged.

If a proposed visual decision requires changing any of these contracts, stop and return
to product or architecture review rather than treating the change as styling.

## Design evidence contract

UI work is **required** for the epic. Evidence stays proportional:

- Concept and bake-off tasks use comparable rendered artifacts; they do not need app
  tests.
- Production tasks use targeted tests for touched behavior plus scenario-indexed
  rendered evidence for the states and viewports materially affected.
- The canonical `docs/templates/ux-evidence-matrix.md` format is used for one cumulative
  scenario-indexed evidence matrix. TREK-233, TREK-235, TREK-234, and TREK-236 each add
  their changed material scenarios rather than creating separate procedural reports.
- Synthetic or de-identified local data is used for evidence.
- Missing rendered evidence for a changed material scenario blocks that production task.
- Final integration runs the repository's real cumulative verification command,
  `npm run ci:check`, plus the required cumulative reviews and draft-PR checks.

## Seven-task delivery plan

### TREK-227 — Generate and select three Nudge concepts

Create three genuinely different Nudge concepts using identical real content, states, and
viewports. At minimum show Plan/readiness, active exercise, concurrent rest or
transition, Review, and history or recovery. Compare them side by side with accessible
descriptions.

Codex prepares one shared content/state brief, three concept-specific prompts, and a
filename manifest. The user generates the images in ordinary ChatGPT web Chat, not
ChatGPT Work, Codex, or the API:

1. Start a fresh ordinary ChatGPT web chat for each concept.
2. Paste the supplied prompt unchanged and generate one contact sheet.
3. Do not request variants or refinements before comparison.
4. Download the original result as `nudge-concept-a.png`, `nudge-concept-b.png`, or
   `nudge-concept-c.png`, following the manifest.
5. Attach all three originals back to the Codex task. If one omits a required state or is
   unusable, return it before spending another generation so Codex can provide the
   smallest repair prompt.

Codex verifies prompt/output provenance, saves the exact prompts and images under
`docs/reports/nudge-concepts/`, and creates
`docs/reports/nudge-concept-selection.md` with accessible descriptions and the
side-by-side comparison.

The user selects one direction and records why it best fits Journal × Instrument ×
Training Partner, its hierarchy, prepare/reflect and train-together rhythm, exertion,
dense data, distinctiveness, user agency, and accepted tradeoffs.
Codex records the selection, rationale, accepted tradeoffs, and canonical prompt/image
paths in the selection document and a TREK-227 completion comment. TREK-229 used that
selection as its sealed experiment input. Later production tasks retain it as historical
evidence only and must not use it as design direction.

### TREK-229 — Run and record the design-translation bake-off

Give frontend-design and Impeccable the same selected concept, neutral input, content,
states, and mobile/desktop targets. Run them in isolation with no hooks. Each produces
its own design context, token proposal, and the same rendered slice.

Compare the results, preferably without tool labels during the first assessment, and
record defects, strengths, revisions required, and process cost. The user selected
Candidate 3 as the bake-off winner. Retain the collected evidence and discard the
experiment-scoped implementations, hooks, and generated product context. Production work
may create fresh Impeccable workflow artifacts after selection.

Do not extract a production design system or use the winning candidate as a production
reference. The selection closes the experiment and does not constrain the fresh redesign.

### TREK-233 — Build Nudge foundations and pilot Plan → Perform → Review

Design Nudge afresh through the existing shell and the Plan, active workout, concurrent
rest/transition, cooldown, Review, and completion path. Start from current behavior and
the preserved product contracts without using the concept or bake-off artifacts as
visual references. Reuse current state and semantic markup where they remain appropriate;
add only the implementation needed by the approved production design.

Preserve user agency, navigation, timing, persistence, feedback, and focus behavior.
Integrate the current sign-out and shell contract from TREK-245 before this task
completes.

Verify targeted shell, Plan, Generator, WorkoutView, timing, and affected lazy-loading
behavior. Render the affected states at representative mobile, landscape, and desktop
sizes, including keyboard/focus, 200% reflow, reduced motion, contrast, target size, and
fallback fonts where applicable. Run a fresh rendered usability critique.

### TREK-235 — Extend the fresh Nudge design to history

Apply the system to the existing `WorkoutHistory` disclosure inside `WorkoutView`.
Do not create a Journal root route or alter navigation. Preserve pagination, schema
truth, malformed records, empty/loading/error/offline states, progression explanations,
and dense disclosure behavior. Express memory through truthful existing history only.

Extend the production design established through the real application without consulting
the historical concept or bake-off artifacts. Add shared decisions only when the working
screens demonstrate that they are needed.

Verify targeted history, schema, progression, and WorkoutView behavior. Render dense
mobile, desktop, and 200% reflow states including keyboard traversal and
loading/error/malformed content, followed by a fresh usability critique.

### TREK-234 — Apply Nudge to recovery and uncertainty states

Extend the production design to recovery, takeover, conflict, lock or storage failure,
invalid or stale sessions, account mismatch, discard, retry, save uncertainty, and
reconciliation. Do not reinterpret their state machines or make unsupported readiness
claims. Keep user agency and recovery choices explicit.

Run targeted recovery, coordinator, reconciliation, storage, and affected WorkoutView
tests. Render the affected lifecycle states and verify focus, action clarity, feedback,
and feedback retirement.

### TREK-236 — Apply Nudge to Settings and catalog

Extend the production design to Settings and catalog management while preserving
validation, inherited and overridden values, dirty edits, destructive actions,
replacement behavior, and save semantics. Do not return planning burden through
excessive configuration.

Run targeted Settings, storage, and affected shell/lazy-navigation tests. Render normal,
invalid, dirty, destructive, and failure states at representative mobile and desktop
sizes and 200% reflow.

### TREK-237 — Validate and integrate Nudge across production surfaces

Correct cross-surface inconsistencies without expanding product scope. Confirm Nudge
communicates memory, preparation, and recommendations only through existing behavior,
preserves user agency, and avoids guilt, fake urgency, simulated intimacy, unsupported
readiness claims, and authoritative coaching language. Complete the single cumulative
evidence matrix, confirm the current shell state including TREK-245, and verify that
experiments and unused tooling are absent.

Run `npm run ci:check`, bounded responsive/offline/PWA/font preview checks, and emulator
or access checks only when the changed surface requires them. Run the required cumulative
epic and conformance reviews, commit any approved-intent corrections, push the branch,
open a draft PR, and report check status. This is the sole final validation and
integration task.

## Dependencies and decision gates

```text
TREK-226 (completed historical charter)
  → TREK-227
  → user selects a concept
  → TREK-229
  → user records the bake-off winner and authorizes a fresh redesign
  → TREK-233
  → TREK-235
  → TREK-234 and TREK-236
  → TREK-237
```

TREK-245 protects shell/auth behavior and gates TREK-233, not concept exploration.
TREK-234 and TREK-236 may run independently after TREK-235.

The former TREK-228, TREK-230, TREK-231, TREK-232, and TREK-238 are absorbed into the
tasks above and should be closed as superseded with successor references.

## Epic acceptance

- The concept and bake-off selections remain traceable as historical evidence.
- Plan, Perform, Review, history, recovery, Settings, and shell states feel coherent
  while their behavior remains unchanged.
- Nudge adds no unsupported intelligence, pressure, simulated intimacy, features, or
  gamification.
- History remains an existing disclosure, not a new root route.
- Accessibility and responsive behavior are demonstrated on changed material scenarios.
- Experimental implementations and unused design tooling are absent.
- No concept or bake-off artifact is treated as a production design requirement.
- Cumulative verification and both final integration reviews pass or have explicit,
  owned follow-up before the draft PR is handed off.

## Decision record

- 2026-07-19: The initial charter recorded Resolve, Journal × Instrument, contextual
  Coach × Instrument energy, Record/Perform rhythm, and protected behavior contracts.
- 2026-07-26: The user approved replacing the B2–B13 waterfall with the seven-task
  design-translation and production-pilot plan in this document.
- 2026-07-26: The user replaced Resolve with the working name Nudge and approved
  Journal × Instrument × Training Partner as the presentation identity. The pivot retains
  all current functionality and guides future direction without authorizing future
  behavior.
- 2026-07-26: The user chose ordinary ChatGPT web Chat for the three concept generations
  to preserve Codex quota. Codex owns the controlled prompts, artifact intake, comparison,
  durable selection record, and downstream handoff.
- 2026-07-29: The user selected Candidate 3 (Impeccable) as the bake-off winner, declined
  token or visual-principle extraction, and directed production design to start fresh
  without concept or bake-off references. The winner is a historical experiment result,
  not a production visual contract. Product boundaries and anti-goals remain binding;
  positive aesthetic direction does not. Impeccable remains the selected production design
  workflow, and its post-selection hook, DESIGN.md sidecar, and implementation-direction
  comments are production artifacts rather than bake-off residue.
- No disposable bake-off workflow, hook, generated product context, experimental
  implementation, or custom design reviewer is retained.
