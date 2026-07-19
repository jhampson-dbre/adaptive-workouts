# Resolve Interface Design Validation Charter

**Status:** Approved design-validation charter; visual system pending validation

**Date:** 2026-07-19

**Trekker epic:** EPIC-13

**Branch:** `codex/resolve-interface-system`

**Planning task:** TREK-226

## Charter boundary

This document records the approved product, interaction, accessibility, and design-
validation contract for **Resolve — Adaptive training journal and coach**. It is the
durable authority for validating and then implementing the interface system.

It does **not** approve a final visual direction, exact token values, font family or
type pairing, motion durations, icon treatment, or production component styling.
Those decisions remain pending the comparable-concept, user-selection, synthesis,
prototype, and rendered-validation gates in B2–B6. Only choices that survive those
gates may be encoded as the project design skill or promoted to production.

B1 is documentation-only and independent of Workout Phase Timing. B2 and every later
Resolve task require all three of the following:

1. Timing final handoff TREK-225 (A9) is complete.
2. The Timing work is actually integrated into the target `main` branch.
3. The user gives fresh authorization to begin B2.

## Product identity and working direction

> A training ledger fused with a precision instrument, becoming more energetic only
> when the user is performing. This gives us an original foundation instead of
> adopting an established “fitness app” aesthetic.

The working name and descriptor are:

```text
Resolve
Adaptive training journal and coach
```

The visible identity may use this two-line lockup where the product name and purpose
need introduction. Accessible names and application metadata must preserve the same
meaning without forcing the visual line break.

**Journal × Instrument** is the foundation. History, settings, planning, and saved
reflection carry the calmer journal character. **Coach × Instrument** energy is
activated contextually for active workouts, timers, progress milestones, and primary
actions. The instrument layer—precise numbers, disciplined hierarchy, operational
clarity, and truthful measurement—unifies both expressions.

This creates the approved emotional rhythm:

- **Record:** calm while planning, configuring, reading history, and reflecting.
- **Perform:** energetic while warming up, performing sets, resting, and cooling down.

The two modes are contextual expressions of one semantic system, not independent
themes. Explicit workout lifecycle events control transitions; inferred physiology,
user effort, timer urgency, or decorative animation must not.

The product ideas that should remain legible throughout the system are progression,
progress, adaptive training, journal, and trends. “Trends” means chronological
scanability and understandable progression explanations in this epic. It does not
authorize analytics, forecasting, dashboards, scores, or new progression logic.

## Identity principles

- **Calm by default, energized by state.** Energy communicates action, urgency, or
  achievement.
- **Precision creates character.** Numbers, calibration marks, progression lines,
  and structured spacing become the visual vocabulary.
- **Data is not decoration.** Lines, ticks, labels, and divisions must encode real
  workout information.
- **Energy comes from contrast, scale, and motion—not neon.**
- **Typography stays upright and disciplined.** Distinctive condensed numerals or
  headings are appropriate; racing italics are not.
- **Materials feel tactile but restrained.** Warm paper, graphite, ink, and
  oxidized-metal tones can inspire the palette without literal notebook or machinery
  skeuomorphism.
- **Motion feels measured.** Progress advances, values increment, and states lock
  into position—no glowing pulses, speed lines, or arcade effects.

## Explicit anti-patterns

The validated proposal and production system must prohibit:

- Neon green as the default performance shorthand.
- Racing italics and exaggerated athletic fonts.
- Black-and-red bodybuilding branding.
- Glows, chrome, flames, lightning, and diagonal speed stripes.
- Trophy-heavy gamification.
- Decorative barbell or plate imagery.
- Generic purple gradients and floating SaaS cards.
- Making every positive value compete for attention.

Color, motion, or language must never pressure the user to exert harder. Achievement
is communicated with truthful state, hierarchy, and measured feedback rather than
reward spectacle.

## Goals

- Establish an original, recognizable application identity rooted in adaptive
  training, records, and precision.
- Make the current phase, exercise, prescription, timer, and next action immediately
  scannable during exertion.
- Make planning, settings, history, and completion calmer and information-forward.
- Refresh every user-facing surface without changing approved product behavior.
- Keep Record and Perform visually distinct while unmistakably one product.
- Preserve accessibility, responsive behavior, interruption handling, recovery, and
  failure visibility.
- Validate the system against real interaction before codifying it as a reusable
  project skill or applying it broadly.

## Non-goals

- New workout generation, scheduling, progression, recommendation, or catalog logic.
- New analytics, charts, forecasts, readiness scores, physiology inference, or
  gamification.
