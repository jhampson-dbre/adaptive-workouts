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

---

## 2026-08-02 - Nudge typography roles

## Planning

- Classification: `required`
- Rationale: TREK-276 changes typography across production surfaces, including hierarchy, reading size, wrapping, and numeric alignment.
- Approved scenario or artifact: `DESIGN.md` Clear Signal direction and the Impeccable typeset brief; preserve copy, behavior, and the Barlow Condensed / Atkinson Hyperlegible families while establishing display, headline, title, body, label, metadata, and purpose-specific numeric roles.

## Changed scenario

- Scenario: Verify active workout and recovery typography at desktop and phone widths.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-276 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 1280 x 900 and 390 x 844; canonical synthetic emulator workout in active and recovery states.
- Actions: Resume the workout, inspect the wordmark, state heading, help copy, journey labels, status metadata, timer, wrapping, and recovery heading.
- Observed result: The approved display/action family remains Barlow Condensed 700 and body family remains Atkinson Hyperlegible. At 390px, the active heading computes to 50.4px, body help to 18px/27px with 0.18px tracking, journey labels to 12.96px, status metadata to 15.75px, and the timer to 24.3px. The recovery heading wraps without clipping; desktop and phone have no horizontal overflow.
- Rendered evidence: Chrome DevTools MCP screenshots inspected inline for active desktop, active phone, and recovery phone states; font loading reported both families available with `document.fonts.status = loaded`.
- Material limitation: Chrome DevTools MCP denied screenshot-file persistence within the workspace, so rendered captures were inspected inline rather than saved. Chromium rendering does not prove physical-device Safari font metrics.

## Changed scenario

- Scenario: Verify Settings and private-access typography at phone width and 200% text scaling.
- Build / commit: Same TREK-276 working tree.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844; Settings open on the canonical synthetic baseline and the signed-out local-emulator surface.
- Actions: Inspect Settings hierarchy and catalog roles, then apply a temporary 200% root text-size override through DevTools to stress reflow; repeat on private access.
- Observed result: At normal size, Settings uses a 50.4px display heading, 34.2px section heading, 18px labels, 26.1px catalog titles, and 12.96px badges with no horizontal overflow. At 200% text scaling, the Settings header wraps its action below the title, the Close label retains its full intrinsic width (79px client and scroll widths), title and action do not overlap, and the document has no horizontal overflow. Private access also retains readable wrapping and no horizontal overflow at 200% scaling; its sign-in action computes to 18px at normal size. Font loading remained stable.
- Rendered evidence: Chrome DevTools MCP screenshots inspected inline for Settings phone, Settings at 200% text scaling, private access phone, and private access at 200% text scaling.
- Material limitation: The temporary root-size override exercises text scaling and reflow in the emulated target because Chrome keyboard zoom does not alter the DevTools-emulated viewport. Screenshot-file persistence was denied, and the signed-out surface does not prove a production identity-provider round trip.

---

## 2026-08-02 - Baseline and private-access CSS hardening

## Planning

- Classification: `required`
- Rationale: TREK-277 changes focus visibility, viewport containment, identity wrapping, and recovery-action sizing on baseline and private-access states.
- Approved scenario or artifact: Preserve the approved Clear Signal presentation and private-access behavior while hardening `src/App.css` for long content, RTL flow, narrow viewports, dynamic viewport height, and 200% text scaling.

## Changed scenario

- Scenario: Verify pending private access at phone and desktop widths, then stress it with 200% text, RTL direction, long translated labels, and long unbroken identity values.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-277 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844 and 1280 x 900; isolated canonical `UX-10-02` pending-access scenario with synthetic identity.
- Actions: Inspect the focused Awaiting approval heading, identity grid, and recovery actions at normal size; then temporarily set the root to 36px, set document direction to RTL, and replace identity/action text with long German, Arabic, emoji, and unbroken synthetic values.
- Observed result: The focused heading uses the approved 4px `rgb(18, 97, 160)` outline. Normal phone and desktop states retain two identity columns, clear action hierarchy, at least 44px targets, and no horizontal overflow. The first stress pass exposed a `max-content` label track collapsing values to 0px; remediation changed the grid to bounded 1:2 tracks. The confirmation pass measured 88px and 176px tracks, equal client/scroll widths for every identity term and action, and a 390px document client/scroll width with no horizontal overflow.
- Rendered evidence: Chrome DevTools MCP screenshots inspected inline for pending access at phone and desktop widths and for the final 200%/RTL/long-content confirmation.
- Material limitation: The extreme text was a transient synthetic DOM stress probe and does not assert authorization behavior. Chrome DevTools MCP screenshots were inspected inline rather than persisted; Chromium does not prove physical-device Safari font metrics.

## Changed scenario

- Scenario: Verify the baseline-unavailable recovery surface at normal size and under 200% text, RTL, long diagnostics, and a long retry label.
- Build / commit: Same TREK-277 working tree.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844; exact baseline Vite build pointed at intentionally unavailable local emulator ports.
- Actions: Wait for the classified Baseline unavailable state, inspect focus and Retry baseline sizing, then apply the same transient text/RTL stress with long German and Arabic/unbroken synthetic content.
- Observed result: Baseline unavailable receives the approved 4px focus-blue outline, the retry control measures 128.5 x 50.8px at normal size, and the surface fills the 844px dynamic viewport without horizontal overflow. Under stress, the long heading, 280-character diagnostic, and retry action remain contained; document and surface client/scroll widths remain 390px and the action retains its 44px logical minimum.
- Rendered evidence: Chrome DevTools MCP screenshots inspected inline for the normal baseline error and the 200%/RTL/long-content confirmation.
- Material limitation: Unavailable emulator ports deterministically prove the baseline failure presentation and recovery affordance, not a successful authorization transition or physical-device viewport behavior.

---

## 2026-08-02 - Source polish and Settings recovery

## Planning

- Classification: `required`
- Rationale: TREK-278 changes visible Settings failure recovery and removes native list styling from the authored workout sequence.
- Approved scenario or artifact: Preserve the Clear Signal identity, existing Settings hierarchy, workout behavior, and copy except concise failure guidance.

## Changed scenario

- Scenario: Verify workout list normalization and Settings at phone and desktop widths, including the blocking load-error presentation.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-278 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844 and 1280 x 900; canonical synthetic emulator workout and Settings data.
- Actions: Generate a workout and inspect its authored exercise list plus disabled/locked rows; open Settings at both widths; render the exact production-class markup for load, default-rest, Leg Day, and deep-row catalog failures as transient layout probes at their production insertion points.
- Observed result: The workout list computes to `list-style: none`, zero inline-start padding, and zero horizontal overflow. Disabled and locked states use existing design tokens. Settings retains its hierarchy with no horizontal overflow at either width. The load error presents one alert and a full-width 44px Retry action; field-save alerts remain visibly adjacent and Leg Day exposes a direct Retry control; a catalog-toggle alert stays inside its triggering phone row even near the end of the 15-item list. Focused tests separately verify each real failure, rollback, dirty-state, and retry lifecycle. Chrome reported no warnings or errors.
- Rendered evidence: Chrome DevTools MCP screenshots inspected inline for workout phone, Settings phone and desktop, the phone load error, default-rest/Leg Day errors, and a deep phone catalog-row error.
- Material limitation: Failure screenshots use transient DOM layout probes with exact production classes and insertion points; focused component tests prove the production state transitions and retry behavior. Chromium emulation does not replace physical-device or screen-reader testing.
