# Workout Phase Timing

**Status:** Approved design; implementation pending EPIC-11 integration and fresh authorization

**Date:** 2026-07-18

**Trekker epic:** EPIC-12

**Planning task:** TREK-217

**Branch:** `codex/workout-phase-timing`

## Summary

Add explicit Warmup, Performance, and Cooldown phases around the existing set-level
work/rest flow. Persist canonical planned targets and exact cumulative actual phase
durations in schema v4, restore interrupted active workouts within the same browser,
coordinate tabs with an exclusive Web Lock, and save completed workouts through an
immutable stable-ID protocol.

This feature is a functional prerequisite for the Resolve Interface System (EPIC-13).
It supplies truthful phase, overtime, recovery, conflict, and completion states with
minimal controlled presentation. Resolve may later restyle those states but may not
change their lifecycle, persistence, security, or accessibility semantics.

Planning Task A1 is documentation-only and may complete before EPIC-11 is integrated.
A2 and every product implementation task remain blocked until:

1. TREK-203, EPIC-11’s final-integration task, is complete.
2. EPIC-11 is actually integrated into the target `main` branch.
3. The user gives fresh authorization to start A2.

## Problem

The application currently measures total workout time and set-level work/rest, but
does not model the full workout lifecycle. Warmup is a setting rather than a timed
phase, cooldown does not exist, completed history cannot explain how time was divided,
and an accidental reload can silently discard an active session. Saving also lacks a
stable operation identity that can distinguish an exact replay from a divergent
overwrite after an uncertain response.

The result is incomplete timing truth at the same moment the product needs reliable
phase state for recovery and for the dependent Resolve interface.

## Goals

- Add first-class Warmup, Performance, and Cooldown phases without replacing the
  existing set-level work/rest model.
- Let users begin Performance before Warmup reaches its planned target and finish
  Cooldown before or after its target.
- Display zero and overtime without automatic phase transitions.
- Preserve a nondecreasing, cumulative phase ledger through undo, cooldown re-entry,
  Review/Back, browser sleep, and wall-clock changes.
- Save exact whole-second planned and actual phase durations with a phase-sum
  invariant in schema v4.
- Restore valid active work after reload and prevent concurrent mutation by two tabs.
- Make save retry idempotent with a stable UUID, canonical fingerprint, immutable
  document path, and server-only reconciliation.
- Preserve all legacy, schema-v2, schema-v3, progression, authentication, catalog,
  generation, and EPIC-11 behavior except the approved final-set focus destination.
- Provide accessible minimal phase and recovery presentation that the Resolve epic
  can consume without redesigning behavior.

## Non-goals

- Pause/resume clocks, background notifications, server-side active-session sync, or
  recovery across devices or browsers.
- New workout generation, progression, recommendation, scheduling, or readiness
  algorithms.
- Rewriting or backfilling legacy, v2, or v3 history.
- Analytics, forecasts, trend calculations, calorie estimates, or physiological
  inference.
- A visual redesign, marketing identity, gamification, or the final Resolve component
  system.
- Offline multi-device conflict resolution or general-purpose distributed locking.
- Deleting history, editing a saved workout, or allowing a mutable history document.
- Changing authentication, user ownership, catalog rules, or root user-document
  behavior beyond the narrowly approved history path.

## User journey and phase boundaries

```text
Plan / generated readiness
  → Start Workout
Warmup
  → Start first set
Performance
  → confirm final outstanding set
  → or confirm early finish after completed work
Cooldown
  → Finish Workout
Review
  → Save / retry / exit
Saved history
```

### Warmup

- **Start Workout** begins the global elapsed clock and Warmup at one injected epoch
  timestamp.
- The Warmup display counts down from the snapshotted target, reaches zero, then
  displays labeled overtime.
- Zero never advances the workout automatically.
- Starting the first valid set ends the current Warmup interval and enters
  Performance at the same transition timestamp.
- Starting before the planned target is valid. Cancelling that set’s work timer does
  not return to Warmup.
- A zero-minute target still creates an explicit Warmup state at zero/overtime until
  the user starts the first set or cancels.

### Performance

- Performance owns all existing EPIC-11 work/rest, sequential-set, interleaving,
  undo, collapse, alert, and focus behavior.
- The existing global elapsed timer continues; phase timing does not replace or
  duplicate per-set work/rest timing.
- Confirming the final outstanding set closes the current Performance interval and
  enters Cooldown at the same timestamp.
- The final automatic focus destination changes from **Finish Workout** to the
  Cooldown `h1`. This is the only approved EPIC-11 behavior change.
- Undoing that final completion from Cooldown closes the current Cooldown interval,
  re-enters Performance at the same timestamp, and restores existing EPIC-11
  completion/focus rules.
- An early-finish request with at least one completed set requires confirmation. On
  confirmation, all active work/rest state resolves according to the existing Finish
  candidate rules and the session enters Cooldown.
- An early-finish request with no completed work cancels the active session after the
  approved confirmation path; it does not enter Cooldown or create history.

### Cooldown

- Cooldown counts down from its snapshotted target, reaches zero, and displays labeled
  overtime without automatic completion.
- **Resume Workout** returns to Performance. Time already spent in Cooldown remains in
  the cumulative Cooldown duration; a later re-entry continues the same total.
- **Finish Workout** closes the current Cooldown interval and opens a frozen Review
  candidate at the same timestamp.
- Cooldown may finish early, at target, or in overtime.

### Review and completion

- Review is not an active timed phase. Time spent in Review is excluded from all
  phase durations and from the completed workout total.
- **Back** from Review restores the underlying active workout in Cooldown and rebases
  the open Cooldown boundary to the Back timestamp. The Review gap never accrues.
- A later Finish creates a fresh candidate with later active-phase time but still
  excludes every Review gap.
- A failed-save retry reuses the exact frozen candidate, stable workout ID, canonical
  fingerprint, and payload. Timing cannot drift across retries.
- Save success or exact server reconciliation clears the recovery slot. An
  indeterminate or divergent result retains actionable pending state.

## Settings and immutable plan targets

### Canonical settings

The canonical settings fields are:

```js
{
  warmupSeconds,
  cooldownSeconds,
}
```

Each is an integer multiple of 60 in the inclusive range `0..3600`. The Settings UI
edits whole minutes from 0 through 60 and converts at the storage boundary. A value
outside the range, a fraction, a non-finite number, or a non-minute multiple is
invalid rather than silently rounded.

`warmupTime` remains a legacy fallback only. When canonical `warmupSeconds` is absent,
a valid legacy whole-minute `warmupTime` is converted to seconds and normalized to the
same `0..3600` contract. Once `warmupSeconds` exists, `warmupTime` cannot override it.
New writes use canonical fields. Existing rest settings and catalog overrides remain
unchanged.

The default Cooldown target is 300 seconds. Existing Warmup fallback/default behavior
remains equivalent after unit conversion.

### Generated snapshot

Generation adds an immutable phase target snapshot without changing exercise
selection, ordering, recommendations, or the meaning of the existing generation
time budget:

```js
phaseTargets: {
  warmupSeconds,
  performanceSeconds,
  cooldownSeconds,
}
```