- A marketing brand, logo program, illustration system, user-selectable themes, or
  light/dark theme preference.
- Changes to authentication, account ownership, Firestore data boundaries, or
  deployment architecture.
- Redesigning Timing, recovery, save reconciliation, or EPIC-11 behavior.
- Notebook, machinery, gym-equipment, or industrial-control skeuomorphism.
- Treating generated concept images as behavior evidence or implementation authority.

## Preserved architecture and behavior contracts

Resolve consumes the contracts implemented by Workout Phase Timing (EPIC-12); it
does not own or reinterpret them.

### Timing and history

- Warmup and cooldown settings are exact whole-minute multiples of 60 seconds in
  `0..3600`; legacy `warmupTime` remains a fallback only.
- A generated workout snapshots immutable planned phase targets.
- Schema v4 history stores cumulative phase durations with an exact phase-sum
  invariant. Performance `plannedSeconds` is the generation budget.
- Legacy, schema-v2, and schema-v3 history remain readable with their existing
  semantics. Existing progression algorithms are unchanged.
- The global elapsed timer spans all workout phases.
- Warmup and cooldown reaching zero enter overtime; they never auto-advance.
- Starting the first set early is valid. Cancelling its timer does not return to
  warmup.
- Confirming the final outstanding set enters Cooldown. Undoing that set returns to
  Performance. The EPIC-11 final-set focus target moves only to the Cooldown heading.
- Early workout termination requires confirmation and then enters Cooldown. A session
  with no completed work cancels rather than creating empty history.
- Review/confirmation gaps are excluded according to the Timing ledger contract.
- Completion may be planned or early, but saved phase totals remain exact and
  cumulative across valid re-entry.

### Active recovery and coordination

- Recovery uses one versioned slot per Firebase project and user:
  `adaptive-workouts:active-workout:v1:<projectId>:<uid>`.
- Every draft mutation requires the exclusive Web Lock
  `active-workout:<projectId>:<uid>`.
- Only the approved allowlisted draft projection is persisted.
- Recovery, takeover, conflict, lock failure, storage failure, stale draft, account
  change, and explicit discard remain distinguishable, actionable states.
- Resolve may improve hierarchy, language, and presentation but may not weaken lock
  exclusivity, account binding, recovery validation, or user choice.

### Immutable save and security

- Saves use a stable UUID, exact immutable `setDoc`, canonical SHA-256 fingerprinting,
  and server-only reconciliation.
- Firestore history permits owner read/create and structurally identical replay while
  denying divergent overwrite, deletion, unauthenticated access, and cross-user
  access.
- Save success, retry, already-saved reconciliation, divergent conflict, and failure
  must remain truthfully distinct. Visual polish must not imply persistence before
  confirmation.

### EPIC-11 set timing and focus

- Only one work timer is active globally; rest timers may overlap across exercises.
- Starting the next set of an exercise closes that exercise’s preceding rest.
- Confirm, cancel, undo, sequential set locking, weighted relocking, and concurrent
  rest behavior remain unchanged.
- Collapsed exercise headers continue to expose meaningful work/rest state.
- Focus recovery and semantic status announcements remain deterministic. Per-second
  timer updates are not live-announced.
- Sound and vibration remain supplementary; visible and textual state is authoritative.

## Information architecture and interaction contract

### Stable navigation

The authenticated application has exactly three stable root modes:

- **Plan** — configure and generate the next workout; continue into active work.
- **Journal** — review saved workouts and progression explanations chronologically.
- **Settings** — edit preferences and the exercise catalog.

Active workout phases, Review, completion, recovery, takeover, save reconciliation,
login, loading, empty, error, and offline states are owned flows or overlays, not
additional root navigation destinations. The shell must not obscure a phase-critical
action, timer, error, or recovery choice. Navigation away from dirty or active work
must preserve the approved confirmation and recovery contracts.

### Record mode

Record mode serves Plan readiness, Journal, Settings/catalog, login, and Saved
Reflection. It favors calm hierarchy, deliberate spacing, chronological reading, and
quiet comparison. It may reveal adaptation and progress, but positive values do not
all receive primary emphasis. History is a ledger: dates, prescriptions, performed
values, durations, and progression explanations align for scanning and retain schema
truth, including malformed and unavailable states.

### Perform mode

Perform mode serves Warmup, active Performance, concurrent Rest, and Cooldown. It
raises contrast and scale only where action, urgency, or achievement requires it.
The current phase, current exercise, prescription, active timer, rest state, and next
valid action form the hierarchy. Rest may coexist with active work and may not be
presented as a modal state that hides the current set. Overtime is explicit text and
structure, never color alone.

