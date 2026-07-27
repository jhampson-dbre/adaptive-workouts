# TREK-97 Rendered History UX Evidence

This execution record supplements the authoritative planning contract
`UX-ARTIFACT: trek-97-history-pagination@v2` in
`docs/reports/trek-97-history-ux-evidence.md`. The run used only the local Auth and
Firestore emulators and synthetic history data.

## Run identity and capability probe

| Field | Record |
| --- | --- |
| Classification | `required` |
| Harness | Codex in-app Browser plugin `26.715.52143`; initial session `TREK-97 required UX evidence` and fresh post-review session `TREK-97 corrected UX evidence`; Vite baseline server `127.0.0.1:5174`; local Auth emulator `127.0.0.1:9099`; local Firestore emulator `127.0.0.1:8080` |
| Build / commit | Working tree atop planning commit `9996735`; final product-code-and-test diff identity `git hash-object` `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459`. The final task commit is recorded in Trekker rather than embedded self-referentially here. |
| Fixture / data revision | Canonical `emulator-baseline-v1`; synthetic UID `emulator-baseline-user`; supplemental `trek97-history-41-v1` fixture: 41 deterministic legacy documents named `trek97-ux-00` through `trek97-ux-40`, dated newest-first from 2026-07-20 |
| Per-run capability probe | `CAP-97-2026-07-21`: both the initial and fresh post-review Browser capability lists advertised `viewport` and `visibility`. The viewport override accepted exact normal-width requests. It did not advertise actual browser zoom, sequential keyboard, network interception, fault injection, or request throttling. A bounded keyboard probe focused `Generate Plan`, but Playwright Enter, CUA Enter, and CUA Tab did not activate or advance the control. An immediate DOM read after `Load older` activation could not observe the pending state before the emulator response completed. |
| Supported portion | Pointer activation, DOM/accessibility snapshots, active-element inspection, screenshots, exact viewport overrides, focus inspection, and responsive measurements |
| Unsupported metadata | `capability_reason: unsupported-by-harness`. Actual zoom used half-width viewport reflow proxies. Keyboard activation/traversal and request-failure injection used component tests plus source audit. Limitations: viewport reflow is not actual text/page zoom; component tests are not rendered usability evidence. Residual risk reactivates on the next required run or when the browser harness advertises the missing capability. |

Live screenshots were inspected for representative 320, 375, 640-proxy, and 1280
states. They are not persisted because the bounded DOM/focus/geometry observations
below are the durable, reproducible evidence and avoid adding binary run artifacts.
The fixture and exact action sequence allow independent reproduction.

## Responsive and zoom evidence

| Requested state | Actual viewport | Client / document scroll width | Outcome |
| --- | --- | --- | --- |
| 320 px normal | 320 x 800 | 305 / 305 | `observed-pass`; no horizontal overflow on the changed history surface |
| 375 px normal | 375 x 812 | 360 / 360 | `observed-pass`; 20-card and 40-card layouts reflowed without horizontal overflow |
| 768 px normal | 768 x 900 | 753 / 753 | `observed-pass`; retained 41 cards and end state without horizontal overflow |
| 1280 px normal | 1280 x 900 | 1265 / 1265 | `observed-pass`; history remained in the centered document flow below workout controls |
| 375 px at 200% zoom | Actual zoom unsupported; requested 188 px half-width proxy, clamped by harness to 240 x 812 | 225 / 278 | `partial`; proxy reproduced the repository's pre-existing 240 px shell overflow even with history collapsed. It is not caused by TREK-97. Actual zoom is `not-tested`. |
| 1280 px at 200% zoom | Actual zoom unsupported; 640 x 900 half-width proxy | 625 / 625 | `observed-pass` for the rendered proxy; actual zoom is `not-tested` |

Duplicate search for the narrow proxy used `trekker search "240px"` and
`trekker search "horizontal overflow"`. It found the same frozen finding and
intentional no-owner disposition in TREK-206 comments CMT-140/CMT-145, not an active
product task. This run does not expand TREK-97 to repair the existing shell below its
required 320 px normal-width boundary. EPIC-13's integration ledger must retain the
zoom/overflow obligation for the redesign.

## Firestore deployment and index contract