- `warmupSeconds` and `cooldownSeconds` come from normalized settings.
- `performanceSeconds` is the generation budget converted to seconds. It is a plan,
  not a promise or a sum of set timers.
- All three values are nonnegative integers.
- Settings changes after generation do not alter an active or saved workout.
- Phase targets are additive metadata and must not influence engine selection output.

## Duration and persistence contract

All persisted duration values use integer seconds. Epoch timestamps used by active
state and recovery use integer milliseconds and never appear in completed history.

### Duration field table

| Location | Field | Unit | Null/zero rule | Meaning |
| --- | --- | --- | --- | --- |
| Settings | `warmupSeconds` | seconds | zero allowed; never null when canonical | User’s canonical Warmup target |
| Settings | `cooldownSeconds` | seconds | zero allowed; never null when canonical | User’s canonical Cooldown target |
| Legacy settings | `warmupTime` | minutes | fallback-only; absent allowed | Converted only when canonical Warmup is absent |
| Generated plan | `phaseTargets.warmupSeconds` | seconds | zero allowed | Immutable Warmup plan |
| Generated plan | `phaseTargets.performanceSeconds` | seconds | zero allowed | Immutable generation budget |
| Generated plan | `phaseTargets.cooldownSeconds` | seconds | zero allowed | Immutable Cooldown plan |
| V4 history | `phaseDurations.warmup.plannedSeconds` | seconds | zero allowed | Snapshotted Warmup target |
| V4 history | `phaseDurations.warmup.actualSeconds` | seconds | zero allowed | Cumulative Warmup wall-clock time |
| V4 history | `phaseDurations.performance.plannedSeconds` | seconds | zero allowed | Generation budget, not expected set-time sum |
| V4 history | `phaseDurations.performance.actualSeconds` | seconds | zero allowed | Cumulative Performance wall-clock time |
| V4 history | `phaseDurations.cooldown.plannedSeconds` | seconds | zero allowed | Snapshotted Cooldown target |
| V4 history | `phaseDurations.cooldown.actualSeconds` | seconds | zero allowed | Cumulative Cooldown wall-clock time across re-entry |
| V3/V4 history | `actualDurationSeconds` | seconds | nonnegative integer | Exact sum of the three v4 actual phase durations |
| Active ledger | interval boundaries | epoch milliseconds | integers; no null for closed pair | Injected wall-clock boundaries used only while active |
| Set record | existing work/rest durations | seconds | existing v3 rules unchanged | EPIC-11 set-level timing, not phase timing |

### Schema v4 completed document

New production writes switch atomically from v3 to v4 only in A8. The v4 envelope is
an additive strict extension of the valid v3 completed document:

```js
{
  schemaVersion: 4,
  status: 'completed',
  date,
  actualDurationSeconds,
  phaseDurations: {
    warmup: { plannedSeconds, actualSeconds },
    performance: { plannedSeconds, actualSeconds },
    cooldown: { plannedSeconds, actualSeconds },
  },
  exercises: [],
}
```

The whole document is valid only when:

- every planned and actual phase value is a nonnegative integer;
- all existing v3 envelope, occurrence, set-record, mode, and identity invariants
  hold;
- at least one set is performed under the existing mode-specific rules;
- `actualDurationSeconds` exactly equals
  `warmup.actualSeconds + performance.actualSeconds + cooldown.actualSeconds`;
- the saved DTO contains no reducer timestamps, open intervals, ownership generation,
  recovery metadata, lock state, alert bookkeeping, or UI flags.

A malformed or unsupported versioned envelope is unavailable as a whole. It cannot
drive progression. Legacy, valid-v2, valid-v3, and their established partial-invalid
behavior remain unchanged. Valid v4 weighted occurrences remain eligible progression
anchors under the same catalog-ID and ordering rules as valid v3.

Firestore document IDs are authoritative. A payload-supplied `id` cannot override the
path ID or become a second mutable identity when history is loaded.

## Pure phase ledger

The active reducer owns a pure, injected-timestamp phase ledger. Rendering owns a
shared current-time tick; ticks never mutate reducer state.

The ledger records cumulative closed seconds per phase plus at most one open phase
boundary. Every transition receives one epoch-millisecond timestamp and uses it for
both sides of the boundary. Phase totals never derive from countdown intervals or
component render frequency.

### Elapsed calculation

For an open interval, compare the injected timestamp with the last accepted boundary:

```js
effectiveNow = Math.max(lastAcceptedEpochMs, timestamp)
elapsedSeconds = Math.max(0, Math.round((effectiveNow - openedAtEpochMs) / 1000))
```

The reducer advances `lastAcceptedEpochMs` only monotonically. Therefore:

- forward wall-clock movement, sleep, throttling, and suspended tabs count correctly;
- a backward clock change stalls elapsed accumulation until wall clock catches up;
- no phase total decreases;
- one transition timestamp cannot create a gap or overlap between adjacent phases;
- closed cumulative values plus the current open interval produce the live total.

At Finish, the candidate freezes each cumulative phase value and derives
`actualDurationSeconds` from their exact sum. It does not independently calculate a
second total from Start-to-Finish because Review gaps and backward-clock stalls would
violate the invariant.

### Transition table

| Current state | Event | Next state | Ledger effect |
| --- | --- | --- | --- |
| Generated | Start Workout | Warmup | Open Warmup at event timestamp |
| Warmup | Start first set | Performance | Close Warmup; open Performance at same timestamp |
| Performance | Cancel first work timer | Performance | No phase transition |
| Performance | Confirm final outstanding set | Cooldown | Close Performance; open Cooldown |
| Performance | Confirm early finish with work | Cooldown | Resolve active set/rest state; close Performance; open Cooldown |
| Performance | Confirm cancellation with no work | Cancelled | Close/discard active state; no history |
| Cooldown | Undo final set / Resume Workout | Performance | Close Cooldown cumulatively; open Performance |
| Performance | Reconfirm final outstanding set | Cooldown | Close Performance cumulatively; reopen Cooldown |
| Cooldown | Finish Workout | Review | Close Cooldown; freeze candidate; no open phase |
| Review | Back | Cooldown | Discard candidate; open Cooldown at Back timestamp, excluding Review gap |
| Review | Retry save | Review | Reuse identical frozen candidate and save identity |
| Review | Save/reconcile exact match | Saved | Clear active recovery slot after durable result |

## Active recovery projection

Recovery is local to one browser profile. It is not Firestore sync and makes no
cross-device promise.

### Namespacing

One versioned local slot exists per Firebase project and authenticated user:

```text
adaptive-workouts:active-workout:v1:<encodeURIComponent(projectId)>:<encodeURIComponent(uid)>
```

Every mutation requires exclusive ownership of:

```text
active-workout:<encodeURIComponent(projectId)>:<encodeURIComponent(uid)>
```

Both keys use the resolved Firebase project ID and authenticated UID; neither accepts
caller-provided display identity. Auth changes retire the prior account’s in-memory
state and never hydrate it into the new account.

### Allowlisted draft

