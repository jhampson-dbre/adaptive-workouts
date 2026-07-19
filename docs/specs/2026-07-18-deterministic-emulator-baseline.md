# Deterministic Firebase Emulator Baseline

Status: approved design and implementation plan

Epic: EPIC-6

Planning task: TREK-211

Branch: `codex/epic-6-emulator-baseline`

Date: 2026-07-18

## Summary

Create a deterministic local Firebase environment that removes the manual Google
Auth emulator popup from evidence and test workflows while leaving normal
development and production behavior unchanged. The feature provides:

- a canonical reset-on-start Auth and Firestore fixture;
- a separate persistent scratch profile;
- a popup-free, isolated browser mode for the canonical baseline;
- reference-date history scenarios for progression and selection behavior; and
- scenario manifests that integrate with the finalized UX Quality Gate evidence
  contract without making that contract depend on Firebase tooling.

The canonical fixture is the only source of baseline truth. Mutable emulator export
data is local and ignored. Production defaults, authentication, storage, rules, and
bundles must not contain or depend on the synthetic baseline.

## Problem

Authenticated emulator evidence currently requires a human to complete the Google
Auth emulator popup and then manually construct useful settings, catalog, and
history. Restarting the emulator also destroys that work. This makes repeated UX and
algorithm scenarios slow and fragile, and it encourages evidence runs to reuse stale
browser or emulator state.

The existing production new-user catalog contains only six simple exercises. It is
correct production behavior and remains unchanged, but it is too narrow to exercise
weighted, bodyweight, leg-day, linked-exercise, rest-override, and aging behavior in
repeatable local reviews.

## Goals

- Make the recommended baseline workflow one command and popup-free.
- Seed and verify Auth and Firestore before the browser can expose app state.
- Give every canonical run the same user, settings, catalog, and empty history.
- Preserve a separate, explicitly mutable scratch workflow.
- Provide dynamically dated scenario histories with stated algorithm and visible UI
  outcomes.
- Make emulator scenarios usable as UX reviewer evidence fixtures through the
  canonical scenario-indexed evidence contract.
- Keep synthetic code, identities, fixture values, and marker strings out of normal
  production output.
- Work reliably on Windows, including startup failure and process-tree cleanup.

## Non-goals

- Change normal `npm run dev`, production Google sign-in, or production Firebase
  behavior.
- Replace `DEFAULT_CATALOG` in `src/utils/storage.js`.
- Add production users, seed production data, or change Firestore rules.
- Commit Firebase emulator export data.
- Preserve mutations made in the canonical baseline.
- Migrate legacy or schema-v2 history.
- Make every UX review execute every emulator scenario.
- Treat proxy or static evidence as a rendered-usability pass.
- Add continuous post-success health polling or automatic emulator restart/reseed.

## Approved command contract

### `npm run emulators`

- Own the normal Auth and Firestore emulator processes for `demo-project`.
- Wait for hub, Auth, and Firestore readiness.
- Clear Auth and Firestore.
- Seed the canonical fixture.
- Verify identity, provider, fixture revision, settings, catalog cardinality, and
  empty history before announcing readiness.
- Never import or export mutable state.

### `npm run emulators:scratch`

- Use `/.firebase/emulator-scratch/` as the exact ignored export location.
- Import that export when it is present and valid.
- Initialize from the canonical fixture with the runtime profile changed to
  `scratch` when the export is absent.
- Preserve valid mutations and export on coordinated clean shutdown.
- Fail loudly rather than silently reset when the export is unreadable or corrupt.

### `npm run dev`

- Remain the existing Vite development command.
- Retain popup Google sign-in, persistent browser caches, and existing PWA
  development behavior.

### `npm run dev:baseline`

- Be the recommended one-command full-stack workflow.
- Own canonical emulator startup, clear, seed, and verification before starting
  Vite.
- Start Vite on strict port `5174` and fail rather than select another port.
- Use baseline mode, in-memory Auth persistence, in-memory Firestore cache, and no
  development PWA service worker.
- Automatically sign in the fixed mock Google identity without rendering Login or
  opening a popup.
- Render the approved bootstrap/recovery states before exposing the existing app.

