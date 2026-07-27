# Workout Phase Timing A7 UX Evidence

`UX-ARTIFACT: workout-phase-timing@v1`

This report records coordinator-owned rendered evidence for TREK-223's controlled,
non-production Timing presentation harness. The approved behavior remains
authoritative in `docs/specs/2026-07-18-workout-phase-timing.md`. Every observation
used deterministic synthetic data; the harness explicitly does not claim real
storage, Web Lock, server-reconciliation, authentication, or production-route proof.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | A7 changes phase, Review, History, recovery, ownership, and save-result presentation and must prove the complete T-01-T-10/C-01-C-06 interaction language before A8 production cutover. |
| Proportional artifact | This scenario-indexed report plus the authoritative Timing spec. The depth is proportional to a new multi-state workout lifecycle with recovery and save uncertainty. |
| Planning artifact revision | `UX-ARTIFACT: workout-phase-timing@v1`; authoritative location: `docs/specs/2026-07-18-workout-phase-timing.md`. |
| Planning wireframe status | `planning-only`; the approved spec's phase journey and state/action contract are not rendered evidence. |
| Required UX design review | Completed during approved feature planning before A1. A7 implements the approved minimal functional presentation without redesign. |
| Architecture authority | Architecture retains system, data, security, and feasibility authority. A7 remains synthetic and does not activate production recovery or schema-v4 writes. |

## Run metadata

| Field | Record |
| --- | --- |
| Run ID | `CAP-223-2026-07-22-IAB-01` |
| Build / commit | `TREK-223-A7-WT4` on task base `5b11ab9`; final task commit is recorded in Trekker Summary. |
| Fixture / data revision | `timing-scenarios@v1`: one deterministic simple exercise, injected epoch clock, canonical 60/300/60-second targets, v4/malformed/legacy History fixtures, and explicitly synthetic recovery/save outcomes. |
| Harness | Codex in-app browser; Vite 8.1.2 at `127.0.0.1:5176/timing-harness.html`; scenario manifest exposes exactly T-01-T-10/C-01-C-06 and six viewport probes. |
| Safety | Synthetic local data only. Representative 375x667 and 568x320 screenshots were inspected transiently; binaries were not persisted to avoid repository churn. Exact DOM, focus, geometry, actions, and limitations are recorded below for independent re-execution. |
| Verification at evidence run | Focused changed-surface/compatibility tests, manifest check, lint, production build, and full serial suite were run by the coordinator; final counts are recorded in Trekker Summary after reviews. |

## Per-run capability probe

| Evidence area | Probe and result | `capability_state` | Fallback / limitation / reactivation |
| --- | --- | --- | --- |
| Viewport override and screenshots | Browser advertised viewport control and screenshots. Direct runs completed at 320x640, 375x667, 568x320, 768x1024, and 1280x800. | `supported` | None for the five physical viewports. |
| DOM semantics and focus | DOM snapshots, role/name queries, active-element reads, status/alert inspection, and visible control actions succeeded. | `supported` | None for rendered semantics and phase-heading focus. |
| Keyboard traversal | Repeated bounded Tab probes remained on the native scenario select in this in-app-browser session, repeating the limitation recorded by A2. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/version/session: Codex in-app browser / `CAP-223-2026-07-22-IAB-01`; eligible alternatives: native-control semantics, DOM order, component focus tests, and source audit; selected fallback: those three. Limitation: end-to-end Tab order is not directly observed. Residual risk: exact keyboard traversal remains unproven. Reactivation: A8 integrated T-10 run or a browser harness with reliable Tab traversal. |
| 200% browser zoom | No zoom capability was advertised. | `unsupported` | `capability_reason: unsupported-by-harness`; selected fallback: direct 320px reflow with no horizontal overflow. Residual risk: exact 200% zoom is unobserved. Reactivation: A8 or a future browser exposing zoom control. |
| Reduced-motion emulation | No preference-emulation capability was advertised; the current browser reported no reduced-motion preference. | `unsupported` | `capability_reason: unsupported-by-harness`; selected fallback: source audit found no animation-dependent transition or feedback, and rendered states are immediate. Residual risk: the reduce preference was not directly emulated. Reactivation: A8 or a future preference-capable harness. |
| Offline/PWA | No deterministic offline/network switch was advertised. A7 intentionally has no real network adapter. | `unsupported` | `capability_reason: unsupported-by-harness`; selected fallback: explicit synthetic pending/error states plus passing production PWA build. Limitation: offline browser navigation and installed-PWA behavior are not direct A7 evidence. Reactivation: A8 integrated evidence. |
| Real reload/two-tab/storage/server behavior | A7 intentionally injects proxy outcomes and labels them as synthetic. | `partial` | Rendered presentation is direct; underlying coordination/persistence remains component/integration/rules evidence from A5/A6 and must be integrated in A8. |

