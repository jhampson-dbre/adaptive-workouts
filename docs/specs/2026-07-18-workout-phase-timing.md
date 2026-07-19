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
adaptive-workouts:active-workout:v1:<projectId>:<uid>
```

Every mutation requires exclusive ownership of:

```text
active-workout:<projectId>:<uid>
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

The exact recovery field table and versioning rules must be expanded during A5 before
implementation. TREK-240 durably tracks this planning-workflow improvement so future
specs require recovery metadata alongside saved duration contracts.

### Dispositions

- **Valid and unlocked:** offer Resume and Discard; Resume must acquire the lock
  before hydration or mutation.
- **Same user, active owner elsewhere:** show a distinct conflict and offer the
  approved cooperative handoff/takeover path.
- **Malformed, unsupported version, stale, wrong project, or wrong user:** do not
  hydrate. Show the approved explanation and safe disposition where applicable.
- **Storage unavailable, quota denied, serialization failure, or write failure:**
  surface a distinct local-recovery failure. Do not present the draft as protected.
- **No draft:** start normally with no warning.

## Exclusive Web Lock coordination

`activeWorkoutCoordinator` is injected and testable. Every state-changing action,
including Start, set input/confirmation, cancel, undo, phase transition, Review/Back,
discard, and save-state mutation, runs only while the caller exclusively owns the
project/user Web Lock.

- Acquisition is cancellable and bounded to eight seconds.
- The coordinator revalidates stored ownership generation after acquisition; a tab
  cannot mutate a stale in-memory generation.
- Cooperative handoff asks the current owner to release before acquisition. A
  takeover never creates two owners.
- Lock loss freezes mutation and presents an actionable conflict/recovery state.
- Unsupported Web Locks are a named unsupported state with an approved safe fallback
  or blocked active-workout entry; they are never silently treated as exclusive.
- Read-only display may continue when safe, but no draft or save mutation bypasses
  ownership.

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