### Completion bridge

Review and Saved Reflection form the bridge from Perform back to Record. Review keeps
the frozen candidate and its save/exit/retry truth clear. Saved Reflection confirms
the durable outcome, summarizes the session and phases, and returns the interface to
the calmer journal expression without trophy-heavy celebration.

## Accessibility, responsiveness, and feedback

- All meaning remains available without color, motion, sound, or vibration.
- Text, controls, focus indicators, timing states, and disabled states meet applicable
  WCAG contrast requirements.
- Interactive targets are at least 44×44 CSS pixels unless a documented contextual
  exception preserves equivalent usability.
- Keyboard order follows visual and task order. Dialogs contain focus, restore it to
  the initiating or next logical control, and expose clear accessible names.
- Phase changes and semantic timer transitions use concise status announcements;
  ticking values are not repeatedly announced.
- Reduced-motion users receive equivalent state communication without animated
  ramping, pulsing, or abrupt spatial movement.
- The system must remain usable at 320px, 375px, 568×320 landscape, 768px, and 1280px,
  and under 200% zoom/reflow. Critical actions and timers may not be clipped, covered,
  or pushed beyond practical reach.
- Long exercise names, large values, dense workout content, localization pressure,
  browser text scaling, safe-area insets, offline state, and installed-PWA presentation
  are validation inputs rather than cleanup work.
- Feedback has an owner and retirement event. Success, error, offline, conflict,
  cancellation, undo, completion, navigation, and retry cannot leave stale banners,
  toasts, or status text.
- Fonts must be legally usable, self-hostable for the production PWA, performant, and
  resilient. A loading failure must retain hierarchy and legibility through the
  approved fallback stack.

## Scenario-indexed validation contract

UX classification is **required**. Each applicable implementation task must perform a
fresh per-run capability probe and record evidence using
`docs/templates/ux-evidence-matrix.md`. Concept images are advisory and never satisfy
rendered interaction evidence. Synthetic or de-identified local data is mandatory.

### Resolve scenarios

| ID | Scenario and required outcome |
| --- | --- |
| R-01 | **Shell and identity:** Resolve identity, Plan/Journal/Settings navigation, login, loading, offline, empty, and error states remain understandable and responsive. |
| R-02 | **Plan and readiness:** settings summary, generated prescription, adaptation explanation, regenerate/start hierarchy, and dirty/replacement choices are calm, truthful, and reachable. |
| R-03 | **Perform:** Warmup, active set, concurrent rests, overtime, collapsed status, undo, blocked action, and Cooldown keep phase, timer, prescription, and next action immediately scannable. |
| R-04 | **Completion bridge:** Review, early finish, cancel/no-work, retry, saved reconciliation, Saved Reflection, exit, and return to Record preserve candidate and persistence truth. |
| R-05 | **Journal:** chronological history across legacy/v2/v3/v4, phase and set details, progression explanations, malformed records, empty/error/offline states, and dense scanning remain readable without inventing analytics. |
| R-06 | **Settings/catalog:** preferences, phase settings, inherited/overridden values, catalog CRUD, validation, unsaved changes, destructive actions, and replacement paths protect dirty drafts. |
| R-07 | **Recovery and uncertainty:** reload recovery, takeover, multi-tab conflict, lock/storage failure, stale/invalid/account-mismatched drafts, discard, retry, and save reconciliation remain explicit and actionable. |
| R-08 | **Cross-cutting quality:** required viewports, 200% zoom/reflow, keyboard/focus, screen reader semantics, contrast, 44px targets, reduced motion, offline, font failure, safe areas, and PWA behavior pass without relying on color or animation. |

### Timing evidence inherited by Resolve

Resolve must preserve and, where its surfaces apply, re-demonstrate the Timing
contract. The Timing epic owns the detailed fixture matrix; these IDs are the stable
integration obligations:

