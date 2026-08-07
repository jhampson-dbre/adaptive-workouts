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

---

## 2026-08-02 - Focus, validation, and Login accessibility hardening

## Planning

- Classification: `required`
- Rationale: TREK-279 changes visible keyboard focus, field-validation feedback, initial focus order, and the primary landmark on Plan, Settings, and private Login surfaces.
- Approved scenario or artifact: Preserve the `DESIGN.md` Clear Signal focus-blue treatment, Settings form hierarchy, Login copy, and authentication behavior while correcting the two audit P1 findings and aligning Login with the established private-access entry pattern.

## Changed scenario

- Scenario: Verify shared programmatic heading focus on Plan and Settings at phone width.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-279 based on `c203c9667328891b815dc7cdd86bbd300a4bbedd` before task commit.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844; canonical synthetic emulator baseline on Plan, followed by Manage Catalog.
- Actions: Wait for each lazy destination to settle, inspect the accessibility tree and computed style of the active heading, and measure document containment.
- Observed result: Plan focused `How much time do you have?` and Settings focused `Settings` as `h2[tabindex="-1"]`. Both computed to a solid 4px `rgb(18, 97, 160)` outline with the authored 3px offset, and each surface retained equal 390px client/scroll widths.
- Rendered evidence: Chrome DevTools MCP accessibility snapshots and inline rendered inspection for Plan and Settings at 390 x 844.
- Material limitation: Chromium reports the authored 3px outline offset as 2.66667px under the emulated device metrics. Screenshot-file persistence was denied by the MCP workspace-path guard, so rendered captures were inspected inline. Physical-device and screen-reader behavior remain outside this pass.

## Changed scenario

- Scenario: Verify empty exercise-name validation and recovery at phone width.
- Build / commit: Same TREK-279 working tree.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844; canonical synthetic Settings catalog with an empty Exercise name.
- Actions: Activate Add, inspect the alert and field accessibility properties, verify unrelated rest/tracking controls remain valid, then enter `Row` in Exercise name.
- Observed result: Add produced one visible assertive alert, `Exercise name is required.` The Exercise name textbox alone exposed `invalid=true` and used that alert as its accessible description; unrelated controls remained unmarked. Entering a name immediately removed the alert and invalid state without mutating the catalog. The rendered error stayed within the form and the document retained no horizontal overflow.
- Rendered evidence: Chrome DevTools MCP accessibility snapshot plus inline screenshot of the production Settings form and recovery transition at 390 x 844.
- Material limitation: Chrome surfaced an existing autofill advisory because 11 Settings fields lack id/name attributes; their explicit wrapping labels remain accessible, and the advisory predates this field-error change. Chromium evidence does not replace assistive-technology certification.

## Changed scenario

- Scenario: Verify signed-out Login landmark, entry focus, and unchanged action hierarchy.
- Build / commit: Same TREK-279 working tree.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844; isolated signed-out local development origin with no identity session.
- Actions: Load Login, inspect the main landmark and accessibility tree, then measure active focus, overflow, and console diagnostics.
- Observed result: Login rendered as one `main.access-surface` labelled by the Nudge heading. The heading, not the sign-in button, received initial focus and the approved solid 4px focus-blue outline; the button had no autofocus attribute. Copy and the Google sign-in action were unchanged, client/scroll widths both measured 390px, and Chrome reported no warnings or errors.
- Rendered evidence: Chrome DevTools MCP accessibility snapshot and inline rendered inspection of signed-out Login at 390 x 844.
- Material limitation: The isolated local state proves presentation, landmark, and focus behavior only; it does not perform a production identity-provider round trip. Screenshot-file persistence was denied by the MCP workspace-path guard.

---

## 2026-08-02 - Settings select typography

## Planning

- Classification: `required`
- Rationale: TREK-280 changes the rendered font metrics and wrapping space of every native select in Settings.
- Approved scenario or artifact: Preserve the `DESIGN.md` Settings Field body role, Clear Signal hierarchy, existing options and behavior, and the 44px minimum target.

## Changed scenario

- Scenario: Verify General defaults plus Add/Edit catalog selects at phone and desktop widths, including the longest selected priority and tracking labels.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-280 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 390 x 844 and 1280 x 900; canonical synthetic Settings baseline, with Back Squat opened for editing.
- Actions: Inspect computed font, target height, loaded-font state, option visibility, and document containment for Leg Day, Add, and Edit selects. The first desktop pass exposed clipping after inheriting the approved body font; the existing wrapping fields were then given a larger flexible basis and rechecked.
- Observed result: Every inspected select computes to 18px Atkinson Hyperlegible at weight 400 and 45.3px high. At phone width, Add and Edit selects use the full 346px content width. At desktop width, Add fields render at 227.3px or 294px and Edit fields at 227.3px or 656px; `Tier 3 (Standard)`, `Simple completion`, and `Tier 3 (Primary Leg Day)` are fully visible. Fonts report loaded, and client/scroll widths remain equal at both viewports (390px phone; 1265px desktop).
- Rendered evidence: Chrome DevTools MCP accessibility snapshots, computed-style measurements, and inline screenshots inspected for phone Add/Edit and desktop Add/Edit/Leg Day states.
- Material limitation: Native select arrow metrics are Chromium-specific; this pass does not replace physical-device Safari or assistive-technology testing. Screenshots were inspected inline rather than persisted.

---

## 2026-08-02 - Local font WOFF2 optimization

## Planning

- Classification: `required`
- Rationale: TREK-281 changes the delivered font binaries and therefore can affect font loading, fallback behavior, glyph coverage, and rendered metrics across every UI surface.
- Approved scenario or artifact: Preserve the `DESIGN.md` Atkinson Hyperlegible body and Barlow Condensed heading roles, all weights and glyphs, `font-display: swap`, local hosting, and the Clear Signal composition while reducing the precached font payload.

## Changed scenario

- Scenario: Verify all local font faces load from WOFF2 resources and preserve representative Plan/Settings typography at desktop and phone widths.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-281 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 1282 x 667 and emulated 390 x 844; canonical synthetic baseline opened on Plan and Settings.
- Actions: Force-load Atkinson Hyperlegible 400/700 and Barlow Condensed 700 through the CSS Font Loading API, inspect resource timing entries and computed typography, open Settings, and repeat computed-style/containment checks at phone width.
- Observed result: All three font checks return true and `document.fonts.status` reports loaded. Resource timing contains only `atkinson-hyperlegible-regular.woff2` (17,184 bytes), `atkinson-hyperlegible-bold.woff2` (23,268 bytes), and `barlow-condensed-bold.woff2` (33,088 bytes); the live stylesheet has zero TTF references. Plan and Settings headings retain Barlow Condensed 700, body/select text retains Atkinson Hyperlegible 400 at 18px, and catalog titles retain Atkinson Hyperlegible 700. Phone and desktop client/scroll widths remain equal, with no console warnings or errors. Total local font bytes fall from 157,720 to 73,540, saving 84,180 bytes (53.37%).
- Rendered evidence: Chrome DevTools MCP accessibility snapshots, resource/computed-style measurements, and an inline Settings phone screenshot.
- Material limitation: Local Vite transfer measurements omit production CDN/cache effects, and Chromium rendering does not replace physical-device Safari font validation. The WOFF2 conversion separately preserved source glyph order, OpenType tables, name records, 1000 UPEM, weight, and italic angle.