### Other commands introduced by the plan

- `npm run test:emulator-baseline`: sole serial alternate-port integration owner.
- `npm run verify:baseline-production`: build, scan, and negative baseline-build
  verification.
- The scenario loader command must require a scenario name and
  `--reference-date YYYY-MM-DD`; its exact package-script name is fixed in TREK-215
  before its RED test is committed.

## Canonical identity and storage

| Field | Canonical value |
| --- | --- |
| Firebase UID | `emulator-baseline-user` |
| Email | `peach.otter.880@example.com` |
| Display name | `Emulator Baseline User` |
| Provider | `google.com` |
| Google provider UID / subject | `google-peach-otter-880` |
| Fixture revision | `emulator-baseline-v1` |
| Baseline auth marker | `emulator-baseline-auth-v1` |

`firebase-admin` is a development dependency used only by scripts outside `src`.
The Auth seed imports exactly one user with the fixed Firebase UID and provider data.
The browser uses a mock Google credential whose JSON subject and email match that
provider identity. Integration verification must prove lookup by Firebase UID and
provider UID and must prove the Firebase client credential resolves the same UID.

Firestore data is owned by `users/emulator-baseline-user` and its existing
subcollections. The user document contains the approved settings plus nonsecret
emulator metadata:

- `emulatorFixtureRevision: "emulator-baseline-v1"`
- `emulatorProfile: "canonical" | "scratch" | "test"`

The scratch initializer changes only the runtime profile marker. Scenario loaders
accept only `scratch` or `test` and refuse `canonical` before writes.

## Canonical settings

| Setting | Value |
| --- | ---: |
| `warmupTime` | 10 |
| `staleThreshold` | 5 |
| `legDayOfWeek` | `None` |
| `defaultRestSeconds` | 90 |

The canonical baseline contains no workout-history documents.

## Canonical catalog

The fixture contains exactly 15 active exercises. Biceps and Shoulders are the only
Tier-1 groups and each has exactly two exercises. Tier-3 Legs are primary leg-day
work; Tier-4 Legs are supplemental. An omitted rest value uses the 90-second global
default.

| ID | Exercise | Group | Tier | Mode | Sets | Rest | Mode configuration | Link |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |
| `barbell-curl` | Barbell Curl | Biceps | 1 | weighted | 3 | default | start 45, target 10, floor 6, step 5 | — |
| `hammer-curl` | Hammer Curl | Biceps | 1 | simple | 3 | default | — | — |
| `overhead-press` | Overhead Press | Shoulders | 1 | weighted | 3 | 120 | start 65, target 8, floor 5, step 5 | — |
| `lateral-raise` | Lateral Raise | Shoulders | 1 | simple | 3 | 60 | — | — |
| `bench-press` | Bench Press | Chest | 3 | weighted | 3 | 120 | start 95, target 10, floor 6, step 5 | — |
| `push-up` | Push-Up | Chest | 3 | bodyweight | 3 | 60 | target 15 | — |
| `pull-up` | Pull-Up | Back | 3 | bodyweight | 3 | 90 | target 8 | — |
| `cable-row` | Cable Row | Back | 3 | weighted | 3 | 90 | start 80, target 10, floor 6, step 5 | — |
| `triceps-pushdown` | Triceps Pushdown | Triceps | 3 | weighted | 3 | 75 | start 40, target 12, floor 8, step 5 | — |
| `plank` | Plank | Core | 3 | simple | 3 | 60 | — | — |
| `back-squat` | Back Squat | Legs | 3 | weighted | 4 | 180 | start 135, target 8, floor 5, step 10 | — |
| `romanian-deadlift` | Romanian Deadlift | Legs | 3 | weighted | 3 | 150 | start 115, target 8, floor 5, step 10 | — |
| `leg-extension` | Leg Extension | Legs | 4 | weighted | 3 | 75 | start 60, target 12, floor 8, step 5 | `leg-curl` |
| `leg-curl` | Leg Curl | Legs | 4 | weighted | 3 | 75 | start 50, target 12, floor 8, step 5 | — |
| `standing-calf-raise` | Standing Calf Raise | Legs | 4 | bodyweight | 3 | 60 | target 15 | — |

