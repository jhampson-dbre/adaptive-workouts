# UX Evidence Record

Use this record for material UI work. Keep it concise and use only synthetic or
de-identified local data. Never include sensitive, personal, or production evidence.

## Planning

- Classification: `required` / `optional` / `skip-recorded`
- Rationale:
- Approved scenario or artifact:

## Changed scenario

- Scenario:
- Build / commit:
- Viewport and starting state:
- Actions:
- Observed result:
- Rendered evidence:
- Material limitation:

Repeat the changed-scenario section only when another materially changed flow needs
independent proof. Static inspection may establish a defect but cannot prove
usability. A direct changed-surface defect or missing rendered evidence for a required
material scenario blocks completion. If the preferred harness is unavailable, record
the safe method attempted and the best available alternative.

---

## 2026-07-31 — Mobile confirm-attempt arrow clearance

## Planning

- Classification: `required`
- Rationale: The primary workout action was visually obstructed at phone widths.
- Approved scenario or artifact: Preserve the active-set interaction and Nudge visual system; stack the primary and secondary actions only where the two-column layout cannot contain the primary label and arrow.

## Changed scenario

- Scenario: Start a weighted set and verify the active confirm/cancel actions at phone width.
- Build / commit: `codex/fix-confirm-arrow-responsive` source commit `edba0df`.
- Viewport and starting state: In-app Browser, 390 × 844 override (375 × 844 document viewport); seeded local emulator user with a generated workout and Barbell Curl set 1 active.
- Actions: Plan workout → Start Workout → Start Barbell Curl set 1.
- Observed result: Active actions render in one 318.75px column; “Confirm attempt” clears the CSS arrow, “Cancel timer” remains a separate full-width secondary action, document overflow is 0px, and the unchanged 760px layout retains two columns.
- Rendered evidence: `.impeccable/evidence/mobile-confirm-arrow-fixed.png`
- Material limitation: Browser evidence covers the responsive layout in Chromium, not physical-device Safari font rendering.

## Changed scenario

- Scenario: Verify the active confirm/cancel actions across the residual landscape breakpoint.
- Build / commit: `codex/fix-confirm-arrow-responsive` source commit `edba0df`.
- Viewport and starting state: Chrome DevTools mobile emulation at 568 × 320 and 760 × 600; seeded local emulator user with Barbell Curl set 1 active.
- Actions: Plan workout → Start Workout → Start Barbell Curl set 1; inspect the active actions at both widths.
- Observed result: At 568px the actions stack into one 487.2px column, “Confirm attempt” clears the arrow by 76.1px, and document overflow is 0px. At 760px the actions retain two 322.3px columns with 15.8px arrow clearance and 0px document overflow.
- Rendered evidence: `.impeccable/evidence/mobile-confirm-arrow-landscape-568.png` and `.impeccable/evidence/mobile-confirm-arrow-two-column-760.png`; existing portrait capture remains at `.impeccable/evidence/mobile-confirm-arrow-fixed.png`.
- Material limitation: Device emulation verifies Chromium layout and font metrics, not physical-device Safari rendering.

---

## 2026-08-02 — Settings catalog control labels

## Planning

- Classification: `required`
- Rationale: TREK-268 changes visible form labels and accessible names across the Settings add and edit flows.
- Approved scenario or artifact: `.impeccable/surfaces/src-components-settings-jsx.md`; preserve the mobile-first Settings hierarchy, persistence, validation, ordering, and Close/Cancel behavior.

## Changed scenario

- Scenario: Verify every add-catalog control remains visibly labeled and full-width at phone size.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-268 before task commit.
- Viewport and starting state: In-app Browser at 390 × 844 (375px document viewport); canonical synthetic emulator baseline.
- Actions: Open Manage Catalog and inspect the complete Add exercise form after the label-wrapper remediation.
- Observed result: Exercise name, Muscle group, Priority tier, Sets, Rest override seconds, Tracking mode, and Linked exercise have visible native labels and matching accessible names; controls stack full-width and document `scrollWidth` equals `clientWidth` at 375px.
- Rendered evidence: `.impeccable/evidence/trek-268-settings-labels-add-mobile.png`.
- Material limitation: Chromium rendering does not prove physical-device Safari font metrics.

## Changed scenario

- Scenario: Verify every edit-catalog control remains visibly labeled and full-width at phone size.
- Build / commit: Same TREK-268 working tree.
- Viewport and starting state: In-app Browser at 390 × 844 (375px document viewport); canonical synthetic Back Squat catalog row.
- Actions: Select Edit on Back Squat and inspect the edit form.
- Observed result: Edit exercise name, muscle group, priority tier, sets, rest override, tracking mode, and mode-specific fields have visible native labels and matching accessible names; controls stack full-width and document `scrollWidth` equals `clientWidth` at 375px.
- Rendered evidence: `.impeccable/evidence/trek-268-settings-labels-edit-mobile.png`.
- Material limitation: Chromium rendering does not prove physical-device Safari font metrics.

---

## 2026-08-02 — Settings and Login error contrast

## Planning

- Classification: `required`
- Rationale: TREK-269 changes the visible semantic error treatment on the Settings Leg Day warning and Login sign-in failure.
- Approved scenario or artifact: Preserve the Nudge Settings and access surfaces, copy, and triggering behavior while reusing DESIGN.md `error-red` for blocking feedback.

## Changed scenario

- Scenario: Render the Settings Leg Day warning with no Tier 3 leg exercise.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-269 before task commit.
- Viewport and starting state: In-app Browser at 390 × 844; canonical synthetic emulator catalog temporarily staged with no Tier 3 leg exercise.
- Actions: Open Manage Catalog and select Monday for Leg Day Schedule.
- Observed result: The unchanged warning renders white (`rgb(255, 255, 255)`) on Nudge error red (`rgb(114, 28, 36)`), a computed 11.012:1 contrast ratio. Synthetic catalog tiers and Leg Day Schedule were restored after capture.
- Rendered evidence: `.impeccable/evidence/trek-269-settings-warning-mobile.png`.
- Material limitation: Chromium rendering does not prove physical-device Safari font metrics.

## Changed scenario

- Scenario: Render the Login sign-in failure.
- Build / commit: Same TREK-269 working tree.
- Viewport and starting state: In-app Browser at 390 × 844; signed-out local emulator state.
- Actions: Select Sign in with Google while the browser blocks the local emulator popup.
- Observed result: The unchanged `Sign-in failed. Please try again.` copy renders white (`rgb(255, 255, 255)`) on Nudge error red (`rgb(114, 28, 36)`), a computed 11.012:1 contrast ratio.
- Rendered evidence: `.impeccable/evidence/trek-269-login-error-mobile.png`.
- Material limitation: The failure is a deterministic local popup-blocking path; production identity-provider behavior was not exercised.