| ID | Contract |
| --- | --- |
| T-01 | Canonical warmup/cooldown setting normalization, legacy fallback, validation, and immutable plan snapshots. |
| T-02 | Warmup start, countdown, zero, overtime, early first-set transition, and global elapsed continuity. |
| T-03 | Performance entry, active work, concurrent rest, phase accumulation, cancel, undo/re-entry, and EPIC-11 focus behavior. |
| T-04 | Normal final-set and confirmed early-finish transitions into Cooldown; no-work cancellation remains distinct. |
| T-05 | Cooldown countdown, zero, overtime, Resume Workout, re-entry accumulation, and Finish transition. |
| T-06 | Review-gap exclusion, back/resume behavior, failed-save frozen candidate, and completion-summary timing. |
| T-07 | Nondecreasing injected wall-clock behavior, backward/forward clock shifts, early/planned completion, cancellation, and exact phase sums. |
| T-08 | V4 writer validity, cumulative phase durations, planned performance budget, authoritative IDs, and immutable save/fingerprint semantics. |
| T-09 | Legacy/v2/v3/v4 history classification, malformed-data handling, duration presentation, and unchanged progression/engine compatibility. |
| T-10 | Integrated settings, plan, history, phase, responsive, accessibility, and regression evidence across the production cutover. |

### Coordination and recovery evidence inherited by Resolve

| ID | Contract |
| --- | --- |
| C-01 | Valid same-user reload restores the allowlisted active draft under the project/user slot. |
| C-02 | Two-tab mutation requires the exclusive Web Lock and presents conflict/takeover without silent divergence. |
| C-03 | Lock unavailable, denied, or lost blocks mutation and offers truthful recovery or exit. |
| C-04 | Stale, malformed, wrong-project, or wrong-user drafts never hydrate as valid work and have an explicit disposition. |
| C-05 | Draft lifecycle covers create, mutate, Review, resume, discard, successful save, and cleanup without exposing transient or unallowlisted data. |
| C-06 | Stable-ID replay reconciles only an exact canonical fingerprint; divergent overwrite, deletion, unauthenticated, and cross-user attempts remain denied and visibly distinct. |

No Resolve task may claim an R, T, or C scenario from source inspection alone when the
approved matrix requires rendered evidence. Unsupported harness capability follows
the repository fallback contract and must include complete limitation metadata.

## Validated visual-design and production sequence

### B2 — Comparable imagegen directions

After the dependency and authorization gate, merge updated `main` into this branch
while retaining this charter. Make exactly three separate built-in image-generation
calls. Each prompt must include `Use case: ui-mockup` and the same synthetic four-
screen fixture: Generate/readiness, active Performance with concurrent rest,
Cooldown, and Saved Reflection. Vary only typography, warm/mineral balance, density,
calibration language, and state-energy contrast.

Save inspected finals at:

- `docs/design/resolve/concepts/direction-a.png`
- `docs/design/resolve/concepts/direction-b.png`
- `docs/design/resolve/concepts/direction-c.png`

Record exact prompts, alt descriptions, limitations, and a comparison in
`docs/reports/resolve-interface-b2-concepts.md`. Unsupported comparability checkpoints
the task; there is no silent CLI or alternate-tool substitution. The images remain
advisory concepts, not rendered UX evidence.

An image generated during discovery at
`C:\Users\jhamp\.codex\generated_images\019f7839-02f8-78a2-9488-568089e87003\exec-fd9be934-46ae-4233-900e-b859e97d2d35.png`
is an advisory conversation artifact only. It is not a repository deliverable, one
of the three B2 directions, behavior evidence, or implementation authority.

### B3 — Direction selection

Present the three comparable directions and their tradeoffs. Wait for explicit user
selection. Amend this charter with the chosen direction, rationale, rejected
tradeoffs, and bounded refinements. No later task starts without that approval.

### B4 — Frontend-design synthesis

Resolve the official upstream commit for `anthropics/skills@frontend-design`, install
the user-approved package, locate the Codex installation, retrieve `SKILL.md` from
that exact commit, and require SHA-256 equality between upstream and installed files.
Fully read the verified skill and every required resource. A mismatch or unavailable
source checkpoints the task without substitution.

Use the verified skill to turn the selected concept into an implementable draft:
type scale and roles, semantic colors, spacing and shape language, hierarchy,
workout-state treatments, motion principles, responsive rules, tokens, and
anti-patterns. Exact choices become approved only after a fresh UX design review and
their committed addition to this charter.

### B5 — Vertical-slice prototype

Build a no-write synthetic development prototype for Generate → active workout →
concurrent rest → Cooldown → Saved Reflection, available only at
`?resolvePrototype=1`. Gate its import with `import.meta.env.DEV`; a production build
and bounded production preview must visibly render normal Plan with no prototype
marker. The prototype owns no Timing, storage, authentication, or production state.

### B6 — UX Quality Gate and refinement

