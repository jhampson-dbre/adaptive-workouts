# TREK-233 — Nudge core journey UX evidence

## Planning

- Classification: `required`
- Rationale: TREK-233 materially changes the Plan → Perform → Cooldown → Review hierarchy, feedback, recovery, and mobile placement.
- Approved scenario or artifact: `.impeccable/mocks/nudge-single-next-action.png`

## Changed scenario

- Scenario: Plan a workout from available time while keeping recovery exclusions optional.
- Build / commit: `codex/trek-233-nudge-foundations` working tree; focused tests and build green.
- Viewport and starting state: Seeded local emulator baseline at 390 × 844 and 1280 × 900.
- Actions: Opened Plan, inspected the first viewport, and expanded no optional constraints.
- Observed result: Time and the yellow “Plan my workout” action are the first decision chunk; “Anything to work around?” remains a closed native disclosure. The 390 px heading and document stay within their boxes, and the desktop content remains centered.
- Rendered evidence: `.impeccable/evidence/trek-233-plan-mobile-current.png`; `.impeccable/evidence/trek-233-plan-desktop-current.png`
- Material limitation: The emulator-only safety warning is visible and is not production UI.

## Changed scenario

- Scenario: Enter and perform a generated workout on the target phone width.
- Build / commit: Same working tree and synthetic local catalog/history.
- Viewport and starting state: 390 × 844; generated workout before Start.
- Actions: Started the workout, started the focused set, and inspected the active controls.
- Observed result: “Start Workout” is dominant before timers activate. During Performance, Confirm attempt is the yellow primary action and Cancel timer is a distinct outlined secondary action. The full phase header fits without text or document overflow under the 390 × 844 in-app Browser override.
- Rendered evidence: `.impeccable/evidence/trek-233-workout-ready-mobile-current.png`; `.impeccable/evidence/trek-233-performance-header-390-current.png`; `.impeccable/evidence/trek-233-performance-390-current.png`
- Material limitation: The in-app Browser’s 390 × 844 override produces a 375 × 812 page capture after its 15 px scrollbar and 32 px browser chrome are excluded. The narrower captured page includes the complete Performance heading and therefore exercises the stricter content width.

## Changed scenario

- Scenario: Resolve a due leg-day prompt without a blocking browser dialog.
- Build / commit: Same working tree after the accessibility review fix.
- Viewport and starting state: Local emulator at the 390 × 844 Browser override; temporary Saturday schedule with due synthetic history, restored to None after capture.
- Actions: Activated Plan my workout, observed focus transfer, and inspected both inline choices.
- Observed result: The neutral “Include legs in today’s workout?” heading is focused when the decision appears; Include legs today and Keep current plan remain inline and do not expose elapsed-day pressure copy.
- Rendered evidence: `.impeccable/evidence/trek-233-leg-day-choice-mobile-current.png`
- Material limitation: The capture has the same 375 × 812 page-area dimensions described above; all emulator setting changes were restored after capture.

## Changed scenario

- Scenario: Finish early without losing unfinished-work context.
- Build / commit: Same working tree.
- Viewport and starting state: 390 × 844; one set recorded with remaining planned work.
- Actions: Activated Finish Workout, reviewed the unfinished summary, returned once, then continued.
- Observed result: The guard lists remaining sets, focuses “Finish workout early?”, keeps Return to workout primary, and offers Continue to Cooldown as the secondary choice.
- Rendered evidence: `.impeccable/evidence/trek-233-early-finish-mobile-current.png`
- Material limitation: The eight-exercise list is intentionally representative of the largest seeded plan.

## Changed scenario

- Scenario: Cool down or deliberately return to remaining work.
- Build / commit: Same working tree.
- Viewport and starting state: 390 × 844; early-finish path in Cooldown.
- Actions: Inspected the phase status, Finish/Resume order, and closed remaining-work disclosure.
- Observed result: Finish Workout is the dominant yellow action, Resume Workout is secondary, and unfinished exercise controls are removed from the default view behind “Return to remaining work.”
- Rendered evidence: `.impeccable/evidence/trek-233-cooldown-mobile-current.png`
- Material limitation: Countdown values vary with capture timing.

## Changed scenario

- Scenario: Review partial work, save it, and understand that persistence succeeded.
- Build / commit: Same working tree after the save-acknowledgment review fix.
- Viewport and starting state: 390 × 844; one confirmed set after early finish.
- Actions: Finished Cooldown, reviewed the factual summary, saved, waited more than the former 500 ms timeout, and then activated Plan another workout.
- Observed result: Review leads with “1 set recorded” and duration, places unrecorded work in a closed disclosure, and presents Save workout as primary. “Workout saved” remains focused and visible until the explicit Plan another workout action.
- Rendered evidence: `.impeccable/evidence/trek-233-review-mobile-current.png`; `.impeccable/evidence/trek-233-save-ack-mobile-current.png`
- Material limitation: The save used local emulator data only; no production credentials or records were involved.