The versioned recovery serializer builds a new DTO from an explicit allowlist. It
contains only what is required to reproduce the generated workout, entered
performance, EPIC-11 timer/recommendation state, phase targets and ledger boundaries,
workflow state, ownership generation, last mutation timestamp, and a pending stable
save identity/fingerprint when applicable.

It excludes Firebase credentials, provider data, catalog/settings snapshots not used
by the active plan, DOM/UI references, arbitrary component state, errors/stacks,
sound/vibration bookkeeping, and unrecognized properties. Deserialize validates the
entire envelope before hydration; it never spreads unknown stored data into state.

The A5 recovery contract is the strict version-1 envelope below. A serializer builds
this DTO field by field; it never spreads reducer or component state. Object shapes
are exact unless a field is explicitly marked optional. Unknown, missing-required,
non-finite, or structurally inconsistent data invalidates the entire envelope.

#### Recovery version and identity

The storage and lock names percent-encode each identity component independently so a
delimiter inside a UID cannot alias another project/user pair:

```text
adaptive-workouts:active-workout:v1:<encodeURIComponent(projectId)>:<encodeURIComponent(uid)>
active-workout:<encodeURIComponent(projectId)>:<encodeURIComponent(uid)>
```

`projectId` comes from the initialized Firebase app and `uid` from the authenticated
Firebase user. Both must be nonempty exact strings. The embedded unencoded values are
validated again after read; the key is never parsed to infer identity.

| Path | Type / units | Presence and semantics |
| --- | --- | --- |
| `version` | literal integer `1` | Required. A missing version is malformed; any other version is unsupported and retained without rewrite. |
| `projectId` | nonempty string | Required exact resolved Firebase project ID. |
| `uid` | nonempty string | Required exact authenticated UID; display identity is never accepted. |
| `draftId` | canonical UUID string | Required immutable identity generated once for a new draft. It never repeats across discard/recreate. |
| `ownershipGeneration` | safe integer `>= 1` | Required. First ownership is `1`; each successful ownership transfer increments once. Every acquire, mutation, handoff, and discard compares the pair `{draftId, ownershipGeneration}` to prevent ABA. |
| `lastMutationAtEpochMs` | safe integer epoch milliseconds | Required. Every successful ownership/content write stores `max(previous, injectedNow)`. Backward wall-clock movement never lowers it. |
| `phaseTargets` | exact object | Required immutable generated targets defined below. |
| `activeWorkout` | exact object | Required active projection defined below. |
| `pendingSave` | literal `null` | Required in recovery v1. A5 rejects every non-null value. A6 introduces the exact recovery-v2 save-operation contract below. The `:v1:` key segment is the fixed recovery-family namespace, not the envelope schema version: v2 uses this same physical slot and lock, and v1 and v2 never coexist. V1 readers treat v2 as unsupported and never overwrite it. |

#### Recovery version 2 and pending save

Recovery v2 has the same exact top-level keys as v1 with `version: 2`. Its
`pendingSave` is either null or an exact object with these fields:

| Path | Type and semantics |
| --- | --- |
| `state` | One of `prepared`, `write-pending`, `retryable-absent`, `reconcile-indeterminate`, or `blocked-conflict`. |
| `workoutId` | Immutable lowercase RFC 4122 UUIDv4. It is the save identity, Firestore document ID, and `candidate.id`. |
| `fingerprint` | Exact `{ canonicalization: 'workout-v4-json-v1', algorithm: 'SHA-256', hex }`; `hex` is 64 lowercase hexadecimal characters. |
| `candidate` | Deep-frozen exact canonical v4 write DTO. It is also the unmodified `setDoc` payload. |
| `attemptCount` | Safe integer `>= 0`, incremented and durably persisted immediately before each `setDoc`. |
| `lastAttemptAtEpochMs` | Null exactly before the first attempt; otherwise a safe integer updated with `max(previous, injectedNow)`. |
| `lastReconciliationAtEpochMs` | Null until a server reconciliation completes; otherwise a safe integer updated monotonically. |

A non-null pending save is valid only in Review. Its candidate exactly equals a fresh
canonical v4 build from the frozen Review projection, immutable phase targets, and
`workoutId`; `candidate.id` equals `workoutId`. Candidate, workout ID, and fingerprint
never change. Only state, attempt count, and timestamps mutate.

Before hydration or mutation, recovery recomputes canonical JSON and SHA-256 and
compares both with the candidate and stored fingerprint. Structural, candidate, or
hash mismatch is `malformed`. Unavailable or rejected digest capability is the
distinct retained disposition `fingerprint-error`; it never partially hydrates.
Recovery-v2 verification is therefore asynchronous and completes before returning a
hydrated draft.

State invariants are exact:

- `prepared` has attempt count zero and both timestamps null.
- Every other state has attempt count at least one and a non-null last-attempt time.
- `retryable-absent`, `reconcile-indeterminate`, and `blocked-conflict` have a
  non-null last-reconciliation time.
- `write-pending` may have a null reconciliation time before its first ambiguous
  write is reconciled.

Allowed transitions are:

```text
null -> prepared
prepared | retryable-absent -> write-pending
write-pending + resolved setDoc -> clear recovery slot
write-pending + rejected/ambiguous setDoc -> authoritative reconciliation
write-pending | reconcile-indeterminate + matching -> clear recovery slot
write-pending | reconcile-indeterminate + absent -> retryable-absent
write-pending | reconcile-indeterminate + read failure -> reconcile-indeterminate
write-pending | reconcile-indeterminate + divergent/invalid -> blocked-conflict
```

Reload reconciles `write-pending` and `reconcile-indeterminate` before any new write.
`prepared` and `retryable-absent` may perform the next exact write.
`blocked-conflict` cannot write again. Every asynchronous completion revalidates
`{ draftId, ownershipGeneration, workoutId, fingerprint.hex, attemptCount }`; a late
result from a retired auth identity, ownership generation, save identity, fingerprint,
or attempt cannot mutate local state.

An A6 reader accepts strict v1 and v2. Under the existing identity lock, v1 migration
re-reads and validates v1, revalidates `{draftId, ownershipGeneration}`, constructs a
new exact v2 DTO with `pendingSave: null`, and writes it once. Migration alone does
not increment ownership generation, but the content write updates
`lastMutationAtEpochMs` to `max(previous, injectedNow)`. Resume may combine its one
transfer increment and migration in the same atomic write. There is no downgrade,
object spreading, or coexistence of versions. Future versions remain unsupported and
retained.

Staleness is evaluated with required injected safe-integer `nowEpochMs` and positive
safe-integer `staleAfterMs`. A draft is stale only when
`nowEpochMs - lastMutationAtEpochMs > staleAfterMs`; a backward `nowEpochMs` is not
stale. Acquire re-evaluates age after the lock is granted. Stale drafts are never
resumed or refreshed; they are discard-only after locked identity/generation
revalidation. A8 must obtain product approval for the concrete `staleAfterMs` before
making this path reachable.

#### Immutable targets and workflow state

