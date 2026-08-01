# TREK-234 — Nudge recovery and uncertainty evidence

## Planning

- Classification: `required`
- Rationale: Production recovery, ownership, and save uncertainty states materially affect action hierarchy, focus, feedback, and exit choices.
- Approved scenario or artifact: `docs/specs/2026-07-19-resolve-interface-system.md`, TREK-234; current TREK-233/TREK-235 production UI; CMT-258.

All rendered evidence uses the existing Timing harness with synthetic data and the production `WorkoutView`. Build: `codex/trek-234-nudge-recovery`; source-diff SHA-256 `222c84697f3b4fe750079090cff9eb8480d785ed97fc30b811dfbc9f75939c86`; focused tests, lint, and build green. Browser viewports: 590 × 632 and 1280 × 720 CSS pixels.

## Changed scenario

- Scenario: Resume or discard a recoverable workout.
- Build / commit: Source-diff SHA-256 above.
- Viewport and starting state: C-01 synthetic resumable draft with no live storage or lock.
- Actions: Opened the production recovery surface and inspected focused heading, alert, Resume, and Discard.
- Observed result: Focus moved to `Resume workout?`; Resume is the single emphasized action, Discard remains explicit, and the panel had no horizontal overflow.
- Rendered evidence: `.impeccable/evidence/trek-234-c-01-viewport.png`
- Material limitation: Synthetic fixture; it does not prove storage, locks, routing, or real draft hydration.

## Changed scenario

- Scenario: Ownership conflict and acquisition timeout with retained draft identity.
- Build / commit: Same source diff.
- Viewport and starting state: C-02 conflict and C-03 timeout synthetic states.
- Actions: Opened each production surface, confirmed heading focus and alert copy, then activated Retry acquisition.
- Observed result: Request handoff remains primary; Retry acquisition and Exit remain explicit secondary choices; the failed synthetic retry preserves the recovery state and focused action without overflow.
- Rendered evidence: `.impeccable/evidence/trek-234-conflict-actions-viewport.png`; `.impeccable/evidence/trek-234-timeout-actions-viewport.png`
- Material limitation: Injected outcomes do not exercise real Web Locks or handoff transport.

## Changed scenario

- Scenario: Invalid or stale draft and account/project mismatch disposition.
- Build / commit: Same source diff.
- Viewport and starting state: C-04 synthetic malformed, unsupported-version, stale, wrong-user, and wrong-project outcomes.
- Actions: Presented each outcome and inspected focused heading, factual alert, and allowed exit/discard choice.
- Observed result: Stale data offers Discard; malformed, unsupported, and identity-mismatched data offer only Exit. None exposes takeover controls or overflows.
- Rendered evidence: `.impeccable/evidence/trek-234-malformed-viewport.png`; `.impeccable/evidence/trek-234-unsupported-version-viewport.png`; `.impeccable/evidence/trek-234-c-04-viewport.png`; `.impeccable/evidence/trek-234-wrong-user-viewport.png`; `.impeccable/evidence/trek-234-wrong-project-viewport.png`
- Material limitation: Synthetic validation outcomes; real identity and project isolation remain covered by focused recovery tests.

## Changed scenario

- Scenario: Local recovery storage failure.
- Build / commit: Same source diff.
- Viewport and starting state: C-05 synthetic storage-error outcome.
- Actions: Opened the production recovery surface and inspected focus, alert, and Exit.
- Observed result: The failure remains explicit and calm, exposes no unsafe retry or takeover claim, and had no horizontal overflow.
- Rendered evidence: `.impeccable/evidence/trek-234-c-05-viewport.png`
- Material limitation: Injected outcome does not exercise browser storage.

## Changed scenario

- Scenario: Immutable save uncertainty, blocked conflict, and feedback retirement.
- Build / commit: Same source diff.
- Viewport and starting state: C-06 synthetic reconcile-indeterminate, blocked-conflict, and saved outcomes.
- Actions: Activated Check again in the indeterminate state; activated Keep pending in the blocked conflict; then selected the saved outcome.
- Observed result: Indeterminate reconciliation keeps Back to workout and Check again; blocked conflict freezes Review to Keep pending and Exit and announces `Save conflict remains pending.`; the saved transition retires the alert, focuses `Workout saved`, and exposes only Plan another workout. No tested surface overflowed.
- Rendered evidence: `.impeccable/evidence/trek-234-reconcile-actions-viewport.png`; `.impeccable/evidence/trek-234-blocked-conflict-feedback-viewport.png`; `.impeccable/evidence/trek-234-saved-viewport.png`
- Material limitation: The fixture does not perform immutable writes or server reconciliation; those mechanics remain covered by focused tests.

## Verification notes

- Focused recovery, coordinator, storage, presentation, focus, and `WorkoutView` tests pass.
- `npm run lint` and `npm run build` pass; the build retains the pre-existing dynamic-import warning.
- Browser DOM checks confirmed the intended focused heading or action, exact visible controls, alert/status retirement, and no horizontal overflow for every captured scenario.
