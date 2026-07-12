# Set-Level Tracking & Automatic Progressive Overload

**Status:** Approved

**Approved:** 2026-07-12

**Trekker epic:** EPIC-2

**Supersedes:** `docs/superpowers/specs/2026-07-04-weight-tracking-design.md`

## Problem

The app currently saves generated catalog exercise snapshots when a workout is
finished, but it tracks completion only in transient exercise-level UI state.
It does not persist actual set performance, so it cannot adjust later sets for
fatigue or recommend future weights.

## Goals

- Persist actual set-level performance.
- Recommend weighted top sets from completed history.
- Adjust backoff recommendations immediately from current-session performance.
- Keep every recommendation overridable.
- Track full, assisted, and eccentric bodyweight reps separately.
- Preserve historical prescriptions and recommendation provenance.
- Migrate safely without guessing settings.
- Explain why a weight was recommended.

## Non-goals

- Active-workout autosave or refresh recovery.
- Editing completed history.
- Kilograms or unit conversion.
- Automatic bodyweight, assisted, eccentric, or duration progression.
- Quantified assistance.
- Rewriting legacy history.
- Denormalized progression-anchor documents.
- Production deployment work.

Refresh loss remains a known EPIC-2 limitation and should be handled as a
separate feature.

## Exercise modes

- `simple`: current exercise-level completion without set details or
  progression.
- `weighted`: pounds and reps with automatic top-set and backoff
  recommendations.
- `bodyweight`: full, assisted, and eccentric rep tracking without automatic
  recommendations.

A missing `trackingMode` resolves to `simple`. Existing and new exercises
default to `simple`; users opt into detailed tracking explicitly.

Mode-specific configuration may remain stored when switching modes, but it is
ignored until that mode is re-enabled and revalidated.

## Catalog model

Preserve the existing numeric `sets` field because Settings and workout time
calculations depend on it:

```js
{
  id,
  name,
  muscleGroup,
  tier,
  sets,
  linkedTo,
  isActive,
  trackingMode
}
```

Weighted fields:

```js
{
  startingWeight,
  targetReps,
  floorReps,
  weightStep
}
```

Bodyweight fields:

```js
{
  targetReps
}
```

### Validation

- `sets` is an integer from 1 through 10.
- `startingWeight` is a finite number at least zero.
- `targetReps` is a positive integer.
- `floorReps` is an integer at least zero and below `targetReps`.
- `weightStep` is a finite number greater than zero.
- Actual weights are finite numbers at least zero.
- Actual reps and bodyweight counts are nonnegative integers.

Invalid tracked configuration cannot be saved. If malformed tracked catalog
data is later loaded, generation reports the affected exercise and directs the
user to Settings; it does not silently downgrade the exercise to `simple`.

## Saved workout model

Do not overload the existing numeric `sets` field with an array. New workouts
use an additive versioned schema:

```js
{
  schemaVersion: 2,
  status: "completed",
  date,
  actualDuration,
  exercises: []
}
```

Workout status `completed` means Finish successfully persisted the session. It
does not mean every prescribed set succeeded or was performed.

Each exercise occurrence snapshots:

- Identity and scheduling fields.
- `trackingMode`.
- Numeric `sets`.
- Explicit `prescribedSetCount`.
- Mode-specific configuration.
- Recommendation targets and actual performance.

Tracked occurrences use `setRecords`.

Weighted record:

```js
{
  index,
  targetWeight,
  targetReps,
  actualWeight,
  actualReps,
  completed,
  recommendationReason
}
```

Bodyweight record:

```js
{
  index,
  targetReps,
  fullReps,
  assistedReps,
  eccentricReps,
  completed
}
```

Simple occurrences store an exercise-level `completed` flag.

Weighted top-set provenance stores structured fields:

```js
{
  decision,             // starting | increase | hold | decrease
  sourceWorkoutId,
  sourceWorkoutDate,
  sourceAnchorWeight,
  appliedWeightStep,
  recommendedWeight,
  reasonCode
}
```

Provenance is snapshotted so later catalog edits cannot rewrite the historical
explanation.