| Path | Type / units | Presence and semantics |
| --- | --- | --- |
| `phaseTargets.warmupSeconds` | integer seconds from 0 through 3600, divisible by 60 | Required canonical Warmup target; zero is valid. |
| `phaseTargets.performanceSeconds` | nonnegative safe integer seconds | Required generated performance budget; zero is valid. |
| `phaseTargets.cooldownSeconds` | integer seconds from 0 through 3600, divisible by 60 | Required canonical Cooldown target; zero is valid. |
| `activeWorkout.phase` | `warmup`, `performance`, `cooldown`, or `review` | Required. Generated/pre-start and cancelled sessions are not persisted. |
| `activeWorkout.workoutStartedAtEpochMs` | safe integer epoch milliseconds | Required for every persisted draft; never null. |
| `activeWorkout.activeWorkTimer` | exact object or `null` | Required. Non-null only in Performance and defined below. |
| `activeWorkout.nextTimerId` | positive safe integer | Required persisted form of `_nextTimerId`; greater than every numeric work/rest timer suffix present in the projection. |
| `activeWorkout.phaseLedger` | exact object | Required strict A4 ledger defined below. |
| `activeWorkout.phaseCandidate` | exact object or `null` | Required. Non-null exactly in Review. |
| `activeWorkout.cooldownUndoTarget` | exact object or `null` | Required persisted form of `_cooldownUndoTarget`. A non-null value is permitted only in Cooldown or Review and must reference the completed final-outstanding set whose undo is valid. |
| `activeWorkout.exercises` | nonempty array | Required ordered active occurrence projection. Occurrence IDs are unique; set and reference invariants below apply. |

`activeWorkout.activeWorkTimer` has exactly `id`, `occurrenceId`, `exerciseIndex`,
`setIndex`, and `startedAtEpochMs`. `id` is `work-<positive integer>`;
`occurrenceId` and both zero-based indices resolve to the same uncompleted ready set;
`startedAtEpochMs` is a safe integer. It cannot coexist with Review, Cooldown, or an
active rest on the referenced set.

`activeWorkout.cooldownUndoTarget`, when non-null, has exactly `exerciseIndex` and
`setIndex`, both nonnegative integers resolving to the completed set recorded when
Performance entered Cooldown. Missing is never substituted for null.

The strict phase ledger retains A4 units and derivation:

| Path | Type / units | Presence and semantics |
| --- | --- | --- |
| `phaseLedger.closedMilliseconds.<phase>` | nonnegative safe integer milliseconds | Exactly Warmup, Performance, and Cooldown; required. |
| `phaseLedger.closedSeconds.<phase>` | nonnegative safe integer seconds | Exactly the three phases; required and equal to `Math.round(closedMilliseconds / 1000)`. |
| `phaseLedger.openPhase` | phase name or `null` | Active workflow phases require the matching open phase. Review requires null. |
| `phaseLedger.openedAtEpochMs` | safe integer epoch milliseconds or `null` | Required integer exactly when a phase is open; otherwise null. |
| `phaseLedger.lastAcceptedEpochMs` | safe integer epoch milliseconds | Required monotonic accepted boundary and not earlier than an open boundary. |

The Review-only `phaseCandidate` has exactly `phaseActualSeconds`,
`actualDurationSeconds`, and `finishRequestedAtEpochMs`.
`phaseActualSeconds` contains exactly the three nonnegative safe-integer phase values
and equals the ledger's derived `closedSeconds`; `actualDurationSeconds` is their
exact sum. `finishRequestedAtEpochMs` is the raw injected safe-integer Finish event
timestamp, not the monotonic accepted boundary. It is persisted so reload cannot
change the eventual v4 date; A6/A8 derive the canonical ISO date from this value once
and A5 already requires it to produce a finite, ISO-representable JavaScript date.
The candidate and ledger are closed, no
work or rest timer remains, and the candidate is reconstructed frozen after hydrate.

#### Exercise and set projection

Every occurrence requires the exact common fields `id`, `occurrenceId`, `name`,
`muscleGroup`, `tier`, `trackingMode`, `sets`, `prescribedSetCount`, and `setRecords`.
`id`, `occurrenceId`, `name`, and `muscleGroup` are nonempty strings; `tier` is an
integer; `trackingMode` is `simple`, `weighted`, or `bodyweight`; `sets` is an integer
from 1 through 10 and equals `prescribedSetCount` and the set-record count. Optional
`linkedTo` preserves exact presence and is null or a string; optional `isActive`
preserves exact presence and is boolean. Selection-only `dynamicTier` is excluded.

Mode-specific occurrence fields are:

| Mode | Required additional fields | Forbidden occurrence fields |
| --- | --- | --- |
| Simple | `completed` boolean | Weighted/bodyweight configuration fields |
| Weighted | finite nonnegative `startingWeight`; positive integer `targetReps`; nonnegative integer `floorReps < targetReps`; finite positive `weightStep` | Simple `completed` and bodyweight-only fields |
| Bodyweight | positive integer `targetReps` | Simple `completed` and weighted-only configuration fields |

Every set record requires exactly the common fields `index`, `completed`,
`plannedRestSeconds`, `workDurationSeconds`, `actualRestSeconds`, and `activeRest`, plus
the mode-specific fields below. Indices are contiguous from zero. `plannedRestSeconds`
is an integer from 5 through 600 on non-final sets and null on the final set.
Unconfirmed records require `workDurationSeconds: null` and
`actualRestSeconds: null`. Confirmed records require a nonnegative integer
`workDurationSeconds`; final records require `actualRestSeconds: null`. A confirmed
non-final record has either a nonnegative integer `actualRestSeconds` with
`activeRest: null`, or `actualRestSeconds: null` with a non-null active rest.
Confirmed records form a contiguous prefix per occurrence.

`activeRest` is required on every record and is either null or exactly
`{ id, startedAtEpochMs }`. A non-null ID is `rest-<positive integer>`, its boundary is
a safe integer, and it is allowed only on the latest confirmed non-final record of
that occurrence. Concurrent rests across different occurrences are valid. Every work
and rest timer ID is unique and its numeric suffix is less than `nextTimerId`.

| Mode | Required set fields and value rules |
| --- | --- |
| Simple | No additional fields. Occurrence `completed` equals whether any set is completed. |
| Weighted | `targetWeight` and numeric `actualWeight` are finite and nonnegative; `targetReps` is a positive integer; `actualReps` is a nonnegative integer. `actualWeight` or `actualReps` may instead be the exact empty string `""` on either an unconfirmed or completed record because EPIC-11 permits temporary completed-detail editing. Such a draft remains resumable but cannot be confirmed/saved until required actuals are numeric. `recommendationReason` and `inputDirty` are required exact objects. |
| Bodyweight | `targetReps` is a positive integer. Each of `fullReps`, `assistedReps`, and `eccentricReps` is a nonnegative integer or the exact empty string `""`, including during temporary completed-detail editing. A blank draft remains resumable but cannot be confirmed/saved until required actuals are numeric. |

