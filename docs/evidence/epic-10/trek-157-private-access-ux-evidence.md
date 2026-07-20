# TREK-157 Private Access UX Evidence

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | TREK-157 changes the full-screen authorization journey, protected-content visibility, action hierarchy, focus, timeout feedback, and recovery. |
| Proportional artifact | `UX-ARTIFACT: private-owner-approved-access@v2` in `docs/specs/2026-07-14-private-owner-approved-access.md`, scenarios UX-10-01 through UX-10-04. |
| Planning artifact revision | `private-owner-approved-access@v2`; the approved spec is authoritative. |
| Planning wireframe status | `planning-only`; no wireframe was used as rendered evidence. |
| Required UX design review | Completed during planning with no remaining findings; fresh execution usability review is required after this matrix. |
| Architecture authority | The approved strict claim, token, storage, migration, emulator, and deployment boundaries were not changed by this evidence run. |

## Execution build and capability probe

| Field | Record |
| --- | --- |
| Evidence build | `trek-157-worktree-2026-07-19`; final post-review-simplification worktree based on commit `4670df46d9bf7c78fb6e514b4769b5114cea50bb`. The scoped task commit is intentionally pending until the renewed reviews accept this exact worktree. |
| Harness | Codex in-app Browser plus `npm run ux:private-access`; browser session `-bdee-4559-b85a-e6673f0bfcef`; manifest `private-access-ux-scenarios-v1`. |
| Bounded capability probe | Browser viewport override accepted 375x812; DOM snapshots, accessible focus, read-only layout metrics, unique semantic clicks, and viewport screenshots worked. Runner start/stage/stop worked with real Auth/Firestore emulators and Vite. |
| Capability state | `supported` for rendered-primary viewport observation, semantic actions, focus inspection, and safe synthetic screenshots. Full-page screenshot capture was rejected after a bounded probe produced a DPR-cropped image; viewport capture was independently verified and used instead. |
| Shared provenance | Artifact `private-owner-approved-access@v2`; fixture `emulator-baseline-v1`; auth contract `emulator-baseline-auth-v2`; explicit project `demo-project`; actual viewport 375x812 for every final run. |
| Safe data | Canonical synthetic identity `peach.otter.880@example.com` / `emulator-baseline-user`; no production identity, credential, token, or project configuration appears. |
| Automated support | Final serial `npm run ci:check` passed with 325 tests passed and 10 intentional skips. Full emulator baseline, production exclusion, runner/control/staging tests, and App/baseline access-state regression suites passed. The dedicated contrast suite verifies black primary text at 4.7788:1 on light `#aa3bff` and 7.9475:1 on dark `#c084fc`. |

## Harness preflight and correction record

- Final preflight independently validated exact manifest/artifact/fixture/auth revisions, the canonical UID and strict claim readback, strict rules predicates, registered start states/actions, viewport/session connectivity, and driver acknowledgements. It did not inspect product DOM, focus, actions, or outcomes.
- Paired classifier tests prove that invalid manifest/fixture/staging/capture is blocking `harness-invalid`, while a valid preflight plus an intentionally wrong product observation is blocking `ux-defect`.
- The first bounded probe found three harness-owned defects before evidence acceptance: the scenario start state was metadata-only, cross-port control polling lacked narrow loopback CORS, and queued action IDs did not match adapter action IDs. Each was corrected without changing scenario semantics; targeted tests, simplification, and fresh preflight were rerun.
- The first usability review found insufficient recovery-action hierarchy. The final worktree gives Check again/Retry primary treatment and Sign out secondary treatment; UX-10-02 and UX-10-03 were rerendered after that fix.
- Final accessibility review found white primary-action text below 4.5:1 in both supported color schemes. The final worktree uses black primary text, with exact automated ratios above; every evidence frame containing the shared primary action was rerendered afterward, and browser computed styles confirmed `rgb(0, 0, 0)` over the light accent.
- Final conformance review identified the approved pre-gate DEV+baseline presentation had been lost. The final worktree restores it around the shared strict gate. A bounded exact-build probe intentionally ran baseline Vite without emulators: it captured focused `Preparing emulator baseline…`, classified focused `Baseline unavailable` / `Auth emulator unavailable`, and a semantic Retry baseline transition back to focused preparation. This failure probe never asserted authorization or replaced the scenario runner.
- A full-page screenshot probe was capture-invalid because the browser backend cropped at device-pixel ratio. The supported viewport screenshot path used an actual 375x812 browser viewport; saved PNG raster height is 811 pixels because the browser capture backend omits one device row. DOM layout metrics and reach were recorded independently, and no full-page invalid capture is used as evidence.

## UX-10-01 — Verify sign-in and enter the private application

