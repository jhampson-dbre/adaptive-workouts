# Workout Phase Timing A2 UX Evidence

`UX-ARTIFACT: workout-phase-timing@v1`

This report records the coordinator-owned TREK-218 execution evidence for the
Settings portion of approved scenario T-10. The authoritative approved behavior is
in `docs/specs/2026-07-18-workout-phase-timing.md`; this report does not expand that
design or claim evidence for the later History, active Timing, recovery, or schema-v4
surfaces.

All rendered observations used the local canonical Firebase emulator baseline and
its synthetic seeded identity. No production account or personal data was used.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | TREK-218 adds two persisted Settings controls, validation feedback, and generated plan metadata. T-10 requires rendered Settings and accessibility evidence. |
| Proportional artifact | `docs/specs/2026-07-18-workout-phase-timing.md`, especially “Settings and immutable plan targets,” T-10, and the A2 task/evidence row. The proportional execution scope is only the two new phase-setting controls plus their save/reload lifecycle. |
| Planning artifact revision | `UX-ARTIFACT: workout-phase-timing@v1`; authoritative approved design at `docs/specs/2026-07-18-workout-phase-timing.md`, planning commit `a10eaedab9887316dab041ac04d96f3694b73701` (rebased as `49a2e40`). |
| Planning wireframe status | `planning-only`; the approved spec describes the Settings journey and T-10 outcome. This execution report contains rendered evidence, not a replacement wireframe. |
| Required UX design review | Completed during approved feature planning before A1; TREK-218 preserves the approved whole-minute inputs and adds no redesign. |
| Architecture authority | Architecture retains authority for system boundaries, data, security, and feasibility. A2 keeps production history on schema v3 and does not activate phase timing. |

## Run metadata

| Field | Record |
| --- | --- |
| Run ID | Final WT2 run `CAP-218-2026-07-21-IAB-02`; supersedes WT1 run `CAP-218-2026-07-21-IAB-01`. |
| Build / commit | Worktree build `TREK-218-A2-WT2` on rebased planning base `49a2e40`; 121 focused tests, 362 full-suite tests with 10 pre-existing skips, `npm run ci:build`, `npm run ci:workflow`, and `git diff --check` passed. |
| Fixture / data revision | Canonical local emulator baseline, synthetic seeded user/catalog/settings. Starting values were Warmup 10 minutes, Cooldown 5 minutes, and default rest 90 seconds. Boundary evidence temporarily saved 0/60, then restored 10/5 and verified the restoration after reload. |
| Harness | Final Codex in-app browser session `CAP-218-2026-07-21-IAB-02`, local Vite 8.1.2 baseline server at 127.0.0.1, Firebase Auth/Firestore emulators. |
| Safety | Synthetic local data only. Screenshots were inspected in-session but not persisted, avoiding binary repository churn; the reproducible viewport, DOM, accessibility, value, reload, console, and build observations are recorded below. |

## Post-review delta status

The first rendered run above covered worktree `TREK-218-A2-WT1`. Fresh code and UX
review then found that blank inputs were coerced to zero, phase-setting save failures
were not visible, direct engine callers could produce a non-integer or negative
Performance target, and the new inputs lacked the approved 44 CSS-pixel minimum.
TREK-218 comment `CMT-280` records the approved-intent clarification.

Worktree `TREK-218-A2-WT2` now:

- rejects blank Warmup and Cooldown values without saving;
- rejects a generation budget that does not convert to nonnegative whole seconds;
- exposes an associated phase-specific save-failure alert and permits retry; and
- applies a 44px minimum height to both phase inputs.

Coordinator verification for WT2 passed 121 focused tests, 362 full-suite tests with
10 pre-existing skips, `npm run ci:build`, `npm run ci:workflow`, and
`git diff --check`. The review-driven fixes were localized guards, phase-specific
error handling, and one narrow CSS rule; they did not materially reshape complexity,
so the single optional post-review simplification rerun was not used.

Final run `CAP-218-2026-07-21-IAB-02` re-executed A2-S1 through A2-S3, measured both
phase inputs at every required viewport, rendered both blank-validation paths, and
verified recovery plus reload. The selected browser exposes viewport and page-asset
capabilities but no deterministic request interception, network rejection, or offline
switch. Firestore's persistent offline writes remain pending rather than rejecting,
so stopping the emulator would not exercise the rejected-promise branch safely or
deterministically. A2-S5 therefore records rendered-primary evidence for the
supported WT2 behavior and a component/source fallback with an A7 reactivation
obligation for the unsupported save-rejection injection.

## Scenario A2-S1 — Canonical settings load and responsive presentation

