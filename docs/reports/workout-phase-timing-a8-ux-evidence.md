# Workout Phase Timing A8 UX Evidence

`UX-ARTIFACT: workout-phase-timing@v1`

This report records coordinator-owned production-route evidence for TREK-224's Timing
cutover. The authoritative behavior is
`docs/specs/2026-07-18-workout-phase-timing.md`. All browser observations used the
local Firebase emulator and synthetic catalog/workout data.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | A8 activates the phase lifecycle, recovery/ownership states, immutable v4 save, History rendering, and responsive controls on the production route. |
| Proportional artifact | This T-01-T-10/C-01-C-06 integrated matrix, backed by the Timing spec and the A7 presentation evidence. The depth matches a stateful, multi-tab, reload-safe UI cutover. |
| Planning artifact revision | `UX-ARTIFACT: workout-phase-timing@v1`; authoritative location: `docs/specs/2026-07-18-workout-phase-timing.md`. |
| Planning wireframe status | `planning-only`; the approved phase journey is not implementation evidence. |
| Required UX design review | Completed during approved EPIC-12 planning. A8 integrates the approved artifact without redesign. |
| Architecture authority | Architecture retains authority for coordination, persistence, schema, data isolation, and feasibility. |

## Run metadata and capability probe

| Field | Record |
| --- | --- |
| Run ID | `CAP-225-2026-07-22-IAB-06` (final retained-draft actionability run; IAB-05/IAB-04/IAB-03 observations retained where identified below) |
| Build / commit | Final IAB-06 rendered the clean committed product branch `codex/workout-phase-timing` at `afdeff7` after the cumulative-review timing/actionability correction. Final product HEAD `223ad9b` adds the non-visual durable-epoch recovery correction verified by the exact component fallback below; it does not change the rendered interaction contract exercised in IAB-06. IAB-05 rendered the prior Review Back correction at `047f0ea`. Earlier A8 evidence rendered the exact product/test bytes subsequently committed as TREK-224 commit `4b8647cf760f7d0450a3c049473c384ca5973cd7`. |
| Fixture / data revision | Canonical emulator seed plus a synthetic generated workout and synthetic v4 History record. No production credentials or personal data. |
| Harness | Codex in-app browser; Vite 8.1.2 baseline route at `127.0.0.1:5174`/clean `localhost:5174` origin; Firebase Auth/Firestore emulators. IAB-06 used the actual 1280x720 CSS-pixel viewport at device-pixel ratio 1.5. |
| Verification | Final product HEAD `223ad9b` `npm run ci:check`: 669 tests passed, 18 skipped; strict lint, production/PWA build and budgets, 14 Firestore-rules tests, workflow and agent-model checks passed. Final `npm run test:emulator-baseline`: canonical seed, baseline, immutable save, rules, scratch export/mutation, and corrupt-scratch refusal passed. Focused timing/recovery matrix: 230 passed. One unrelated WorkoutHistory focus assertion failed once during an earlier full run, then passed alone and in the clean complete rerun. |