## Responsive geometry

The selected T-10 surface retained one `main`, one current-phase `h1`, and a 44px
minimum height for every visible select/button at every requested physical viewport.
Document scroll width remained below viewport width; long pages used vertical scroll.

| Requested / actual viewport | Document scroll width | Minimum control size | Observed result |
| --- | ---: | ---: | --- |
| 320x640 | 305px | 66x44px | No horizontal overflow; all actions remained reachable by vertical scroll. |
| 375x667 | 360px | 66x44px | Phase hierarchy, scenario context, and action groups remained legible. |
| 568x320 landscape | 553px | 66x44px | No horizontal overflow; compact landscape used vertical scroll. |
| 768x1024 | 768px | 66x44px | Content remained within the 48rem presentation measure. |
| 1280x800 | 1265px | 66x44px | Content stayed bounded; actions did not stretch across the viewport. |

## Scenario-indexed evidence

Shared fields for every row: applicability is `applicable`; fixture/build are the run
metadata above; changed-surface defects are blocking; screenshots are represented by
the safe text-only observations above; planning wireframes are never used as evidence.

| Scenario | Changed surface and approved flow | Starting state / action | Observed result | Evidence, outcome, and disposition |
| --- | --- | --- | --- | --- |
| T-01 - Start and Warmup | Phase heading, global timer, Warmup countdown/zero/overtime, explicit first-set action. | Generated fixture; stage Start, zero, then one-second overtime. | Warmup `h1` was focused; global elapsed `1:01`; planned `1:00`; labeled overtime `0:01`; Start first set remained available and no auto-transition occurred. | `rendered-primary` + component tests; `observed-pass`; obligation `satisfied`; `rendered-usability-pass` for the supported surface. |
| T-02 - Performance entry | Warmup-to-Performance transition and retained work controls after cancel. | Start first set, then cancel its timer. | Performance `h1`, exercise, prescription/next-action copy, Start/Cancel/Confirm controls remained visible; phase did not return to Warmup. | `rendered-primary`; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-03 - Normal Cooldown | Final confirmation, Cooldown focus, actions. | Confirm the only outstanding set. | Cooldown `h1` became the active element; global elapsed `0:15`; planned/countdown presentation plus Resume and Finish were visible. | `rendered-primary`; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-04 - Early end and cancellation | Partial-work early finish and distinct no-work cancellation. | Two-set fixture completes one set then confirms early finish; separate visible no-work control stages cancellation. | Partial path rendered Cooldown. No-work path rendered focused `Workout cancelled`, retained one main/h1, and rendered no History region. | `rendered-primary`; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-05 - Cooldown timing | Cooldown target/countdown/zero/overtime and Finish. | Final confirmation then advance to one-second overtime; component matrix covers zero, early/planned Finish, and long overtime. | Cooldown rendered global `1:16`, planned `1:00`, overtime `0:01`, Resume, and Finish without automatic completion. | `rendered-primary` + component tests; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-06 - Resume and re-entry | Resume and final-set Undo both return to Performance; later Cooldown accumulates. | Visible Resume and Undo proxy controls from a Cooldown fixture. | Resume rendered Performance at global `0:35`. Final-set Undo rendered focused Performance at global `0:45`; the staged later re-entry retained cumulative Cooldown rather than resetting. | `rendered-primary` + reducer tests; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-07 - Review lifecycle | Frozen breakdown, Back, save state, excluded Review gap. | Finish, Back after injected gap, re-Finish. | Review `h1` and status rendered; breakdown Warmup `0:10`, Performance `0:05`, Cooldown `0:10`, total `0:25`; completed work, prepared save state, Back, and Save were visible. | `rendered-primary` + component tests; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-08 - Clock behavior | Nondecreasing global/phase display under forward, backward, and resumed time. | Advance to 11 seconds, move injected clock backward, dispatch tick, then advance again in tests. | Final rendered backward step stalled at global `0:11` with Warmup countdown `0:49`; it no longer regressed to `0:04`. Tests prove later forward time resumes and global equals displayed phase sum. | `rendered-primary` + component tests; `observed-pass`; `satisfied`; `rendered-usability-pass`. |
| T-09 - V4 History and save | Valid/malformed/legacy History and distinct save reconciliation outcomes. | Visible fixture buttons and retryable-absent/indeterminate/conflict/saved controls. | Valid v4 rendered duration `1:16` and all planned/actual phases; malformed rendered unavailable; legacy rendered its legacy summary. Saved rendered `Workout saved successfully.` and retired the prior alert; other outcomes remained distinct/actionable. | `rendered-primary` for History and synthetic save presentation; `observed-pass`; `satisfied`; `rendered-usability-pass` for changed presentation. |
| T-10 - Integrated accessibility | Semantic hierarchy, quiet status, control size, responsive/reflow, settings/history compatibility. | Performance with long scenario text; inspect all viewports, roles, focus, status retirement, and production build. | One main/current-phase h1, semantic h2 context, polite event status without per-second live text, every control at least 44px high, and no horizontal overflow at five viewports. | `rendered-primary` for supported semantics/viewports; `inconclusive` for Tab/zoom/reduced-motion/offline; obligation `satisfied` with fallbacks; `evidence-complete-with-residual-capability-risk`. |
| C-01 - Reload restore | Recovery-available language and Resume/Discard hierarchy. | Inject `resumable`. | Alert rendered `A saved workout is ready to resume` with Resume workout and Discard. | `rendered-proxy`; `observed-pass` for presentation; real reload not claimed; `evidence-complete-with-residual-capability-risk`. |
| C-02 - Exclusive mutation | Conflict/handoff/exit state. | Inject `conflict`. | Alert rendered another-tab ownership with Request handoff and Exit; no silent takeover language/action appeared. | `rendered-proxy`; `observed-pass`; underlying lock proof remains A5/A8; `evidence-complete-with-residual-capability-risk`. |
| C-03 - Acquisition and loss | Timeout, denied, unsupported, and lost language/actions. | Select each visible synthetic outcome; inspect lost. | Lost rendered status/alert `Workout ownership was lost. Recovery is available.` with Recover workout and Exit. Timeout exposed Retry acquisition/Exit; denied/unsupported stayed distinct. | `rendered-proxy`; `observed-pass`; underlying acquisition proof remains A5/A8; `evidence-complete-with-residual-capability-risk`. |
| C-04 - Draft validation | Malformed, unsupported, stale, wrong-user, wrong-project dispositions without hydration. | Select each visible injected validation result. | Each result rendered distinct copy with Discard/Exit; phase remained generated and no recovered active workout was partially shown. | `rendered-proxy`; `observed-pass`; validation correctness remains A5/A6 component evidence; `evidence-complete-with-residual-capability-risk`. |
| C-05 - Draft lifecycle | Local-storage failure and recovery/exit action hierarchy. | Inject `storage-error`. | Alert rendered `Local recovery storage is unavailable` with Retry local recovery and Exit. | `rendered-proxy`; `observed-pass`; real storage lifecycle not claimed; `evidence-complete-with-residual-capability-risk`. |
| C-06 - Immutable server result | Absent, indeterminate, conflict, and success presentation. | Select visible retryable-absent, reconcile-indeterminate, blocked-conflict, and saved controls. | Indeterminate rendered Check again/Exit and retained pending language; conflict remained blocking; saved rendered semantic success and retired the recovery alert. | `rendered-proxy`; `observed-pass`; real server/rules proof remains A6/A8; `evidence-complete-with-residual-capability-risk`. |