---

## 2026-08-02 - index.css palette consolidation

## Planning

- Classification: `required`
- Rationale: TREK-282 replaces color literals across every authored surface in `src/index.css`, including normal, selected, hover, focus, and error states.
- Approved scenario or artifact: Preserve the `DESIGN.md` Clear Signal palette and exact rendered colors while consolidating downstream uses behind the established CSS custom properties.

## Changed scenario

- Scenario: Verify representative Plan and Settings surfaces at desktop and phone widths, including keyboard focus and an actual Settings validation error.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-282 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 1282 x 667 and emulated 390 x 844; canonical synthetic baseline on Plan and Settings.
- Actions: Inspect all 11 root palette values and representative computed foreground, background, border, and outline colors; open Settings, submit the empty Add form to produce the production validation state, use keyboard Tab to confirm focus-visible styling, and repeat the error/containment check at phone width.
- Observed result: Root tokens resolve to the exact approved hex values. White, ink, line, concrete, graphite, signal-yellow, focus-blue, and error-red surfaces compute to their unchanged RGB values. Keyboard focus remains a solid 4px `rgb(18, 97, 160)` outline; the Settings validation message remains `rgb(114, 28, 36)` on white, and the primary Add action remains yellow with ink text. Desktop and phone client/scroll widths remain equal (1267px and 390px), and Chrome reports no warnings or errors.
- Rendered evidence: Chrome DevTools MCP accessibility snapshots, computed-style measurements, and an inline phone screenshot of the real Add validation state.
- Material limitation: This bounded pass samples representative palette states rather than every selector; the focused source contract separately proves that each of the 11 palette literals appears only once in `:root` and all downstream uses resolve through its matching token. Chromium evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-02 - TREK-283 final polish integration pass

## Planning

- Classification: `required`
- Rationale: Final integrated Clear Signal quality pass; preserve approved Nudge identity and behavior while removing only verified system drift.
- Approved scenario or artifact: `DESIGN.md` and `.impeccable/surfaces/src-app-jsx.md`.

## Changed scenario

- Scenario: Verify private access, active-work timing, and recovery feedback at desktop and phone widths.
- Build / commit: `codex/epic-14-audit-remediation` working tree for TREK-283 before task commit.
- Viewport and starting state: Chrome DevTools MCP at 1280 x 900 Login, the canonical seeded Plan and Settings paths at desktop and emulated 390 x 844 phone widths, and the Timing harness C-05 synthetic recovery fixture.
- Actions: Inspect landmarks, initial focus, keyboard-sized controls, document containment, console diagnostics, the complete seeded Settings catalog, and the production `WorkoutView` recovery message after replacing its 4px side stripe with a structural 1px rule.
- Observed result: Login has one labelled main landmark and focused Nudge heading. The canonical Plan and Settings paths load successfully; phone Plan has 390px client/scroll widths, 44px labelled checkbox targets and slider, a 116px primary action, visible 4px focus blue, and no console warnings or errors. The phone recovery fixture remains assertive and actionable with a uniform 1px ink border and no horizontal overflow. The official Impeccable detector is clean.
- Rendered evidence: Chrome DevTools MCP accessibility snapshots, computed-style inspection, and an inline phone screenshot of the canonical Plan state.
- Material limitation: The timing fixture is synthetic and does not prove storage, locks, server reconciliation, or routing; targeted tests cover those mechanics. Chromium evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-02 - TREK-285 quiet workout completion endpoint

## Planning

- Classification: `required`
- Rationale: TREK-285 materially changes the post-save hierarchy from an immediate planning prompt to a terminal confirmation with optional history.
- Approved scenario or artifact: Trekker comments CMT-508 and CMT-509, approved by a fresh UX design review. Preserve Review progress, focused `Workout saved`, factual `This workout is complete.`, neutral `Back to plan`, and the existing lazy Workout History disclosure without new navigation or state.

## Changed scenario

- Scenario: Complete and save a canonical synthetic workout, then verify the quiet endpoint with history collapsed and expanded.
- Build / commit: `codex/trek-285-quiet-workout-completion` working tree before task commit.
- Viewport and starting state: Codex in-app Chromium browser at 1280 x 720; canonical emulator baseline, one confirmed Barbell Curl set, then early finish, Cooldown, Review, and Save.
- Actions: Save the workout; inspect focus, status and action hierarchy; measure controls and document containment; open Workout history; inspect the newly saved record; close the disclosure and inspect keyboard focus.
- Observed result: `Workout saved` received focus with a computed 4px focus-blue outline. The only status text is `This workout is complete.`; `Back to plan` and Workout history are outside the status region. Back renders as a flat white, ink-rule secondary control at 50.5px high, while Review remains the sole yellow state signal. History began collapsed, expanded through its existing `aria-expanded` button, showed the newly saved 0:13 workout, and returned to collapsed with visible focus. Collapsed and expanded states retained equal client/scroll widths (1280px collapsed; 1265px expanded with the browser scrollbar) and no console error was observed.
- Rendered evidence: Live accessibility snapshots, computed-style/geometry measurements, and inline full-page inspection in the Codex in-app browser; focused tests separately verify no history fetch before disclosure and the existing loader call after opening.
- Material limitation: The available in-app browser did not expose device-viewport emulation, so the approved exact 390 x 844 saved-state capture could not be produced in this pass. The best safe alternative was the real desktop lifecycle plus the established responsive CSS and 44px control contracts exercised by focused tests; this does not replace physical-device, exact phone-height, or assistive-technology verification.

---

## 2026-08-02 - TREK-289 Supersets management

## Planning

- Classification: `required`
- Rationale: TREK-289 adds creation, editing, removal, catalog-deactivation recovery, validation, and focus transitions to the Settings surface.
- Approved scenario or artifact: EPIC-15 discovery decisions in CMT-513 and CMT-518, plus the incumbent Nudge Settings surface brief and Clear Signal design system.

## Changed scenario

