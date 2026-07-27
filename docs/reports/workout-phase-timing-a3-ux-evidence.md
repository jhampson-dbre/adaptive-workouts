# Workout Phase Timing A3 UX Evidence

This report records the required rendered History evidence for TREK-219 / A3 against
T-09 and the History portion of T-10 in
`docs/specs/2026-07-18-workout-phase-timing.md`. It follows
`docs/templates/ux-evidence-matrix.md` and uses synthetic local emulator data only.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | A3 changes how saved schema-v4 workouts are classified and presented in History. A valid document must expose phase totals, while any malformed v4 document must be unavailable as a whole. |
| Proportional artifact | Approved T-09/T-10 behavior and the A3 evidence row in `docs/specs/2026-07-18-workout-phase-timing.md`. This execution artifact is limited to the changed History read/presentation surface. |
| Planning artifact revision | `UX-ARTIFACT: workout-phase-timing@approved-2026-07-18` at the spec path above. |
| Planning wireframe status | `planning-only`; the approved specification remains authoritative and this report records rendered execution evidence. |
| Required UX design review | Completed during EPIC-12 planning; A3 preserves that approved History contract. |
| Architecture authority | Architecture retains authority for system boundaries, data, security, and feasibility. |

## Run metadata and capability probe

| Field | Record |
| --- | --- |
| Run | `CAP-219-2026-07-21-IAB-01` |
| Build / commit | Working tree based on `66caeb1`; final focused 161/161, full 381 passed with 10 skipped, and `npm run ci:build` passed. The rendered run preceded the review-driven strict nested-field and discriminating engine-test additions; those changes do not alter the rendered valid/malformed fixtures or presentation. |
| Fixture / data revision | Canonical `emulator-baseline-v1`, authenticated as the synthetic `emulator-baseline-user`, plus two temporary local History documents: `v4-valid-path-id` and `v4-malformed-path-id`. Both stored conflicting payload IDs to exercise the authoritative Firestore path-ID boundary; no production data or credentials were used. |
| Per-run capability probe | The in-app browser exposed exact viewport override, rendered screenshots, DOM/accessibility snapshots, active-element inspection, geometry reads, and console logs. It did not expose actual browser zoom, reduced-motion emulation, offline switching, network interception, or a reliable sequential-keyboard capability. One bounded `Enter` probe left the already focused disclosure unchanged, so it was not repeated. |
| Supported portion | Pointer activation, responsive rendering, semantic structure, focus inspection, exact viewport dimensions, clipping/overflow measurements, and normal-run console diagnostics. |
| Unsupported metadata | `capability_reason: unsupported-by-harness`; harness/session `CAP-219-2026-07-21-IAB-01`. Eligible alternatives were narrow-width rendered reflow, component tests, source audit, and build/PWA output. Selected fallbacks: 320px rendered pressure for zoom, native disclosure semantics plus component tests for keyboard behavior, source audit for motion neutrality, and successful Workbox/build output for packaged availability. Limitations: no direct 200% zoom, reduced-motion preference, installed/offline navigation, or reliable keyboard traversal. Residual risk reactivates in TREK-223/A7 and TREK-224/A8, or earlier when a capable harness is available. |
| Screenshot disposition | Representative 320x568, 568x320, and 1280x800 screenshots were inspected live. The harness did not provide a durable repository screenshot artifact, so reproducible viewport, DOM, geometry, and outcome observations are recorded here without binary churn. |

## A3-S1 — Valid v4 phase presentation

