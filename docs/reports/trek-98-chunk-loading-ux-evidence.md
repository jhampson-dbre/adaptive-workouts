# TREK-98 Chunk Loading UX Contract

`UX-ARTIFACT: trek-98-chunk-loading@v9`

This is the authoritative approved planning artifact for TREK-98. It expands the
durable implementation contract in Trekker CMT-253 into scenario-indexed UX and
build-budget requirements. Every wireframe is `planning-only`, not rendered evidence.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | Code splitting changes when three primary authenticated surfaces become available and adds loading/import-failure states affecting hierarchy, focus, feedback, interruption, and recovery. |
| Proportional artifact | This file; limited to authorization-to-Plan, Plan-to-Catalog, generated-Plan-to-Workout, bundle enforcement, and PWA availability. |
| Planning artifact revision | `UX-ARTIFACT: trek-98-chunk-loading@v9` at this path; v3 incorporated UX review clarifications, v4 added architecture constraints, v5-v7 proved and hardened Firestore isolation, v8 restored the original universal application-JavaScript 500,000-byte ceiling after supported Rolldown splitting brought every app chunk below it, and v9 makes the already-approved fresh-retry identity explicit. |
| Planning wireframe status | `planning-only` |
| Required UX design review | v2 intent was approved before implementation and summarized in CMT-253; this persisted revision receives fresh UX and architecture conformance checks before product code. |
| Architecture authority | Architecture owns chunk boundaries, retryable module loading, auth isolation, manifest measurement, cache strategy, security, and feasibility. |

## Product and architecture boundaries

- Signed-out, access-checking, pending-approval, verification-error, and baseline
  bootstrap surfaces remain in the boot path. Authorization still fails closed.
- The authorized Plan surface becomes a lazy boundary requested only after approval.
  It contains the authenticated shell and Generator. App (or a non-rendering owner at
  the same level) retains identity-scoped Plan selections, generated-workout input,
  and destination context above the lazy boundary.
- Catalog Settings and Workout are separate lazy destinations requested only when
  chosen. The prior main surface is no longer rendered or interactive after
  navigation; only lifted state remains owned by the authorized shell.
- A fully cached installed build must reach Plan, Catalog, and Workout offline,
  regardless of the cache mechanism selected by architecture. A first-ever uncached
  visit is not claimed to work offline. No speculative prefetch is required.
- Retry starts a fresh import attempt instead of replaying a cached rejection or
  reloading the application. Each retry generation gives the destination's emitted
  lazy-entry module a fresh fragment-keyed module-map identity; whole-graph
  re-evaluation is outside this task's contract.
- Recovery preserves the current account, Generator selections, and generated
  workout input. It does not rerun approval or generate a replacement workout.
- Same-UID access revalidation preserves that lifted state while authorized content
  is inert/unmounted. Sign-out, a changed UID, or confirmed revoked/pending access
  clears it before another authorized surface can render. A transient verification
  error keeps it inert for same-UID retry but never displays it.
- "Same preserved Workout" means the generated workout input and destination. It
  does not expand current behavior to preserve WorkoutView's internal reducer,
  timers, expanded rows, or progress across a Settings detour; those currently reset
  when WorkoutView unmounts. Changing that behavior is out of TREK-98 scope.
- An auth/account transition unmounts all authorized boundaries and supersedes every
  pending attempt. A late result cannot restore protected content or move focus.
- No telemetry is added. Unavailable production telemetry is not a pass.

## Retry and ownership architecture

- Each destination attempt is identified by authorized UID, destination, and retry
  generation. Navigation, identity/access changes, and newer generations retire the
  prior owner; every state/focus effect verifies current ownership.
- React lazy loaders, import promises, and browser module-map failures are cached.
  Retry therefore creates a fresh lazy component type and imports the Vite-resolved
  emitted destination entry with a unique fragment for each retry generation before
  resetting the error boundary. The fragment changes module identity without changing
  the precached network URL; query-string retry keys and app reloads are prohibited.
- The retry control remains the same mounted, focused element while the fresh attempt
  is pending. It is disabled and named `Retrying…`; the initial Suspense fallback
  must not replace it.
- Module evaluation has no user-visible side effects. JavaScript evaluation cannot
  be canceled, so retired attempts may finish evaluating but cannot navigate, expose
  state, announce feedback, or move focus.