- Scenario: Manage a three-member Superset across create/edit validation, removal, catalog deactivation, pause, and reactivation at phone and desktop widths.
- Build / commit: `codex/epic-15-guided-supersets` TREK-289 working tree before task commit.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 and 1280 x 900 using the canonical local emulator catalog and a synthetic Romanian Deadlift, Standing Calf Raise, Leg Extension Superset with between-exercise rest.
- Actions: Create and save a two-member between-exercises group; edit it to a three-member after-round group; exercise rejected-save retention, ordered-member controls, long-name wrapping, direct removal cancellation and success with a following group, pair and three-member deactivation choices, catalog set-count mismatch, pause/reactivation, responsive containment, and console diagnostics.
- Observed result: Both approved rest/group-size configurations save and focus their resulting summaries. Cancelling a new group focuses the remounted `Add superset` action with a solid 4px `rgb(18, 97, 160)` outline. A mismatched member remains selected after the rejected save, the alert names all conflicting exercises, and focus returns to the first member control. Catalog set-count mismatch retains the entered value, names each member/set count, and focuses Edit sets. Long names and actions wrap without horizontal overflow. Opening removal focuses `Keep superset`; successful removal of the first of two groups announces the result and focuses the surviving group with the same outline. Pair deactivation focuses `Deactivate and pause`; three-member deactivation focuses `Remove and deactivate`; cancellation returns focus to the initiating control. Pausing names the inactive member and leaves the other exercises schedulable. Reactivation announces `Superset active.` and focuses the restored summary with the same outline; cancelling a failed reactivation returns focus to the remounted per-exercise Reactivate control. Phone client/scroll widths measured 375/375 within the 390px browser viewport; desktop measured 1265/1265. Chromium reported no warnings or errors.
- Rendered evidence: In-app Chromium accessibility snapshots, inline screenshots of the two-member between-exercises editor/save, three-member after-round editor/save, retained mismatch, catalog mismatch, pair and three-member deactivation, removal cancellation/success, reactivation, narrow reflow, and desktop states, plus computed focus, outline, geometry, overflow, and live-region measurements. Focused Settings/storage tests cover save/retry failures; the reactivation-failure Cancel regression specifically verifies focus returns to the remounted Reactivate control without forcing the emulator network offline in the browser.
- Material limitation: The browser clamps explicit viewports below 240px, so the narrowest controlled reflow pass was 240px (225px content width), where client/scroll widths remained equal; it is a best safe alternative rather than an exact 390px-at-200%-zoom claim. Synthetic emulator data and Chromium do not replace production Firestore, physical-device Safari, browser zoom, or assistive-technology testing.

---

## 2026-08-02 - TREK-290 guided Superset performance

## Planning

- Classification: `required`
- Rationale: TREK-290 changes exercise expansion, keyboard focus, live feedback, rest placement, and recovery behavior during active workouts.
- Approved scenario or artifact: EPIC-15 decisions CMT-513, CMT-516, and CMT-518, plus the CMT-532/CMT-533 recovery issue-class audit and the incumbent Clear Signal Workout surface.

## Changed scenario

- Scenario: Perform and recover ordered two-member Supersets in both rest modes, with ordinary exercises and long names around the group.
- Build / commit: `codex/epic-15-guided-supersets` TREK-290 working tree before task commit.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 and 1280 x 900 against the clean local emulator baseline; canonical Bench Press/Cable Row groups for lifecycle checks and a Barbell Curl/Romanian Deadlift group for long-name reflow.
- Actions: Generate a mixed workout; confirm the first AFTER_ROUND member; confirm the round owner; reload and resume the active group rest; start the next round early; repeat the first-member handoff with BETWEEN_EXERCISES; inspect live status, active focus, outlines, rest adjacency, document containment, motion rules, and long-name wrapping.
- Observed result: Initial plans identify members only as `Superset 1 of 2` and `Superset 2 of 2`, with `Next` on the recommended member and no concatenated group name. Confirmation collapses the completed row, expands the recommendation, and focuses its ready Start button. AFTER_ROUND starts no rest after member one, then announces the owner rest once after the round and shows its persistent countdown beside the next-round Start; recovery preserves that state, and starting the next round closes it without blocking persistence. BETWEEN_EXERCISES announces and displays the rest immediately after member one, beside the focused next-member Start. The phone active control computes a solid 4px `rgb(18, 97, 160)` outline. Barbell Curl/Romanian Deadlift labels and cards remain contained. Client and scroll widths are equal at phone (375/375 inside the 390px viewport) and desktop (1265/1265 inside 1280px). The new Superset rules contain no animation, transition, or scroll-behavior declaration.
- Rendered evidence: Live accessibility snapshots and inline screenshots of the 390px automatic handoff, AFTER_ROUND persistent rest/recovery/next-round lifecycle, BETWEEN_EXERCISES countdown, long-name member card, and 1280px layout; computed focus, outline, viewport, overflow, and authored-motion measurements.
- Material limitation: The in-app browser exposes no console-log retrieval capability, so this pass used rendered recovery alerts as its runtime failure signal and fixed both encountered recovery-v3 integration defects before repeating the lifecycle successfully. Chromium/emulator evidence does not replace production Firestore, physical-device Safari, reduced-motion OS emulation, or assistive-technology certification.

---

## 2026-08-02 - TREK-292 mixed-workout Superset focus routing

## Planning

- Classification: `required`
- Rationale: TREK-292 changes initial exercise expansion, automatic Superset-to-ordinary handoff, recovery selection, and programmatic keyboard focus in the active workout.
- Approved scenario or artifact: TREK-292 root-cause and acceptance criteria, preserving the TREK-290 guided Superset interaction while restoring displayed workout order outside a partial group.

## Changed scenario

- Scenario: Start a three-exercise Leg Day ordered as Calf Raises followed by a two-member Raised Leg Split Squat Superset, manually perform the Superset first, and verify the exhausted group returns guidance to exercise 1.
- Build / commit: `codex/trek-292-superset-focus-routing` working tree before task commit; focused WorkoutView tests, lint, build, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical preseeded emulator authentication plus synthetic Calf Raises and one-set left/right split-squat data.
- Actions: Generate the mixed workout; inspect initial expansion and focus; start the workout; manually expand and confirm the left member; observe automatic within-group focus on the right member; confirm the right member; inspect final expansion, keyboard focus, outline, and document containment.
- Observed result: The generated order is Calf Raises 01, left split squat 02, and right split squat 03. Workout ready initially expands only Calf Raises even though the left member retains the Superset `Next` context. Confirming the left member collapses it, expands the right member, and focuses its Start set. Confirming the final member collapses both completed Superset rows, keeps Calf Raises expanded, and focuses `Calf Raises exercise 1 set 1 start` with a solid 4px `rgb(18, 97, 160)` outline. Client and scroll widths remain equal at 375/375 within the 390px viewport.
- Rendered evidence: Live accessibility snapshots, computed active-element/`aria-expanded`/outline/viewport measurements, and inline phone screenshots before performance and after the exhausted-Superset handoff.
- Material limitation: Synthetic one-set exercises keep the evidence pass bounded and do not prove every set-count permutation. Focused component tests cover multi-set incumbent Superset behavior, ordinary transitions, delayed durable focus, manual override, undo, rest modes, and recovery. Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-03 - TREK-293 core journey copy clarity