Weighted `inputDirty` is exactly `{ actualWeight: boolean, actualReps: boolean }` and
maps to/from `_activeDirty`. Weighted set zero uses the exact top-set recommendation
shape: `decision`, `sourceWorkoutId`, `sourceWorkoutDate`, `sourceAnchorWeight`,
`appliedWeightStep`, `recommendedWeight`, and `reasonCode`, with the existing
progression value/null/date invariants: `decision` is `starting`, `increase`, `hold`,
or `decrease`; starting requires all three source fields null, while every other
decision requires a nonempty source workout ID, an ISO-parseable source date, and a
finite nonnegative source anchor; applied step and recommended weight are finite and
nonnegative. Later sets use either exactly
`{ recommendedWeight, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }` or the exact computed
backoff fields `recommendedWeight`, `reasonCode`, `sourceActualWeight`,
`sourceActualReps`, `floorReps`, `weightStep`, `dropSteps`, `rawWeight`,
`sessionTopTarget`, and `priorTargetCeiling`, with the existing backoff numeric
invariants. In a computed backoff, source actuals equal the preceding set's numeric
actuals, floor/step equal the occurrence configuration, session top equals set zero's
target, prior ceiling equals the minimum prior assigned target, drop steps equal zero
when the floor is met or otherwise `min(floorReps - sourceActualReps, 3)`, raw weight
equals `max(0, sourceActualWeight - weightStep * dropSteps)`, and recommended weight
equals the minimum of raw weight, session top, and prior ceiling. For every weighted
or bodyweight record, set `targetReps` equals the occurrence target. Every
`recommendationReason.recommendedWeight` equals its record `targetWeight`.

Hydration maps persisted `activeRest` to `_activeRest`, `inputDirty` to
`_activeDirty`, `nextTimerId` to `_nextTimerId`, and `cooldownUndoTarget` to
`_cooldownUndoTarget`. It reconstructs `_phaseTimingEnabled: true`; that flag is never
persisted. No other underscore-prefixed or unknown field is admitted.

Phase invariants are whole-envelope invariants:

- Warmup has an open Warmup ledger, no completed set, no active work timer, null
  candidate, and null cooldown undo target.
- Performance has an open Performance ledger, null candidate, and may own one valid
  work timer plus concurrent valid rests.
- Cooldown has an open Cooldown ledger, null candidate, no work timer or active rest,
  and its optional undo target passes the reference rule above.
- Review has a closed ledger, the matching non-null frozen candidate, no work timer
  or active rest, and no mutable timing interval.

#### Read, write, and version precedence

Read classification is deterministic and stops at the first matching outcome:

1. storage access exception -> `storage-error`;
2. absent key -> `missing`;
3. unparsable JSON, non-object, or missing version -> `malformed`;
4. unsupported version -> `unsupported-version` (retain; never rewrite/remove); A5
   supports only v1, while A6 supports strict v1 and v2;
5. missing, empty, or non-string embedded project/UID -> `malformed`;
6. embedded project mismatch -> `wrong-project`;
7. embedded UID mismatch -> `wrong-user`;
8. remaining exact-shape, referential, or phase-invariant failure -> `malformed`;
9. for non-null v2 `pendingSave`, structural/candidate/hash mismatch -> `malformed`,
   while unavailable or rejected digest capability -> `fingerprint-error`;
10. age beyond the injected policy -> `stale`;
11. otherwise -> `resumable` with a deep-frozen hydrated projection.

Async digest verification applies only to v2 with a non-null pending save. V1 and v2
with `pendingSave: null` have no stored candidate fingerprint to verify.

The storage adapter returns distinct `saved`, `removed`, and `storage-error`
outcomes. Under a held lock, a mutation re-reads and validates the stored
`{draftId, ownershipGeneration}`, applies a pure transform to a clone, validates and
serializes the complete candidate, performs one `setItem`, and only then publishes
the new in-memory state. Serialization or storage failure leaves the prior published
state unchanged and is never reported as protected. `removeItem` failure likewise
leaves the slot intact. Web Storage operation completion is atomic with respect to
reported failure, but the application makes no power-loss or eviction durability
claim.

These A5 details fulfill the planned recovery-contract expansion. TREK-240 durably
tracks the corresponding planning-workflow improvement for future features.

### Dispositions

- **Valid and unlocked:** offer Resume and Discard; Resume must acquire the lock
  before hydration or mutation.
- **Same user, active owner elsewhere:** show a distinct conflict and offer the
  approved cooperative handoff/takeover path.
- **Malformed, unsupported version, stale, wrong project, or wrong user:** do not
  hydrate. Show the approved explanation and safe disposition where applicable.
- **Storage unavailable, quota denied, serialization failure, or write failure:**
  surface a distinct local-recovery failure. Do not present the draft as protected.
- **Fingerprint capability failure:** retain the v2 draft as `fingerprint-error`; do
  not hydrate, mutate, rewrite, or remove it through the recovery path.
- **No draft:** start normally with no warning.

## Exclusive Web Lock coordination

`activeWorkoutCoordinator` is injected and testable. Every state-changing action,
including Start, set input/confirmation, cancel, undo, phase transition, Review/Back,
discard, and save-state mutation, runs only while the caller exclusively owns the
project/user Web Lock.

- Acquisition is cancellable and bounded to eight seconds.
- The coordinator revalidates stored `{draftId, ownershipGeneration}` after
  acquisition; a tab cannot mutate stale in-memory ownership.
- Cooperative handoff asks the current owner to release before acquisition. A
  takeover never creates two owners.
- Lock loss freezes mutation and presents an actionable conflict/recovery state.
- Unsupported Web Locks block active-workout entry and all mutation in A5; they are
  never silently treated as exclusive.
- Read-only display may continue when safe, but no draft or save mutation bypasses
  ownership.

The A5 coordinator factory injects Web Locks, storage, clock, UUID creation, timers,
and cooperative-handoff transport. Its default acquisition budget is exactly eight
seconds and bounds the full handoff-plus-lock attempt. Caller abort and internal
timeout are distinct; every terminal path clears its timer.

Web Lock acquisition uses an ordinary exclusive request and never uses `steal`.
`AbortSignal` cancels only while queued. Once granted, ownership lasts until the
request callback's lease promise settles. The coordinator therefore defines `lost`
as its held callback settling unexpectedly or detected preemption—not as a
browser-provided spontaneous loss event. Normal explicit release, cooperative
handoff release, successful discard, and successful auth cleanup settle as
`released` or the operation's success result, never `lost`. Unexpected loss marks the
lease inactive immediately; later operations reject locally, and locked generation
revalidation prevents a preempted callback from writing.

First Start acquires the identity lock, verifies the slot is missing, creates a new
UUID draft at generation 1, writes the post-Start projection, and only then publishes
it. Generated/pre-start plans are not persisted. Resume acquires, re-reads the strict
draft, compares the expected `{draftId, ownershipGeneration}`, advances generation
once, persists, then returns the snapshot for hydration. Each owned mutation
revalidates the same pair before the atomic transform/write sequence. Discard and
prior-auth cleanup acquire the corresponding lock and revalidate the pair before
removal.

Cooperative handoff messages contain a request nonce, draft ID, and generation. The
current owner may acknowledge only after releasing its lease. An acknowledgment
never grants ownership; the requester must still win ordinary exclusive acquisition
and revalidate storage. Unsupported Web Locks block active-workout entry and all
mutation in A5; a mutation-capable fallback would weaken the approved exclusivity
contract and requires renewed architecture and user approval.