## Completion semantics

- A set is completed when the user explicitly confirms the logged attempt.
- A simple exercise is performed when its checkbox is confirmed.
- A tracked exercise is performed when at least one set is confirmed.
- Target attainment is independent of completion.
- Bodyweight performance may be confirmed below target, including a zero-rep
  failed attempt.
- `fullReps + assistedReps + eccentricReps` is total performed. Every category
  counts toward the target while remaining separately visible.
- Finish may save an incomplete workout after warning about unconfirmed work.
- A workout with no confirmed work is not saved.

## Scheduling semantics

Use one schema-aware `wasPerformed` predicate for stale dates, Tier-1 pivot
rotation, and leg-day recency:

- V2 simple: `completed === true`.
- V2 weighted or bodyweight: at least one `setRecord.completed === true`.
- Legacy workout: preserve current presence-based behavior because completion
  is unknowable.
- Malformed v2 occurrence: fail closed as not performed; do not give it legacy
  semantics.

Any confirmed v2 work therefore affects scheduling recency, while a completely
skipped occurrence does not. A partially performed Tier-3 leg exercise counts
as a leg-day occurrence. Progression eligibility remains independent and
stricter.

## Next-session weighted algorithm

Find the newest valid completed v2 weighted occurrence for the same stable
exercise ID that has a completed top set.

Skip:

- Legacy occurrences.
- Simple and bodyweight occurrences.
- Malformed weighted records.
- Non-completed workout documents.
- Occurrences without a completed top set.

If no valid anchor exists after history loads successfully, use
`startingWeight`.

The algorithm has two stages.

### Stage 1: evaluate historical eligibility

Use the source occurrence's snapshotted `targetReps`, `floorReps`,
`prescribedSetCount`, set completion, and actual performance:

```text
top reps < source floor
=> decrease

top reps >= source target
AND every source prescribed set was completed
AND every source backoff set reached source floor
=> increase

otherwise
=> hold
```

A completed top set with skipped backoffs holds unless it was below the floor.
A top set below the floor decreases after one session.

### Stage 2: apply current configuration

Anchor at the source top set's actual weight:

- Increase: add the current catalog `weightStep`.
- Decrease: subtract the current catalog `weightStep`.
- Hold: apply zero.
- Clamp at zero.
- Never apply more than one current step.

The source occurrence's old increment is historical information only. Current
configuration is then snapshotted into the generated workout.

A manual top-set override becomes the next anchor. `startingWeight` is only a
no-anchor fallback, so no reset control is needed.

Catalog set-count changes are prospective. A qualifying historical three-set
workout can earn progression into a newly configured four-set workout.

## Within-session backoff algorithm

Set 1 receives the generated top-set target. Later sets unlock sequentially
within that exercise, while exercises may be interleaved.

For prior actual weight `W`, reps `R`, current session floor `F`, and
snapshotted step `S`:

```text
raw =
  R >= F
    ? W
    : max(0, W - S * min(F - R, 3))

nextTarget =
  min(raw, sessionTopTarget, all prior assigned targetWeight values)
```

The prior-target minimum is a monotonic ceiling. The user may override upward,
but the app never automatically recommends climbing again during that session.

For floor 6 and step 5 lb:

- 5 reps drops 5 lb.
- 4 reps drops 10 lb.
- 3 or fewer reps drops 15 lb.

Additional rules:

- Use actual weight, including overrides.
- Clamp at zero.
- The last set below the floor has no next-set effect but prevents progression.
- Confirmed sets form a contiguous prefix.
- Confirmed actual values remain editable until Finish.
- Confirmed targets are never rewritten.
- Corrections recompute only unconfirmed downstream recommendations.
- Later confirmed sets are never silently changed.
- Only the last confirmed set may be unconfirmed.

## User experience

### Settings

- Add tracking-mode selection.
- Show only the active mode's fields.
- Validate inline.
- Label weighted values in pounds.

### Active workout

- Simple exercises retain exercise-level confirmation.
- Tracked exercises expand into individual set rows.
- Weighted actual weight and reps are prefilled from recommendations but do not
  count until explicitly confirmed.
