# Resolve Interface System

**Status:** Approved planning amendment; implementation not started

**Epic:** EPIC-13

**Branch:** `codex/resolve-interface-system`

**Initial charter commit:** `9f7c9b4a1489c8a98c9f4440d1f428b71bdd89e3`

**Initial charter approved:** 2026-07-19

**Seven-task redesign approved:** 2026-07-26

## Purpose

Give Adaptive Workouts its first coherent product identity and interface system without
changing the workout engine, stored data, authentication, recovery semantics, or current
navigation model.

The working identity is **Resolve**: a training journal fused with a precision
instrument. Calm record-keeping should govern planning, history, settings, and review.
Active training should become more immediate without becoming loud, game-like, or
dashboard-heavy.

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
- Neither a third-party design skill nor a repository-specific design skill has been
  shown to improve this product yet. Their value must be demonstrated by the pilots.

## Identity principles

1. **Calm confidence.** The product should feel deliberate and trustworthy.
2. **Record before dashboard.** Preserve chronology, context, and truth; do not invent
   analytics or coaching claims.
3. **Instrument during effort.** Active work emphasizes the next action, current set,
   phase, rest, and recovery status.
4. **One hierarchy per state.** The primary action and current state must be obvious.
5. **Information earns prominence.** Density follows decisions the user must make.
6. **State is explicit.** Loading, empty, offline, failure, recovery, conflict, pending,
   and completion states are designed outcomes.
7. **Accessibility is structural.** Semantics, focus, keyboard use, target size,
   contrast, reflow, reduced motion, and non-color cues are part of the design.
8. **A small system, not a component catalog.** Add only tokens and patterns proven
   useful on real screens.

## Explicit anti-patterns

- Generic wellness gradients, glass panels, neon dashboards, and decorative metrics.
- Gamification, streak pressure, faux scientific precision, or invented recommendations.
- Every section becoming a card.
- Tiny labels, weak contrast, motion-dependent meaning, or color-only state.
- A new Journal route or broader navigation redesign.
- A parallel prototype application or permanent experimental route.
- Persisting Impeccable, frontend-design, hooks, a custom skill, or a reviewer agent
  before observed evidence justifies the overhead.
- Changing product behavior while restyling it.

## Goals

- Select one of three genuinely different but directly comparable Resolve concepts.
- Compare frontend-design and Impeccable as translation aids against the same selected
  concept and neutral inputs.
- Extract accepted decisions into repository-owned `DESIGN.md`.
- Pilot the provisional workflow on two representative production slices.
- Decide from observed defects and effort whether to retain, narrow, or discard the
  third-party workflow.
- Apply the accepted system to the remaining material surfaces.
- Validate the cumulative product once and publish a reviewable draft PR.

## Non-goals

- New workout-generation, timing, history, recovery, storage, authentication, or
  authorization behavior.
- New analytics, recommendations, progression calculations, or data migrations.
- A new root Journal destination.
- A design-tool supply-chain framework.
- A mandatory project skill or design-review agent.
- A speculative component library or token taxonomy.
- Keeping experimental implementations after their decisions have been extracted.

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

### TREK-227 — Generate and select three Resolve concepts

Create three genuinely different concepts using identical real content, states, and
viewports. At minimum show Plan/readiness, active exercise, concurrent rest or
transition, Review, and history or recovery. Compare them side by side with accessible
descriptions.

The user selects one direction and records why it best fits Resolve, its hierarchy,
Record/Perform rhythm, exertion, dense data, distinctiveness, and accepted tradeoffs.
No downstream task starts without this recorded selection.

### TREK-229 — Run the design-translation bake-off and establish `DESIGN.md`

Give frontend-design and Impeccable the same selected concept, neutral input, content,
states, and mobile/desktop targets. Run them in isolation with no hooks. Each produces
its own design context, token proposal, and the same rendered slice.

Compare the results, preferably without tool labels during the first assessment. Record
defects, strengths, revisions required, and process cost. Select a provisional workflow
or select neither. Extract only accepted product-specific decisions into repository-owned
`DESIGN.md`, then discard both experimental implementations.

A fresh UX design review validates the material scenarios. Architecture review validates
the production contract and feasibility. The user approves the provisional UX contract
and tool-or-neither decision before production work.

### TREK-233 — Build Resolve foundations and pilot Plan → Perform → Review

Apply the accepted system to the existing shell and the Plan, active workout, concurrent
rest/transition, cooldown, Review, and completion path. Reuse current components, state,
and semantic markup. Add only the tokens and shared patterns this slice requires.