Run real rendered interaction, accessibility, responsiveness, reduced-motion, and
workout-scenario evidence against the prototype. Fresh UX usability, code, and task-
conformance reviewers assess the final changed surface. Correct only defects within
the selected direction. Product, Timing, data, security, or architecture changes
return to their approval gates. Completion requires no blocking changed-surface UX
finding.

### User gate before B7

Do not start B7 until the user explicitly confirms:

> Encode the validated Resolve direction as the project skill.

### B7 — Project-specific design skill

Use the repository-approved `skill-creator` workflow to initialize
`.codex/skills/resolve-design-system/`. Include a concise `SKILL.md`, generated
`agents/openai.yaml`, and only necessary references. Encode only decisions that
survived B6; point to this charter and evidence rather than duplicating them.
Validate with `quick_validate.py`, then forward-test with fresh isolated Record/
Journal and Perform/concurrent-rest design tasks. One evidence-driven revision is
allowed. Record prompts, outputs, observations, source hashes, and outcome in
`docs/reports/resolve-interface-b7-skill-validation.md`.

### B8–B13 — Production application

- **B8:** promote validated foundations, fonts, tokens, shell, navigation, dialogs,
  Generate, active/rest/Cooldown, Review, and completion; remove the prototype only
  after parity.
- **B9:** apply Resolve to recovery, takeover, conflicts, lock/storage failures, and
  reconciliation without changing behavior.
- **B10:** implement the chronological Journal for every schema version and malformed
  state; retain trends as scanability, not analytics.
- **B11:** apply the validated system to Settings/catalog and protect every dirty-
  draft replacement path.
- **B12:** complete the full R matrix and applicable T/C evidence across the required
  accessibility, viewport, offline, font, and PWA conditions.
- **B13:** run full CI/emulator verification, cumulative integration reviews, bounded
  preview checks, push, draft PR, checks, and deployed-preview font/PWA probes.

Only one implementation task is active at a time. Every behavior task starts with a
named failing test. Every nontrivial green diff receives the required simplification,
coordinator verification, fresh code review, and fresh task-conformance review.
Every UI task re-probes capability and writes the canonical evidence report.

## Delivery and dependency record

The durable dependency chain is:

```text
B1 (independent)

Timing A9 + actual merge to target main + fresh approval
  → B2 → B3 → B4 → B5 → B6
  → explicit project-skill user gate → B7 → B8
  → B9, B10, B11 → B12 → B13
```

Trekker contains the task-level dependencies. The actual-merge and user-approval
gates are external state and remain explicit in task descriptions and comments; a
completed dependency record alone does not satisfy them.

## Acceptance signals

- Plan, Perform, Cooldown, Review, and Saved Reflection are distinct but clearly one
  product.
- The current phase, prescription, timer, recovery status, and next valid action are
  immediately apparent in their applicable states.
- Journal and progression explanations remain calm, chronological, and truthful.
- Contextual energy follows explicit state and never becomes neon, coercive, or
  arcade-like.
- Instrument details encode real information and do not become decorative linework.
- All required viewports, focus, keyboard, screen-reader, contrast, target-size,
  reduced-motion, offline, recovery, font, and PWA obligations have inspectable
  evidence.
- Existing Timing, EPIC-11, recovery, persistence, security, progression, and
  authentication behavior remains intact except for the explicitly approved focus
  move to the Cooldown heading.
- The project design skill contains only decisions proven by rendered validation.

## Decision and review record

- The Discovery Brief **Measured Momentum Interface Redesign** was approved before
  formal planning.
- The approved foundation is Journal × Instrument with contextual Coach × Instrument
  energy, expressed as calm Record and energized Perform modes.
- Alternatives rejected: Journal × Instrument everywhere (insufficient Perform
  energy), Coach × Instrument everywhere (too intense for Journal/Settings), a single
  generic theme with stronger buttons (insufficient rhythm), continuous or inferred
  theme changes (fragile and manipulative), combining Timing into the redesign
  (unfocused data/lifecycle risk), and creating a project skill directly from mockups
  (would codify an unvalidated system).
- UX design coordination completed its final revision with no blocking finding.
- Architecture/design review found the revised boundary ready, preserving Timing,
  recovery, persistence, security, and EPIC-11 ownership.
- Senior-developer planning conformance found the two-epic execution plan ready after
  tightening dependency, evidence, image comparability, skill-verification, preview,
  and authorization gates.
- On 2026-07-19, the user approved the revised implementation plan, authorized both
  Trekker epics and their dependencies/follow-ups, and authorized execution of B1
  only.
- The B1 planning commit hash is recorded on EPIC-13 and TREK-226 after this document
  is committed.