## Feedback, placement, and focus contract

| Transition | Loading | Failure | Recovery and interruption | Success focus |
| --- | --- | --- | --- | --- |
| L1 Authorized Plan | Focus heading `Loading workout planner…`; one polite status `Loading the workout planner.` | Focus heading `Workout planner unavailable`; one alert `The workout planner couldn’t be loaded.` | Primary `Retry loading planner`; retry retains the control, disables it, renames it `Retrying…`, and exposes loading status as the sole live region | Existing `Generate Workout` heading |
| L2 Catalog Settings | Focus heading `Loading catalog settings…`; one polite status `Loading catalog settings.` | Focus heading `Catalog settings unavailable`; one alert `Catalog settings couldn’t be loaded.` | Primary `Retry loading catalog settings`; when opened from Plan, header `Back to Generator` and Settings `Close` supersede pending/error Settings, retire feedback, ignore late results, restore preserved Plan, and focus `Generate Workout` | Existing `Catalog Management` heading, including its internal data-loading state |
| L3 Workout | Focus heading `Loading your workout…`; one polite status `Loading your workout.` | Focus heading `Workout unavailable`; one alert `Your generated workout couldn’t be loaded.` | Primary `Retry loading workout`; header `Manage Catalog` supersedes pending/error Workout, retires feedback, ignores late results, and focuses the Settings loading/destination heading. While Settings was opened from Workout, the header escape is `Back to Workout` and Settings `Close` uses the same preserved-Workout destination | Existing initial `Ready to sweat?` heading |

Shared rules:

- Loading/failure is the only main job and appears in normal document flow directly
  below any surviving authenticated header. The previous surface is not hidden
  underneath and is not interactive.
- Failure retires loading status. Retry retires failure alert. Success retires all
  transient feedback. No stale announcement or focus move may replay later.
- `Manage Catalog` remains usable during L3. Settings opened from Plan uses `Back to
  Generator`; Settings opened from Workout uses `Back to Workout`. Settings' existing
  `Close` control matches that context-sensitive destination. Returning from Settings
  resumes the preserved destination through its normal loading/success contract.
- Header actions precede contextual Retry in sequential keyboard order. Recovery
  never traps focus. Text and controls wrap without horizontal overflow or required
  horizontal scrolling.
- Required evidence covers 320px, 375px, 768px, and 1280px widths and actual 200%
  zoom at 375px and 1280px when supported. Every L1-L3 loading, failure, retry,
  success, and applicable escape state must remain visible and operable at 320px.

## Planning wireframes

### L1 - authorization to Plan

```text
[Checking access]
       |
       v
[Loading workout planner…]
  Loading the workout planner.
       | success                       | failure
       v                               v
[Generate Workout]         [Workout planner unavailable]
                            The workout planner couldn’t be loaded.
                            [Retry loading planner]
```

### L2 - Plan to Catalog Settings

```text
[Adaptive Hypertrophy] [Back to Generator]
[Loading catalog settings…]
  Loading catalog settings.
       | success                       | failure
       v                               v
[Catalog Management]       [Catalog settings unavailable]
                            Catalog settings couldn’t be loaded.
                            [Retry loading catalog settings]
```

Back invalidates the destination attempt and returns to the preserved Plan even if
the import later resolves. The module boundary retires before Settings' existing
internal data-loading UI renders, so their feedback never overlaps.

### L3 - generated Plan to Workout

```text
[Adaptive Hypertrophy] [Manage Catalog]
[Loading your workout…]
  Loading your workout.
       | success                       | failure
       v                               v
[Ready to sweat?]          [Workout unavailable]
                            Your generated workout couldn’t be loaded.
                            [Retry loading workout]
```

The authorized shell owns the same generated workout through loading, Settings
navigation, retry, and success. During L3-to-Settings navigation the authenticated
header reads `Back to Workout`, and Settings `Close` returns to the same preserved
Workout. A superseded Workout result cannot navigate or focus.

## Build-budget contract

The merged-main baseline measured on 2026-07-21 produced:

| Area | Baseline |
| --- | ---: |
| App JavaScript raw | 897,788 bytes |
| App JavaScript gzip | 265.98 kB reported by Vite |
| PWA precache | 8 entries / 893.04 KiB reported by vite-plugin-pwa |

`npm run ci:build` builds and then fails with an actionable asset report if any
enforced ceiling is exceeded:

