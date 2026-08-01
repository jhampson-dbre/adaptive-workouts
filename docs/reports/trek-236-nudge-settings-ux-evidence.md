# TREK-236 Settings and catalog UX evidence

## Planning

- Classification: `required`
- Rationale: TREK-236 materially changes Settings hierarchy, responsive layout, action emphasis, validation feedback, and catalog status visibility.
- Approved scenario or artifact: `.impeccable/surfaces/src-components-settings-jsx.md`, accepted by the independent UX design review after clarifying the one-signal rule, inherited rest labels, and reversible active/inactive states.

## Normal Settings hierarchy

- Scenario: Open Settings and scan general defaults, the add form, and the catalog.
- Build / commit: `codex/trek-236-settings-catalog` working-tree source diff SHA-256 `cef229dac343c85765768d22960e3a16b7af360b3586a88c634c032a29ee1720`, calculated from `git diff -- src/components/Settings.jsx src/index.css src/tests/Settings.test.jsx` after the final typography alignment.
- Viewport and starting state: In-app Browser at 1280 x 900 and 390 x 844; canonical synthetic emulator baseline.
- Actions: Open `Manage Catalog`; inspect the initial Settings state.
- Observed result: Settings uses the Nudge black, white, and concrete planes; General defaults leads; Add is the sole yellow action; active catalog rows visibly distinguish inherited and overridden rest values. The 390px form stacks into one column.
- Rendered evidence: `.impeccable/evidence/trek-236-settings-desktop.png` and `.impeccable/evidence/trek-236-settings-mobile.png`.
- Material limitation: Chromium rendering does not prove physical-device Safari font metrics.

## Narrow reflow

- Scenario: Reflow the complete Settings surface at the 320 CSS-pixel proxy.
- Build / commit: Same working-tree source diff.
- Viewport and starting state: In-app Browser at 320 x 844, producing a 305px document viewport after the vertical scrollbar; canonical synthetic emulator baseline.
- Actions: Open Settings and measure the document and controls after responsive layout settles.
- Observed result: Document `scrollWidth` equals `clientWidth` at 305px; add controls are full-width and the surface has no horizontal scrolling.
- Rendered evidence: `.impeccable/evidence/trek-236-settings-reflow-320.png`.
- Material limitation: Browser zoom was represented by the equivalent CSS-pixel viewport rather than an operating-system magnifier.

## Validation feedback

- Scenario: Enter an invalid default rest duration and leave the field.
- Build / commit: Same working-tree source diff.
- Viewport and starting state: In-app Browser at 320 x 844; canonical synthetic emulator baseline.
- Actions: Change Default rest seconds from 90 to 4, then focus Warmup minutes.
- Observed result: An inline `role="alert"` explains that rest must be a whole number from 5 through 600 seconds; the invalid value remains available to correct. The value was restored to 90 after capture.
- Rendered evidence: `.impeccable/evidence/trek-236-settings-invalid-mobile.png`.
- Material limitation: A live persistence failure was not injected because the browser shared the local emulator process. Existing focused component tests verify that add and edit values remain present after rejected persistence, while this rendered scenario verifies the shared inline feedback treatment.

## Edit action hierarchy

- Scenario: Edit an existing weighted catalog item.
- Build / commit: Same working-tree source diff.
- Viewport and starting state: In-app Browser at 320 x 844; canonical synthetic Back Squat row.
- Actions: Select Edit on Back Squat and inspect the edit actions.
- Observed result: Save is the sole signal-yellow action (`rgb(255, 212, 0)`); Add becomes neutral white, Cancel remains neutral, and all edit fields stack without horizontal overflow.
- Rendered evidence: `.impeccable/evidence/trek-236-settings-edit-add-neutral-mobile.png` shows neutral Add while the row is editing; `.impeccable/evidence/trek-236-settings-edit-mobile.png` shows yellow Save and neutral Cancel in the same edit state.
- Material limitation: The evidence covers the existing weighted edit mode; simple and bodyweight field validation remain covered by focused component tests.

## Reversible inactive state

- Scenario: Deactivate and reactivate a catalog item.
- Build / commit: Same working-tree source diff.
- Viewport and starting state: In-app Browser at 320 x 844; canonical synthetic Back Squat row initially active.
- Actions: Cancel edit, select Deactivate, inspect the row, then select Reactivate.
- Observed result: The row exposes the non-color `Inactive` label and `Reactivate` action while retaining its rest summary. Reactivation restored the synthetic baseline and the visible `Active` label.
- Rendered evidence: `.impeccable/evidence/trek-236-settings-inactive-mobile.png` shows Inactive and Reactivate; `.impeccable/evidence/trek-236-settings-reactivated-mobile.png` shows the restored Active and Deactivate state.
- Material limitation: Emulator-backed state verifies the reversible interaction locally, not production Firebase latency.

## Automated design scan

- Impeccable's one-pass detector reported advisory typography drift across the shared legacy stylesheet. The five TREK-236 typography declarations were aligned to the documented Display, Headline, Body, Title, and Label ramp in one mechanical batch. Remaining advisories predate or fall outside this task's changed surface.