## Post-review action delta

Run `CAP-223-2026-07-22-IAB-02` rerendered T-09 and C-01-C-06 after the
recovery-action and live-region fixes. The coordinator exercised the changed action
paths at 375x667 and repeated every scenario's representative path at 568x320. Both
viewports retained one `main`, one `h1`, 44px minimum controls, and no horizontal
overflow (document widths 360px and 553px respectively).

| Scenario | Action-result evidence |
| --- | --- |
| C-01 | Resume retired the blocker and announced `Workout resumed.`; Discard retired it and announced `Recovery draft discarded.` |
| C-02 | Request handoff retained the conflict alert and announced `Handoff requested. Waiting for ownership.`; Exit retired the alert and announced `Recovery view exited.` |
| C-03 | Retry acquisition retained the timeout alert and announced `Ownership retry requested.`; Recover workout retained the lost-ownership alert and announced `Recovery requested. Waiting for ownership.` |
| C-04 | Discard retired the malformed-draft alert and announced `Recovery draft discarded.`; the previously recorded unsupported/stale/identity dispositions remain synthetic presentation states. |
| C-05 | Retry local recovery retained the storage-error alert and announced `Local recovery retry requested.` |
| C-06 | Retry exact save retained retryable-absent and announced `Exact save retry requested.`; Check again retained indeterminate and announced `Save reconciliation check requested.`; Keep pending retained blocked-conflict and announced `Save conflict remains pending.`; Exit retired the blocker. |
| T-09 | Retry exact save, Check again, and Keep pending produced the same retained save-state acknowledgements; saved announced `Workout saved successfully.` with no recovery alert. |