| Evidence area | Probe and result | `capability_state` | Fallback / limitation / reactivation |
| --- | --- | --- | --- |
| Viewport and DOM geometry | Viewport override, DOM reads, role/name queries, focus reads, visible actions, reload, and multiple tabs succeeded. | `supported` | Direct rendered-primary evidence. |
| Keyboard traversal | Fresh IAB-04 bounded probe: Tab injection on the focused conflict `Workout recovery` h1 left focus on that h1; the harness did not produce native traversal. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: Codex in-app browser / `CAP-224-2026-07-22-IAB-04`; eligible alternatives were DOM order, native-control semantics, source audit, and component focus tests; all were selected because they directly cover the unchanged semantic controls. Limitation/residual risk: exact end-to-end Tab order is unobserved. Fallback: those semantic/focus checks. Reactivation: a browser session with reliable keyboard injection. |
| 200% zoom | The fresh IAB-04 capability list advertised only `visibility` and `viewport`; no zoom control was available. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: final IAB-04; eligible alternatives were narrower physical reflow and source geometry inspection; selected fallback: direct 320px reflow plus exact client/scroll widths. Limitation/residual risk: exact 200% browser zoom is unobserved. Reactivation: a zoom-capable harness. |
| Reduced motion | The fresh IAB-04 capability list advertised no preference-emulation control. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: final IAB-04; eligible alternatives were source audit and immediate-state component tests; both selected. Limitation/residual risk: the preference was not directly emulated. Fallback found no state-comprehension dependency on animation. Reactivation: a preference-capable harness. |
| Offline/PWA navigation | The fresh IAB-04 capability list advertised no network/offline control. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: final IAB-04; eligible alternatives were production PWA build/precache, local-storage recovery, and emulator integration; all selected. Limitation/residual risk: installed-PWA offline navigation is unobserved. Reactivation: an offline-capable browser harness. |
| Real reload, storage, ownership, and exact server-save reconciliation | Local production adapters, real reloads, two simultaneous tabs, local storage, Web Locks, and the Firestore emulator were exercised. | `supported` | Direct integrated evidence for exact cleanup reconciliation; no synthetic presentation substitute. |
| Deterministic divergent immutable save | IAB-04 again exposed no injection/storage-inspection capability; browser-session storage inspection remains prohibited. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: final IAB-04. Eligible alternatives were source inspection, a manually constructed component state, and a session-driven production-component integration. Selected fallback: a real session/coordinator rejected-write reconciliation against divergent authoritative bytes, followed by production WorkoutView rendering of that emitted state. Limitation/residual risk: exact server divergence and its geometry were not triggered in the browser. Reactivation: an approved save-ID injection harness that does not inspect browser storage. |
| Backward wall-clock presentation | Fresh IAB-06 capability list again advertised browser-level `visibility` and `viewport` plus tab `pageAssets`; it exposed no clock control or safe Date injection. | `unsupported` | `capability_reason: unsupported-by-harness`; harness/session: Codex in-app browser / `CAP-225-2026-07-22-IAB-06`. Eligible alternatives were source inspection, mounted production-component fake-clock transitions, and the controlled presentation controller; all were selected. The final fallback advances the accepted display epoch, regresses the raw clock, then crosses Start/set/Confirm/early-finish/Resume/Undo/Finish/Review-Back/re-Finish and visibility-rest boundaries, proving the frozen candidate and dispatched timestamps do not regress. Limitation/residual risk: a backward OS-clock event was not browser-rendered. Reactivation: a browser harness with deterministic wall-clock control. |

Representative screenshots were not persisted: the exact DOM text, focus, control
geometry, viewport dimensions, actions, storage/reload outcomes, and limitations are
recorded below, while image files would add repository churn without preserving the
stateful two-tab sequence. This is text-only rendered evidence from synthetic data.

## Responsive geometry

The final production-route state inventory retained one `main`, one current-state
`h1`, no horizontal overflow, and no button, input, or select below 44px in either
dimension. The measured inventory covered recovery actions, ordinary Review,
Performance zero-work cancellation, Performance partial early finish, and Cooldown.
Earlier Warmup measurements included enabled and disabled actual-value inputs.

The first 320x568 Performance cancellation probe exposed `.workout-header` overflow
(305px client / 340px scroll, with the timer ending at 339.9px). The validated
CMT-331 correction gives the phase heading its own narrow row and retains Active
Workout plus the timer on the next row. The table contains only the post-fix rerun.

| State | 320x568 | 375x667 | 568x320 | 768x1024 | 1280x800 | Minimum control | Result |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| Recovery (`Resume`, `Discard`) | 320/320 | 375/375 | 553/553 | 768/768 | 1280/1280 | 61.20x44px | Browser pass; `Resume workout?` h1 retained initial focus at every viewport. The final rendered delta proves the Catalog utility is absent in invalid, resumable, and timed-out recovery states; timeout focuses the recovery h1; and an unchanged recovery rerender preserves the focused Exit action. |
| Ordinary Review | 305/305 | 360/360 | 553/553 | 768/768 | 1265/1265 | 108.39x44px | Pass; Back, Save, and History actions remained reachable. Fresh Finish-from-Cooldown focused the Review h1. |
| Performance zero-work cancel | 305/305 | 360/360 | 553/553 | 753/753 | 1265/1265 | 74.99x44px | Browser geometry pass after CMT-331; Finish, Cancel workout, and Keep working remained reachable. The final rendered delta proves the semantic Cancel workout heading receives focus and Keep working restores Finish focus. |
| Performance partial early finish | 305/305 | 360/360 | 553/553 | 753/753 | 1265/1265 | 74.99x44px | Browser geometry pass; Continue to Cooldown and Keep working remained reachable. The final rendered delta proves the semantic early-finish heading receives focus, Keep working restores Finish focus, and Continue moves into focused Cooldown. |
| Cooldown | 305/305 | 360/360 | 553/553 | 753/753 | 1265/1265 | 74.99x44px | Pass; focused Cooldown h1, Resume Workout, and Finish Workout remained visible and contained. |