## Planning

- Classification: `required`
- Rationale: TREK-293 changes user-facing recovery, destructive, empty, retry, and workout-decision language in the core Plan → Perform journey.
- Approved scenario or artifact: The incumbent Nudge core-journey surface brief and Clear Signal design system; behavior, layout, focus, timing, persistence, and action hierarchy remain unchanged.

## Changed scenario

- Scenario: Recover or discard a saved synthetic workout, return to Plan, generate a workout, and inspect the clarified workout-ready action.
- Build / commit: `codex/clarify-core-workout-copy` TREK-293 working tree before task commit; 85 focused tests, lint, build, Impeccable detector, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical synthetic emulator identity and a recoverable workout draft.
- Actions: Inspect the recovery heading, message, Resume workout, and Discard workout actions; discard the synthetic draft; inspect focused Plan; generate the canonical workout; inspect the focused Workout ready state, helper text, Start workout action, and document containment.
- Observed result: Recovery names both the retained workout and the destructive action without internal acquisition language. The recovery heading receives focus, the primary Resume workout action remains dominant, and both actions fit at phone width. Discard returns to focused Plan. The generated state says `Start the workout to time your sets.` and exposes the sentence-case `Start workout` action without changing exercise order or controls. Client and scroll widths remain equal at 375/375 in recovery, Plan, and workout-ready states.
- Rendered evidence: Live accessibility snapshots, inline screenshots of recovery, Plan, and workout-ready states, plus computed focus, viewport, and overflow measurements.
- Material limitation: The canonical baseline directly renders resume/discard and workout-ready language. Focused component tests cover the deterministic no-fit plan, history-load retry/loading, leg-choice alternative, cross-tab takeover/retry, blocked-save, cooldown, and early-finish strings that were not forced through emulator state. Synthetic Chromium evidence does not replace physical-device or assistive-technology testing.

## Follow-up changed scenario

- Scenario: Verify the approved Plan introduction, `Main workout` phase label, and plain-language recommendation and recovery copy.
- Build / commit: `codex/clarify-core-workout-copy` TREK-293 working tree after the user-approved copy follow-ups; 160 focused tests, lint, build, UX workflow validation, Impeccable detector, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical emulator Plan/recovery state plus synthetic T-02 active-work and T-09 valid-v4-history fixtures.
- Actions: Discard the recoverable synthetic workout and inspect the focused Plan introduction; select the T-02 active-work fixture and inspect its focused phase heading and accessible exercise region; select T-09, render valid v4 history, and expand Workout history.
- Observed result: Plan says `Nudge uses your recent workouts and available time to plan today's workout.` with focus on `How much time do you have?`. The active phase heading and announcement say `Main workout`, and the accessible exercise region is named `Main workout exercises`. Valid saved entries list `Main workout` between Warmup and Cooldown. Production recommendation provenance uses `the previous workout`, set explanations use `minimum reps`, and save recovery names the problem and next action without ownership, floor, exact-save, or pending-state vocabulary. Client and scroll widths remain equal at 375/375.
- Rendered evidence: Live accessibility snapshots of recovery, Plan, active work, and saved history; an inline mobile screenshot of the active phase; and computed focus, viewport, and overflow measurements. Exact focused assertions cover the deterministic recommendation and rare save-recovery branches.
- Material limitation: The timing harness retains internal scenario metadata that names the persisted `performance` phase and synthetic recovery actions; production-facing headings, summaries, announcements, recovery states, and history labels use the approved plain language. Synthetic Chromium evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-03 - Completed workout clipboard export

## Planning

- Classification: `required`
- Rationale: TREK-286 adds an explicit saved-workout action, success and failure feedback, retry behavior, and first-class superset text output at the Review endpoint.
- Approved scenario or artifact: Trekker comments CMT-512 and CMT-558 plus `.impeccable/surfaces/src-app-jsx.md`; preserve the focused `Workout saved` heading, factual completion status, equally neutral Copy/Back actions, collapsed lazy history, visible accessible feedback, and phone-first Clear Signal presentation.

## Changed scenario

- Scenario: Copy a frozen mixed workout containing one standalone exercise and one two-member superset from the saved endpoint.
- Build / commit: `codex/trek-286-copy-workout` working tree after 81 focused tests, lint, build, code review, and task-conformance review passed.
- Viewport and starting state: Local Chromium at 1280 x 720 and 390 x 844; synthetic production `WorkoutView` fixture with completed Carry, Long Row Exercise Name, and Long Press Exercise Name records and exact row/press superset membership.
- Actions: Save the frozen Review candidate; confirm the saved heading focus and collapsed history; activate Copy workout results; inspect feedback, focus, geometry, overflow, console, and the browser clipboard.
- Observed result: `Workout saved` received focus before interaction. Copy workout results appears before Back to plan with the same neutral styling. Native clipboard output was exactly `Carry\n1 set\n0:12\n\nA1. Long Row Exercise Name\n1 set\n0:23\n\nA2. Long Press Exercise Name\n1 set\n0:34`. Success rendered `Workout results copied.` in a separate polite status; Copy workout results remained enabled and focused. Copy, Back, and History measured 51.19px high; the phone document measured 390/390 client/scroll width and desktop measured 1280/1280. History remained collapsed (`aria-expanded=false`), and a fresh browser request check found no failed responses.
- Rendered evidence: `.impeccable/evidence/trek-286-copy-saved-desktop.png` and `.impeccable/evidence/trek-286-copy-success-mobile.png`.
- Material limitation: A temporary synthetic timing-harness fixture rendered the production component without storage, routing, or personal data and was removed after capture. The selected browser's synthetic keyboard injection did not advance Tab or create trusted Clipboard user activation, so exact Tab/Enter/Space traversal is supported by the native `button` element, visible focus evidence, and focused component tests rather than claimed as a browser-observed keyboard sequence. Chromium evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: Recover from clipboard rejection and retry without losing the saved workout or action focus.
- Build / commit: Same TREK-286 working tree.
- Viewport and starting state: Local Chromium at 390 x 844 on the same synthetic mixed saved workout; harness rejected the first native `writeText` call and delegated the next call to the browser clipboard.
- Actions: Activate Copy workout results once to reject, inspect the error and focus, then activate the same enabled control again.
- Observed result: First activation rendered the sole assertive alert `Couldn’t copy workout results. Try again.` while Copy workout results stayed enabled and focused. Retry removed the alert, rendered the polite `Workout results copied.` status, retained focus, and wrote the exact standalone/A1/A2 text. The viewport remained 390/390 with no horizontal overflow and History stayed collapsed.
- Rendered evidence: `.impeccable/evidence/trek-286-copy-error-mobile.png`; the succeeding state is `.impeccable/evidence/trek-286-copy-success-mobile.png`.
- Material limitation: Rejection was deterministic synthetic browser behavior; it proves the production recovery presentation and transition, not every browser permission prompt or secure-context policy.