| Field | Record |
| --- | --- |
| Scenario ID and name | `UX-10-01` — Verify sign-in and enter the private application |
| Changed surface | Shared `App` access gate, checking surface, and authorized transition |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | Approved lifecycle runner session `8ed3d47f-697e-43ab-8198-980aae195d22`; approved start readback `{ approved: true }`. Final restored-baseline probe used the exact worktree at 375x812 with no emulator listeners, producing the expected classified unavailable state and successful Retry-to-preparation transition. Browser DOM/focus/layout/screenshot supported. |
| `capability_state` | `supported` |
| Unsupported metadata | Not applicable. |
| Evidence kind | `rendered-primary` plus component/race tests |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable`; no residual limitation or finding requires disposition. |
| Allowed recommendation | `rendered-usability-pass` |
| Build / commit | `trek-157-worktree-2026-07-19`, based on `4670df4`; commit pending renewed review. |
| Fixture / data revision | `emulator-baseline-v1`; auth `emulator-baseline-auth-v2`; actual strict approved readback. |
| Requested and actual viewport | Requested 375x812 CSS px; actual `window.innerWidth=375`, `innerHeight=812`; body scroll width 375. |
| Starting state | Protected UI absent; the pre-gate baseline preparation surface focused `Preparing emulator baseline…`; after identity handoff the shared checking surface owns claim evaluation. |
| Action | Baseline synthetic sign-in, fixed identity validation, strict token evaluation, approved-only Firestore verification, and migration boundary completed. Separately, the exact-build no-emulator failure probe exercised classified bootstrap failure and Retry baseline. |
| Observed result | The restored preparation surface and classified unavailable guidance were focused, truthful, and free of protected content; Retry immediately returned to focused preparation. In the approved runner, the shared gate completed and authorized UI mounted with focus on `Generate Workout`; no horizontal overflow. |
| Evidence link and limitation | [`ux-10-01-baseline-preparing.png`](trek-157/ux-10-01-baseline-preparing.png), [`ux-10-01-baseline-unavailable.png`](trek-157/ux-10-01-baseline-unavailable.png), [`ux-10-01-approved.png`](trek-157/ux-10-01-approved.png). The no-emulator frames prove only the approved baseline presentation/recovery; authorization remains proved by the preflighted runner and automated ordering/race tests. |

## UX-10-02 — Wait for approval and check again

| Field | Record |
| --- | --- |
| Scenario ID and name | `UX-10-02` — Wait for approval and check again |
| Changed surface | Pending approval surface and approval-refresh transition |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | Original lifecycle runner session `f23ebd98-3734-49af-8153-b062131f1d88`; final contrast rerender runner session `44629737-76ae-4593-91e5-a1996ebee9de`. Both started from exact pending `{}` readback; the lifecycle run's `approve-user` acknowledgement read back `{ approved: true }`; semantic click supported. |
| `capability_state` | `partial`; pending, action hierarchy, approval refresh, focus, and long-value reach are supported, while a second rendered activation during the fast emulator settlement uses the documented fallback. |
| Unsupported metadata | Partial sub-capability: duplicate activation during an in-flight refresh. Reason: the local forced refresh settled before a second rendered activation could be delivered. Fallback: component/race tests verify current-generation ownership and stale-result suppression. Residual risk: low and confined to rendered timing, not state logic. Reactivation: rerun if a deterministic in-flight pause is added to the approved harness. |
| Evidence kind | `rendered-primary` plus component/race tests |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed. |
| Evidence obligation | `satisfied` |
| Disposition | `nonblocking-residual`; the bounded timing limitation is covered by the approved automated fallback and has the reactivation trigger above. |
| Allowed recommendation | `evidence-complete-with-residual-capability-risk` |
| Build / commit | `trek-157-worktree-2026-07-19`, based on `4670df4`; commit pending renewed review. |
| Fixture / data revision | Synthetic canonical identity with pending `{}` then strict `{ approved: true }` Admin readback. |
| Requested and actual viewport | Requested and actual browser viewport 375x812; body/client width 375; surface scroll height 812 with both actions reachable. Saved PNG raster is 375x811 due to the one-row capture limitation recorded above. |
| Starting state | Authenticated pending user; protected UI absent; `Awaiting approval` heading focused. |
| Action | Stage `approve-user`, click unique `Check again`, observe checking, forced refresh, and authorization. |
| Observed result | Only synthetic email/UID values appeared. Check again has clear primary treatment, computed black text on the light accent, and Sign out has secondary treatment. Check again retired pending immediately; authorized UI mounted with `Generate Workout` focused. An isolated exact-component/CSS stress render used intentionally long synthetic values: body scroll width remained 375, surface height remained 812, and both 44px-high actions remained above the fold. |
| Evidence link and limitation | [`ux-10-02-pending.png`](trek-157/ux-10-02-pending.png), [`ux-10-02-long-identity.png`](trek-157/ux-10-02-long-identity.png). The long-value frame is the exact final `PendingApproval` component and application CSS rendered by the same Vite build with synthetic props; it is a layout stress probe, not an authorization-state assertion. Duplicate activation uses the documented automated fallback. |

## UX-10-03 — Recover from an access-verification failure

| Field | Record |
| --- | --- |
| Scenario ID and name | `UX-10-03` — Recover from an access-verification failure |
| Changed surface | Verification-error, Retry, and timeout recovery |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | Lifecycle runner session `fe10e5fe-a296-4fb2-8e5e-1e1702286ab2`; final contrast rerender session `597ec39b-121c-4f11-930d-4ec1861c1569`; approved start readback; registered reject/hold acknowledgements and Retry click supported. |
| `capability_state` | `supported` |
| Unsupported metadata | Not applicable. |
| Evidence kind | `rendered-primary` plus component/fake-timer race tests |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed after harness corrections. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable`; no residual limitation or finding requires disposition. |
| Allowed recommendation | `rendered-usability-pass` |
| Build / commit | `trek-157-worktree-2026-07-19`, based on `4670df4`; commit pending renewed review. |
| Fixture / data revision | Strict approved synthetic identity; adapter protocol `private-access-scenario-control-v1`. |
| Requested and actual viewport | Requested and actual 375x812; no horizontal overflow. |
| Starting state | Approved identity with protected UI absent during evaluation. |
| Action | Reject next evaluation, observe error, click Retry and recover approved; separately hold next evaluation through the real 15-second App deadline. |
| Observed result | Error heading focused, protected UI absent, truthful alert visible, Retry clearly primary with computed black text on the light accent, and Sign out clearly secondary. Retry recovered to authorized focus. Hold remained on focused checking and moved to the same focused error after 15 seconds; late-result safety is covered by automated tests. |
| Evidence link and limitation | [`ux-10-03-checking-timeout.png`](trek-157/ux-10-03-checking-timeout.png), [`ux-10-03-error.png`](trek-157/ux-10-03-error.png). |