Preserve navigation, timing, persistence, feedback, and focus behavior. Integrate the
current sign-out and shell contract from TREK-245 before this task completes. Manually
invoke the provisional tool when useful and log concrete defects, accepted revisions,
bypasses, and no-value passes.

Verify targeted shell, Plan, Generator, WorkoutView, timing, and affected lazy-loading
behavior. Render the affected states at representative mobile, landscape, and desktop
sizes, including keyboard/focus, 200% reflow, reduced motion, contrast, target size, and
fallback fonts where applicable. Run a fresh rendered usability critique.

### TREK-235 — Generalize Resolve to history and decide workflow retention

Apply the system to the existing `WorkoutHistory` disclosure inside `WorkoutView`.
Do not create a Journal root route or alter navigation. Preserve pagination, schema
truth, malformed records, empty/loading/error/offline states, progression explanations,
and dense disclosure behavior.

Use this as the second production pilot. Update `DESIGN.md` only with reusable decisions
that survive both pilots. Record the observed value and cost of frontend-design,
Impeccable, and coordinator judgment.

The user then decides to retain a tool, narrow its use, or retain neither. Persistent
third-party tooling, hooks, or a custom design skill/reviewer agent requires separate
authorization supported by concrete pilot evidence. Without that authorization, later
tasks use `DESIGN.md` directly.

Verify targeted history, schema, progression, and WorkoutView behavior. Render dense
mobile, desktop, and 200% reflow states including keyboard traversal and
loading/error/malformed content, followed by a fresh usability critique.

### TREK-234 — Apply Resolve to recovery and uncertainty states

Apply the accepted system to recovery, takeover, conflict, lock or storage failure,
invalid or stale sessions, account mismatch, discard, retry, save uncertainty, and
reconciliation. Do not reinterpret their state machines.

Run targeted recovery, coordinator, reconciliation, storage, and affected WorkoutView
tests. Render the affected lifecycle states and verify focus, action clarity, feedback,
and feedback retirement.

### TREK-236 — Apply Resolve to Settings and catalog

Apply the calm Record expression to Settings and catalog management while preserving
validation, inherited and overridden values, dirty edits, destructive actions,
replacement behavior, and save semantics.

Run targeted Settings, storage, and affected shell/lazy-navigation tests. Render normal,
invalid, dirty, destructive, and failure states at representative mobile and desktop
sizes and 200% reflow.

### TREK-237 — Validate and integrate Resolve across production surfaces

Resolve cross-surface inconsistencies without expanding product scope. Complete the
single cumulative evidence matrix, confirm the current shell state including TREK-245,
and verify that experiments and unused tooling are absent.

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
  → user approves the provisional UX contract and tool-or-neither decision
  → TREK-233
  → TREK-235
  → user decides workflow retention; any persistent/custom tooling needs authorization
  → TREK-234 and TREK-236
  → TREK-237
```

TREK-245 protects shell/auth behavior and gates TREK-233, not concept exploration.
TREK-234 and TREK-236 may run independently after the TREK-235 decision gate.

The former TREK-228, TREK-230, TREK-231, TREK-232, and TREK-238 are absorbed into the
tasks above and should be closed as superseded with successor references.

## Epic acceptance

- One selected Resolve direction is traceable to three comparable concepts.
- `DESIGN.md` contains the accepted product-specific system and no tool-specific ritual
  without demonstrated value.
- Plan, Perform, Review, history, recovery, Settings, and shell states feel coherent
  while their behavior remains unchanged.
- History remains an existing disclosure, not a new root route.
- Accessibility and responsive behavior are demonstrated on changed material scenarios.
- Experimental implementations and unused design tooling are absent.
- Any retained third-party or custom design infrastructure has separate, evidence-backed
  user authorization.
- Cumulative verification and both final integration reviews pass or have explicit,
  owned follow-up before the draft PR is handed off.

## Decision record

- 2026-07-19: The initial charter recorded Resolve, Journal × Instrument, contextual
  Coach × Instrument energy, Record/Perform rhythm, and protected behavior contracts.
- 2026-07-26: The user approved replacing the B2–B13 waterfall with the seven-task
  design-translation and production-pilot plan in this document.
- The retained external techniques are temporary comparison inputs. The repository owns
  the selected visual decisions through `DESIGN.md`.
- The default disposition is no persistent third-party tool and no custom design
  skill/reviewer agent unless two production pilots reveal a concrete recurring need.
