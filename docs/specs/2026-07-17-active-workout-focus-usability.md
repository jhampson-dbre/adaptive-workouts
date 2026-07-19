# Mobile Active-Workout Focus and Interim History Disclosure

**Status:** Approved; UX Quality Gate reviewed for future implementation authorization

**Date:** 2026-07-17

**Trekker epic:** EPIC-11

**Planning task:** TREK-200

**UX quality retrofit:** TREK-243

## Problem

EPIC-8 made per-set work and rest timing accurate and accessible, but the active
workout still gives completed rows nearly the same visual weight as the current
action. A live rest countdown remains attached visually to the completed set that
started it, which draws users backward toward Undo instead of forward toward the
next set.

The visible page-level status surface can also be above the current viewport. Rest
completion messages and actionable errors therefore compete in one location that
may not be visible when the user needs it.

Workout History is always rendered at the bottom of the active-workout view. Its
unbounded visual length distracts from the workout even though a full history
navigation, search, and pagination redesign is separate work.

## Goals

- Make the next ready set the strongest visual action on mobile.
- Show live rest countdown or overtime beside the next ready set of the same
  exercise.
- Keep **Start set** wording and behavior unchanged and available throughout rest
  and overtime.
- Make completed sets compact by default and expandable for their full details.
- Keep Undo available under its existing eligibility rules while making it
  visually secondary.
- Preserve textual work, rest, and overtime status in collapsed exercise headers.
- Remove the visible global overdue/status banner while preserving accessible rest
  announcements, sound, and vibration.
- Put actionable exercise errors in the panel where the user acted.
- Collapse the entire existing Workout History section by default as an interim
  treatment.
- Preserve all existing reducer, focus, interleaving, persistence, save, and
  history-compatibility behavior.

## Non-goals

- Changing `activeWorkoutReducer`, reducer actions, timer IDs, timestamp capture,
  timestamp calculations, or timer ownership.
- Changing any saved workout field, schema version, storage read/write behavior,
  auth behavior, Firebase rules, migration, deployment, or settings.
- Changing final-set behavior; final sets still have no rest.
- Guided sequencing, auto-start, rest pausing, or background notifications.
- Dedicated history navigation, individual workout disclosures, pagination,
  filtering, search, or query optimization.
- Changing or absorbing TREK-97. It remains related future history-performance
  work.

## User Experience

### Next-set rest placement

- Before workout start, existing Start Workout gating and help remain unchanged.
- When non-final set `n` is confirmed, its existing transient record continues to
  own the active rest.
- Ready set `n + 1` of the same exercise displays that rest beside its unchanged
  **Start set** button.
- The display reads as a countdown while time remains and as clearly labeled
  overtime after crossing zero.
- **Start set** remains available throughout both states. Starting it ends and
  records the preceding rest through the existing reducer path.
- Starting or working in another exercise does not end this rest. Multiple
  exercises may continue resting concurrently.
- A completed set never duplicates the live countdown in its compact row or
  expanded details.

### Completed sets

- A completed set initially renders as a compact row identifying the set and its
  completed state.
- The row provides an accessible expand/collapse control.
- Expanded details show the applicable mode-specific performance data, work
  duration, resolved planned/actual rest, recommendation explanation where
  applicable, and the existing guarded Undo action.
- Undo is visually secondary and retains every existing enable/disable rule.
- Expanding or collapsing details is view-local presentation state. It never
  changes reducer state, focus progression, performance values, timer state, or
  save output.

### Exercise collapse and focus

- Existing exercise-level expand/collapse rules remain intact.
- Collapsed headers continue to expose confirmed counts plus active work, active
  rest, overtime, or remaining-set status in text.
- Existing final-set automatic collapse and next-exercise focus transfer remain
  unchanged.
- Undoing final completion continues to re-expand that exercise.
- Timer values and status never rely on color alone.

### Rest announcements and actionable feedback

- Remove the visible page-level workout status banner.
- Retain exactly one visually hidden, polite, atomic live region at workout scope.
  It is reserved for newly completed rest announcements and never carries
  per-second updates or actionable errors.
- Preserve existing once-per-rest-attempt sound and vibration, visibility-return
  suppression, repeated-message handling, and silent unsupported-API fallback.
