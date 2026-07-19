# Per-Set Workout Timing and Focused Exercise Flow

**Status:** Approved for implementation planning

**Date:** 2026-07-14

**Trekker epic:** EPIC-8

## Problem

The active workout has one total-workout timer at the top of the page. It becomes
unreachable after the user scrolls into a longer workout, and it cannot capture
set-level work or rest duration. All exercises also remain expanded, so completed
work occupies the same space and visual priority as the current set.

## Goals

- Put work and rest timing controls directly in every prescribed set row.
- Allow one active work timer globally and concurrent rest timers across exercises.
- Collapse exercises so current and upcoming work remain prominent without hiding
  timer state.
- Save and display planned rest, actual work duration, and actual rest duration.
- Keep timer calculations accurate after browser throttling or returning to the app.
- Give simple, weighted, and bodyweight modes a consistent set-level workflow.
- Preserve legacy and schema-v2 history, scheduling, and weighted progression.
- Preserve a stable occurrence-plus-set identity that future guided supersets can use.
- Make timing, completion, and focus behavior accessible without relying on color,
  sound, or vibration.

## Non-Goals

- Active-workout recovery after refresh or crash.
- Pause and resume controls.
- Push, service-worker, or background notifications.
- Duration prediction, analytics, or forecasting.
- Guided supersets or exercise grouping.
- Backfilling timing into legacy or v2 workouts.
- Authentication, Firestore-rule, deployment, merge, or production-release changes.

## User Experience

### Starting and timing work

- Retain the explicit **Start Workout** action and a compact total elapsed timer.
- Before the workout starts, set controls are disabled and reference explanatory
  text.
- Render one row per prescribed set in simple, weighted, and bodyweight modes.
- A ready row offers **Start set**. Only one set may time work at a time across the
  workout.
- The active row shows a work count-up, **Confirm attempt**, and **Cancel timer**.
- Confirmation requires valid mode-specific performance inputs. It records the work
  duration and, except on the exercise's final set, starts rest on the confirmed row.
- Cancel clears the unconfirmed work start without recording work or beginning rest.

### Rest timing

- Rest counts down from the snapshotted target and then displays clearly labeled
  overtime.
- Starting the next set of the same exercise ends the preceding set's rest and
  records actual rest duration.
- Work from another exercise does not end the rest, so rests may overlap across
  exercises.
- Final sets never start rest.
- Confirmed rows display their work duration and planned-versus-live-or-ended rest.

### Exercise focus and collapsing

- Each exercise header is an accessible expand/collapse button with confirmed/total
  sets and non-color work/rest status.
- Initially expand the first incomplete exercise and collapse the others.
- Starting a set expands its exercise.
- Confirming an exercise's final set collapses it and expands the next incomplete
  exercise.
- Automatic changes affect only the current and next-focus panels; unrelated manual
  expansion choices remain intact.
- After automatic collapse, focus moves to the next ready Start control or exercise
  header. If the workout is complete, focus moves to **Finish Workout**.
- Undoing a final completion re-expands that exercise.

### Alerts and background behavior

- Per-second timer values are not live-announced. A dedicated status region announces
  semantic transitions such as rest completion or a blocked start.
- When a visible active workout observes rest cross zero, show a persistent overtime
  state and provide best-effort sound and vibration.
- Sound and vibration are supplementary; unsupported APIs fall back silently to the
  visible and textual state.
- If rest crosses zero while the app is hidden, show accurate overtime on return but
  suppress delayed sound, vibration, and live announcement.

## Behavior Rules

- Sets remain sequential within each exercise, while exercises may be interleaved.
- The active-workout reducer owns timer identities and transition timestamps.
- `WorkoutView` owns one shared current-time render tick; per-second ticks never
  mutate reducer state.
- All elapsed values use:

  ```js
  Math.max(0, Math.round((endedAt - startedAt) / 1000))
  ```

- Zero seconds is valid.
- Starting set `n > 0` first closes set `n - 1`'s active rest for the same occurrence,
  then starts work.