Coordinator outcomes remain distinct. `acquired` means the non-null exclusive lock
callback revalidated storage, persisted the ownership generation, and returned an
active lease. `conflict` means a matching live owner explicitly declines handoff or
remains active through the handoff attempt; an optional exclusive `ifAvailable`
probe returning null may detect that conflict but never grants mutation.
`timeout` is the internal eight-second budget expiring before ordinary exclusive
grant, and `aborted` is the caller's signal ending the queued attempt. `denied` is a
non-abort Web Locks rejection such as platform/security denial. `unsupported` means
the Web Locks capability is absent. `stale-generation` means stored draft ID or
generation differs from the caller expectation after grant. `released` is a normal
explicit lease settlement; `lost` is only unexpected settlement/preemption.
`storage-error` is a storage/serialization failure. After grant, read dispositions
`malformed`, `unsupported-version`, `wrong-project`, `wrong-user`, or `stale` are
propagated unchanged, the lease settles normally without a write, and only the
approved locked stale/identity-matched discard path may remove a stale draft. Storage
errors include the failed operation (`read`, `serialize`, `write`, or `remove`) for
diagnostics without exposing stored workout contents. Auth change freezes/releases
the prior lease and attempts removal only under the prior identity lock. Cleanup
failure leaves that slot intact, reports failure, and never permits the new UID to
inspect or hydrate it.

## Immutable save and reconciliation

### Stable identity

Each active workout receives a random UUID save identity before its first save
attempt. The ID survives recovery and all retries. The completed history path is:

```text
users/<uid>/history/<workoutId>
```

The client validates the UUID but does not derive it from workout contents or time.

### Canonical fingerprint

After strict v4 validation, construct a canonical fingerprint DTO containing only
the immutable saved fields, with object keys in a specified stable order and arrays
preserving semantic order. Encode as UTF-8 canonical JSON and hash with SHA-256.
Undefined values, non-finite numbers, alternate date encodings, transient fields,
and unknown properties are rejected before hashing rather than normalized silently.

Test vectors pin the canonical bytes and digest. The same DTO feeds the exact
`setDoc` payload so hash and write cannot diverge.

The candidate includes `id`; the fingerprint therefore covers the exact immutable
payload and its Firestore identity. A builder creates new plain objects field by
field and uses this key order:

- document: `id`, `schemaVersion`, `status`, `date`, `actualDurationSeconds`,
  `phaseDurations`, `exercises`;
- phase map: `warmup`, `performance`, `cooldown`, with each phase ordered
  `plannedSeconds`, `actualSeconds`;
- simple occurrence: `id`, `occurrenceId`, `name`, `muscleGroup`, `tier`, optional
  `linkedTo`, optional `isActive`, `trackingMode`, `sets`, `prescribedSetCount`,
  `setRecords`;
- weighted occurrence: the same prefix through `prescribedSetCount`, then
  `startingWeight`, `targetReps`, `floorReps`, `weightStep`, `setRecords`;
- bodyweight occurrence: the same prefix through `prescribedSetCount`, then
  `targetReps`, `setRecords`;
- simple set: `index`, `completed`, `plannedRestSeconds`, `workDurationSeconds`,
  `actualRestSeconds`;
- weighted set: the simple-set prefix, then `targetWeight`, `targetReps`,
  `actualWeight`, `actualReps`, `recommendationReason`;
- bodyweight set: the simple-set prefix, then `targetReps`, `fullReps`,
  `assistedReps`, `eccentricReps`;
- recommendation: the exact top-set, awaiting-backoff, or computed-backoff order
  defined by the recovery contract.

The general v4 read classifier may continue accepting a raw Firestore document that
lacks payload `id`, because the loaded Firestore path ID is authoritative for history
reads. Every A6 canonical write candidate separately requires `id` and requires it to
equal the lowercase UUIDv4 document path. During A6 reconciliation, an existing
server document with a missing or different payload ID is divergent, never matching.

The canonical algorithm is exact:

1. derive `date` once as `new Date(finishRequestedAtEpochMs).toISOString()`;
2. build the new ordered DTO without spreading reducer, recovery, or stored data;
3. strictly validate v4, rejecting blanks, undefined, unknown fields, non-finite
   numbers, and alternate date encodings;
4. serialize with whitespace-free `JSON.stringify`;
5. encode that exact string with `TextEncoder` UTF-8;
6. hash those bytes with Web Crypto SHA-256;
7. encode the digest as two-digit lowercase hexadecimal;
8. pass that same DTO, without augmentation or merge, to `setDoc`.

Reconciliation rebuilds and compares canonical bytes, not the digest alone. A hash
collision or structurally different document is never a match. Literal checked-in
vectors pin complete canonical JSON and digest values for: a minimal ASCII/simple
workout; a weighted workout with optional fields, both recommendation shapes,
Unicode, quotes, and backslashes; and a bodyweight workout. A fourth assertion pins
that changing only `id` changes both canonical bytes and digest. Expected digests are
not generated dynamically by the implementation under test.

### Write protocol

- Use `setDoc(historyRef, exactPayload)` with no merge.
- The first absent-document write is owner create.
- A retry of an already-present structurally identical document is permitted as an
  exact replay.
- Any divergent existing document is a conflict; the client never overwrites it.
- Delete is not part of this feature.
- A successful response finalizes the candidate and clears recovery state.
- A transport/availability ambiguity triggers server-only reconciliation by reading
  the authoritative document. The outcomes are matching, absent, indeterminate, or
  divergent conflict.
- Matching completes locally; absent remains safely retryable; indeterminate remains
  pending; divergent conflict blocks and preserves evidence/recovery state.
- Local cached state alone cannot declare a reconciliation match.

The exact client sequence is:

1. under the held recovery lease, prepare and persist the pending save;
2. persist `write-pending` with the incremented attempt before network I/O;
3. call `setDoc(doc(db, 'users', uid, 'history', workoutId), candidate)` with no
   merge option, transaction, pre-read, transform, server timestamp, or augmentation;
4. treat a resolved write as final for both create and exact replay;
5. after any rejected or ambiguous write, call `getDocFromServer` only: absent is
   `absent`; a strict v4 document with identical canonical bytes is `matching`; an
   existing malformed or different document is `conflict`; read rejection,
   unavailability, or auth failure is `indeterminate`.

There is no preliminary read because it adds a TOCTOU race. Firestore Rules arbitrate
direct create/replay. Concurrent exact writers may both complete as immutable replay;
a divergent writer is denied and reconciles to conflict. Local cleanup failure after
server success leaves the pending record intact so a later authoritative matching
reconciliation can retry cleanup. Errors and stacks remain ephemeral.

## Firestore security contract

Narrow history rules by path while preserving established root user-document and
catalog behavior.

For `users/{uid}/history/{workoutId}`:

- owner authenticated read is allowed;
- owner create of an approved valid shape is allowed;
- owner replay/update is allowed only when the incoming document is structurally
  identical to the existing document;
- divergent update is denied;
- delete is denied;
- unauthenticated and cross-user access are denied.

Rules are defense in depth, not the schema classifier. Exact immutable replay and
client reconciliation receive emulator coverage with real storage calls. The owned
emulator runner executes both baseline integration and rules suites in one controlled
lifecycle and preserves migration/root/catalog tests.