| Enforced area | Raw ceiling | Gzip ceiling |
| --- | ---: | ---: |
| Boot JavaScript closure | 760,000 bytes | 225,000 bytes |
| First-Plan JavaScript closure | 760,000 bytes | 225,000 bytes |
| Each emitted application JavaScript chunk, including Firestore SDK/support | 500,000 bytes | not separately enforced |

- Boot is entry JavaScript plus its static JavaScript closure before Plan is
  requested. First-Plan is the unique union of boot and the authorized Plan module's
  static JavaScript closure; it excludes lazy Settings and Workout.
- Measurement uses the emitted Vite manifest and actual hashed assets. Gzip bytes are
  computed deterministically. Renaming cannot evade a ceiling.
- The report lists included assets and raw/gzip bytes, then totals and ceilings.
- Service-worker runtime files and total PWA precache bytes are reported separately
  and excluded from app-JavaScript ceilings. Missing manifest, app assets, service
  worker, or precache output fails instead of reporting zero.
- Explicit universal per-chunk enforcement replaces the generic recurring 500 kB
  warning. Persistent Firestore caching remains required; memory-only cache or
  Firestore Lite is not an authorized way to meet the budget.

Machine definitions:

- Production builds emit `.vite/manifest.json`. Exactly one manifest record must have
  `isEntry: true`. The authorized Plan root is the exact manifest key
  `src/components/AuthorizedApp.jsx` and must have `isDynamicEntry: true`.
- A closure recursively follows only `imports`, not `dynamicImports`; cycles are
  deduplicated by emitted `file`. Missing records, non-JavaScript closure files,
  duplicate emitted files with conflicting records, missing assets, or unexpected
  entry/root counts fail with actionable diagnostics.
- Gzip uses Node `zlib.gzipSync` with `{ level: 9, mtime: 0 }` on emitted file bytes.
  Synthetic tests pin totals so runtime/default changes cannot silently alter CI.
- vite-plugin-pwa/Workbox `manifestTransforms` captures its final precache URL list in
  a machine-readable `.vite/pwa-precache.json`. The checker resolves those URLs to
  actual output files, reports their raw total, and requires every app-JavaScript
  manifest file (including Plan, Settings, and Workout closures) to be present.
- `sw.js` and emitted Workbox runtime files are required and reported separately in
  raw and deterministic gzip bytes. The checker never treats all files in `dist` as
  proof that a file is precached.
- The Firestore allowance applies to exactly one explicit code-splitting group named
  `firestore-sdk`. Vite 8 uses `build.rolldownOptions.output.codeSplitting.groups`
  with a cross-platform test matching only resolved module IDs under
  `node_modules/@firebase/firestore/` and `includeDependenciesRecursively: false`, so
  shared or unrelated dependencies are not absorbed. The supported execution-order
  safeguards are configured as required by Rolldown; deprecated Rollup
  `manualChunks` and unsupported `onlyExplicitManualChunks` are prohibited.
- A build hook emits machine-readable chunk provenance mapping output file to
  normalized module IDs. The checker requires exactly one JavaScript manifest record
  named `firestore-sdk`, exactly one matching provenance record, and at least one
  `@firebase/firestore` module. Every member must be under `node_modules/`; any `src/`
  module fails. Any Firestore-package module emitted in another chunk also fails.
- The `firestore-sdk` chunk must not appear in the boot or first-Plan static closure,
  regardless of those closures' totals. Missing, duplicate, mixed, differently named,
  or leaked ownership records fail. It remains subject to the same 500,000 raw-byte
  ceiling as every other manifest JavaScript file and always reports gzip.
- Synthetic tests cover the passing isolated Firestore group and every failure mode:
  missing/duplicate manifest or provenance records, no Firestore member, first-party
  or other-package mixing, Firestore in another chunk, boot/Plan leakage, and each
  applicable size ceiling.

## Canonical scenario-indexed planning matrix

Every execution field is a planning placeholder until the post-simplification,
per-run probe. Fields remain separate so execution evidence can replace them without
reinterpretation.