The link remains one-way because the existing engine discovers a reverse partner and
existing tests use that convention.

## Fixture ownership and validation

The canonical fixture is a readable committed module at
`scripts/emulator/fixtures/baseline.mjs`. No generated emulator export is committed.
`scripts/emulator/validate-fixture.mjs` reuses exported production catalog and
workout-schema validators where applicable, then adds fixture-only rules:

- exact canonical Auth and provider identity;
- supported fixture revision and runtime profile;
- unique catalog document IDs and valid mode configurations;
- exactly two Tier-1 groups and exactly two exercises in each;
- valid Tier-3 primary and Tier-4 supplemental leg coverage;
- valid one-way link target;
- exactly 15 catalog documents; and
- no canonical history.

Validation is shared by tests, seeders, launchers, and scenario setup. An implementor
must not introduce a second divergent fixture schema.

## Emulator lifecycle architecture

The Node lifecycle wrapper resolves the repository-installed Firebase CLI instead of
assuming a global command. It owns the complete child process tree and uses one
one-shot cleanup state.

Canonical startup order is a hard gate:

1. Preflight configured ports.
2. Start the Auth and Firestore emulators.
3. Wait for bounded hub and service readiness.
4. Clear Auth and Firestore.
5. Validate the fixture.
6. Import the fixed Auth user.
7. Batch the fixed user's settings, metadata, and catalog.
8. Verify Auth by Firebase and provider UID and verify Firestore revision, settings,
   catalog, and empty history.
9. Announce emulator readiness or, for `dev:baseline`, launch Vite.

This ordering prevents Firebase from generating an unexpected UID and prevents
`migrateLocalData` from backfilling the production six-exercise catalog.

Any unexpected owned child exit after launch—zero, nonzero, or signal—moves the
parent atomically to stopping, reports the failed child/code/signal, terminates the
remaining Windows process tree, waits a bounded grace period, force-terminates if
necessary, and exits nonzero. Only an exit caused by an already-active coordinated
user shutdown is normal. `SIGINT`, `SIGTERM`, uncaught exceptions, and unhandled
rejections use the same cleanup path. The launcher never silently restarts or
reseeds after browser launch.

### Integration-test topology

`npm run test:emulator-baseline` is the only integration-process owner. It uses
`firebase.emulator-test.json` with alternate fixed ports (Auth 19099, Firestore
18080, hub 14400, emulator UI disabled), preflights those ports, starts the local CLI,
waits for readiness, seeds and verifies, spawns the focused integration tests
serially, and tears down the whole process tree on success, failure, or timeout. It
fails rather than racing or selecting alternate ports when a configured port is
occupied.

## Baseline browser isolation and production exclusion

`.env.baseline` supplies only nonsecret development mode selection. Baseline code
requires both `import.meta.env.DEV` and `import.meta.env.MODE === "baseline"`.
`src/utils/baselineAuth.js` is dynamically loaded only inside that guard and performs
the mock Google `signInWithCredential` flow.

Baseline bootstrap is the sole readiness owner. The existing Auth observer cannot
expose Login, migration, the app, or the generic `Loading...` state until baseline
bootstrap reaches success. Baseline mode uses memory-only Auth persistence and
Firestore cache on its separate origin. Development PWA registration is disabled.
Normal development retains persistent cache, popup auth, and PWA behavior.

`npm run verify:baseline-production` must:

1. Run the normal production build.
2. Scan all emitted `dist` files for the email, Firebase UID, provider UID, fixture
   revision, and `emulator-baseline-auth-v1` marker.
3. Fail if any marker is present.
4. Run `vite build --mode baseline` and assert that the command is rejected.

The application must reject baseline-mode production builds in configuration, not
merely rely on dead-code elimination.

## Required baseline bootstrap UX artifact

Classification: `required` for the development-only bootstrap/recovery surface.
Production Login, Generate, history, settings, and navigation are `skip-recorded`
because this feature does not change them.

Single job: establish and verify the canonical baseline, then enter the existing
Generate screen without a popup, or explain why the baseline is invalid and how to
recover without pretending evidence is usable.