| Field | Record |
| --- | --- |
| Scenario ID and name | `A2-S1` — Warmup and Cooldown controls load with canonical minute values and remain usable at required viewports. |
| Changed surface | Settings / Catalog Management top settings group. |
| Applicability | `applicable`; both controls are new changed-surface UI. |
| Per-run capability probe | WT2 in-app browser viewport override, rendered screenshot inspection, DOM snapshot, and bounded geometry read at 320×568, 375×667, 568×320, 768×768, and 1280×800. Each viewport was allowed to settle before capture. |
| `capability_state` | `supported` for the five requested viewports and screen-reader-facing DOM semantics. |
| Unsupported metadata | Not applicable for the supported viewport/semantic portion. |
| Evidence kind | `rendered-primary` |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect found. |
| Evidence obligation | `satisfied` for requested viewport rendering. |
| Disposition | `not-applicable` |
| Allowed recommendation | `rendered-usability-pass` for viewport rendering and semantic labeling. |
| Build / commit | `TREK-218-A2-WT2` / base `49a2e40` |
| Fixture / data revision | Canonical synthetic baseline; restored Warmup 10, Cooldown 5. |
| Requested and actual viewport | Requested/actual: 320×568, 375×667, 568×320, 768×768, 1280×800. Document scroll widths were 305, 360, 553, 753, and 1265 respectively, all below the requested viewport width. At every viewport both Warmup and Cooldown measured 65×44 CSS pixels. |
| Starting state | Authenticated synthetic baseline on Settings with a 90-second rest setting and populated catalog. |
| Action | Open Manage Catalog; inspect Warmup/Cooldown controls, header/action placement, labels, values, and reflow at each viewport. |
| Observed result | “Warmup minutes” loaded as 10 and “Cooldown minutes” as 5. Both were exposed as uniquely labeled spinbuttons and met the approved 44×44 minimum through an observed 65×44 rendered box. Controls, heading, close/back actions, and surrounding Settings content remained within the viewport without horizontal overflow; landscape retained normal sizing and reachability through vertical scroll. |
| Evidence link and limitation | Text-only durable evidence by design; safe synthetic screenshots were inspected transiently and exact reproducible geometry is recorded here. This row does not claim 200% browser zoom. |

## Scenario A2-S2 — Validation, accessible feedback, and retirement

| Field | Record |
| --- | --- |
| Scenario ID and name | `A2-S2` — Invalid fractional minutes expose actionable feedback; a valid boundary retires the error and saves canonical seconds. |
| Changed surface | Warmup/Cooldown inputs and inline alert. |
| Applicability | `applicable`; validation and recovery are approved changed-surface behavior. |
| Per-run capability probe | WT2 at 375×667: focus each phase spinbutton, select its content with Control+A, clear it with Backspace, blur through the adjacent phase control, inspect the rendered alert/ARIA/geometry, then restore the canonical value and inspect feedback retirement. A keyboard `Tab` probe again did not move focus in this browser session; pointer blur completed the rendered lifecycle while component tests exercised the same blur handler. |
| `capability_state` | `partial`; rendered feedback, focus visibility, labels, ARIA association, and recovery were supported. A complete keyboard-only blur sequence was not established by this run. |
| Unsupported metadata | The unsupported classification is not asserted from one inconclusive keypress. Limitation: this run could not complete the keyboard-only blur transition. Fallback: uniquely labeled native number inputs, visible focus outline, component blur tests, and rendered pointer-blur lifecycle. Residual risk: exact keyboard-only traversal remains to be re-probed in the next controlled Timing presentation run. Reactivation trigger: A7/A8 integrated T-10 evidence or a harness run with reliable Tab traversal. |
| Evidence kind | `rendered-primary` for feedback/recovery; `component-test` fallback for handler behavior. |
| Outcome | `observed-pass` for rendered validation and recovery; keyboard-only traversal is `inconclusive`. |
| Changed-surface routing | No direct defect observed. The keyboard capability limitation is explicit and routed to the next integrated T-10 run, not treated as a usability pass. |
| Evidence obligation | `satisfied` for rendered validation/recovery; keyboard traversal retained as a bounded residual obligation. |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | `TREK-218-A2-WT2` / base `49a2e40` |
| Fixture / data revision | Canonical synthetic baseline. |
| Requested and actual viewport | 320×568 and 375×667 portrait. |
| Starting state | Warmup 10, Cooldown 5; no phase-setting error. |
| Action | Clear Warmup using keyboard selection/deletion and blur through Cooldown; restore Warmup 10; clear Cooldown and blur through Warmup; restore Cooldown 5. |
| Observed result | Warmup and Cooldown each remained visibly blank rather than coercing to zero. Each rendered its phase-specific “must be a whole number from 0 through 60 minutes” alert, exposed `aria-invalid="true"` and its own `aria-describedby`, retained a 65×44 target, and retired the alert/ARIA state after restoration. The active control retained a visible focus outline. |
| Evidence link and limitation | Text-only durable evidence; the transient synthetic Warmup screenshot showed the 44px blank control and associated alert without obscuring Cooldown or recovery actions. Keyboard deletion was rendered; harness Tab traversal remains the stated limitation. |

