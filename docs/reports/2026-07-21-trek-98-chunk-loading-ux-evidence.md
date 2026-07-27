# TREK-98 Rendered UX Evidence

`UX-EVIDENCE: trek-98-chunk-loading@2026-07-21`

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | TREK-98 changes when the authorized Plan, Catalog Settings, and Workout surfaces become available and adds loading, failure, retry, focus, and interruption behavior. |
| Proportional artifact | `docs/reports/trek-98-chunk-loading-ux-evidence.md`; focused on L1-L3 lazy destinations, B1 bundle enforcement, and P1 cached-offline availability. |
| Planning artifact revision | `UX-ARTIFACT: trek-98-chunk-loading@v9` |
| Planning wireframe status | `planning-only` |
| Required UX design review | Approved before implementation; fresh post-implementation usability review required against this evidence. |
| Architecture authority | Architecture retains authority for auth isolation, Firestore persistence, chunk ownership, retry semantics, and PWA feasibility. |

## Run metadata and capability probe

| Field | Record |
| --- | --- |
| Run | `CAP-98-2026-07-21-IAB-01` |
| Harness | Codex in-app browser plugin `26.715.52143`, Browser Use session `-d251-4155-9ae9-cead0b025b9d` |
| Build / commit | Production build from planning commit `7ba0385` plus the final uncommitted TREK-98 implementation diff; the implementation commit is recorded in Trekker after review. |
| Fixture / data revision | Synthetic Firebase emulator fixture `emulator-baseline-v1`, approved user `emulator-baseline-user`; no production or personal data. |
| Bounded safe probe | Read the harness documentation, listed browser and tab capabilities, exercised the supported viewport override, captured DOM snapshots and screenshots, and attempted sequential `Tab` focus movement once. Browser capabilities were `viewport` and `visibility`; the tab exposed `pageAssets`. No offline/network interception, browser zoom, import-failure injection, or durable screenshot-file capability was advertised. The single keyboard probe did not move focus from the programmatically focused heading, so no repeated fragile retries were attempted. |
| Supported portion | Rendered navigation, focus after transitions, copy, hierarchy, controls, and responsive layout at exact viewport widths. |
| Unsupported portion | Actual 200% browser zoom; offline/network toggling; deterministic import rejection/retry/stale-promise injection; reliable sequential keyboard traversal in this harness. |
| Selected fallbacks | Component tests for failure, retry, focus, ownership, auth, and stale-result behavior; DOM/source audit for keyboard order; generated Vite manifest, provenance, and Workbox precache reports for bundle and offline availability. |
| Screenshot disposition | Representative synthetic screenshots were inspected in the live run for Plan at 320px and Catalog/Workout at 375px. The harness returned ephemeral image bytes but did not advertise a durable screenshot-file capability, so this report records reproducible text evidence rather than an unsafe or invented link. |

## Per-scenario evidence