- Bodyweight rows expose full, assisted, and eccentric counters plus their
  total.
- Sets unlock sequentially within each exercise.
- Different exercises may be interleaved.
- Recommendation changes display concise reasons.
- Finish shows a compact summary and highlights incomplete work.

Example explanations:

- `+10 lb: prior top set reached its target and all 3 sets stayed above its floor; current increment is 10 lb.`
- `Held: set 3 fell below the floor.`
- `-10 lb: 4 reps, floor 6.`

### History

- Legacy entries remain readable in summarized form.
- Weighted entries show target versus actual and recommendation rationale.
- Bodyweight entries show full, assisted, and eccentric categories and total.
- Completed history remains read-only.

## Storage and failures

- Continue saving one additive document under `users/{uid}/history`, only on
  Finish.
- Existing Firestore ownership rules require no shape change.
- Local React state powers live recommendations.
- History-load failure during generation blocks generation with a retry action;
  it never falls back to `startingWeight`.
- A later history-display failure remains non-blocking.
- Save failure keeps the active workout visible and retryable. `onFinish` runs
  only after successful persistence.
- Malformed documents remain render-safe but are ignored by progression.
- Normalize history order before newest-first scanning rather than relying only
  on Firestore's ascending result.
- Full client-side history scanning is acceptable for this epic but remains a
  documented scaling risk.

## Migration

- Do not bulk-rewrite history or catalog documents.
- A missing catalog mode resolves to `simple`.
- Existing defaults and catalog documents remain usable.
- Legacy history remains readable and keeps existing presence-based scheduling
  behavior.
- Legacy history cannot anchor weighted progression.
- Existing localStorage migration preserves legacy shapes.
- New generated and saved occurrences snapshot all relevant configuration and
  performance.

## Architecture ownership

- The existing engine retains exercise selection and time budgeting.
- Pure progression helpers own anchor selection, eligibility, and backoff
  calculations.
- Generation enriches selected exercises after selection.
- `WorkoutView` owns local editable workout state and sequential confirmation.
- Storage owns retrieval and serialization only.

## Testing strategy

- Progression unit tests cover starting, increase, hold, decrease, incomplete
  sets, overrides, legacy and malformed history, history order, changed
  configuration, zero clamp, and scaled drops.
- Scheduling tests cover partial, skipped, malformed-v2, and legacy occurrences
  across stale dates, pivots, and leg-day recency.
- Engine integration tests prove selection and time budgeting remain stable.
- UI tests cover all modes, sequential locking, edits, unconfirmation,
  recommendation reasons, summaries, and retries.
- Settings tests cover validation and migration compatibility.
- Storage tests cover legacy/v2 compatibility and serialization.
- Firestore rules tests continue to verify same-user access and deny
  unauthenticated or cross-user access.
- Final verification runs the full tests, warning-free lint, build, and rules
  checks.

## Acceptance criteria

- Next-session and backoff algorithms produce deterministic results for every
  defined branch.
- Below-floor performance immediately changes the next set recommendation.
- An increase requires every prescribed set and every backoff at or above the
  historical floor.
- A below-floor top set causes a one-current-step next-session reduction.
- Overrides establish the future anchor.
- Catalog edits do not reinterpret old workouts.
- Recommendation rationale remains historically accurate after configuration
  changes.
- Bodyweight history distinguishes full, assisted, and eccentric reps.
- Legacy data remains usable without guessed progression settings.
- V2 skipped exercises do not alter scheduling.
- Save failures never discard the active workout.
- No unfinished workout document is persisted before Finish.

## Implementation constraints

The following choices are fixed for EPIC-2:

- Public persisted schema and mode semantics.
- Pure schema, progression, and active-state boundaries.
- Exact progression and current-step behavior.
- Additive Firestore history collection.
- Save-on-Finish persistence boundary.
- Full client-side history scan for this version.
- No new dependencies, collections, Firestore-rules expansion, draft
  persistence, or completed-history editing.

Internal helper names, reducer action names, small component extraction, and
presentation wording remain implementation discretion when they preserve this
contract.