`getHistoryPage` orders by `date` descending and then document ID (`__name__`)
descending. This uses Firestore's default collection-scope descending automatic
index for `date`; Firestore includes `__name__` in the same direction as the last
sorted field in an index definition. No manual composite index or
`firestore.indexes.json` deployment is required for this query. The deployment
precondition is that the default descending automatic index for `date` remains
enabled. If a future index exemption disables it, deployment must restore that index
before release. Production will return a failed-precondition error with an index
creation link if the assumption is violated. See Firebase's official
[index overview](https://firebase.google.com/docs/firestore/query-data/index-overview)
and [ordering documentation](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

## Scenario evidence

### H1 - First expansion and initial result states

| Field | Record |
| --- | --- |
| Changed surface | Workout-history disclosure and initial page |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21` above |
| `capability_state` | `partial` |
| Unsupported metadata | Shared probe `CAP-97-2026-07-21`; keyboard activation and request-failure injection are unsupported. Component tests are the selected fallback, with the limitations and reactivation triggers recorded in the run-level probe. |
| Evidence kind | `rendered-primary` for disclosure/success/empty layout and focus; `component-test` for transient loading and initial error/retry copy |
| Outcome | `observed-pass` |
| Changed-surface routing | No remaining finding |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | `emulator-baseline-v1` plus `trek97-history-41-v1` |
| Requested and actual viewport | 375 x 812 requested and actual; responsive matrix above |
| Starting state | Two fresh authenticated synthetic-baseline runs: first with 41 saved synthetic documents and then with empty canonical history |
| Action | Activate `Workout history` for the first time in each run |
| Observed result | With data, exactly 20 newest cards rendered, `20 workouts loaded.` appeared, `Load older` appeared, and focus remained on the disclosure; the list began July 20, 2026 and ended July 1, 2026. With empty history at 375 x 812, zero cards rendered, `No workouts logged yet.` appeared, no exhaustion message or live success remained, focus stayed on the disclosure, and client/document widths were both 360 px. |
| Evidence link and limitation | Live screenshots and DOM/focus/geometry inspection for success and empty states; loading/error states use focused component evidence because request throttling and Firestore fault injection were unavailable. |

### H2 - Load older successfully

| Field | Record |
| --- | --- |
| Changed surface | Load-older control, appended cards, focus, and success feedback |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21`; an immediate read after activation could not outpace the local emulator response |
| `capability_state` | `partial`; pointer/focus inspection supported, pending-state throttling and sequential keyboard unsupported |
| Unsupported metadata | Shared probe `CAP-97-2026-07-21`; the selected pending-state fallback is the focused component test `keeps cards visible and exposes a busy Load older control during a normal page request`, which asserts retained cards, exact label, disabled state, and `aria-busy=true`. Rendered pending styling/timing remains a residual risk until request throttling is available. |
| Evidence kind | `rendered-primary` plus `component-test` |
| Outcome | `observed-pass` after one resolved finding |
| Changed-surface routing | The first run scrolled to June 30 but left `BODY` focused because temporary `tabindex` was removed immediately. The implementation retained the focus target until blur; the repeated run verified the fix. |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | `trek97-history-41-v1` |
| Requested and actual viewport | 375 x 812 requested and actual |
| Starting state | Initial 20 cards loaded; `Load older` visible |
| Action | Activate `Load older` |
| Observed result | 40 cards rendered, `20 older workouts loaded.` appeared, another `Load older` remained, and focus was retained on the first appended `H3`, `June 30, 2026`, with `tabindex=-1`. |
| Evidence link and limitation | Live before/after screenshots plus active-element inspection. The named component test covers the normal pending label, retained cards, disabled/`aria-busy` state; another focused test covers retirement of temporary `tabindex` on blur. |

### H3 - Recover from later-page failure

| Field | Record |
| --- | --- |
| Changed surface | Existing list, later-page alert, retry, and restored focus |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21`; no browser network interception or safe request-failure injection advertised |
| `capability_state` | `unsupported` for rendered failure injection |
| Unsupported metadata | `capability_reason: unsupported-by-harness`; eligible alternatives were stopping the owned emulator stack or component fault injection. Stopping Firestore would also terminate the supervised Vite run, so the focused component fixture was selected. Residual risk: rendered alert styling and timing were not observed. Reactivation trigger: a future required run with request interception/fault injection. |
| Evidence kind | `component-test` and `source-audit` |
| Outcome | `observed-pass` for the fallback; rendered state `not-tested` |
| Changed-surface routing | No source/test defect found |
| Evidence obligation | `satisfied` through the prescribed fallback |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | Vitest rejected-then-resolved page fixture |
| Requested and actual viewport | Rendered failure viewport unavailable; responsive success layouts covered above |
| Starting state | One loaded page; later request rejects |
| Action | Retry the contextual older-page failure |
| Observed result | Focused test `keeps loaded cards through an older-page failure and retries without duplicates` verifies existing cards remain during both error and pending retry. Before retry, the exact error is the sole alert and `Retry older workouts` is focused. During retry, the stale error and alert semantics clear, the same control stays mounted/busy/disabled as `Retrying older workouts…`, and `Loading workout history…` is the sole live region. Final success appends without duplicates and focus follows H4. |
| Evidence link and limitation | `src/tests/WorkoutHistory.test.jsx`; component evidence cannot establish rendered alert styling or timing. |

### H4 - End of available history

| Field | Record |
| --- | --- |
| Changed surface | Final page, exhaustion message, and focus |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21` above |
| `capability_state` | `partial`; pointer/focus inspection supported, sequential keyboard unsupported |
| Unsupported metadata | Shared probe `CAP-97-2026-07-21`; the component tests supply keyboard-independent focus and single-live-slot assertions, with actual sequential traversal reactivated when supported. |
| Evidence kind | `rendered-primary` plus `component-test` for a zero-item final page |
| Outcome | `observed-pass` |
| Changed-surface routing | No finding |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | `trek97-history-41-v1` |
| Requested and actual viewport | 375 x 812 requested and actual |
| Starting state | 40 cards and a remaining final page |
| Action | Activate `Load older` again |
| Observed result | On the final corrected diff, the 41st card rendered; focus remained on `June 10, 2026` with `tabindex=-1`; `Load older` disappeared; and the only live text was `All available workouts are shown.` (`endCount=1`, older-success count `0`). Focused tests verify that a zero-item final page focuses the end message until blur and that a non-empty initial final page also exposes only the exhaustion slot. |
| Evidence link and limitation | Live screenshot/DOM/focus inspection plus focused component fallback for the zero-item branch. |

### H5 - Preserve state across collapse and reopen

| Field | Record |
| --- | --- |
| Changed surface | Disclosure lifecycle, announcements, and request identity |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21` above |
| `capability_state` | `partial`; rendered collapse/reopen supported, account-change race and sequential keyboard use fallbacks |
| Unsupported metadata | Shared probe `CAP-97-2026-07-21`; component/source evidence is selected for the account-change race because cross-account browser orchestration was outside the synthetic harness. Limitation and reactivation trigger follow the shared probe. |
| Evidence kind | `rendered-primary`, `component-test`, and `source-audit` |
| Outcome | `observed-pass` |
| Changed-surface routing | No finding |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | `trek97-history-41-v1` plus account-A/account-B component fixture |
| Requested and actual viewport | 375 x 812 rendered; component fixture not viewport-dependent |
| Starting state | 41 cards loaded at exhaustion |
| Action | Collapse and reopen the disclosure; separately change `historyKey` while account A's request is pending |
| Observed result | Collapsed DOM contained zero cards and no live text. Reopen restored all 41 cards and the exhaustion message without replaying a success message or focus. Tests verify a pending account-A response is ignored, account B remains lazy until expansion, and UID-keyed remount prevents even a transient prior-account render. |
| Evidence link and limitation | Live DOM/focus inspection plus `src/tests/WorkoutHistory.test.jsx` and the UID-keyed `WorkoutView` boundary. |

### H6 - Generator history cap with no pagination UI

| Field | Record |
| --- | --- |
| Changed surface | Generator history read and existing generate/retry flow |
| Applicability | `applicable` |
| Per-run capability probe | Shared probe `CAP-97-2026-07-21`; Generator view was rendered before plan generation, while the storage boundary is verified in tests/source |
| `capability_state` | `partial` |
| Unsupported metadata | Shared probe `CAP-97-2026-07-21`; the 100-document raw-query cap is not visually distinguishable, so storage/component tests and source audit are the selected fallback. Actual keyboard activation remains unsupported. |
| Evidence kind | `rendered-primary`, `component-test`, and `source-audit` |
| Outcome | `observed-pass` |
| Changed-surface routing | No finding |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Product diff `ed9b33d3c80c0b315d50cb1c74cf3a45cebb3459` |
| Fixture / data revision | `emulator-baseline-v1`; storage and Generator Vitest fixtures |
| Requested and actual viewport | Generator observed at 375 x 812; responsive matrix above applies to the subsequent workout view |
| Starting state | Authenticated Generator with synthetic history available |
| Action | Render Generator and generate a plan |
| Observed result | Generator exposed no pagination control and proceeded through its existing flow. Tests/source verify `getGenerationHistory` orders date descending, limits the raw query to 100 documents, and preserves the history-unavailable retry boundary. |
| Evidence link and limitation | Rendered absence plus `src/tests/storage.test.js`, `src/tests/Generator.test.jsx`, and `src/components/Generator.jsx`; the 100-document cap is not visually distinguishable. |

## Verification summary

- Coordinator final targeted matrix: 6 files, 143 tests passed.
- Coordinator final `npm run ci:check`: 337 passed, 10 skipped; lint, production
  build, Firestore rules, UX workflow validation, and agent-model checks passed.
- After the initial rendered focus fix, review found that older failure/retry hid
  loaded cards, duplicate-only responses announced raw counts, and final pages could
  expose both success and exhaustion live messages. The corrected implementation
  retains cards and retry focus, counts only unique appends, leaves duplicate-only
  non-final focus on the existing control, and gives exhaustion exclusive ownership
  of the live slot.
- The final implementor WorkoutHistory suite passed 21 tests; the prior consolidated
  four-suite run passed 67 tests. Coordinator final targeted and full verification
  above passed against the evidence-complete diff before fresh final review.
- Sequential keyboard interaction and actual browser zoom remain residual capability
  risks, not product passes. The approved component/source fallbacks are recorded
  above and must be re-probed on the next required run.