- Invalid confirmation and blocked **Start set** feedback belong to the exercise
  where the user acted.
- If that exercise is collapsed, merge only that exercise into expansion state.
  Preserve unrelated manual expansion choices and do not move focus solely because
  the panel expanded.
- Associate local feedback with the relevant control where appropriate.
- A corrected field edit, successful relevant retry/start/confirmation,
  cancellation or Undo that invalidates the message, or transition to the finish
  summary clears the owning exercise error.
- A blocked **Finish Workout** message remains adjacent to the workout-level Finish
  control, stays out of the hidden rest announcer and exercise-error state, and
  clears after active work is confirmed/canceled or Finish later succeeds.
- Save and account errors remain in the workout summary.

### Interim Workout History treatment

- Keep the existing eager, nonblocking history request and auth lifecycle.
- Render a stable **Workout history** disclosure button with `aria-expanded` and
  `aria-controls`.
- The disclosure starts collapsed. Its accessible name does not include loading,
  errors, counts, or other dynamic status.
- Conditionally render loading, error, empty, and history-list content only when
  the disclosure is open so a closed section remains visually and semantically
  quiet.
- After opening, preserve all existing legacy, valid-v2, valid-v3,
  malformed-versioned, ordering, and read-only presentation behavior.
- A history load failure remains nonblocking to the active workout.

## Behavior Rules

- For a ready set at index `i > 0`, render a live rest readout only from
  `exercise.setRecords[i - 1]._activeRest`.
- Never copy, move, or persist that rest on the ready record.
- Never render that active rest in the preceding completed-set compact row or
  disclosure.
- Ready first sets have no derived rest readout. Final sets never start rest.
- The next-ready presentation does not add a field or change `getSetStatus`.
- Existing same-exercise rest closure, concurrent rests, Finish-time resolution,
  Undo/reconfirmation identity, frozen save candidates, and one-global-work-timer
  behavior remain authoritative.
- Keep one shared current-time render tick; do not add intervals or reducer tick
  actions.
- Completed-detail, exercise-error, and history-disclosure state are view-local and
  are not persisted or restored.

## Data Model and Storage

No new persisted fields, data-model changes, migrations, backfills, or storage
behavior changes are proposed. This epic only repositions or progressively reveals
existing in-memory and saved values.

### Persisted duration contract

| Field / persisted path | Reader/writer versions | Storage unit | Precision and display | Null, missing, and zero semantics | Cross-version and write behavior |
| --- | --- | --- | --- | --- | --- |
| `actualDuration` | Existing legacy/v2 history reader; no v3 writer | minutes | Existing legacy/v2 behavior and display | Existing validity behavior; supported zero remains unchanged | Read only as legacy/v2 duration; no writes or migration in this epic |
| `actualDurationSeconds` | Existing v3 builder, validator, and history reader | integer seconds | Existing shared rounded elapsed calculation; `m:ss` display | Nonnegative integer; zero valid | Valid-v3 only; writer and migration behavior unchanged |
| `exercises[].setRecords[].plannedRestSeconds` | Existing active UI, v3 validator, and history reader | integer seconds | Existing snapshotted precision; `m:ss` display | Non-final configured integer; final set `null` | Never copied to the next ready set; persistence unchanged |
| `exercises[].setRecords[].workDurationSeconds` | Existing reducer, v3 builder/validator, and history reader | integer seconds | Existing shared elapsed calculation; `m:ss` display | Confirmed nonnegative integer; unconfirmed `null`; zero valid | Persistence and compatibility unchanged |
| `exercises[].setRecords[].actualRestSeconds` | Existing reducer, Finish resolver, v3 builder/validator, and history reader | integer seconds | Existing shared elapsed calculation; `m:ss` display | Live rest is transiently `null`; confirmed non-final is resolved before save; unconfirmed/final `null`; zero valid | Presentation relocation does not alter ownership, lifecycle, or persistence |

## UI Surfaces

- `src/components/WorkoutView.jsx`
  - derive the preceding rest at the next ready set;
  - add view-local completed-detail state;
  - separate the hidden rest announcer from exercise-local and Finish-local errors;
  - preserve existing timer effects, reducer dispatches, and focus refs.
- `src/components/WorkoutHistory.jsx`
  - add the explicit outer disclosure and conditionally render existing content.
