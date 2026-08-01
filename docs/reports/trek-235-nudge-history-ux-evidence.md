# TREK-235 Nudge history UX evidence

## Planning

- Classification: `required`
- Rationale: Workout history changes hierarchy, dense responsive layout, recoverable feedback, and visible keyboard focus inside the active workout surface.
- Approved scenario or artifact: TREK-235 task contract plus the fresh UX design review recorded during implementation; the established Clear Signal system remains authoritative.

All evidence uses synthetic local fixtures. Build: `codex/trek-235-nudge-history` working tree on base `7e87411`; source-diff fingerprint `c7ead75a48995dbdfd6da34fd6467bec06274194`.

## Changed scenario

- Scenario: Dense newest-first v4 history on a phone.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 390 × 844; T-09 synthetic history fixture; disclosure collapsed.
- Actions: Opened Workout history with three saved workouts.
- Observed result: Neutral disclosure and square cards remain subordinate to the current workout action; dates lead each card; phase durations, exercises, set status, and timing wrap without horizontal overflow. History `scrollWidth` equaled `clientWidth` at 337px.
- Rendered evidence: `.impeccable/evidence/trek-235-history-mobile.png`
- Material limitation: Synthetic fixture; no production or personal data.

## Changed scenario

- Scenario: Dense desktop history.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 1280 × 900; T-09 synthetic history fixture; disclosure collapsed.
- Actions: Opened Workout history.
- Observed result: Three v4 phase durations use equal columns, cards remain newest first, and the focused disclosure retains the shared blue focus outline. History `scrollWidth` equaled `clientWidth` at 723px.
- Rendered evidence: `.impeccable/evidence/trek-235-history-desktop.png`
- Material limitation: Synthetic fixture; no production or personal data.

## Changed scenario

- Scenario: 200% reflow proxy.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 320 × 844 CSS pixels, equivalent to a 640px viewport at 200%; dense T-09 fixture.
- Actions: Opened Workout history and inspected the expanded cards.
- Observed result: Card headers, phase durations, and set rows stack; long factual content wraps; the history surface has no horizontal overflow (`scrollWidth` and `clientWidth` both 283px).
- Rendered evidence: `.impeccable/evidence/trek-235-history-reflow-320.png`
- Material limitation: The browser controller exposes viewport sizing but not a zoom override, so this is a CSS-pixel reflow proxy rather than a browser-zoom capture.

## Changed scenario

- Scenario: Loading and initial offline recovery.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 390 × 844; synthetic pending or rejected loader; disclosure collapsed.
- Actions: Selected Loading History or Error History, then opened the disclosure.
- Observed result: Loading remains a polite status. Initial failure renders one neutral `role="alert"` with a visible Retry control; the containing workout remains available and the error does not use the blocking red fill.
- Rendered evidence: `.impeccable/evidence/trek-235-history-loading-mobile.png`; `.impeccable/evidence/trek-235-history-error-mobile.png`
- Material limitation: Injected outcomes prove presentation, not real network failure handling.

## Changed scenario

- Scenario: Older-page failure and keyboard recovery.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 390 × 844; one loaded v4 card with an older-page cursor.
- Actions: Opened history, activated Load older, and allowed the synthetic older request to reject.
- Observed result: The loaded card remains visible, one neutral alert appears, and focus moves to Retry older workouts with the shared blue focus outline.
- Rendered evidence: `.impeccable/evidence/trek-235-history-older-error-mobile.png`
- Material limitation: Injected outcome; pagination ordering, deduplication, and focus transitions are additionally covered by focused component tests.

## Changed scenario

- Scenario: Malformed saved workout.
- Build / commit: Source-diff fingerprint above.
- Viewport and starting state: 390 × 844; malformed v4 fixture.
- Actions: Selected Malformed History and opened the disclosure.
- Observed result: One square unavailable card shows `Unknown date` and the existing factual unavailable message without an invented completion claim.
- Rendered evidence: `.impeccable/evidence/trek-235-history-malformed-mobile.png`
- Material limitation: Synthetic malformed fixture.

## Verification notes

- Focused baseline and post-change tests: 87/87 passed across `WorkoutHistory.test.jsx` and `WorkoutView.test.jsx`.
- The bounded design detector scanned the shared stylesheet and returned repository-wide advisories. Its task-local new color/type advisories were removed without a second detector loop.
- An author self-review caught disclosure overflow at 320px. Adding `box-sizing: border-box` removed it; the replacement render has no overflowing element and the history section's `scrollWidth` equals its `clientWidth`.
- Workflow limitation: the environment's only child-thread slot remained reserved by the completed implementor, so a fresh `ux-usability-reviewer` could not be dispatched. The rendered scenarios received coordinator review and an author self-review, but independent rendered usability review remains the publication follow-up.