## Scenario A2-S3 — Boundary persistence and immutable plan-target handoff

| Field | Record |
| --- | --- |
| Scenario ID and name | `A2-S3` — Canonical boundaries persist, reload truthfully, and generation carries immutable phase targets without changing the array-based handoff. |
| Changed surface | Settings save/reload; generated metadata has no new A2 presentation surface. |
| Applicability | `applicable` for save/reload; generated metadata is source/test evidence because A2 intentionally does not activate Timing UI. |
| Per-run capability probe | WT2 restored valid 10/5 after both blank-validation recoveries, reloaded the authenticated emulator app, reopened Settings, inspected values/geometry, and inspected console warnings/errors. Pair with focused storage/Settings/Generator/engine tests and the WT1 0/60 boundary reload evidence. |
| `capability_state` | `supported` for rendered Settings persistence; generated metadata is intentionally non-presentational in A2. |
| Unsupported metadata | Not applicable. |
| Evidence kind | `rendered-primary` for save/reload plus `component-test` and `source-audit` for the non-presentational immutable snapshot. |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect found. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable` |
| Allowed recommendation | `rendered-usability-pass` for Settings persistence. |
| Build / commit | `TREK-218-A2-WT2` / base `49a2e40` |
| Fixture / data revision | Synthetic canonical baseline; temporary 0/60 boundaries; final restored 10/5. |
| Requested and actual viewport | 375×667 for final WT2 recovery/reload; geometry also reconfirmed at all A2-S1 viewports. |
| Starting state | Authenticated Settings with Warmup 10 and Cooldown 5. |
| Action | WT1: save 0/60, reload, and restore 10/5. WT2: clear/recover both controls to 10/5, reload and reopen Settings, and inspect browser warnings/errors. |
| Observed result | WT1 reload returned 0/60 exactly. WT2 recovered both blank states to 10/5, retired their alerts, and reloaded 10/5 exactly with both inputs still 65×44. No browser console warnings or errors were present. Focus returned to the normal Plan heading after reload, and Settings reopened through Manage Catalog. Focused tests passed 121/121; full tests passed 362 with 10 pre-existing skips. |
| Evidence link and limitation | The immutable non-enumerable `phaseTargets` handoff is not visible until later Timing tasks by approved design; engine and Generator regressions prove its frozen values and unchanged array identity/selection output. |

## Scenario A2-S4 — Zoom, reduced motion, and offline/PWA fallbacks

| Field | Record |
| --- | --- |
| Scenario ID and name | `A2-S4` — Settings remain functionally neutral under reflow, motion preferences, and PWA packaging. |
| Changed surface | Settings controls and emitted Settings application chunk. |
| Applicability | `applicable` as the A2 subset of T-10; no A2-specific animation or offline mutation workflow is introduced. |
| Per-run capability probe | Browser capability documentation exposed viewport override but no deterministic zoom, reduced-motion emulation, or offline switch. Bounded rendered fallback used 320px reflow. Source audit checked that the controls add no motion-dependent state. `npm run ci:build` produced the Settings chunk and successful Workbox precache plus bundle-budget evidence. |
| `capability_state` | `partial` |
| Unsupported metadata | `capability_reason: unsupported-by-harness`; harness/session `CAP-218-2026-07-21-IAB-02`; eligible alternatives were narrow-width rendered reflow, source audit, component tests, and emitted Workbox/build artifacts. Selected fallback: 320px rendered reflow for zoom pressure, source audit for reduced-motion neutrality, and Workbox/build evidence for packaged offline availability. Limitation: no direct 200% zoom, preference emulation, or browser offline navigation. Residual risk: installed/offline behavior and exact 200% zoom remain unobserved in this A2 run. Reactivation trigger: A7/A8 integrated T-10 capability probe or a future harness exposing those controls. |
| Evidence kind | `rendered-proxy`, `source-audit`, `component-test` |
| Outcome | `inconclusive` for direct 200% zoom/offline; fallback checks passed and found no static defect. |
| Changed-surface routing | No direct defect proven. Capability gaps remain explicit and must not be presented as direct rendered passes. |
| Evidence obligation | `satisfied` with prescribed fallback and retained integrated-run obligation. |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | `TREK-218-A2-WT2` / base `49a2e40`; `ci:build` passed. |
| Fixture / data revision | Synthetic canonical baseline and production Vite/PWA artifacts. |
| Requested and actual viewport | Requested direct 200% zoom; actual 320×568 narrow-width rendered proxy. |
| Starting state | Settings open with canonical values; production build emitted. |
| Action | Inspect narrow reflow, changed-source motion behavior, build manifest/bundle report, and Workbox generation. |
| Observed result | New controls remained visible and recoverable at 320px without horizontal overflow. They introduce no motion-dependent feedback. `ci:build` emitted the WT2 Settings chunk, generated a 22-entry Workbox precache, and passed all bundle ceilings. |
| Evidence link and limitation | Text-only durable evidence with exact build output available from the verification run. Static/proxy evidence is not claimed as a direct zoom, reduced-motion, or offline usability pass. |

## Scenario A2-S5 — Review-fix rendered delta

| Field | Record |
| --- | --- |
| Scenario ID and name | `A2-S5` — Review-fix blank validation, failed-save recovery, retry, and target sizing. |
| Changed surface | Warmup/Cooldown inputs and inline alerts. |
| Applicability | `applicable`; direct changed-surface review findings and CMT-280 clarification. |
| Per-run capability probe | Final WT2 run rendered both blank-validation/recovery paths and measured both inputs at every required viewport. Browser/tab capability probes exposed viewport, visibility, and page-assets only; no request interception, deterministic rejected-write injection, or offline switch. Firestore persistent offline writes would remain pending, so terminating the emulator is not an eligible rejected-promise probe. |
| `capability_state` | `partial` |
| Unsupported metadata | `capability_reason: unsupported-by-harness`; harness/session `CAP-218-2026-07-21-IAB-02`; eligible alternatives were emulator termination, component injection, and later controlled-harness evidence. Emulator termination was rejected because Firestore offline persistence produces a pending write rather than the required rejection and would invalidate the fixture lifecycle. Selected fallback: component test with rejected `saveSettings`, source audit of the associated alert/retry path, and rendered evidence of the shared alert/retirement UI through blank validation. Limitation: the phase-save rejection itself was not produced in the browser. Residual risk: browser integration of the rejection branch remains unobserved. Reactivation trigger: TREK-223/A7 controlled non-production Timing harness and TREK-224/A8 integrated T-10 run. |
| Evidence kind | `rendered-primary` for blank validation/target geometry; `component-test` and `source-audit` fallback for save rejection/retry. |
| Outcome | `observed-pass` for rendered WT2 blank recovery and target sizing; save rejection injection is `inconclusive` with passing fallback evidence. |
| Changed-surface routing | Original direct defects are fixed in the rendered supported paths. The unsupported save-rejection injection is retained as an explicit future evidence obligation, not presented as a rendered pass. |
| Evidence obligation | `satisfied` with prescribed fallback and retained integrated-run obligation. |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | `TREK-218-A2-WT2` / base `49a2e40`; final task commit is recorded in the TREK-218 `Summary:` after this evidence capture. |
| Fixture / data revision | Canonical synthetic emulator baseline; seed restored to Warmup 10 / Cooldown 5 and verified after reload. |
| Requested and actual viewport | Requested/actual: 320×568, 375×667, 568×320, 768×768, 1280×800. Both inputs measured 65×44 at all five viewports. |
| Starting state | Authenticated synthetic Settings baseline at Warmup 10 / Cooldown 5 with successful canonical persistence. |
| Action | Clear/recover both inputs; inspect alerts and target geometry; reload and confirm canonical values. Probe capabilities and eligible methods for deterministic failed-save injection. |
| Observed result | Both blank controls stayed blank, rendered their associated alerts, met 65×44, recovered to 10/5, retired feedback, and reloaded correctly. Component tests separately forced Warmup and Cooldown save rejection and successful retry. Direct rejected-write rendering was unavailable for the reasons above. |
| Evidence link and limitation | Text-only durable evidence with exact measurements and transient synthetic screenshot inspection. Static/component evidence is not claimed as a direct rejected-save usability pass. |

## Run conclusion

WT2 code/test/build and the supported rendered paths are green. The direct blank-field
and target-size defects are fixed. The current recommendation is
`evidence-complete-with-residual-capability-risk`: deterministic rendered save-write
rejection, direct 200% zoom, browser-offline navigation, reduced-motion emulation,
and complete keyboard-only Tab traversal remain explicitly unsupported/inconclusive
with fallbacks and TREK-223/A7 plus TREK-224/A8 reactivation obligations. Renewed UX,
code-delta, and task-conformance reviews must still approve the final diff/evidence.
This report does not authorize product, architecture, schema, or scope changes.