---

## 2026-08-04 - TREK-294 contextual exercise ordering

## Planning

- Classification: `required`
- Rationale: TREK-294 adds pre-start exercise/superset order controls, contextual preference save and clear actions, asynchronous feedback, and programmatic focus.
- Approved scenario or artifact: `docs/specs/2026-08-03-contextual-exercise-ordering.md`; preserve planner selection and prescriptions while applying or changing only generated run order.

## Changed scenario

- Scenario: UX-ORDER-01/03 - Reorder an ordinary generated exercise at the first-position boundary and save the resulting context.
- Build / commit: `codex/trek-294-contextual-order` working tree after focused tests, emulator transaction tests, lint, build, and diff-check passed.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical synthetic emulator identity and an eight-exercise generated workout.
- Actions: Move Back Squat from position 2 to position 1, inspect boundary focus, then select Use this order in future workouts.
- Observed result: The whole Back Squat block moved without changing prescriptions; the unavailable earlier control was not focused and focus moved to the reordered block. The save outcome received focus as a polite status. Move controls exposed exercise name, position, direction, and availability. Document client and scroll widths remained 375/375.
- Rendered evidence: Live accessibility snapshots of the generated order, today-only disclosure, save action, and focused terminal outcome; computed active-element and viewport measurements.
- Material limitation: Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: UX-ORDER-04 - Apply a saved two-exercise context, create a more-specific eight-exercise order, and disclose precedence without focusing stale feedback.
- Build / commit: Same TREK-294 working tree after the rendered focus regression was fixed and its focused test passed.
- Viewport and starting state: Codex in-app Chromium at 390 x 844; synthetic saved Back Squat-before-Barbell Curl pair and canonical generated workout.
- Actions: Generate the workout, confirm Preferred order applied, move Barbell Curl earlier, and save the full context.
- Observed result: The generated pair order applied before editing. The terminal status named the full context, the superseded pair order, and when the pair still applies. With both statuses rendered, focus reached the new terminal save outcome. Document client and scroll widths remained 375/375.
- Rendered evidence: Live accessibility snapshots and computed active-element/status/viewport measurements. A focused component regression mounts both statuses and asserts terminal-outcome focus.
- Material limitation: The 51st-context eviction disclosure is covered by focused rendered component tests and emulator transaction evidence rather than a second browser seed containing 50 synthetic contexts.

## Changed scenario

- Scenario: UX-ORDER-02/06/07/08 - Verify grouped movement, Settings clearing, and narrow-screen reflow.
- Build / commit: Same TREK-294 working tree.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 and 320 x 640; canonical synthetic emulator with a configured Barbell Curl/Cable Row superset.
- Actions: Generate the configured superset, move it later, open Manage Catalog, clear saved order preferences through the native confirmation, and inspect the generated order controls at 320px.
- Observed result: The named two-member superset rendered and moved as one consecutive block, retained focus after movement, and explained that member order remains in Settings. Clear rendered a focused success outcome. At 320px all order controls remained inside the viewport, the minimum control height was 44px, and document client and scroll widths were equal at 305/305.
- Rendered evidence: Live accessibility snapshots of the grouped block, Settings action/outcome, and computed focus, control-height, clipping, and viewport measurements.
- Material limitation: The grouped scenario uses a two-member superset; resolver tests cover expansion, split membership, and nonconsecutive collision variants.

## Changed scenario

- Scenario: UX-ORDER-05 - Recover from a future-order save that cannot reach Firestore.
- Build / commit: Same TREK-294 working tree after final lifecycle review remediation.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical synthetic generated workout reordered today, then the exact local Firestore emulator process was stopped before save.
- Actions: Select Use this order in future workouts, observe the pending state, and wait for the Firestore client to definitively reject.
- Observed result: While pending, Start workout and order controls were disabled and the status said `Saving this order for future workouts.` After rejection, Start workout and order controls were restored, Try again appeared, and an assertive alert said the future order was not saved while today's workout order remained unchanged. Document client and scroll widths remained 375/375.
- Rendered evidence: Live accessibility snapshots of pending and rejected states plus computed Start/viewport measurements. Focused lifecycle tests independently prove the 15-second indeterminate branch restores Start without exposing retry before definitive rejection.
- Material limitation: The rejection was induced by terminating only the synthetic local Firestore emulator; it does not represent production outage timing or every Firebase SDK retry schedule.

## Changed scenario

- Scenario: UX-ORDER-07 - Recover when Clear saved exercise-order preferences cannot reach Firestore.
- Build / commit: Same TREK-294 working tree after final usability review.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical synthetic Settings state, then the exact local Firestore emulator process was stopped before clearing.
- Actions: Select Clear saved exercise-order preferences, accept the native confirmation naming future workouts and today's unchanged workout, and wait for definitive rejection.
- Observed result: Settings retained the Order preference region and original Clear action, rendered the assertive alert `Couldn't clear saved exercise-order preferences. Try again.`, and exposed the distinct `Try clearing again` recovery action. Document client and scroll widths remained 375/375. The successful clear outcome is covered by the preceding grouped browser scenario.
- Rendered evidence: Live accessibility snapshot of the Settings failure/retry state and computed alert/action/viewport measurements.
- Material limitation: The rejection was induced by terminating only the synthetic local Firestore emulator; it does not represent production outage timing or every Firebase SDK retry schedule.

---

## 2026-08-05 - TREK-296 mobile workout-order insets

## Planning

- Classification: `required`
- Rationale: Workout-ready ordering labels and movement controls touched opposite phone edges, weakening hierarchy and tap clearance.
- Approved scenario or artifact: Preserve the Nudge generated-workout hierarchy: inset supporting order content, keep movement controls at least 44px high, and retain the full-bleed signal-yellow Start workout action.

## Changed scenario