- `src/index.css`
  - style the action hierarchy, compact completed rows, secondary Undo, local
    feedback, visually hidden announcer, and history disclosure at narrow widths.
- `src/tests/WorkoutView.test.jsx`
  - cover timer placement, startability, disclosures, feedback ownership/lifecycle,
    eager history fetch, accessibility, and preserved focus behavior.
- `src/tests/WorkoutHistory.test.jsx`
  - cover disclosure semantics and unchanged content after opening.

`src/utils/activeWorkout.js`, `src/utils/workoutTiming.js`,
`src/utils/workoutSchema.js`, `src/utils/storage.js`, Firebase configuration, and
auth are outside implementation scope.

## Planning UX Quality Gate

### Classification and artifact authority

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | The epic materially changes mobile action hierarchy, disclosure, viewport placement, transient-feedback ownership, and recovery on the active-workout surface. |
| Proportional artifact | This section is the authoritative scenario-indexed artifact. Four scenarios cover the two planned implementation tasks without expanding product scope. |
| Planning artifact revision | `UX-ARTIFACT: active-workout-focus-usability@v1`; authoritative location: this section of `docs/specs/2026-07-17-active-workout-focus-usability.md`. |
| Planning wireframe status | `planning-only`; the compact wireframes below communicate intended hierarchy and are not rendered implementation evidence. |
| Required UX design review | Fresh `ux-design-reviewer` required against this artifact, the approved design, and the implementation plan before implementation authorization. |
| Architecture authority | Architecture retains authority for system boundaries, data, security, and feasibility. A review outcome that requires changing those boundaries returns to architecture/design review and user approval. |

### Shared mobile interaction contract

The active-workout screen has one job: keep the user's next safe workout action
obvious while retaining access to completed context and history without making either
compete with the current action.

Action hierarchy at the 375px reference viewport is:

1. **Primary:** the current ready or active set action (`Start set`, confirmation,
   or the existing finalization action for that state).
2. **Secondary:** completed-set disclosure and guarded Undo inside expanded details.
3. **Exit:** `Finish Workout`, with blocking feedback adjacent to that control.
4. **Utility:** exercise collapse and the whole-history disclosure.

No destructive action is added. Controls and timer text wrap within the exercise
panel without horizontal scrolling or hiding the focused control. The primary action
and its contextual status stay together; prior completed details are disclosed in
place and never inserted between the ready set and its action. Scrolling, manual
exercise expansion choices, and focus remain stable when feedback appears or retires.

Feedback ownership and retirement are explicit:

- the workout-scoped hidden live region owns newly completed rest announcements;
- the acted-in exercise owns invalid confirmation and blocked-Start feedback;
- the Finish area owns blocked-Finish feedback;
- the workout summary owns save and account errors;
- corrected input, the relevant successful retry/action, cancellation, Undo, or the
  defined state transition retires only the message whose cause is no longer valid.

Backgrounding or collapsing a panel must preserve the existing in-memory active set,
rest, overtime, and focus rules. Full reload recovery remains outside this epic and is
owned by TREK-210; this epic must not imply that reload recovery has been added.

### Scenario UX-11-01 — Advance through work, rest, and overtime

**Changed surface:** `WorkoutView` active exercise panel. **Applicability:**
`applicable`; this is the epic's primary action-hierarchy change.

**Approved flow and states:** before workout start, existing gating remains. After a
non-final set is confirmed, its compact completed row stays above the next ready set.
The next ready set derives the preceding record's live rest and presents countdown or
overtime beside an always-available **Start set**. Starting that set closes only its
own predecessor rest. Concurrent rests in other exercises remain active. Collapsing
the exercise preserves textual active-rest/overtime status in its header; expanding
returns to the same actionable state. Final sets never create or display rest.

```text
+ Exercise header: 1/3 complete · Rest 0:42        [Collapse]
| Set 1 · Completed                               [Details]
| Set 2 · Ready                 Rest 0:42          [Start set]
| Set 3 · Upcoming
+------------------------------------------------------------
```