Each viewport cell is document client width / scroll width in pixels. The
container-wide `.workout-view button` contract and session-driven production-component
fallback cover blocked-conflict `Keep pending`/`Exit` at 44x44 minimum, but their
exact browser geometry remains part of the deterministic-divergence limitation above.

The production Settings surface was measured in both default and catalog-edit states
at the same five viewports. The edit run contained 53 controls and included the
default controls plus edit actions and weighted fields. Every button, input, and
select measured at least 44px high and 49.45px wide;
client and scroll widths matched at 305, 360, 553, 753, and 1265px. Weighted add/edit
fields and bodyweight edit fields each measured 44px high. Disabled mutation sizing
inherits the same Settings-local selector and is covered by the stylesheet contract
and Settings mutation tests. Closing Settings restored the same unsaved generated
workout after its loading transition.

## Final rendered navigation and focus delta

The following bounded evidence used the rendered parent HEAD plus exact product/test
fingerprint recorded above; the same product/test bytes are final commit `4b8647c`.
IAB-04 closes every state/transition gap named by the prior blocker;
same-tree IAB-03 retains the stable-rerender and finish-prompt observations. Component
tests remain corroborating evidence rather than the primary observation. IAB-04's
capability probes and 1280x720 viewport are recorded in the run metadata above.

| Delta | Starting state and action | Final rendered observation |
| --- | --- | --- |
| D-01 - Every forced recovery status | IAB-04: rapidly sample the authorized bootstrap while the active session is `checking`; separately inspect resumable, timeout/recovery-blocked, and generic `blocked` conflict states. Earlier same-tree invalid recovery remains an additional retained disposition. | During session checking, the forced Workout route rendered focused `Loading your workout…` with no Catalog utility. Resumable, timeout/recovery-blocked, invalid, and generic blocked/conflict states also omitted Catalog. This covers all four App forced-routing statuses (`checking`, `recovery-available`, `recovery-blocked`, `blocked`). |
| D-02 - Stable recovery rerender | IAB-03, same fingerprint: in invalid recovery, focus Exit and wait beyond the one-second clock-driven rerender. | Exit remained the active button before and after the unchanged rerender. |
| D-03 - Material timeout and actual conflict transitions | IAB-03/IAB-04 establish focused timeout/conflict replacement. IAB-06 kept a real owner, timed out a contender, exited without deleting the draft, generated a competing workout, and chose Start; it then activated Request handoff. A second retained-draft Start timeout closed the owner and activated Retry acquisition. | The generated Start timeout replaced Generated with focused Workout recovery and exposed Request handoff / Retry acquisition / Exit only after the exact retained draft was re-inspected. Request handoff released the former owner into focused `This tab released workout ownership…` recovery and restored the requester to the frozen 3:51 Review with `Workout resumed.` Retry acquisition, after the owner tab closed, independently restored the other requester to the same 3:51 Review. Real coordinator/session tests cover the lock-free retained-draft `conflict` branch and exact ownership-generation increments. |
| D-04 - Finish prompts and continuation | IAB-03, same fingerprint: start then cancel a set and choose Finish Workout; choose Keep working. Confirm one set, choose Finish Workout, choose Keep working, reopen, then Continue to Cooldown. | The zero-work `Cancel workout?` and partial-work `Finish workout early?` semantic headings each received focus. Both Keep working actions restored focus to Finish Workout. Continue to Cooldown focused the `Cooldown` `h1`. |
| D-05 - Review Back timing correction | IAB-05 at committed `047f0ea`: inspect a frozen Review candidate, wait more than four seconds in Review, choose Back, observe settled Cooldown, allow only active Cooldown time, then Finish again. | Initial Review stayed frozen at 3:36 with Warmup 0:09 + Performance 3:01 + Cooldown 0:26. After the measurable Review gap, Back settled on focused Cooldown with the summary absent and global elapsed still 3:36, proving the Review gap was excluded and the total equaled the ledger sum. During active Cooldown the total advanced, and the next Review was 3:51 with Cooldown 0:41; only the 15 seconds of resumed active Cooldown were added. The local emulator completed publication too quickly to render the pending interval; the committed deferred-session component regression proves the summary stays absent while publication is pending and restores the identical candidate on failure. |