- Scenario: Generate the canonical eight-exercise workout and inspect ordinary ordering rows at phone and narrow reflow widths.
- Build / commit: `codex/trek-296-297-workout-ux-fixes` working tree before the TREK-296 task commit.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 (375px document viewport) and 320 x 844 (305px document viewport); canonical synthetic emulator identity on Workout ready.
- Actions: Plan the workout, inspect the first and subsequent ordering rows, and compare label, movement-control, viewport, and Start-workout geometry at both widths.
- Observed result: At 390px, order content begins 27.29px from the left and ends at least 27.62px from the right; at 320px, the corresponding clearances are 22.40px and 22.73px. Narrow labels occupy their own line so Move earlier and Move later remain a coherent pair. Movement controls retain a 44px minimum height, document client and scroll widths remain equal at 375/375 and 305/305, and Start workout remains full-bleed.
- Rendered evidence: `.impeccable/evidence/trek-296-order-inset-mobile.png` and `.impeccable/evidence/trek-296-order-inset-reflow-320.png`.
- Material limitation: Chromium/emulator evidence does not replace physical-device Safari font rendering or touch testing.

---

## 2026-08-05 - TREK-297 adjacent completed-exercise details

## Planning

- Classification: `required`
- Rationale: Expanding a completed exercise changed its toggle to Collapse while revealing the associated disclosure only below the entire exercise list, outside the phone viewport.
- Approved scenario or artifact: Preserve the one-guided-action active-workout hierarchy and existing optional-set disclosure; place completed-exercise details inside the exercise toggle's own controlled reading context without adding scroll behavior or changing workout state.

## Changed scenario

- Scenario: Complete the first exercise during an active canonical workout, then activate its collapsed exercise toggle once.
- Build / commit: `codex/trek-296-297-workout-ux-fixes` working tree before the TREK-297 task commit.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 (375px document viewport); canonical synthetic emulator workout with all three Barbell Curl sets confirmed and Back Squat still guided.
- Actions: Expand the completed Barbell Curl exercise, inspect its aria-controlled region and visible viewport placement, then collapse it again.
- Observed result: The first activation keeps focus on the expanded toggle and renders `Other sets in Barbell Curl` directly against the toggle bottom inside `exercise-0-sets`; the summary is visible in the current viewport and precedes the next exercise. The shared optional-disclosure styling preserves the 27.3px content inset, heading type, border, pointer affordance, and a 57.2px summary target in both placements. The unfinished Back Squat keeps its focused set and deferred optional details. Collapsing removes the controlled region while retaining toggle focus. Document client and scroll widths remain equal at 375/375.
- Rendered evidence: `.impeccable/evidence/trek-297-completed-exercise-adjacent-mobile.png` plus live accessibility and computed DOM-placement measurements.
- Material limitation: Chromium/emulator evidence does not replace physical-device Safari or assistive-technology testing.

---

## 2026-08-06 - TREK-298 cooldown return actions

## Planning

- Classification: `required`
- Rationale: TREK-298 changes the terminal cooldown decision hierarchy and the recovery route back to unfinished or completed set editing.
- Approved scenario or artifact: Keep Finish workout dominant while offering exactly one context-specific secondary action that reuses the existing resume-workout transition.

## Changed scenario

- Scenario: Enter Cooldown once with unfinished sets and once after every set is complete.
- Build / commit: `068d35e`; full WorkoutView suite 85/85, lint, independent code review, task-conformance review, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844; synthetic production `WorkoutView` fixtures in timed Cooldown with one confirmed set plus unfinished work, and with all prescribed work confirmed.
- Actions: Inspect the Cooldown heading, dominant Finish workout boundary, available secondary action, hidden exercise controls, and document containment in each state.
- Observed result: Incomplete Cooldown shows Finish workout followed by exactly one `Continue workout` action; completed Cooldown shows Finish workout followed by exactly one `Edit completed sets` action. Neither state exposes exercise controls or extra explanatory copy, and document client/scroll widths remain equal at 390/390.
- Rendered evidence: `.impeccable/evidence/trek-298-cooldown-incomplete-mobile.jpg` and `.impeccable/evidence/trek-298-cooldown-complete-mobile.jpg`, plus live button inventory and viewport measurements.
- Material limitation: The synthetic fixture renders the production component and reducer state without persistence, routing, or personal data. Focus restoration after activating either secondary action is covered by focused component regressions. Chromium evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-06 - TREK-299 active set timer clarity

## Planning

- Classification: `required`
- Rationale: TREK-299 changes live set/rest hierarchy, wording across the planned-rest boundary, collapsed discovery, and the legibility of time-sensitive guidance during a phone-at-a-distance workout.
- Approved scenario or artifact: Preserve the Nudge core-journey one-signal rule and guided-set placement while showing one instance of each visible timer identity, retaining collapsed discovery, and distinguishing optional early start from ready-to-start states.

## Changed scenario

- Scenario: Start and confirm a set in an expanded exercise, compare its detailed active-work and planned-rest states with the same exercise collapsed, then observe the rest reach overtime.
- Build / commit: `f88b4f7` (including the TREK-299 implementation in `6d576f7`); full WorkoutView suite 89/89, lint, code review, task-conformance review, independent usability review, Ponytail proposal pass, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; canonical synthetic emulator workout with Barbell Curl expanded.
- Actions: Start Barbell Curl set 1; inspect active work; confirm the set; inspect planned rest; collapse and re-expand Barbell Curl; wait through planned-rest completion; inspect the ready/overtime state.
- Observed result: Expanded active work shows `Set 3: Working`, a separately spaced target, one 320.08 x 60px detailed work timer, and no matching compact header timer. Expanded planned rest shows one 320.08 x 132px tabular-numeral countdown, `Set 2: Resting`, and a 320.08 x 116.4px `Start set early` action; the matching header says only `2 sets remaining`. Collapsing removes the detailed timer and restores `rest 1:23 remaining` in the accessible header. After planned rest, re-expansion shows `Set 2: Ready`, `Start set`, and factual `Rest overtime +0:58` while suppressing the matching compact copy. Document client and scroll widths remain equal at 375/375.
- Rendered evidence: `.impeccable/evidence/trek-299-active-work-mobile.jpg`, `.impeccable/evidence/trek-299-active-work-reflow-320.jpg`, `.impeccable/evidence/trek-299-planned-rest-mobile.jpg`, `.impeccable/evidence/trek-299-collapsed-concurrent-mobile.jpg`, and `.impeccable/evidence/trek-299-overtime-mobile.jpg`, plus live accessibility snapshots and computed timer/action/viewport measurements.
- Material limitation: The exact zero instant is covered by the focused component regression because a one-second live browser snapshot is nondeterministic. Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: Keep one exercise's rest discoverable while expanding a different exercise with its own active rest, then verify the same detailed state at narrow reflow width.
- Build / commit: Same `f88b4f7` build.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 and 320 x 844 with 375px and 305px document viewports; canonical synthetic emulator workout with concurrent Barbell Curl and Back Squat rests.
- Actions: Collapse Barbell Curl during its active rest; start and confirm Back Squat set 1; keep Back Squat expanded; inspect both timer identities at 390px; resize to 320px and inspect the detailed rest and early-start action.
- Observed result: Collapsed Barbell Curl retains `rest 1:13 remaining` while expanded Back Squat shows one `Rest: 3:00 remaining / 3:00 planned` detail and suppresses only Back Squat's matching compact copy. At 320px the detailed timer remains dominant at 259.88 x 132px with tabular numerals, `Set 2: Resting` remains coherent with `Start set early`, the action remains 116.4px high, and document client and scroll widths remain equal at 305/305.
- Rendered evidence: `.impeccable/evidence/trek-299-collapsed-concurrent-mobile.jpg` and `.impeccable/evidence/trek-299-planned-rest-reflow-320.jpg`, plus live accessibility snapshots and computed timer/action/viewport measurements at both widths.
- Material limitation: Superset owner/recommended-next identity splitting is covered by a focused production-component regression rather than a separately seeded browser workout. The rendered concurrent-rest scenario proves distinct timer identities remain discoverable. Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