- Undo remains limited to the latest confirmed-prefix set and is prohibited after its
  rest has ended by starting the next same-exercise set.
- Undo cancels live rest and clears completion, work duration, and actual rest while
  preserving planned rest and entered performance values.
- Weighted undo also relocks the immediate next set and restores its
  awaiting-prior-set recommendation state.
- Finish is blocked while work is active and directs the user to confirm or cancel.
- Finish creates an immutable candidate without mutating active reducer state. Its
  timestamp resolves every live rest and total duration in the candidate.
- Back discards the candidate while the underlying workout and rest clocks continue.
  A later Finish creates a fresh candidate with the later timestamp.
- A failed-save retry reuses the identical frozen candidate so timings cannot drift.
- Partial workouts may save after at least one set is confirmed.

## Rest Settings and Generated Configuration

- Add user setting `defaultRestSeconds`.
- Missing or invalid user defaults normalize to 60 seconds.
- Add optional catalog field `restSeconds`; clearing it restores inherited behavior.
- Settings accepts whole values from 5 through 600 seconds.
- An invalid explicit catalog override follows the existing invalid-catalog error
  path rather than silently falling back.
- Generation snapshots the effective target into each non-final set:

  ```js
  exercise.restSeconds ?? settings.defaultRestSeconds ?? 60
  ```

- Final sets use `plannedRestSeconds: null`.
- Settings changes after generation do not alter an active or historical workout.
- Existing user settings and catalog items require no migration.

## Schema V3 and Compatibility

### Workout envelope

New completed workouts use schema version 3:

```js
{
  schemaVersion: 3,
  status: 'completed',
  date,
  actualDurationSeconds,
  exercises: [],
}
```

`actualDurationSeconds` is the only v3 total-duration field. It is a nonnegative
integer derived from the Finish timestamp and workout start timestamp using the
shared elapsed calculation. V3 does not persist `actualDuration`.

Schema v2 remains unchanged: `actualDuration` keeps its established minute value and
history presentation. Legacy records are unchanged. No existing record is rewritten.

### Occurrence and set identity

- Generation assigns each occurrence one immutable `occurrenceId`, unique within the
  generated workout, using catalog ID plus the final generation ordinal as an opaque
  value.
- Set identity is `(occurrenceId, setRecords[index].index)`.
- Catalog `id`, not `occurrenceId`, remains the cross-workout progression identity.

### Set records

All v3 modes use `setRecords`. Each record includes:

```js
{
  index,
  completed,
  plannedRestSeconds,
  workDurationSeconds,
  actualRestSeconds,
}
```

- `plannedRestSeconds` is a valid configured integer for non-final sets and `null`
  for final sets.
- A saved confirmed set requires a nonnegative integer `workDurationSeconds`.
- A saved confirmed non-final set also requires a nonnegative integer
  `actualRestSeconds` because Finish resolves every live rest.
- Unconfirmed and final sets use `actualRestSeconds: null` where rest does not apply.
- Active state may temporarily hold a confirmed non-final set with
  `actualRestSeconds: null` while its rest remains live.
- Weighted and bodyweight records retain their existing target, actual, and
  recommendation fields.
- Simple mode has no v3 occurrence-level completion flag. It is performed when at
  least one set is confirmed.
- Reducer timestamps, input dirty flags, and alert bookkeeping never persist.

### Classification, history, and progression

- Document classification distinguishes `legacy`, `valid-v2`, `valid-v3`, and
  `malformed-versioned`. Unsupported schema versions are malformed versioned data.
- Preserve current v2 behavior: a valid v2 envelope may render valid occurrences
  around one malformed occurrence, with only the malformed row unavailable.
- Progression considers only valid v2 weighted occurrences from eligible v2
  envelopes.
- Schema-v3 validity is a whole-document timing invariant. A malformed v3 workout is
  unavailable as a whole and cannot drive progression.
- Valid v3 weighted occurrences explicitly remain eligible progression anchors.
- Legacy and v2 history presentation remains unchanged.
- V3 history shows total duration from `actualDurationSeconds` and per-set planned
  rest, work duration, actual rest, and overtime comparison.