| Field | L1 - authorized Plan | L2 - Catalog Settings | L3 - preserved Workout | B1 - bundle ceilings | P1 - cached offline |
| --- | --- | --- | --- | --- | --- |
| Changed surface | Access-to-Plan lazy destination | Header, loading destination, and return path | Plan-to-Workout loading and Settings detour | Build/CI; no UI | Installed/offline lazy destinations |
| Applicability | `applicable` | `applicable` | `applicable` | `applicable` | `applicable` |
| Per-run capability probe | `CAP-98-2026-07-21-IAB-01`; rendered success supported, deterministic transient/error injection unsupported | Same; rendered loading, success, and return supported; failure injection unsupported | Same; rendered loading, success, preserved-workout detour supported; failure injection unsupported | Local CLI and emitted artifacts supported | Browser offline control unsupported; emitted Workbox report supported |
| `capability_state` | `partial` | `partial` | `partial` | `supported` | `partial` |
| Unsupported metadata | `capability_reason: unsupported-by-harness`; import failure and actual zoom unavailable; component-test and source-audit fallback; residual risk is browser-specific timing/zoom behavior; reactivate when the harness advertises failure injection or zoom | Same, plus reliable sequential keyboard traversal unavailable; rendered route focus and DOM-order fallback; reactivate when keyboard/zoom controls are advertised | Same, plus deterministic stale import unavailable; rendered detour plus component-test fallback; reactivate when network/import controls are advertised | Not applicable | `capability_reason: unsupported-by-harness`; no offline/network capability; final Workbox manifest inspection selected over unsupported browser toggle; residual risk is an unexecuted installed-browser offline transition; reactivate when an offline capability is advertised |
| Evidence kind | `rendered-primary` plus `component-test` and `source-audit` | `rendered-primary` plus `component-test` and `source-audit` | `rendered-primary` plus `component-test` and `source-audit` | `component-test` and `source-audit` | `rendered-proxy` via generated final precache plus source audit |
| Outcome | `observed-pass` | `observed-pass` | `observed-pass` | `observed-pass` | `inconclusive` for an actual offline transition; generated cache membership passed |
| Changed-surface routing | No direct defect found | No direct defect found | No direct defect found | No defect found | No generated-artifact defect; unsupported browser step remains a nonblocking residual capability risk |
| Evidence obligation | `satisfied` | `satisfied` | `satisfied` | `satisfied` | `satisfied` through prescribed fallback and complete unsupported metadata |
| Disposition | `nonblocking-residual` | `nonblocking-residual` | `nonblocking-residual` | `not-applicable` | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` | `evidence-complete-with-residual-capability-risk` | `evidence-complete-with-residual-capability-risk` | `rendered-usability-pass` | `evidence-complete-with-residual-capability-risk` |
| Requested and actual viewport | 320/375/768/1280 requested and actual; actual 200% zoom unsupported | 320/375/768/1280 requested and actual; actual 200% zoom unsupported | 320/375/768/1280 requested and actual; actual 200% zoom unsupported | Genuinely not applicable | 375/1280 requested; no offline mode available |
| Starting state | Approved synthetic user, authorized shell loading Plan | Plan with 45-minute selection, synthetic catalog | Generated eight-exercise workout beginning with Barbell Curl | Clean production build inputs | Final production output after Workbox generation |
| Action | Load authorized app; inspect loading/success contract and auth/state regression matrix | Open Manage Catalog; observe loading; inspect Catalog; return via `Back to Generator`; later open from Workout and inspect `Back to Workout` | Generate Plan; observe loading; inspect Workout; open Catalog; return to preserved Workout | Run checker fixtures, production build, full CI check, and baseline production verifier | Inspect `.vite/pwa-precache.json` and require every manifest JavaScript file to be included |
| Observed result | `Generate Workout` received focus. At 320px the changed surface had `scrollWidth == clientWidth == 320`; success remained available at all widths. After the review-driven focus fix, toggling the Plan `Back` checkbox retained focus on that control across the lifted-state rerender; the component regression also covers slider and checkbox focus persistence. Exact loading/failure/retry/auth ownership passed component tests. | `Loading catalog settings…` and `Loading catalog settings.` appeared as the sole main job before `Catalog Management` received focus. Header label was context-correct. Changed surfaces had no horizontal overflow at all four widths. Failure/retry/stale navigation passed component tests. | `Loading your workout…` and `Loading your workout.` appeared before `Ready to sweat?` received focus. Settings showed `Back to Workout`; returning restored the same generated workout beginning with Barbell Curl. Changed surfaces had no horizontal overflow at all four widths. Failure/retry/stale/auth behavior passed component tests. | Boot `316,900` raw / `98,588` gzip; first Plan `338,073` / `106,452`; Firestore SDK and largest application chunk `309,241` / `87,144`. Every application JavaScript chunk was below `500,000` raw bytes. Firestore provenance was pure and excluded from boot/Plan. PWA precache was `926,070` raw / `278,879` gzip; SW/runtime `17,156` / `6,217`. | Final precache contained 22 entries, including the emitted `AuthorizedApp`, `Settings`, and `WorkoutView` retry identities, Firestore, storage, shared support, and all other manifest JavaScript files. The checker requires those ordinary hashed lazy-entry URLs to remain precached, requires fragment-keyed retry code, and rejects query-keyed retry URLs. An actual installed-browser offline route transition was not available in the harness. |
| Evidence link and limitation | This report; screenshots inspected but not durably linkable. Component tests cover transient states that load too quickly for deterministic browser capture. | This report; screenshot inspected at 375px. Keyboard source order is header action before main retry; the harness did not reliably advance `Tab`. | This report; screenshots inspected at 375px. WorkoutView reducer/timer state intentionally resets across the Settings detour; generated input and destination were preserved. | `npm run ci:check`, `npm run verify:baseline-production`, `node --test scripts/bundle-budget.node.mjs`, and emitted `.vite` reports. | `dist/.vite/pwa-precache.json` and bundle checker output; residual risk limited to the unsupported real offline transition. |

## Verification summary

- Focused regression matrix: 9 files, 99 tests passed.
- Full `npm run ci:check`: 29 files passed, 2 skipped; 349 tests passed, 10 skipped; lint, production build, Firestore rules, workflow, and agent checks passed without Vite warnings.
- Bundle checker fixtures: 5 passed, including missing/duplicate provenance, mixed ownership, boot/Plan leakage, retry URL identity, precache coverage, and all size ceilings.
- Firebase emulator rules: 8 passed.
- `npm run test:emulator-baseline`: all canonical and scratch integration scenarios passed; 2 browser baseline tests passed.
- `npm run verify:baseline-production`: passed.

## Overall recommendation

`evidence-complete-with-residual-capability-risk`

No direct changed-surface usability defect was observed. The residuals are limited to
actual 200% browser zoom, reliable sequential keyboard traversal in this harness, and
an installed-browser offline transition. Each unsupported portion has a documented
fallback, residual risk, and reactivation trigger; no product behavior was weakened
to satisfy the bundle budget.

## EPIC-13 integration impact

EPIC-13/B8 must preserve the lazy Plan, Catalog Settings, and Workout boundaries;
the exact loading, failure, retry, focus, ownership, and context-sensitive escape
behavior; and the application-JavaScript bundle and PWA contracts recorded here.
TREK-98 introduces no additional EPIC-13 product scope.