---

## 2026-08-06 - TREK-300 workout-order save hierarchy

## Planning

- Classification: `required`
- Rationale: TREK-300 changes where a pre-start persistence decision and its asynchronous feedback appear relative to the ordered exercises and dominant Start action.
- Approved scenario or artifact: Preserve the contextual-ordering behavior and lifecycle from `docs/specs/2026-08-03-contextual-exercise-ordering.md` while superseding its verbose pre-start explanation and below-Start preference placement.

## Changed scenario

- Scenario: Reorder a canonical generated workout and decide whether to keep the order only today or save it for future workouts.
- Build / commit: `f1722a3`; full WorkoutView suite 89/89, lint, independent code review, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 and 320 x 844 with 375px and 305px document viewports; canonical synthetic emulator workout with eight reorderable exercises.
- Actions: Move Lateral Raise from position 1 to position 2; scroll through the final ordered block; inspect the persistence action, today-only explanation, Start action, control geometry, and document containment at both widths.
- Observed result: `Save order for future workouts` appears immediately after the eighth order block, followed by only `Order changes apply only to today unless you save them.` and then the sole signal-yellow `Start workout` boundary. The neutral save control is 44px high; Start remains full-width and 82.2px high. At 390px and 320px, document client/scroll widths remain equal at 375/375 and 305/305, and movement controls reflow without clipping.
- Rendered evidence: `.impeccable/evidence/trek-300-dirty-mobile.jpg` and `.impeccable/evidence/trek-300-dirty-reflow-320.jpg`, plus live accessibility snapshots and computed action/viewport measurements.
- Material limitation: The canonical workout contains ordinary order blocks; focused component tests preserve configured-superset movement and its separate Settings guidance. Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: Save the reordered preference, observe pending and success, then retry after a synthetic local Firestore outage produces a definitive failure.
- Build / commit: Same `f1722a3` build.
- Viewport and starting state: Codex in-app Chromium at 390 x 844, plus failure reflow at 320 x 844; the same synthetic generated workout, with only the local Firestore emulator stopped for the failure attempt.
- Actions: Activate Save order for future workouts; inspect immediate pending/disabled state and successful settlement; make another order change; stop the verified local Firestore emulator process; activate Save again; inspect pending and definitive failure/retry; resize the failure state to 320px.
- Observed result: Pending keeps `Saving order…`, its adjacent status, and disabled Start together before the dominant boundary. Success retires the dirty action and places its focused polite outcome directly before enabled Start. After emulator rejection, `Try saving this exercise order again`, the today-only sentence, and the assertive failure remain together before restored Start; today's order is unchanged. All visible preference and Start controls are at least 44px high, and document client/scroll widths remain equal at 375/375 and 305/305.
- Rendered evidence: `.impeccable/evidence/trek-300-pending-mobile.jpg`, `.impeccable/evidence/trek-300-success-mobile.jpg`, `.impeccable/evidence/trek-300-failure-mobile.jpg`, and `.impeccable/evidence/trek-300-failure-reflow-320.jpg`, plus live accessibility snapshots and computed focus/disabled/action/viewport measurements.
- Material limitation: The pending interval was captured at 390px and shares the same responsive composition proven by the 320px dirty and failure states. Failure was induced by stopping only the synthetic local Firestore emulator and does not represent production outage timing or every Firebase retry schedule.

---

## 2026-08-06 - TREK-301 acknowledged order-save retirement

## Planning

- Classification: `required`
- Rationale: TREK-301 changes when asynchronous preference success remains visible across the Start boundary and shortens the ordinary saved outcome across its existing renderers.
- Approved scenario or artifact: Retire only a terminal success already acknowledged before Start; preserve pending, indeterminate, failure, late settlement, retry, focus, baseline/candidate, and specific override or eviction disclosure.

## Changed scenario

- Scenario: Save an order before Start, begin the workout after the success is announced, then compare that acknowledged path with a save that settles only after Start.
- Build / commit: `00ce55d` (including the TREK-301 presentation change in `1b364e3`); focused App, WorkoutView, and Settings suites 154/154, lint, independent code review, task-conformance review, Ponytail proposal pass, and diff-check green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844; synthetic production `WorkoutView` fixtures for pre-Start success, active workout after acknowledged success, and active workout transitioning from indeterminate to late success.
- Actions: Inspect ordinary success before Start; cross the Start boundary after that acknowledged success; separately keep focus on the expanded Plank exercise while an indeterminate save settles after Start; inspect the remaining late-result panel and Dismiss action.
- Observed result: Before Start, the polite outcome is the concise `Order saved.` directly before the dominant Start action. After acknowledged success, active Warmup contains no saved-order panel or Dismiss. A genuinely late settlement renders one nonempty `Order saved.` status and one Dismiss while focus remains on the Plank exercise toggle. At 390px, document client/scroll widths remain equal at 375/375.
- Rendered evidence: `.impeccable/evidence/trek-301-prestart-success-mobile.jpg`, `.impeccable/evidence/trek-301-acknowledged-start-mobile.jpg`, and `.impeccable/evidence/trek-301-late-success-mobile.jpg`, plus live status/action inventory, active-element, and viewport measurements.
- Material limitation: A temporary synthetic fixture rendered the production component and reducer state without persistence, routing, or personal data and was removed after capture. Focused App and production-WorkoutView regressions cover the overlap where a save settles while durable Start is pending. Chromium evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: Reflow the genuinely late saved-order result on the narrow supported phone width.
- Build / commit: Same `00ce55d` build; the race remediation does not change rendered output.
- Viewport and starting state: Codex in-app Chromium at 320 x 844 with a 305px document viewport; active Warmup transitioning from indeterminate preference save to ordinary success.
- Actions: Allow the late save to settle while workout focus remains on the expanded Plank exercise; inspect the result panel, Dismiss geometry, containment, and following workout controls.
- Observed result: The 304.67px-wide result panel contains one `Order saved.` status and one full-width Dismiss action without clipping. Focus remains on the Plank exercise toggle, the following Start set action remains dominant and usable, and document client/scroll widths remain equal at 305/305.
- Rendered evidence: `.impeccable/evidence/trek-301-late-success-reflow-320.jpg`, plus live panel geometry, status/action inventory, active-element, and viewport measurements.
- Material limitation: The synthetic fixture proves the production presentation and focus-preserving rerender; it does not simulate Firebase latency or every browser announcement cadence.