| Evidence field | Planning record |
| --- | --- |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind / outcome | `rendered-primary` planned / `not-tested` |
| Changed-surface routing | Direct defect in action placement, rest ownership, concurrency, focus, collapse status, reach, or overflow blocks the task. |
| Evidence obligation / disposition / allowed recommendation | `unsatisfied` / `blocking` until execution evidence / `blocked` before execution |
| Build / fixture / viewport | `not-run`; use the per-run build, synthetic baseline fixture, requested 375px viewport, and record the actual viewport. |
| Starting state / action / observed result | `not-run`; cover remaining rest, overtime, collapsed exercise, concurrent rest, and final-set states with the approved actions. |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence. |

### Scenario UX-11-02 — Inspect a completed set and use guarded Undo

**Changed surface:** completed set rows in `WorkoutView`. **Applicability:**
`applicable`; the epic introduces progressive disclosure and changes Undo hierarchy.

**Approved flow and states:** a completed row begins compact. Its accessible disclosure
opens mode-specific performance, work duration, resolved planned/actual rest,
recommendation explanation where applicable, and the existing guarded Undo. Undo is
secondary, retains all eligibility rules, and returns the row through the existing
reducer path. Closing details restores the compact row without changing focus,
timers, save output, or unrelated exercise expansion.

```text
| Set 1 · Completed                               [Show details]
|   (expanded)
|   8 reps · 95 lb · Work 0:37 · Rest 1:12
|   Recommendation explanation
|                                                [Undo]
```

| Evidence field | Planning record |
| --- | --- |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind / outcome | `rendered-primary` planned / `not-tested` |
| Changed-surface routing | Direct defect in disclosure semantics, content completeness, Undo eligibility/hierarchy, focus stability, or narrow-width layout blocks the task. |
| Evidence obligation / disposition / allowed recommendation | `unsatisfied` / `blocking` until execution evidence / `blocked` before execution |
| Build / fixture / viewport | `not-run`; record per-run build, mode-specific synthetic fixtures, requested 375px viewport, and actual viewport. |
| Starting state / action / observed result | `not-run`; cover collapsed/expanded details, eligible and ineligible Undo, and post-Undo recovery. |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence. |

### Scenario UX-11-03 — Recover from contextual workout feedback

**Changed surface:** exercise-local feedback, the hidden rest announcer, and
Finish-local feedback in `WorkoutView`. **Applicability:** `applicable`; the epic
separates formerly competing status ownership and defines message recovery.

**Approved flow and states:** invalid confirmation or blocked **Start set** feedback
appears in the exercise where the action occurred and associates with the relevant
control. A collapsed owning exercise opens without moving focus or disturbing other
manual expansion choices. Correcting the field or the relevant successful action,
cancellation, or Undo retires the stale message. Blocked Finish feedback stays beside
Finish and retires when active work is confirmed/canceled or Finish succeeds. The
single hidden polite atomic live region announces newly completed rests only, never
per-second ticks or actionable errors.

```text
+ Exercise header                                      [Collapse]
| [contextual error for this exercise]
| Current set fields                                  [Confirm]
+------------------------------------------------------------
|                                                     [Finish Workout]
| [Finish-only blocking feedback]
(hidden at workout scope: newly completed rest announcements)
```

| Evidence field | Planning record |
| --- | --- |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind / outcome | `rendered-primary` planned, with accessibility-tree or component-test support / `not-tested` |
| Changed-surface routing | Direct defect in ownership, association, expansion, focus, concurrency, announcement isolation, or retirement blocks the task. |
| Evidence obligation / disposition / allowed recommendation | `unsatisfied` / `blocking` until execution evidence / `blocked` before execution |
| Build / fixture / viewport | `not-run`; record the per-run build, synthetic invalid/blocked states, requested 375px viewport, and actual viewport. |
| Starting state / action / observed result | `not-run`; cover collapsed owner, corrected input, retry, cancellation, Undo, blocked Finish, rest completion, and repeated-message states. |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence. |

### Scenario UX-11-04 — Reveal interim workout history without distraction

**Changed surface:** outer `WorkoutHistory` disclosure within the active-workout view.
**Applicability:** `applicable`; the epic changes hierarchy and semantic visibility
while preserving eager fetching and all history content behavior.