### Hierarchy and compact wireframes

Loading:

```text
[ Adaptive Workouts ]
[ Preparing emulator baseline… ]
[ Checking seeded account and workout data ]
```

Failure:

```text
[ Adaptive Workouts ]
[ Baseline unavailable ]
[ Specific failure category and concise diagnostic ]
[ Exact restart/retry guidance ]
[ Retry baseline ]
```

The full-page bootstrap occupies the current auth-gate footprint. Retry is the only
primary action, is at least 44 by 44 CSS pixels, remains in the initial viewport, and
has visible focus and a disabled pending state. Long approved diagnostics wrap
without horizontal scrolling and keep Retry above verbose detail. There is no popup
or production-sign-in fallback.

### State and recovery contract

| Scenario | Visible result | Recovery |
| --- | --- | --- |
| B0 loading | First baseline paint and reload show `Preparing emulator baseline…`; no generic Loading, Login, blank screen, or popup. | A whole logical attempt has a 15-second deadline and phase attribution. |
| B1 success | Fixed credential, Firebase UID, provider identity, revision, settings, and catalog revalidate; bootstrap retires and existing Generate appears. | Focus `Generate Workout`, or the containing main landmark if that is more reliable. |
| B2-auth | `Auth emulator unavailable`; auth operation failed or its phase reached the deadline. | Retry may resolve a transient failure. If persistent, stop the owning terminal command and rerun `npm run dev:baseline`. |
| B2-firestore | `Workout data unavailable`; a server-forced settings/catalog/revision read failed or timed out. | Retry may resolve a transient failure. If persistent, stop and rerun `npm run dev:baseline`. |
| B2-identity | `Baseline account mismatch` with expected and observed nonsecret UID/provider detail. | Browser Retry cannot repair seeded identity; stop and rerun `npm run dev:baseline`, wait for Vite to reconnect or reload the page, and confirm bootstrap restarts at B0. |
| B2-revision | `Baseline data mismatch` with expected and observed nonsecret revision. | Browser Retry cannot repair seeded data; stop and rerun `npm run dev:baseline`, wait for Vite to reconnect or reload the page, and confirm bootstrap restarts at B0. |
| B3 retry | Stale error retires immediately, Retry becomes pending, and B0 returns. | Retry without external repair determinately returns to the same failure. Repaired state reaches B1. |
| B4 reload/interruption | Reload during B0 restarts bootstrap; reload after B1 reauthenticates and revalidates memory-only state. | Never reuse stale persistent identity or Firestore data. |

Firebase promises are not cancellable. Cancellation is logical: only one attempt
token is current, and every post-await success, failure, focus, and cleanup transition
checks it. Each timer clears on completion or unmount. The current phase is recorded
immediately before every Firebase operation so deadline attribution is deterministic.
Late superseded Auth results are not signed out because that could invalidate a newer
successful attempt. Immediately before B1, bootstrap revalidates
`auth.currentUser`, Firebase UID, provider identity, and the fixture revision using
server-forced reads.

Failure moves focus once to a programmatically focusable error heading and uses an
appropriate determinate alert/status without repeated announcements. Retry moves
focus to the loading heading/status. Loading and error states retire one another.

### Rendered evidence matrix

- B0 first paint and reload: 375x812, 390x844, 1280x800.
- B1 transition and absence of Login/popup flash: all three viewports.
- Every B2 variant: at least one viewport.
- Longest identity and revision diagnostics: 375x812 and 1280x800.
- B3 transient retry and restart-required repair: representative mobile and desktop.
- B4 reload during loading and after success: representative mobile and desktop.

Each record includes build/commit, fixture revision, viewport, starting state,
actions, observed result, and limitations. Sequential keyboard, actual zoom, safe
area, and reduced-motion follow the finalized capability-aware UX Quality Gate
fallback taxonomy. Unsupported capabilities remain non-pass residual risks.

No continuous health check is added. Baseline validity is established at bootstrap
and reload. Later service loss is surfaced by ordinary Auth/Firestore operations and
the parent launcher terminates the stack. The UI must not display a persistent
“healthy” claim.

## Dynamic history scenarios