## Scenario-indexed evidence

Shared fields for each row: applicability is `applicable`; changed-surface defects
are blocking; build/fixture are the run metadata above; evidence obligations are
`satisfied`. Text-only evidence has the screenshot limitation described above.

| Scenario | Starting state and action | Observed result | Evidence / disposition |
| --- | --- | --- | --- |
| T-01 - Start and Warmup | Generate a workout, inspect storage, then Start; repeat with a zero Warmup target. | Generation remained local-only. Start created the first durable snapshot, focused Warmup `h1`, and rendered `10:00 planned / 10:00 remaining`. The zero-target run remained in Warmup and rendered `0:00 planned / +2:59 overtime` without auto-transition. | `rendered-primary` + tests; `observed-pass`; `rendered-usability-pass`. |
| T-02 - Performance entry | From Warmup, start the first weighted set and reload/resume. | Performance remained active; the set timer and nondecreasing elapsed time restored without returning to Warmup or Plan. | `rendered-primary` + tests; `observed-pass`; `rendered-usability-pass`. |
| T-03 - Normal Cooldown | Complete the final outstanding set. | Cooldown became the active phase and its `h1` received focus, preserving EPIC-11 behavior except the approved focus destination. | `rendered-primary` + focus tests; `observed-pass`; `rendered-usability-pass`. |
| T-04 - Early end and cancellation | Cancel an active timer, confirm no-work cancellation, then open/close Settings; separately confirm one set and finish early. | No-work cancellation returned to Plan and Settings close did not resurrect the generated workout; no History entry was created. Partial work entered Cooldown. The final rendered transitions focus the semantic zero/partial heading, restore Finish on Keep working, and retain focused Cooldown/Plan terminal routing. | `rendered-primary` geometry and final focus delta + tests; `observed-pass`; `rendered-usability-pass`. |
| T-05 - Cooldown timing | Enter zero-target Cooldown after partial work, wait one second, then Finish. | Cooldown `h1` was focused and rendered `0:00 planned / +0:01 overtime`; it did not auto-finish. Finish opened Review. Unit timing matrices cover early/planned/long-overtime boundaries. | `rendered-primary` + tests; `observed-pass`; `rendered-usability-pass`. |
| T-06 - Resume and re-entry | Reload during active phases and use Resume/Undo paths. | Resume committed the recovered Workout destination without a remount or Plan flash; phase timing and exercise state were retained. | `rendered-primary` + reducer/session tests; `observed-pass`; `rendered-usability-pass`. |
| T-07 - Review lifecycle | Finish Cooldown, inspect focused Review, then save; prior integrated cleanup-failure run exercises exact retry reconciliation. IAB-05 additionally waits in Review, uses Back, waits in resumed Cooldown, and finishes again. | Earlier Review/save and exact cleanup reconciliation remain green. On committed `047f0ea`, frozen 3:36 Review timing (0:09 + 3:01 + 0:26) remained unchanged during the Review delay; Back removed Review and settled on focused Cooldown at total 3:36. Re-Finish produced 3:51 with Cooldown 0:41, adding only resumed active Cooldown. The pending-publication interval is covered by the committed deferred-session production-component regression because the local browser publication settled before an intermediate rendered frame could be captured. | `rendered-primary` for Review/Back/focused Cooldown/re-Finish + production-component pending/failure fallback + emulator tests; `observed-pass`; `rendered-usability-pass` for the supported rendered transition and `evidence-complete-with-residual-capability-risk` for the unobservable pending interval. |
| T-08 - Clock behavior | Reload after elapsed time in Warmup and Performance; in IAB-05 compare the frozen phase sum before and after a measurable Review gap and Back. Use the final IAB-06 capability probe and exact component/controller fallback for a backward raw clock followed by durable transitions and Finish. | Displayed elapsed time restored across reload. IAB-05 directly rendered the post-Back global total as 3:36, exactly 0:09 + 3:01 + 0:26, despite the Review delay. At `afdeff7`, the fallback advances a visible total, regresses the raw clock, crosses every time-bearing presentation action plus hidden-rest return, and freezes Review at no less than the accepted display sum. Final product `223ad9b` additionally mounts or republishes recovered Warmup, Performance work/rest, and Cooldown state ahead of the raw clock; every next action, duration, ledger/frozen total, and finish timestamp remains at or above the restored durable epoch. | `rendered-primary` for phase-sum/Review-gap behavior + exact committed transition, recovery, and Finish clock fallback; `observed-pass`; `evidence-complete-with-residual-capability-risk` only for backward OS-clock browser rendering. |
| T-09 - V4 History and save | Save the completed workout, reload, and open History. | History rendered the schema-v4 record for July 22 with duration 32:59 and exact phase rows: Warmup planned 10:00/actual 21:00, Performance planned 45:00/actual 11:58, Cooldown planned 5:00/actual 0:01. The saved weighted exercise remained intact. | `rendered-primary` + immutable-save/rules tests; `observed-pass`; `rendered-usability-pass`. |
| T-10 - Integrated accessibility | Inspect the state-indexed Workout and Settings controls at five viewports; exercise phase/recovery focus, status retirement, cancellation/Settings detour, global actions, and the fresh capability probes above. | Existing geometry/focus results remain green. IAB-06 at 1280x720 directly activates both retained-draft recovery actions on exact product `afdeff7`: Request handoff and Retry acquisition each replace focused Workout recovery with the retained focused Review plus `Workout resumed.`; identity-less timeout/conflict controls are absent in component coverage. Its fresh probe advertised only browser `visibility`/`viewport` and tab `pageAssets`, with no clock injection. IAB-05 proves Review Back/focused Cooldown; IAB-04/IAB-03 retain forced-route, conflict, timeout, rerender, and prompt evidence. | `rendered-primary` for supported state geometry and final navigation/focus delta; capability fallbacks above for Tab/zoom/motion/offline/divergent injection/backward clock; `evidence-complete-with-residual-capability-risk`. |
| C-01 - Reload restore | Reload an active Warmup/Performance workout, then Resume. | Exact phase, exercise, active timer, and nondecreasing elapsed state restored. Resume retired the blocker, announced `Workout resumed.`, and focused the phase heading. | `rendered-primary`; `observed-pass`; `rendered-usability-pass`. |
| C-02 - Exclusive mutation | With one live owner, one non-owning observer, and one requester, let Resume time out and choose Request handoff. | The observer remained silent. The matching owner released and froze with human text plus Exit; the requester then won ordinary exclusive acquisition, generation-revalidated, restored Performance/timer state, announced `Workout resumed.`, and could mutate. Former-owner Exit cleared only its local state and reached Plan while the requester remained owner. A stale-generation requester correctly remained conflict. | `rendered-primary` + lock/session/adapter tests; `observed-pass`; `rendered-usability-pass`. |
| C-03 - Acquisition and loss | Exercise checking, timeout, generic blocked/conflict, lost, and unsupported branches in integrated tests and the multi-tab runs. | Each result remained distinct and actionable; ordinary mutations stayed blocked until ownership was acquired or recovery exited. IAB-06 closes the prior actionability gap: after generated Start timed out against the retained owner, the requester had an exact re-inspected snapshot; Request handoff transferred ownership and resumed the retained Review, while a second run proved Retry acquisition after owner release. Identity-less conflict/timeout hides those identity-dependent controls and retains truthful Exit. Real coordinator/session tests cover the lock-free conflict branch and exact identity pair. | `rendered-primary` state/action/focus/navigation evidence + real coordinator/session/component tests; `observed-pass`; `rendered-usability-pass`. |
| C-04 - Draft validation | Load an invalid draft, Exit, reload, then repeat. Exercise stale/wrong-user/wrong-project cases in tests. | Exit retired the visible blocker without mutating bytes; reload exposed the invalid draft again. Exact stale discard removes only the inspected snapshot. No invalid draft hydrated into Workout state. | `rendered-primary` + validation tests; `observed-pass`; `rendered-usability-pass`. |
| C-05 - Draft lifecycle | Mutate an owned weighted workout, reload, resume, detour through Settings, and return; then exercise old-UID retirement while a new-UID bootstrap is queued. | The strict recovery projection accepted all tracking modes, preserved only allowed fields, restored the active session, and retained the local generated/active destination through Settings. Post-CMT-324 session evidence confirms identity retirement first clears the prior UI state, then awaits exact locked cleanup with the captured prior project/UID/draft generation before inspecting the new UID; both removed and stale-generation cleanup results preserve that ordering. | `rendered-primary` for workout/Settings lifecycle + production-session integration tests for the non-visual auth boundary; `observed-pass`; `rendered-usability-pass`. Limitation: the harness exposes no sign-out/auth-switch UI, so auth cleanup uses the exact production session implementation in a component integration harness rather than a browser gesture. |
| C-06 - Immutable server result | Save through a local cleanup failure, reload Review, and retry exact reconciliation; separately drive a mounted production session/WorkoutView through rejected write plus divergent authoritative reconciliation. | Exact retry matched the already-written server document, removed the exact recovery slot under lock, released ownership after cleanup, returned to Plan, and left no recovery prompt on reload. The session-driven transition began in ordinary focused Review, activated Save, emitted blocked conflict, restored focus to Review, retained frozen phase/completed rows, removed Back/save-rewrite actions, exposed only `Keep pending` and `Exit`, and announced `Save conflict remains pending.` without another save. Failure paths retain recovery bytes. | Exact reconciliation is `rendered-primary`/`observed-pass`. Divergent conflict is a production-component transition fallback with automated observed pass and `evidence-complete-with-residual-capability-risk`, not a browser-rendered usability pass. The browser limitation and reactivation condition are recorded above. |