Each active blocker had one assertive semantic owner (`role=alert`). A differing
action acknowledgement used the separate polite `role=status`; terminal actions
retired the alert. These are controlled synthetic acknowledgements only. They do not
claim that a real lock, local-storage operation, reload, handoff, or server request
executed, so every A8 integration obligation and capability-risk disposition above
remains unchanged.

## Blocked-mutation delta and fresh capability probe

Run `CAP-223-2026-07-22-IAB-03` rerendered C-01-C-06 and T-09 after the shared
recovery mutation gate was added. At both 375x667 and 568x320, every injected active
recovery state retained its recovery-specific controls but exposed neither `Start Workout`
nor `Start first set`. In particular, C-02's ownership conflict exposed only
Request handoff/Exit rather than a silent workout mutation path. C-01, C-03, C-04,
C-05, C-06, and T-09's indeterminate save state produced the same blocked-primary-
action result. Exiting C-02 retired the alert, announced `Recovery view exited.`, and
restored `Start Workout`. Component tests apply the same shared gate to Warmup,
Performance, Cooldown, and Review controls.

The coordinator repeated the bounded capability probe for this final rendered run:

| Evidence area | Fresh IAB-03 result | `capability_state` | Fallback / limitation / evidence obligation |
| --- | --- | --- | --- |
| Viewport and responsive geometry | Viewport capability was advertised and exercised at 375x667 and 568x320. Both retained one `main`, one `h1`, 44px minimum controls, and document widths of 360px and 553px. | `supported` | Direct evidence for the post-fix mobile and landscape surfaces; the five-viewport IAB-01 matrix remains the broader responsive record. |
| DOM semantics and visible actions | Role/name reads, alert/status ownership, recovery actions, absence of incompatible ordinary controls, and terminal restoration were directly exercised. | `supported` | Direct post-fix evidence; no fallback required for these presentation behaviors. |
| Keyboard traversal | Four fresh bounded Tab attempts remained on the native scenario select. | `unsupported` | `capability_reason: unsupported-by-harness`; selected fallback remains DOM order, native-control semantics, component focus tests, and source audit. Exact end-to-end traversal remains an A8 obligation. |
| 200% browser zoom | The fresh capability list advertised only visibility and viewport controls; no zoom control was available. | `unsupported` | Direct 375px/320px reflow remains the fallback; exact 200% zoom remains an A8 obligation. |
| Reduced-motion emulation | No preference-emulation capability was advertised; the rendered page reported no active reduced-motion preference. | `unsupported` | Source audit still finds no animation-dependent transition; direct emulation remains an A8 obligation. |
| Offline/PWA and real coordination/storage/server | No offline/network capability or real adapter is present in this intentionally synthetic harness. | `partial` | Passing production PWA build plus A5/A6 component/integration evidence are supporting fallbacks only; integrated proof remains required in A8/TREK-224. |

## Terminal-action focus delta

Run `CAP-223-2026-07-22-IAB-04` rerendered the terminal and retained recovery
focus paths after focus restoration was added. At both 375x667 and 568x320:

- C-01 Resume workout retired the alert, announced `Workout resumed.`, and focused
  the current `Workout` h1.
- C-01 Discard retired the alert, announced `Recovery draft discarded.`, and focused
  the current `Workout` h1.
- C-02 Exit retired the alert, announced `Recovery view exited.`, and focused the
  current `Workout` h1.
- C-02 Request handoff retained the conflict alert, announced `Handoff requested.
  Waiting for ownership.`, and preserved focus on the Request handoff button.

Changing or injecting an active recovery outcome did not trigger heading focus, and
the previously recorded mutation gate, alert/status ownership, responsive geometry,
and capability dispositions remained unchanged. Component regressions cover both
terminal focus restoration and retained-action focus preservation.

## Evidence conclusion

No direct changed-surface defect remains in the supported rendered portions. The
recommended result is `evidence-complete-with-residual-capability-risk`, not a blanket
usability pass: physical viewports, hierarchy, focus transitions, feedback, recovery
language, and scenario actions are rendered and green, while exact Tab traversal,
200% zoom, reduced-motion emulation, offline/PWA navigation, and real integrated
reload/two-tab/storage/server behavior retain explicit A8 obligations.

This report authorizes no production cutover, redesign, schema change, or relaxation
of A8's integrated evidence requirements.