| Field | Record |
| --- | --- |
| Scenario ID and name | `A3-S1` — A valid v4 workout explains total and per-phase timing. |
| Changed surface | Workout History valid-v4 card. |
| Applicability | `applicable`; this is the direct A3 presentation surface. |
| `capability_state` | `supported` for rendered pointer, responsive, and screen-reader-facing evidence. |
| Evidence kind | `rendered-primary` plus component/schema tests. |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable` |
| Allowed recommendation | `rendered-usability-pass` for the supported portion. |
| Requested and actual viewport | Requested/actual: 320x568, 375x667, 568x320, 768x768, and 1280x800. Document scroll widths were 305, 360, 553, 753, and 1265 CSS pixels, all below the requested viewport width. |
| Starting state | Authenticated canonical Plan, generated workout visible, History closed, two synthetic v4 records seeded locally. |
| Action | Activate `Workout history`, inspect the newest card and its phase region, then resize through every required viewport. |
| Observed result | The July 20 card rendered `Duration: 2:05`; the accessible `Phase durations` region rendered Warmup planned 10:00 / actual 0:00, Performance planned 30:00 / actual 2:05, and Cooldown planned 5:00 / actual 0:00. Plank set timing remained visible below it. The region stayed inside the card at every viewport with no horizontal overflow or clipped phase content. The disclosure measured about 108x44 CSS pixels and retained `aria-expanded=true` plus focus after pointer activation. Normal-run console output contained only Vite/React debug information and the expected Auth Emulator notice. |
| Evidence link and limitation | Live screenshots and DOM snapshots were inspected in-session; no durable image was emitted. Exact keyboard-only activation, browser zoom, reduced motion, and offline behavior retain the capability limitations recorded above. |

## A3-S2 — Malformed v4 whole-card unavailability

| Field | Record |
| --- | --- |
| Scenario ID and name | `A3-S2` — A malformed v4 save is unavailable as a whole. |
| Changed surface | Workout History malformed-versioned card. |
| Applicability | `applicable`; partial salvage would contradict the approved strict-reader behavior. |
| `capability_state` | `supported` for rendered presentation and semantic inspection. |
| Evidence kind | `rendered-primary` plus schema/component tests. |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable` |
| Allowed recommendation | `rendered-usability-pass` |
| Build / commit | Same run and working tree as A3-S1. |
| Fixture / data revision | `v4-malformed-path-id` differed from the valid record by an `actualDurationSeconds` value that did not equal the sum of actual phase durations. |
| Requested and actual viewport | Same five required requested/actual viewports as A3-S1. The malformed card remained within its containing width at each viewport. |
| Starting state | History open beneath the valid v4 record. |
| Action | Inspect the July 19 malformed record at mobile, landscape, tablet, and wide viewports. |
| Observed result | The card rendered only its date and `Saved workout details are unavailable.` It exposed no phase totals, exercise name, set details, or salvaged timing. The valid card immediately above remained intact. |
| Evidence link and limitation | Live mobile and wide screenshots plus the accessibility snapshot were inspected in-session. No durable image was persisted. |

## A3-S3 — Read compatibility, ID authority, and residual capabilities

| Field | Record |
| --- | --- |
| Scenario ID and name | `A3-S3` — v4 reads integrate without changing older reads or the production writer. |
| Changed surface | History read boundary and downstream classification; no additional rendered controls. |
| Applicability | `applicable`; T-09 requires authoritative IDs and legacy/v2/v3 compatibility, while T-10 requires cross-cutting History accessibility evidence. |
| `capability_state` | `partial`; rendered semantics are supported, while keyboard traversal, zoom, reduced motion, and offline switching are unsupported by this harness. |
| Evidence kind | `component-test` and `source-audit`, with rendered-primary semantic evidence for the disclosure/cards. |
| Outcome | `observed-pass` for supported rendered semantics and automated compatibility; `not-tested` for the unsupported direct browser capabilities. |
| Changed-surface routing | No defect observed. Unsupported portions are explicit nonblocking residuals routed to the integrated A7/A8 run. |
| Evidence obligation | `satisfied` through the prescribed fallbacks. |
| Disposition | `nonblocking-residual` |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | Same run and verification as A3-S1. |
| Fixture / data revision | Both local records stored conflicting payload `id` values; storage tests prove returned entries use their Firestore path IDs. Automated schema coverage rejects unknown nested exercise, set-record, and recommendation bookkeeping while preserving canonical v4 shapes. History, progression, engine, and storage coverage also preserves legacy/v2/v3 behavior and keeps the production writer on schema v3. |
| Requested and actual viewport | Rendered semantics covered at all five required viewports; 320x568 is the narrow-width proxy for zoom pressure. |
| Starting state | History disclosure focused after pointer activation, valid and malformed records rendered. |
| Action | Inspect accessibility roles/names and focus; perform one bounded Enter probe; review focused/full test and build results. |
| Observed result | History remained a named region with a uniquely named disclosure, `aria-expanded`, dated article headings, and an accessible `Phase durations` region. Pointer activation retained focus. The harness Enter probe did not change disclosure state, so no keyboard pass is claimed. Source inspection found no new animation or motion-dependent state. The production build emitted the normal Workbox precache successfully. |
| Evidence link and limitation | Automated tests are reproducible from the commands in Run metadata. Direct keyboard traversal, 200% zoom, reduced-motion emulation, and installed/offline navigation remain unsupported-by-harness, with the exact fallback and reactivation trigger recorded above. |

## Recommendation

The changed A3 History surface has a rendered usability pass for valid and malformed
v4 presentation at every required viewport. The unsupported direct keyboard, zoom,
reduced-motion, and offline capabilities are evidence-complete nonblocking residuals
for this read-only slice and must be re-probed during the controlled A7/A8 integrated
evidence runs.