## Remediation recheck

- Scenario: Move one generated exercise, save the resulting order for future workouts, and verify that the temporary current-workout-only announcement retires after success.
- Build / commit: `bd36dea` working tree with the focused TREK-301 journey-review remediation; full WorkoutView suite 92/92, diff-check, scoped code review, and scoped task-conformance review green.
- Viewport and starting state: Fresh coordinator-owned UX-10-01 lease in Codex in-app Chromium at 390 x 844; approved synthetic identity and clean Plan start.
- Actions: Generate a workout; move Barbell Curl from position 1 to position 2; inspect the temporary semantic movement announcement; save the order for future workouts; wait for success; inspect the whole viewport, live-region inventory, and active element after an additional 1.2 seconds.
- Observed result: Before save, the semantic status correctly said the move was for this workout only. After save, the viewport showed focused `Order saved.` before Start workout; semantic inventory contained one empty status and one nonempty `Order saved.` status, with no current `this workout only`, `current workout only`, or `only to today` content. The affected ux-usability-reviewer recheck returned `ready` with no direct defect.
- Rendered evidence: Live final-build viewport inspection, semantic status inventory, and programmatic focus evidence from isolated lease `f03afe5c-e526-47ec-953d-0e38e7422981`.
- Material limitation: Semantic structure and focus were verified without a real screen-reader announcement or a next-workout persistence check. Existing transaction tests and ordering evidence cover persistence behavior; this remediation changes only the temporary local movement announcement.

---

## 2026-08-07 - TREK-305 post-save History freshness

## Planning

- Classification: `required`
- Rationale: TREK-305 changes the asynchronous lifecycle of an already-visible empty History state after a successful workout save, where contradictory persistence feedback directly affects trust and recovery.
- Approved scenario or artifact: Preserve the current Nudge saved-completion contract from Trekker comments CMT-508/CMT-509 and the existing lazy Workout History disclosure while retiring stale empty, error, and pagination state after confirmed persistence. No navigation, information-architecture, completion-receipt, schema, or copy redesign.

## Changed scenario

- Scenario: Keep an empty Workout History expanded before saving a workout, then verify the same disclosure refreshes to the newly persisted workout on the saved-completion screen.
- Build / commit: TREK-305 working tree on `codex/trek-305-history-refresh`; focused WorkoutView and WorkoutHistory suites 117/117, lint, diff-check, independent code review, task-conformance review, and Ponytail proposal pass green.
- Viewport and starting state: Codex in-app Chromium at 390 x 844 with a 375px document viewport; fresh isolated UX-10-01 approved synthetic identity with empty History and a generated canonical workout.
- Actions: Expand Workout history and observe `No workouts logged yet.`; start the workout; confirm Barbell Curl set 1; finish early through Cooldown; save; wait for the existing disclosure to refresh.
- Observed result: Before save, Workout history remained expanded and truthfully showed the empty state. After save, `Workout saved` received focus, the sole completion status remained `This workout is complete.`, the disclosure remained expanded, one saved workout article replaced the empty state without reload or another save, and no warning or error was logged. Document client and scroll widths remained equal at 375/375 before and after save.
- Rendered evidence: `.impeccable/evidence/trek-305-mobile-pre-save.png` and `.impeccable/evidence/trek-305-mobile-post-save.png`, plus live accessibility snapshots, active-element/status inventory, disclosure state, and viewport measurements.
- Material limitation: The in-app browser's semantic off-screen disclosure activation focused but did not activate the control in this pass, so the coordinator used a visible coordinate activation after confirming the target geometry. The resulting state, keyboard semantics, and refresh lifecycle were verified through the live DOM and focused component regressions; Chromium/emulator evidence does not replace physical-device or assistive-technology testing.

## Changed scenario

- Scenario: Repeat the pre-expanded empty-to-saved History transition at the desktop evidence viewport.
- Build / commit: Same TREK-305 working tree and verification evidence.
- Viewport and starting state: Codex in-app Chromium at 1440 x 900 with a 1265px document viewport; independent fresh isolated UX-10-01 approved synthetic identity with empty History.
- Actions: Generate a workout; expand empty Workout history; start and confirm Barbell Curl set 1; finish through Cooldown; save; inspect completion focus, status, disclosure state, refreshed article, containment, and console output.
- Observed result: The pre-save disclosure was expanded with `No workouts logged yet.`. Successful save kept it expanded and replaced the stale empty state with one newly saved workout article; `Workout saved` held focus, `This workout is complete.` remained the only nonempty completion status, client and scroll widths remained equal at 1265/1265, and Chromium logged no warning or error.
- Rendered evidence: `.impeccable/evidence/trek-305-desktop-pre-save.png` and `.impeccable/evidence/trek-305-desktop-post-save.png`, plus live accessibility snapshots, active-element/status inventory, disclosure state, and viewport measurements.
- Material limitation: The isolated emulator proves application read-after-save behavior and rendered reconciliation without production data, physical-device rendering, or a real screen reader. Focused regressions separately cover collapsed lazy refresh, repeated-key no-op behavior, and refreshed pagination cursor ownership.

## Independent usability review

- Goal: A distracted trainee finishing a short workout can confirm that the result was saved and understand the next safe action.
- Journey: On a fresh isolated 390 x 844 UX-10-01 lease, generate and start the canonical workout; confirm Barbell Curl set 1; finish early through Cooldown and Review; save; expand Workout History; inspect the persisted entry; select Back to plan.
- Result: `READY` with no direct usability defects. The first viewport made `Workout saved` and `This workout is complete.` unmistakable, the expanded History showed the new August 7, 2026 entry with its confirmed set, and Back to plan reached a clean Plan screen. Focus, completion status, accessible control names, and disclosure state were present without stale or contradictory post-save content.
- Material limitation: The independent review used live in-app Chromium interaction, screenshots, focus/status inspection, and semantic DOM evidence; it did not include a physical phone, gym conditions, or a full screen-reader session.
