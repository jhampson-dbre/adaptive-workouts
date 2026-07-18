# Mobile Active-Workout Focus and Interim History Disclosure

**Status:** Approved for implementation planning

**Date:** 2026-07-17

**Trekker epic:** EPIC-11

**Planning task:** TREK-200

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
- keyboard, focus, contextual-message, disclosure, and overflow checks at 375px.

Use a fresh implementor, task-scoped code simplifier, fresh code reviewer, and fresh
task-conformance reviewer. Commit only the scoped task diff and complete it with a
`Summary:` containing RED/GREEN and verification evidence.

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
- keyboard, focus, disclosure, and overflow checks at 375px.

Use a fresh implementor, task-scoped code simplifier, fresh code reviewer, and fresh
task-conformance reviewer. Commit only the scoped task diff and complete it with a
`Summary:` containing RED/GREEN and verification evidence.

Task 2 and Task 3 share only scoped stylesheet work and have no behavioral
dependency. Both depend directly on Task 1. The coordinator executes them serially
and preserves scoped CSS ownership.

### Task 4: Complete final integration and publish the draft PR

**Trekker:** TREK-203

**Depends on:** TREK-201 and TREK-202

Invoke `$epic-development-branch-completion`, verify task commit and Summary
boundaries, run full tests/lint/build and cumulative 375px manual checks, and run
independent epic code and fresh epic conformance reviews over the cumulative branch.
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