Scenario data is separate from the canonical fixture. The loader:

- requires an exact scenario and `--reference-date YYYY-MM-DD`;
- validates the complete scenario before entering a transaction;
- accepts only `scratch` and `test` runtime profiles;
- preserves the fixed user's settings and catalog;
- replaces only the fixed user's history with stable document IDs;
- writes schema-v3 history only and performs no migration; and
- prints the resolved system timezone, reference date, and reference instant.

The reference date means that calendar date in the invoking machine's system
timezone. Generated instants and pinned “now” use system-local noon, then serialize
to ISO. Manual use should pass the current local calendar date. Automated outcome
tests start a process with `TZ=America/Chicago` and pin the clock at local noon,
matching the supported repository environment and the engine's local `setHours()`
and `getDay()` calculations.

### Bounded atomic replacement

- Fail before the transaction if the scenario contains more than 450 documents.
- Within one Firestore transaction, query at most
  `451 - scenarioDocumentCount` history documents.
- If that limited query fills the limit, refuse with instructions to clear or
  reinitialize scratch state.
- Read all returned documents before scheduling writes.
- Delete existing IDs absent from the scenario, then set every stable scenario ID.
- Retain the conservative `existingCount + scenarioCount <= 450` precondition even
  when stable-ID overlap reduces actual writes.
- Keep the transaction callback side-effect free because Firestore may retry it.
- Map request-size, timeout, and exhausted-retry failures to actionable reset
  guidance. All remain atomic.

Tests prove replacement below the bound, refusal with unchanged history at the
derived boundary, stable-ID overlap, concurrent retry or clean failure, canonical
refusal, and settings/catalog preservation.

### Initial scenarios

| Stable scenario | Algorithm contract | Representative visible contract |
| --- | --- | --- |
| Weighted progression decisions | Crafted weighted anchors produce increase, hold, and decrease decisions for separate exercises. | Generated recommendations and rationales visibly distinguish all three decisions. |
| Pivot rotation and staleness | Relative ages make the intended muscle groups stale and exercise pivots rotate deterministically. | Generated workout visibly contains the expected group/exercise rotation and staleness explanation where the UI exposes it. |
| Recent-leg supplemental suppression | A recent primary leg session suppresses Tier-4 supplemental legs under existing engine rules. | Generated workout omits the suppressed supplemental leg entries without implying they were deleted from catalog. |
| Tier-4 quota closed/open | Relative history closes and opens the existing Tier-4 coverage quota deterministically. | Generated workout visibly reflects the expected Tier-4 inclusion state. |

Each definition includes exact relative offsets, valid workout documents, expected
engine/progression assertions, and visible UX outcomes. Repeating the same scenario
and reference date is idempotent. Changing the reference date shifts every stored
date while preserving relative age and expected outcomes.

## Persisted duration compatibility contract

Scenario loaders write complete schema-v3 documents. Existing readers retain their
established legacy and v2 behavior. There is no inference between minutes and
seconds, no mixed-unit heuristic, and no migration.

| Full path | Writers/readers | Unit and precision | Null, missing, zero | Cross-version behavior |
| --- | --- | --- | --- | --- |
| `users/{uid}/history/{workout}.actualDuration` | Existing schema-v2 writers/readers only; scenario loader never writes it. | Minutes as an existing finite nonnegative number; history displays the stored value with `mins`. | Required by a valid v2 document; missing/negative/nonfinite is invalid. Zero is valid. | V2 keeps established minute semantics. V3 forbids this field. No conversion or migration. |
| `users/{uid}/history/{workout}.actualDurationSeconds` | Schema-v3 active-workout writer, v3 reader, and scenario loader. | Nonnegative integer seconds; display formats exact stored seconds as `M:SS`. | Required by valid v3; missing, null, negative, or fractional is invalid. Zero is valid. | V3 canonical total-duration field. V2 does not use it. Readers classify by schema version. |
| `users/{uid}/history/{workout}.exercises[].setRecords[].plannedRestSeconds` | V3 generator/active-workout writer and scenario loader; v3 history reader. | Integer seconds. Non-final configured values are 5–600 inclusive and display as `M:SS`. | Final sets require `null`. Non-final missing/null/out-of-range/fractional is invalid. | Exists only in v3 set records. No legacy/v2 inference. |
| `users/{uid}/history/{workout}.exercises[].setRecords[].workDurationSeconds` | V3 active-workout writer and scenario loader; v3 reader. | Nonnegative integer seconds; display as `M:SS`. | Completed sets require an integer; incomplete sets require `null`. Zero is valid completed work, not missing. | Exists only in v3. Scenario documents obey the same completion contract. |
| `users/{uid}/history/{workout}.exercises[].setRecords[].actualRestSeconds` | V3 active-workout writer and scenario loader; v3 reader. | Nonnegative integer seconds; display as `M:SS` and compare against planned rest without rounding storage. | Completed non-final sets require an integer in saved completed workouts; incomplete and final sets require `null`. Zero is valid. Live unsaved rest may temporarily be null under existing active-workout rules, but scenarios write persisted history only. | Exists only in v3. No legacy/v2 inference or migration. |