**Approved flow and states:** a stable **Workout history** button starts collapsed with
`aria-expanded="false"` and a controlled region ID. Loading, error, empty, and list
content remain absent visually and semantically while closed even though fetching
starts eagerly. Opening reveals the current state and unchanged legacy/v2/v3/malformed
read-only content; closing returns to a quiet stable button. Load failure never blocks
the active workout. No individual-card disclosure, navigation, count, search, or
pagination is introduced.

```text
|                                                     [Finish Workout]
+ Workout history                                      [Show]
  (closed: no loading, error, empty, count, or list content)

+ Workout history                                      [Hide]
| Existing loading / error / empty / history list content
```

| Evidence field | Planning record |
| --- | --- |
| Per-run capability probe | `not-probed` before execution |
| `capability_state` | `not-probed` before execution |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind / outcome | `rendered-primary` planned, with accessibility-tree or component-test support / `not-tested` |
| Changed-surface routing | Direct defect in initial quietness, disclosure semantics, state reveal, active-workout nonblocking behavior, focus, or overflow blocks the task. |
| Evidence obligation / disposition / allowed recommendation | `unsatisfied` / `blocking` until execution evidence / `blocked` before execution |
| Build / fixture / viewport | `not-run`; record the per-run build, synthetic loading/error/empty/versioned-history fixtures, requested 375px viewport, and actual viewport. |
| Starting state / action / observed result | `not-run`; cover closed eager load, open loading/error/empty/content, close/reopen, and continued workout interaction. |
| Evidence link and limitation | `planning-only`; this wireframe is not rendered evidence. |

### Execution evidence obligation

The coordinator must re-probe the available rendered harness on every required task
run, instantiate the canonical evidence matrix with each evidence concept in its own
field, populate those fields from the per-run build with synthetic or de-identified
data, and preserve representative screenshots when safe. The compact combined rows
above are planning-only and must not be reused as completed execution evidence. Missing
prescribed rendered evidence blocks task completion and requires a resumable
`Checkpoint:`. Static or proxy evidence may prove a defect but cannot produce a
rendered usability pass. After simplification and coordinator-owned rendered
verification, dispatch a fresh `ux-usability-reviewer` in parallel with the fresh
code reviewer and task-conformance reviewer. Reviewers may report defects but may not
redesign or expand this approved artifact.

## Edge Cases

- If a resting exercise is collapsed when rest crosses zero, its header reports
  overtime and the hidden announcement/sound/vibration retain existing behavior.
- Multiple resting exercises each display only their own preceding-record rest.
- Starting one next same-exercise set closes only that rest.
- Starting another exercise leaves unrelated rests active.
- Starting at or beyond zero records actual rest through the existing timestamped
  reducer action.
- Undoing while rest is active returns the row to its existing ready-state behavior
  and clears presentation that no longer applies.
- Local feedback for a collapsed exercise expands only that panel and never steals
  focus.
- A closed History disclosure remains quiet while eager loading succeeds, returns
  empty, or fails.
- At 375px, long names and timer text must not obscure actions, create horizontal
  overflow, or hide the focused control.

## Migration and Deployment

None. No production data, environment, Firestore, auth, rules, migration, or
deployment action is required by the feature itself.

## Testing Strategy

Behavior tasks use TDD.

### Active-workout tests

- Rest countdown and overtime appear beside the same exercise's next ready Start
  control and not on the completed row.
- Start remains usable during remaining rest and overtime and closes its predecessor
  through existing reducer behavior.
- Active rest is not a blocker to starting that next set.
- Final sets show no rest.
- Two concurrent rests complete and announce independently.
- Starting one next set clears only its predecessor rest and related announcement.
- Compact completed rows start collapsed and expanded details expose the approved
  performance/timing/Undo content.
- Undo eligibility remains unchanged.
- Invalid confirmation and blocked Start errors are exercise-local, expand only the
  owner, preserve focus, and clear through the defined lifecycle.
- Blocked Finish feedback remains beside Finish and clears through its defined
  lifecycle.
- No visible global status banner remains; the hidden rest-only live region retains
  once-per-attempt semantics.
- Collapsed header status and existing automatic focus transitions remain correct.

### History tests

- History disclosure starts closed with correct button semantics.
- Activating it opens conditionally rendered content.
- `getHistory` still starts eagerly from `WorkoutView` while closed content remains
  absent.