| Field | L1 Plan | L2 Catalog | L3 Workout | B1 Budgets | P1 Cached offline |
| --- | --- | --- | --- | --- | --- |
| Scenario ID and name | L1 - reach authorized Plan | L2 - reach/recover Catalog | L3 - reach/recover same Workout | B1 - enforce bundle ceilings | P1 - reach lazy destinations offline after full cache |
| Changed surface | Access-to-Plan | Header and Settings destination | Plan-to-Workout and header | none; build/CI | Installed/offline path |
| Applicability | `applicable`; new lazy primary job | `applicable`; lazy navigation/recovery | `applicable`; interrupted primary workflow | `applicable`; task enforcement | `applicable`; preserve PWA promise |
| Approved flow | Exact L1 and identity/retry ownership contracts above | Exact L2 and identity/retry ownership contracts above | Exact L3 contract above; generated input preserved, internal WorkoutView state unchanged across Settings detour | Exact manifest roots/closures, deterministic gzip, universal application-JavaScript 500,000 per-chunk ceiling, Firestore provenance/boot exclusion, artifact failures, and thresholds above | All three destinations listed in captured final precache and available after full cache |
| Per-run capability probe | `not-probed` | `not-probed` | `not-probed` | `not-probed` | `not-probed` |
| `capability_state` | `not-probed` | `not-probed` | `not-probed` | `not-probed` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` | `not-applicable-before-probe` | `not-applicable-before-probe` | `not-applicable-before-probe` | `not-applicable-before-probe` |
| Evidence kind | `not-run` | `not-run` | `not-run` | `not-run` | `not-run` |
| Outcome | `not-tested` | `not-tested` | `not-tested` | `not-tested` | `not-tested` |
| Changed-surface routing | Direct defect blocks; auth change escalates | Direct defect blocks; hierarchy expansion escalates | Direct defect blocks; workout semantic change escalates | CI defect blocks; ceiling change needs approval | Cached-offline defect blocks; first-visit offline out of scope |
| Evidence obligation | `unsatisfied` | `unsatisfied` | `unsatisfied` | `unsatisfied` | `unsatisfied` |
| Disposition | `blocking` until evidence | `blocking` until evidence | `blocking` until evidence | `blocking` until evidence | `blocking` until evidence |
| Allowed recommendation | `blocked` | `blocked` | `blocked` | `blocked` | `blocked` |
| Build / commit | `not-run` | `not-run` | `not-run` | `not-run` | `not-run` |
| Fixture / data revision | `not-run`; synthetic approved user | `not-run`; synthetic selections/catalog | `not-run`; stable synthetic workout IDs | `not-run`; synthetic manifests/assets | `not-run`; synthetic installed build |
| Requested and actual viewport | `not-run`; 320/375/768/1280 and zoom | `not-run`; 320/375/768/1280 and zoom | `not-run`; 320/375/768/1280 and zoom | genuinely not applicable | `not-run`; 375 and 1280 representative |
| Starting state | `not-run`; approved user at checking | `not-run`; Plan with non-default selections | `not-run`; immediately after generation | `not-run`; fixture/build output | `not-run`; fully cached build before offline |
| Action | `not-run`; authorize, same-UID revalidate, switch/revoke, fail/retry/succeed, retire late results | `not-run`; open, Back, reopen, fail/retry/succeed, retire late navigation/auth results | `not-run`; load, open Catalog, return, fail/retry/succeed with same generated input and current internal-state reset behavior | `not-run`; cross each ceiling, exercise duplicate/missing/cyclic records and deterministic gzip, omit artifacts, pass production | `not-run`; inspect captured final precache then visit Plan/Catalog/Workout offline |
| Observed result | `not-run` | `not-run` | `not-run` | `not-run` | `not-run` |
| Evidence link and limitation | `planning-only`; render transition; component-test failure/retry/stale/auth focus | `planning-only`; render loading/success; test Back, internal-load handoff, state/focus | `planning-only`; render loading/success; test same-workout and navigation/auth supersession | `planning-only`; require RED fixtures and GREEN exact membership/totals | `planning-only`; inspect generated cache and probe available offline control with fallback metadata |

## Scope and escalation

- Direct changed-surface defects in L1-L3 block TREK-98 completion.
- Changes to access control, Firestore ownership, persisted workout semantics,
  navigation hierarchy, or approved copy/focus/recovery return to design/architecture.
- Meeting a budget through new dependencies, telemetry, service-worker strategy
  changes with user-visible consequences, or broader redesign requires a user decision.
- EPIC-13 must preserve the final chunk boundaries and loading/error contracts.