Scenario validators validate the complete document before any Firestore write.

## UX reviewer scenario integration

`scripts/emulator/scenarios/manifest.mjs` is self-contained and revisioned. Every
entry requires:

- manifest revision and stable scenario ID/name;
- exact loader command template;
- fixture/profile revision and required reference-date input;
- algorithm precondition and expected internal outcome;
- applicable UX workflow;
- expected visible state and outcome;
- approved viewport/state coverage;
- evidence setup and action fields consumable by
  `docs/templates/ux-evidence-matrix.md`; and
- limitation and residual-risk fields.

The manifest validator rejects missing required fields and unknown manifest
revisions. It does not import the documentation template at runtime or define a
competing evidence taxonomy.

The UX reviewer evaluates rendered clarity, recovery, and visible explanation. Code,
spec, and integration tests own algorithm correctness, schema validity, identity,
rules, and production exclusion. Scenario applicability remains proportional; a
review runs only scenarios relevant to changed surfaces. Unsupported browser
capabilities retain their approved fallback evidence and cannot become passes.

TREK-215 depends on TREK-209, which owns the cumulative PR-ready evidence template
and Summary reference. TREK-215 validates its field mapping against the exact
TREK-209 commit with read-only `git show <commit>:docs/templates/ux-evidence-matrix.md`.
TREK-216 repeats the compatibility check unconditionally. The UX Quality Gate PR
should merge before the emulator-baseline PR. No post-merge adapter task is required.

## Edge cases and failure policy

- Occupied configured ports fail with the exact port and owning command guidance.
- Readiness timeout exits nonzero and cleans the owned process tree.
- An invalid canonical fixture prevents any seed writes.
- An invalid scratch export fails rather than silently resetting user mutations.
- Browser boot never races the Auth/Firestore seed gate.
- Identity or revision mismatch cannot fall back to production Login or production
  defaults.
- Late superseded Firebase promises cannot expose or overwrite a newer attempt.
- Baseline reload cannot reuse persistent Auth or Firestore state.
- Scenario validation or size refusal leaves prior history unchanged.
- Scenario transactions tolerate retry and expose clean failure after exhausted
  conflicts.
- Normal production build contains none of the fixed markers.

## Implementation plan

### TREK-211 — [Planning] Establish deterministic emulator baseline spec and branch

Persist this approved design and complete implementation plan on
`codex/epic-6-emulator-baseline`, commit only the planning artifact, and record the
branch, spec path, and commit on EPIC-6. Verification: `git diff --check` and
`git status --short --branch`. This is the only task authorized by the initial
creation approval.

### TREK-212 — [Execution] Add canonical emulator fixture and validation

Add the fixed fixture, shared validator, fixture tests, `/dev-dist/` and
`/.firebase/emulator-scratch/` ignores, and remove only the validated generated
`dev-dist/`. Preserve production defaults and defer `firebase-admin`.

TDD RED: `npm test -- --run src/tests/emulatorFixture.test.js` fails because the
fixture/validator contract is absent. GREEN: the same command passes all valid and
invalid cases. Then run `npm run lint` and `git diff --check`.