The rule tree uses mutually exclusive matches. The root user document retains the
existing strict-approved owner behavior. `users/{uid}/history/{workoutId}` receives
the immutable behavior below. A separate non-history subtree match retains existing
owner behavior only when its first subcollection segment is not `history`; an
unconditional recursive owner wildcard must not also authorize history.

History create permits a strict-approved owner to write either:

- a canonical v4 envelope with exact top-level keys `id`, `schemaVersion`, `status`,
  `date`, `actualDurationSeconds`, `phaseDurations`, and `exercises`; lowercase UUIDv4 path;
  `data.id == workoutId`; schema version 4; completed status; string date;
  nonnegative integer total; exact Warmup/Performance/Cooldown maps whose planned and
  actual values are nonnegative integers and whose actual sum equals the total; and a
  nonempty exercises list; or
- an owner-only compatibility document with no payload `id` and schema version
  absent, 2, or 3, preserving legacy migration and the pre-A8 writer.

Rules allow owner read, allow update only when `request.resource.data == resource.data`,
and deny delete. Full arbitrary nested exercise/set validation remains the strict
client classifier because Firestore Rules cannot iterate those dynamic arrays.
Unauthenticated, unapproved, and cross-user access remains denied. Removing or
restricting the compatibility branch is a migration/product change outside A6.

The owned emulator baseline keeps one canonical Auth/Firestore stack alive while it
seeds/verifies the baseline, runs baseline integration, runs immutable-save
integration, and runs Firestore Rules tests sequentially. The owner stops the stack
in `finally` after child failure or timeout. The existing scratch lifecycle then runs
independently. Coverage includes canonical vectors, UUID stability, v1 migration and
every v2 state, candidate/digest tampering and digest failure, exact `setDoc`, real
matching/absent/conflict reconciliation, bounded injected indeterminate coverage,
late-result suppression, immutable owner create/read/replay, invalid v4/path/phase
denial, divergent update/delete denial, auth isolation, legacy/v2/v3 migration
create/replay, and root/catalog/scratch regressions.

## Presentation and accessibility

Timing owns minimal functional presentation only. Resolve owns later visual-system
application.

- The current phase is a semantic heading and is never communicated by color alone.
- Warmup and Cooldown show planned target, countdown, zero, and labeled overtime.
- Performance retains the current exercise, prescription, work timer, concurrent
  rests, and next action as the primary content.
- The global elapsed value remains available and derives from the phase ledger.
- Review shows the frozen phase breakdown, total, completed work, and save state.
- Recovery, conflict, unsupported lock, local-storage failure, retry, reconciliation,
  and discard use distinct language and actions.
- Per-second values are not live-announced. Phase entry, target reached/overtime,
  blocked action, recovery availability, ownership loss, and save outcome use concise
  semantic status announcements.
- Focus moves to the phase `h1` on major transitions. The approved final-set focus
  target is Cooldown rather than Finish Workout.
- Reduced-motion users receive equivalent state changes without animated ramping.
- Actions remain reachable at 320px, 375px, 568×320 landscape, 768px, and 1280px and
  under 200% zoom/reflow. Touch targets are at least 44×44 CSS pixels unless a
  documented contextual exception provides equivalent usability.
- Offline, reload, long content, concurrent rest, browser sleep, and installed-PWA
  conditions are first-class evidence scenarios.

## Failure and edge cases

- A backward wall-clock change stalls accumulation; it never subtracts duration.
- Browser throttling and sleep count forward elapsed time from timestamps.
- Countdown zero never triggers an automatic transition.
- Zero planned Warmup or Cooldown is valid and immediately displays zero/overtime.
- Re-entering Performance and Cooldown accumulates prior closed time exactly.
- Review gaps never enter phase totals.
- Cancelled no-work sessions clear their draft and create no history document.
- Active work and rests resolve at the approved early-finish timestamp before
  Cooldown begins.
- A failed local draft write is visible and cannot be mistaken for protected recovery.
- Lock timeout/loss cannot fall through to an unlocked reducer mutation.
- Auth or Firebase project changes cannot cross-hydrate a recovery draft.
- Corrupt or future-version recovery data never partially hydrates.
- A payload `id` cannot override the Firestore document ID.
- A replay with equivalent-looking but structurally different canonical data is a
  conflict, not success.
- An indeterminate server read remains pending; absence is not inferred.
- Production remains on the v3 writer until the A8 atomic cutover.

## Verification matrices

Every applicable UI task uses a fresh capability probe and the canonical
`docs/templates/ux-evidence-matrix.md` format with synthetic or de-identified local
data. Image concepts are never behavior evidence.

### Timing scenarios

| ID | Scenario and required outcome |
| --- | --- |
| T-01 | **Start and Warmup:** Start Workout opens Warmup and global time at one injected timestamp; planned countdown, zero, overtime, early Start set, and zero target are truthful. |
| T-02 | **Performance entry:** first Start set closes Warmup and opens Performance; cancelling its timer remains in Performance; existing sequential/global-work/concurrent-rest behavior is unchanged. |
| T-03 | **Normal Cooldown:** final outstanding confirmation resolves EPIC-11 state, closes Performance, enters Cooldown, and focuses its heading. |
| T-04 | **Early end and cancellation:** confirmed partial-work early finish enters Cooldown; no-work confirmation cancels without history; active timers/rests resolve coherently. |
| T-05 | **Cooldown timing:** countdown, zero, overtime, early Finish, planned Finish, and long overtime preserve cumulative exact seconds. |
| T-06 | **Resume/re-entry:** Undo final set and Resume Workout return to Performance; later Cooldown re-entry accumulates rather than resets. |
| T-07 | **Review lifecycle:** Finish freezes a candidate; Review time is excluded; Back rebases Cooldown; re-Finish creates later active time; retry reuses identical candidate. |
| T-08 | **Clock behavior:** forward/sleep counts, backward change stalls, rounded boundaries are nondecreasing, and actual total exactly equals the phase sum. |
| T-09 | **V4 history/save:** strict valid/malformed classification, authoritative IDs, phase presentation, stable-ID exact replay, conflict, and legacy/v2/v3 behavior pass. |
| T-10 | **Integrated/settings/accessibility:** canonical setting validation/fallback, immutable targets, History, required viewports, keyboard/focus, screen reader, reduced motion, offline, font/PWA-neutral functional presentation, and regression suites pass. |

### Coordination and recovery scenarios

| ID | Scenario and required outcome |
| --- | --- |
| C-01 | **Reload restore:** in one uninterrupted server/emulator/browser/auth/UID lifecycle, reload restores the same identifiable workout, phase, set/timer state, and accurate elapsed values. |
| C-02 | **Exclusive mutation:** two tabs cannot mutate the same project/user draft concurrently; the second receives conflict/handoff state and generation revalidation. |
| C-03 | **Acquisition and loss:** eight-second cancellation/timeout, denied/unsupported acquisition, cooperative release, and lock loss block mutation and expose recovery/exit. |
| C-04 | **Draft validation:** valid draft resumes; malformed, unsupported, stale, wrong-project, wrong-user, and auth-change drafts never partially hydrate and receive the approved disposition. |
| C-05 | **Draft lifecycle:** create, every mutation, phase changes, Review/Back, discard, localStorage failure, pending save, successful save, and cleanup preserve the allowlist and ownership contract. |
| C-06 | **Immutable server result:** owner create/read/exact replay passes; divergent overwrite/delete, unauthenticated, and cross-user access fail; matching/absent/indeterminate/conflict reconciliation remains distinct. |