- Loading, error, empty, legacy, v2, v3, malformed, ordering, and read-only behavior
  remains unchanged after opening.

### Verification commands and manual checks

- `npm test -- --run src/tests/WorkoutView.test.jsx`
- `npm test -- --run src/tests/WorkoutHistory.test.jsx`
- `npm run lint`
- `npm run build`
- Final integration: `npm test -- --run`
- Immediate per-task and repeated cumulative keyboard/focus/no-overflow checks at
  375px.

## Acceptance Criteria

- A non-final set's live rest appears beside the same exercise's next ready
  **Start set** control.
- Start remains available during countdown and overtime and records rest through
  unchanged reducer behavior.
- Final sets never start or display rest.
- Completed sets are compact by default and expand for full approved details and
  the guarded secondary Undo action.
- Collapsed headers expose textual timer or remaining-work status.
- No visible global rest/status banner remains.
- Sound, vibration, visibility behavior, and a hidden rest-only announcement remain.
- Exercise-triggered errors are contextual; Finish-triggered feedback remains by
  Finish.
- Workout History is one stable collapsed-by-default disclosure with unchanged
  content semantics after opening and unchanged eager fetching.
- No reducer, saved shape, duration unit, storage query/write, auth, migration, or
  deployment behavior changes.
- Existing concurrent-rest, interleaving, focus, Finish/save, and compatibility
  behavior remains covered.

## Review Notes

The feature-planner-advisor used the repository's nearest supported model fallback
because the preferred flagship planner model was unavailable in the current Codex
account.

The architecture/design review raised six findings. All were accepted:

- separate rest-announcement and contextual-error state and lifecycle;
- pin the exact preceding-record lookup and prohibit duplicate live readouts;
- define auto-expansion and no-focus-move behavior for local errors;
- define completed-row disclosure boundaries;
- keep the closed history disclosure quiet during eager loading;
- explicitly prohibit duration, reducer, schema, and storage changes.

The senior-developer planning review findings about artifact paths, eager-fetch
integration coverage, explicit disclosure mechanism, immediate manual checks,
dependencies, and PR/CI completion boundaries were accepted. One suggestion to put
blocked Finish feedback in the active exercise was rejected because it contradicted
the approved architecture decision that Finish-triggered feedback belongs beside
the workout-level Finish control. The reviewer accepted the explicit boundary and
recommended the final plan for approval.

After the UX Quality Gate was merged to `main`, a fresh read-only
`ux-design-reviewer` retroactively reviewed
`UX-ARTIFACT: active-workout-focus-usability@v1`, the approved design, and the
implementation plan. It found no blocking or material UX issue and no product,
architecture, data, auth, migration, persistence, or scope change. It confirmed that
UX-11-01 through UX-11-04 proportionally cover the planned flows, that all planning
capability and execution fields remain `not-probed` / `not-run` / `not-tested`, and
that TREK-201 and TREK-202 carry the required fresh probe, coordinator-owned rendered
evidence, and fresh `ux-usability-reviewer` obligations. Recommendation: ready for the
implementation-authorization gate; the review does not itself authorize
implementation. Its optional clarification to use separate canonical evidence fields
during execution is incorporated above.

No durable EPIC-6 workflow follow-up was identified. The model failure was an
account capability limitation, and the documented nearest-tier fallback completed
both planning reviews without changing the workflow contract.

## Approved Implementation Plan

### Task 1: Establish the epic feature branch and durable approved spec

**Trekker:** TREK-200

- Create `codex/active-workout-focus-usability` from `main` at `ce5a389`.
- Save this approved design and implementation plan at this path.
- Commit only the planning artifact.
- Record the branch, spec path, and planning commit hash on EPIC-11.
- Add a `Summary:` and complete only Task 1.
- Leave Tasks 2-4 `todo` pending fresh explicit user approval.

Verification is immediate: branch/base, committed spec, epic references, Task 1
Summary, and worktree status must agree. The user-owned untracked `dev-dist/` is
outside scope and remains untouched. TDD does not apply to this planning-only task.

### Task 2: Focus active-workout actions and contextual feedback

**Trekker:** TREK-201

**Depends on:** TREK-200

**Files:**

- `src/components/WorkoutView.jsx`
- `src/index.css`
- `src/tests/WorkoutView.test.jsx`