### TREK-213 — [Execution] Add deterministic baseline and scratch emulator lifecycles

Add launcher, seeder, alternate test configuration, serial integration owner,
`firebase-admin` dev dependency, lifecycle/process tests, and real Auth/Firestore
client verification.

TDD RED: focused process tests fail on absent readiness, reset/import/export, corrupt
scratch, port, timeout, and cleanup behavior. GREEN: focused process tests plus
`npm run test:emulator-baseline` pass with no orphaned processes.

### TREK-214 — [Execution] Add isolated popup-free baseline app mode

Add `.env.baseline`, fixed `src/utils/baselineAuth.js`, mode/cache/PWA configuration,
parent orchestration, bootstrap UI, production guard verification, tests, and
rendered evidence.

TDD RED: focused auth/config/App tests fail because baseline bootstrap, guards, and
recovery do not exist. GREEN: targeted tests, `npm run test:emulator-baseline`,
`npm run verify:baseline-production`, lint, normal build, and manual no-popup exact-UID
smoke pass. After simplification and coordinator-rendered verification, run fresh UX
usability, code, and task-conformance reviews.

### TREK-215 — [Execution] Add reference-date emulator history scenarios and UX manifests

Add scenario definitions, revisioned manifest, validators, loader, bounded atomic
replacement, outcome tests, and emulator integration. Depend on both TREK-214 and
TREK-209; do not change the canonical UX taxonomy.

TDD RED: focused scenario tests fail because the loader/manifest and validated
outcomes do not exist. GREEN: targeted validation/outcome tests and the named emulator
integration cover idempotence, date shifting, transaction boundaries, preservation,
and all four scenarios.

### TREK-216 — [Review] Validate emulator baseline and publish draft PR

Document all workflows and recovery; run `npm run test:emulator-baseline`,
`npm run verify:baseline-production`, `npm test -- --run`, `npm run lint`,
`npm run build`, and `npm run ci:check`; perform the Windows Ctrl+C and rendered
workflow matrix; and unconditionally validate the manifest against TREK-209's exact
commit.

Invoke the epic-development-branch-completion workflow, run fresh cumulative epic
and spec/conformance reviews, fix/commit/re-review when required, push, open a draft
PR against `main`, and confirm remote checks or record the exact coordinator-owned
next step. Draft PR creation is the completion boundary.

## Dependencies and execution boundary

```text
TREK-211 -> TREK-212 -> TREK-213 -> TREK-214 --+
                                                 +-> TREK-215 -> TREK-216
TREK-207 -> TREK-208 -> TREK-209 ----------------+
```

The existing UX Quality Gate chain does not depend on emulator work. Tasks are
otherwise serial to avoid overlapping ownership of fixture, scripts, auth, and
configuration. Every behavior task receives a fresh implementor and uses RED/GREEN
TDD. Every nontrivial green diff receives a fresh code simplifier, coordinator final
verification, and fresh code and task-conformance reviews. TREK-214 additionally
receives rendered verification and a fresh UX usability review. Each task is committed
and summarized before the next starts.

After TREK-211 completes, TREK-212 remains `todo`. A fresh user approval is required
to start TREK-212. The user may instead resume the already-ready TREK-207; no chat
context is required to make that choice.

## Approval and review record

- Discovery brief and decision log: user approved.
- Feature-planner advisory draft: incorporated after configured-model fallback.
- Architecture review: approved after seed ordering, production isolation, browser
  cache/Auth isolation, bounded history transaction, and launcher cleanup changes.
- UX design review: approved after distinct failures, bounded attempts, focus/retry,
  first-paint, viewport, and recovery changes; architecture confirmed no further UX
  design pass was required.
- Senior-developer planning review: approved after exact artifacts, named integration
  topology, Task-1 plan persistence, scenario transaction bound, production guard
  command, and TREK-209 dependency changes.
- Final design, bounded replacement amendment, scenario-to-UX integration, and this
  implementation plan: user approved.

The unavailable preferred reviewer model used the repository's documented
nearest-tier fallback. Duplicate search found the same disposition in CMT-135 and an
existing fallback policy in TREK-205, so no additional workflow task is proposed.