### Evidence environments

Integrated evidence covers at minimum:

- 320px and 375px mobile widths;
- 568×320 landscape;
- 768px and 1280px representative wider viewports;
- 200% zoom/reflow;
- keyboard order, focus transition/restoration, screen-reader semantics, and status
  retirement;
- reduced motion and non-color state equivalence;
- long/dense content, concurrent rests, zero/overtime, sleep/clock shift, offline,
  reload, and two-tab ownership;
- saved-history reload and active-workout resume using one uninterrupted synthetic
  identity lifecycle; and
- production build/PWA behavior without relying on development-only state.

## Task and evidence map

| Task | Purpose | Required verification/evidence |
| --- | --- | --- |
| A1 / TREK-217 | Persist this approved design and branch handoff | Documentation path/link inspection, `git diff --check`, scoped commit, Summary |
| A2 / TREK-218 | Canonical settings and immutable generated targets | Storage/Settings/Generator/engine RED-GREEN tests, build, T-10 settings evidence |
| A3 / TREK-219 | Strict v4 read compatibility while writer stays v3 | Schema/History/progression/engine/storage tests, build, mandatory T-09/T-10 History evidence |
| A4 / TREK-220 | Pure cumulative phase ledger | Named RED-GREEN reducer/clock/transition matrix; no production UI or writer cutover |
| A5 / TREK-221 | Recovery projection and exclusive Web Lock coordinator | Recovery/coordinator tests covering C-01–C-05; production path unreachable |
| A6 / TREK-222 | Stable-ID immutable save, fingerprint, reconciliation, rules | Canonical vectors, storage tests, owned emulator integration/rules suites, C-06 |
| A7 / TREK-223 | Controlled non-production Timing presentation | Component/infrastructure tests, lint/build, rendered T-01–T-10 and C-01–C-06 evidence |
| A8 / TREK-224 | Atomic production integration and v4 writer cutover | Changed-surface tests, `ci:check`, emulator baseline, integrated rendered matrix; close TREK-210 only after recovery passes |
| A9 / TREK-225 | Cumulative review and draft-PR handoff | Full CI/emulators, after-action audit, epic and conformance reviews, clean range, push/PR/check evidence |

Every behavior task begins with a named failing test. Every nontrivial green diff gets
the required simplification pass, coordinator verification, fresh code review, and
fresh task-conformance review. Each UI task performs a new capability probe and writes
its canonical evidence report. A9 may fix only approved-intent evidence or review
findings; material behavior, data, security, or scope changes return to their gates.

## Dependency and cutover strategy

```text
A1 → A2
A2 → A3, A4
A3 + A4 → A5
A3 + A5 → A6
A2 + A3 + A4 + A5 + A6 → A7
A7 → A8 → A9
```

A2 additionally depends on TREK-203, actual EPIC-11 integration into target `main`,
and fresh user approval. The explicit external merge/approval checks are not satisfied
merely because a Trekker dependency changes state.

The implementation deliberately adds read/build capability before writer cutover:

1. Normalize settings and snapshot targets without changing live output.
2. Teach classifiers, history, progression, and engine consumers to read valid v4
   while production continues writing v3.
3. Build the pure ledger, recovery, coordinator, immutable save, and rules behind
   non-production boundaries.
4. Render and validate the complete controlled journey.
5. Wire all pieces and change the production writer to v4 atomically in A8.

There is no mixed production state in which v4 can be written before History,
progression, recovery, save reconciliation, and rules can consume it.

## Cross-epic and residual links

- **EPIC-13 / Resolve Interface System:** Resolve B2+ waits for A9, actual Timing merge
  into target `main`, and fresh authorization. Timing behavior remains authoritative.
- **TREK-210:** active-workout reload loss is resolved only when A8’s uninterrupted
  recovery evidence passes; planning linkage alone does not close it.
- **TREK-240:** records the workflow improvement to require recovery metadata,
  versioning, ownership, save identity, unit, and null/zero contracts alongside future
  persisted timing specifications.
- **EPIC-11 / TREK-203:** remains unchanged and must be integrated before A2.

## Acceptance criteria

- Warmup, Performance, Cooldown, and Review have explicit, accessible lifecycle state.
- Countdown zero enters overtime and never auto-advances.
- Early Start set, normal completion, early finish, no-work cancellation, Resume,
  final-set Undo, Review Back, and save retry follow the transition contract.
- Phase totals are cumulative, nondecreasing, whole-second wall-clock values and their
  exact sum is the saved total.
- Review gaps and backward-clock movement cannot inflate or reduce totals.
- V4 strictly validates planned/actual phases and existing set records while legacy,
  v2, v3, progression, engine output, auth, and EPIC-11 remain compatible.
- A valid same-user reload restores the identifiable active context without silent
  reset.
- Every draft mutation requires exclusive project/user Web Lock ownership.
- Stable-ID retries can reconcile exact server state without permitting divergent
  overwrite or deletion.
- Recovery, lock, local storage, offline, reconciliation, and malformed states are
  visible and actionable.
- The production writer remains v3 until the atomic A8 cutover.
- TREK-210 closes only after recovery evidence passes, and Resolve does not start from
  A9 completion alone without the actual merge and approval gates.

## Decision and review record

- Product discovery approved first-class Warmup and Cooldown, countdown/overtime,
  saved planned/actual phase durations, a five-minute Cooldown default, early-finish
  confirmation, Resume Workout, accessible announcements, and a separate prerequisite
  epic rather than embedding Timing in the visual redesign.
- Architecture review established schema v4, exact phase-sum accounting, a pure
  nondecreasing wall-clock ledger, project/user recovery namespacing, exclusive Web
  Locks, stable UUID saves, canonical fingerprints, server-only reconciliation, and
  immutable history rules while preserving legacy/v2/v3 and EPIC-11 behavior.
- UX design review established explicit event-driven phase transitions, concurrent
  Rest within Performance, Review-gap exclusion, recovery/conflict/error states,
  phase-heading focus, non-live ticking announcements, responsive obligations, and
  minimal functional styling before Resolve.
- Senior-developer planning conformance established the A1–A9 sequencing, read-before-
  write compatibility, pure-ledger boundary, controlled presentation harness, atomic
  cutover, exact evidence ownership, and draft-PR—not merge—completion boundary.
- On 2026-07-19, the user approved two linked epics and initially placed A1 after
  EPIC-11 integration. Later the same day, the user explicitly clarified that the
  documentation-only A1 should run immediately to durably record the design. The
  coordinator moved the EPIC-11 dependency and actual-main gate to A2 without changing
  behavior, scope, evidence, or implementation authority.
- The A1 planning commit hash is recorded on EPIC-12 and TREK-217 after this document
  is committed.