Write failing tests for the approved next-set rest presentation, Start availability,
completed disclosure, error ownership/lifecycle, hidden rest-only announcements,
and preserved header/focus behavior. Implement only view-local helpers and state
needed for those behaviors. Do not modify reducer, timing, schema, storage, history,
auth, or Firebase files.

Immediate verification:

- `npm test -- --run src/tests/WorkoutView.test.jsx`
- `npm run lint`
- `npm run build`
- coordinator-owned rendered evidence for UX-11-01, UX-11-02, and UX-11-03 after a
  fresh bounded harness probe, including keyboard, focus, feedback retirement,
  collapse/recovery, concurrency, reach, and overflow checks at the requested 375px
  viewport.

Use a fresh implementor, task-scoped code simplifier, fresh code reviewer, and fresh
task-conformance reviewer. After simplification and coordinator-owned rendered
verification, run a fresh `ux-usability-reviewer` in parallel with code and
task-conformance review. Missing required rendered evidence blocks completion and
requires a resumable `Checkpoint:`. Commit only the scoped task diff and complete it
with a `Summary:` containing RED/GREEN, capability-probe, rendered-evidence, and
review evidence.

### Task 3: Add the interim whole-history disclosure

**Trekker:** TREK-202

**Depends on:** TREK-200

**Files:**

- `src/components/WorkoutHistory.jsx`
- `src/index.css`
- `src/tests/WorkoutHistory.test.jsx`
- `src/tests/WorkoutView.test.jsx`

Write failing disclosure and eager-fetch integration tests. Implement the explicit
button/controlled-region disclosure and conditionally render existing content only
when open. Do not change `WorkoutView` fetching, storage, schema, navigation,
individual history cards, pagination, filtering, search, or TREK-97.

Immediate verification:

- `npm test -- --run src/tests/WorkoutHistory.test.jsx`
- `npm test -- --run src/tests/WorkoutView.test.jsx`
- `npm run lint`
- `npm run build`
- coordinator-owned rendered evidence for UX-11-04 after a fresh bounded harness
  probe, including closed quietness, open loading/error/empty/content states,
  keyboard, focus, continued-workout nonblocking behavior, and overflow checks at
  the requested 375px viewport.

Use a fresh implementor, task-scoped code simplifier, fresh code reviewer, and fresh
task-conformance reviewer. After simplification and coordinator-owned rendered
verification, run a fresh `ux-usability-reviewer` in parallel with code and
task-conformance review. Missing required rendered evidence blocks completion and
requires a resumable `Checkpoint:`. Commit only the scoped task diff and complete it
with a `Summary:` containing RED/GREEN, capability-probe, rendered-evidence, and
review evidence.

Task 2 and Task 3 share only scoped stylesheet work and have no behavioral
dependency. Both depend directly on Task 1. The coordinator executes them serially
and preserves scoped CSS ownership.

### Task 4: Complete final integration and publish the draft PR

**Trekker:** TREK-203

**Depends on:** TREK-201 and TREK-202

Invoke `$epic-development-branch-completion`, verify task commit and Summary
boundaries, run full tests/lint/build and cumulative 375px rendered checks against
UX-11-01 through UX-11-04, and run independent epic code and fresh epic conformance
reviews over the cumulative branch.
Route accepted source fixes through the owning implementation-task continuation,
then renew affected task reviews and both final-integration gates.

Push the branch and open a draft PR. CI is deferred only until that PR exists:

- trigger: pushed draft PR;
- owner: main coordinator;
- evidence: PR URL plus required check names, URLs, and final statuses;
- Task 4 stays `in_progress` until both final reviews, draft PR, and required passing
  CI evidence are recorded.

After Task 4 receives its `Summary:` and completes, EPIC-11 remains open pending an
explicit user review/merge decision. Opening the draft PR never silently closes the
epic.

## Dependencies

```text
TREK-201 depends on TREK-200.
TREK-202 depends on TREK-200.
TREK-203 depends on TREK-201 and TREK-202.
```

## Execution Approval Boundary

Approval of this design, Trekker structure, and planning Task 1 does not authorize
feature implementation. TREK-201, TREK-202, and TREK-203 remain `todo` until the
user gives a separate fresh explicit approval to continue.