## UX-10-04 — Remove access after refresh, sign-out, or account switch

| Field | Record |
| --- | --- |
| Scenario ID and name | `UX-10-04` — Remove access after refresh, sign-out, or account switch |
| Changed surface | Authorized-to-checking/pending lifecycle and sign-out recovery |
| Applicability | `applicable`; direct changed surface |
| Per-run capability probe | Final runner session `be269c6c-da9b-4cbd-b021-2f193f16620a`; approved start readback, `revoke-user` readback exact `{}`, reload/session refresh, semantic Sign out click, and final screenshots captured after all shared component/style changes. |
| `capability_state` | `supported` for the rendered lifecycle; bounded stale/overlap timing is component-test evidence as planned. |
| Unsupported metadata | Not applicable. |
| Evidence kind | `rendered-primary` plus component/race tests |
| Outcome | `observed-pass` |
| Changed-surface routing | No direct changed-surface defect observed. |
| Evidence obligation | `satisfied` |
| Disposition | `not-applicable`; no residual limitation or finding requires disposition. |
| Allowed recommendation | `rendered-usability-pass` |
| Build / commit | `trek-157-worktree-2026-07-19`, based on `4670df4`; commit pending renewed review. |
| Fixture / data revision | Approved strict claim then exact revoked `{}` readback for the canonical synthetic UID. |
| Requested and actual viewport | Requested and actual 375x812. |
| Starting state | Authorized UI visible with `Generate Workout` focused. |
| Action | Stage `revoke-user`, reload to deliver the refreshed session/token path, observe fail-closed destination, then Sign out. Account-switch/stale overlap uses the approved automated bounded-race evidence. |
| Observed result | After revocation, protected UI was absent and focused `Awaiting approval` showed only the current synthetic identity, with contrast-corrected Check again primary and Sign out secondary. Sign out retired identity details and focused `Sign in with Google`. No stale protected content or focus appeared. |
| Evidence link and limitation | [`ux-10-04-authorized.png`](trek-157/ux-10-04-authorized.png), [`ux-10-04-revoked-pending.png`](trek-157/ux-10-04-revoked-pending.png), [`ux-10-04-signed-out.png`](trek-157/ux-10-04-signed-out.png). Reload is the safe rendered token-delivery path; immediate same-document event ordering, account switch, sign-out pending/rejection, and stale completions are verified by the final App/baseline regression suites. |

## Evidence conclusion

All four prescribed scenarios have independently valid final preflight, rendered-primary observations at the requested viewport, safe synthetic screenshots, and supporting race/focus tests. The final allowed recommendation is `evidence-complete-with-residual-capability-risk` because UX-10-02's duplicate-activation sub-capability uses the documented automated fallback; no direct changed-surface defect remains. Fresh usability, code, and task-conformance review must accept this exact final worktree.