## Issue-class corrections discovered during integration

Each user-facing defect was reproduced, audited, recorded on TREK-224, validated by
a read-only conformance reviewer, and fixed with regression coverage. Supported
changed surfaces were rerun through their affected browser paths; auth-boundary and
deterministic-divergence cases used the exact production fallbacks documented above.
The corrections cover: pre-Start persistence, recovery
Exit/stale handling and visible acquisition blockers, strict recovery projection,
resume destination/focus, transient resume-status retirement, immutable-save cleanup,
the cooperative owner/observer reply path and safe former-owner Exit, and the complete
Workout/Settings button/input/select 44px touch-target class. CMT-324 additionally
corrected prior-identity cleanup ordering and the blocked-conflict Review presentation;
the final continuation then preserved stable same-UID sessions through transient
access checks, made blocked state derive from reconciled pending state, replaced the
hand-built conflict fixture with a session-driven integration, completed the
Workout-wide button contract, corrected 320px active-header overflow, removed the
ineffective recovery Catalog utility, completed recovery/conflict/prompt focus
lifecycle, and made Review Back use one transition timestamp. A9 cumulative review
then found and corrected stale Review-candidate rehydration during asynchronous Back,
the Start-to-now global total, and backward accepted-display ticks. IAB-05 directly
revalidated Review-gap exclusion, ledger-sum total, focused Cooldown, and re-Finish.
The next cumulative gate found that a later raw-clock transition could still freeze
below that visible total and that retained-draft Start controls lacked identity.
Commit `afdeff7` routes every time-bearing presentation action through the accepted
epoch, re-inspects exact recovery identity, and hides identity-dependent actions when
none exists. IAB-06 activates both retained-draft actions; exact controller/component
fallbacks cover the unsupported backward-clock injection and pending frame. Final
product commit `223ad9b` also restores that accepted epoch from durable recovery state
before the first post-recovery action and when a newer snapshot publishes without a
remount.

## Evidence conclusion

No direct changed-surface defect remains. Production-route reload, two-tab ownership,
strict recovery, immutable reconciliation, schema-v4 History, phase focus/status,
Settings compatibility, responsive geometry, and touch targets are directly green.
Auth-boundary cleanup and blocked-conflict presentation are green through the exact
production session/component paths with the explicit browser limitations above.
The result is `evidence-complete-with-residual-capability-risk` because exact Tab
traversal, 200% zoom, reduced-motion emulation, installed-PWA offline navigation,
the local pending-publication frame, and backward OS-clock injection remain
unsupported by this harness with the documented fallbacks.
