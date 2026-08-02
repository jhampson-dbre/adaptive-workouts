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

---

## 2026-08-02 — Nudge CSS consolidation

## Planning

- Classification: `required`
- Rationale: TREK-271 removes superseded CSS across the core journey and supporting surfaces, so unchanged responsive rendering needs direct proof.
- Approved scenario or artifact: Preserve the approved Nudge core journey, history, private-access, canonical baseline, timing harness, and Settings presentation while deleting only confirmed-dead starter rules.

## Changed scenario

- Scenario: Verify the canonical Plan surface at desktop, mobile, and 320px reflow widths.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-271 before task commit.
- Viewport and starting state: Canonical synthetic emulator baseline at 1280 × 900, 390 × 844, and 320 × 844.
- Actions: Load the Plan phase and inspect its header, journey progress, time control, and primary action.
- Observed result: Chrome DevTools reported no console errors or warnings and no horizontal overflow at 390px or 320px; coordinator captures preserve the centered desktop column and the approved mobile/reflow hierarchy.
- Rendered evidence: `.impeccable/evidence/trek-271-plan-desktop.png`, `.impeccable/evidence/trek-271-plan-mobile.png`, and `.impeccable/evidence/trek-271-plan-reflow-320.png`.
- Material limitation: Chromium rendering does not prove physical-device Safari font metrics.

## Changed scenario

- Scenario: Verify Settings and signed-out private access after consolidation.
- Build / commit: Same TREK-271 working tree.
- Viewport and starting state: Canonical synthetic emulator baseline at 390 × 844.
- Actions: Open Manage Catalog, inspect defaults and the Add exercise form, then sign out.
- Observed result: Settings retained its approved hierarchy and controls with zero horizontal overflow. Review remediation restored the live catalog and tracking-field rules: Chrome DevTools verified all 15 Current Catalog rows at 1280px, 390px, and 320px, plus weighted/bodyweight add and edit fields at desktop. Lists have no browser bullets/indentation; metadata/actions and tracking fields retain their responsive flex layouts; console output is clean. The private-access surface retained its focused, centered sign-in action.
- Rendered evidence: `.impeccable/evidence/trek-271-settings-mobile.png`, `.impeccable/evidence/trek-271-settings-catalog-desktop.png`, `.impeccable/evidence/trek-271-settings-catalog-mobile.png`, `.impeccable/evidence/trek-271-settings-catalog-reflow-320.png`, `.impeccable/evidence/trek-271-settings-tracking-desktop.png`, `.impeccable/evidence/trek-271-settings-tracking-edit-desktop.png`, and `.impeccable/evidence/trek-271-private-access-mobile.png`.
- Material limitation: The signed-out capture verifies the local emulator access boundary, not a production identity-provider round trip.

## Changed scenario

- Scenario: Verify timing and history presentation surfaces.
- Build / commit: Same TREK-271 working tree.
- Viewport and starting state: Non-production synthetic timing harness at 390 × 844.
- Actions: Run T-01 Start and Warmup; then run T-09 V4 History and save, select valid v4 history, and expand Workout history.
- Observed result: Warmup timing and labeled overtime render without horizontal overflow; expanded history retains phase durations, set details, and readable card hierarchy.
- Rendered evidence: `.impeccable/evidence/trek-271-timing-harness-mobile.png` and `.impeccable/evidence/trek-271-history-mobile.png`.
- Material limitation: The harness presents injected outcomes and does not prove storage, locks, reconciliation, or production routing.

---

## 2026-08-02 - Plan time slider touch target

## Planning

- Classification: `required`
- Rationale: TREK-273 increases the phone-primary Plan time control's interactive height from 28px to the documented 44px minimum.
- Approved scenario or artifact: `.impeccable/surfaces/src-app-jsx.md`; preserve native range semantics, the Nudge track appearance, Plan layout, copy, and keyboard behavior.

## Changed scenario

- Scenario: Verify the Plan time slider's touch area and native interaction across phone, reflow-equivalent, and desktop widths.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-273 before task commit.
- Viewport and starting state: Chrome DevTools at 320 x 844, 390 x 844, 640 x 900, and 1280 x 900; canonical synthetic emulator baseline on Plan.
- Actions: Inspect the computed slider box and native appearance; check document overflow; focus the slider, set 70 minutes, then press ArrowLeft and ArrowRight.
- Observed result: Slider height is 44px at every viewport; `appearance: auto` and the ink accent preserve the native track; ArrowLeft changes 70 to 65 and ArrowRight restores 70; the blue 4px focus outline remains visible; there is no horizontal overflow or console warning/error.
- Rendered evidence: `.impeccable/evidence/trek-273-plan-slider-mobile.png` and `.impeccable/evidence/trek-273-plan-slider-desktop.png`.
- Material limitation: Chromium emulation verifies layout, keyboard behavior, and computed hit area, not physical-device Safari touch acquisition.

---

## 2026-08-02 - Workout state heading hierarchy

## Planning

- Classification: `required`
- Rationale: TREK-274 hardens the production page outline so the global Nudge heading remains the sole `h1` while WorkoutView state headings use the next semantic level.
- Approved scenario or artifact: `.impeccable/surfaces/src-app-jsx.md`; preserve active-workout, Review, recovery, and saved presentation, copy, focus transitions, and session behavior.

## Changed scenario

- Scenario: Verify the top-level heading and focus lifecycle across active, Review, recovery, and saved WorkoutView states.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-274 before task commit.
- Viewport and starting state: Chrome DevTools at 390 x 844; canonical synthetic emulator baseline with generated workout data.
- Actions: Generate and start a workout, confirm one set, finish early through Cooldown and Review, save, then start another workout and reload to exercise recovery before resuming.
- Observed result: Every state retained exactly one page-level `h1` named Nudge. Warmup/Performance, Review, Resume workout?, and Workout saved rendered as focused `h2` headings with unchanged actions. The confirmation pass measured the active title as ink `rgb(5, 5, 5)`, `text-transform: none`, 45.12px at 390px, and no horizontal overflow after removing a conflicting dormant `h2` rule.
- Rendered evidence: `.impeccable/evidence/trek-274-workout-active-mobile.png`, `.impeccable/evidence/trek-274-workout-review-mobile.png`, `.impeccable/evidence/trek-274-workout-recovery-mobile.png`, and `.impeccable/evidence/trek-274-workout-saved-mobile.png`.
- Material limitation: Chromium accessibility snapshots and keyboard focus prove semantic hierarchy and focus behavior; they do not replace physical-device screen-reader testing.