## Failure and Edge Cases

- Negative wall-clock deltas clamp to zero.
- Browser interval throttling cannot lose time because display and persistence derive
  from timestamps.
- Each rest completion alert fires once per rest attempt, including after
  undo/reconfirm creates a new attempt.
- Manual collapse cannot hide timing state because the header retains status.
- Duplicate catalog exercises remain distinct through immutable occurrence IDs.
- Cancel, undo, and weighted relocking cannot leave downstream sets unlocked or
  timing fields incoherent.
- Finishing resolves all outstanding rests using one Finish timestamp.
- V3 save failures retain the frozen candidate and existing account-bound retry
  safeguards.

## Testing Strategy

- Duration helper tests cover rounding, zero, clock rollback, and Finish timestamps.
- Reducer tests inject timestamps and cover global work exclusivity, sequential
  locking, exercise interleaving, concurrent rests, same-exercise rest closure,
  overtime, cancel, undo/reconfirm identity, weighted relocking, and Finish
  resolution.
- Schema tests cover active versus saved timing invariants, occurrence uniqueness,
  all modes, malformed v3, transient-field stripping, and legacy/v2 compatibility.
- Generator tests cover all-mode records, occurrence identity, inherited and
  overridden rest targets, and final-set null behavior.
- Progression tests cover v3 anchors, malformed-v3 exclusion, partial-invalid-v2
  fallback, and unchanged ordering and recommendations.
- UI tests use fake time for Start Workout, inline controls, completed-row timing,
  collapsed-header discovery, concurrent rests, manual and automatic collapse,
  focus transfer, visibility resume, once-only alerts, and non-live per-second text.
- Settings tests cover normalization, 5-600 validation, and clearing overrides.
- History tests cover v3 timing plus unchanged legacy/v2 and malformed behavior.
- Finish tests cover Finish to Back to later Finish and failed save to identical retry.
- Each implementation task runs its targeted tests plus the approved broader tests,
  lint, build, manual checks, and fresh code/conformance reviews as specified in
  Trekker.

## Acceptance Criteria

- Timing controls remain reachable without scrolling to the page top.
- Completed exercises no longer dominate the viewport, while collapsed headers
  expose active timing state.
- Every confirmed v3 set saves coherent work duration.
- Every confirmed non-final v3 set saves planned and actual rest.
- V3 saves only `actualDurationSeconds`; v2 duration semantics remain unchanged.
- Resume calculations remain timestamp-accurate.
- Legacy and v2 history remain readable with existing partial-invalid-v2 behavior.
- V3 history exposes planned rest, work, and actual rest.
- Simple-mode performed semantics remain at least one confirmed set.
- Status and alerts remain understandable without sound, vibration, or color.
- Occurrence ID plus set index supports future grouping without replacing saved data.
- Valid v3 weighted workouts continue driving future recommendations.

## Delivery Sequence

The approved Trekker dependency chain is:

```text
TREK-107 -> TREK-108 -> TREK-109 -> TREK-110 -> TREK-111 -> TREK-112 -> TREK-113
```

Add v3 reading and building capability first while keeping the live writer on v2.
The live writer switches atomically only after the reducer, active UI, and v3 history
can produce and display coherent v3 documents. Each implementation task requires its
own TDD evidence, scoped commit, fresh code review, fresh task-conformance review, and
Trekker Summary before the next task begins. Final integration uses the repository's
epic-completion workflow and produces a draft PR without merging or deploying.

## Review Record

The feature-planner-advisor produced the design from the user-approved Discovery
Brief. The architecture-design-reviewer approved the design after targeted edits for
v3 timing invariants, timer ownership, v2 behavior, progression compatibility,
occurrence identity, accessibility, settings normalization, and Finish semantics.
The senior-developer-reviewer approved the seven-task execution plan after tightening
the v3 duration contract, intermediate compatibility, atomic writer cutover, alert
identity, and verification boundaries. The user explicitly approved
`actualDurationSeconds` as the canonical v3 total duration.
