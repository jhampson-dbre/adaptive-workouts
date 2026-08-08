# TREK-306 inline-order remediation evidence

## Scope

This report closes the cumulative EPIC-16 review delta after commit `738c6fb`.
The trainee-approved follow-up replaces the separate pre-start order-only disclosure
with move controls inside each exercise row and keeps a compact **Back to Plan**
utility directly after **Start workout**. No workout-session, order-preference,
persistence, route, schema, or recovery authority changed in this remediation.

The only production-code remediation is the palette-token correction in
`src/index.css`; the Workout-ready behavior was already present on the reviewed
branch. The durable EPIC-16 artifact now records the later approved topology.

## Rendered setup

- Synthetic/de-identified local emulator data only.
- Current branch served by the existing Vite process at `http://127.0.0.1:19152/`.
- Authenticated seeded Plan and Workout-ready surfaces were inspected after confirming
  the current HMR source was active.
- Reference viewports: 390x844 phone, 1440x900 desktop, and 320x844 reflow.
- Attempts to acquire two new private-access leases timed out before returning lease
  identifiers. The already-running authenticated synthetic session was therefore used;
  no production or personal workout data was observed.

## Observations

### Workout ready

- At 390x844, the focused `Workout ready` heading leads truthful totals and a bounded
  three-name summary. **Start workout** is fully visible in the first viewport, followed
  by the compact **Back to Plan** utility and then the exercise list.
- At 1440x900, **Start workout** spans 760px from y=467.65 to y=569.65; **Back to Plan**
  follows from y=569.65 to y=613.65; `Exercises` begins at y=613.65. The document has no
  horizontal overflow (`scrollWidth === clientWidth === 1425`).
- At 320x844, **Start workout** remains fully visible from y=585.98 to y=668.18;
  **Back to Plan** follows from y=668.18 to y=712.18. The page has no horizontal
  overflow (`scrollWidth === clientWidth === 305`), and both first-row order actions
  retain 44px target height.
- No `Review or change order` disclosure or duplicate order-only list is present at any
  inspected viewport. Earlier/Later actions remain attached to their exercise rows.

### Order movement and save lifecycle

- Pointer-activating `Move Barbell Curl later` reordered the first two rows to Back
  Squat then Barbell Curl. The control's accessible label updated to position 2 of 5.
- The polite status announced `Barbell Curl moved to position 2 of 5. This change is
  for this workout only.` Focus remained visibly associated with the moved row action.
- The today-only explanation and **Save order for future workouts** appeared after the
  exercise list. Moving Barbell Curl back to the baseline retired the save action and
  restored the seeded order.
- Direct keyboard activation could not be produced through the available browser key
  injection. Existing focused component tests remain the evidence for native-button
  keyboard activation, boundary labels, move focus, atomic supersets, and preference
  lifecycle behavior; this report does not claim a rendered keyboard pass.

### Back to Plan and Plan hierarchy

- **Back to Plan** returned to the keyed Plan destination, restored focus to
  `Plan today's workout`, and preserved the 45-minute Plan input.
- At 390x844, **Plan my workout** is fully visible from y=686.24 to y=802.24 and the
  page has no horizontal overflow.
- At 1440x900, the action begins at y=788.14 and ends at y=904.14. Its final 4.14px
  falls below the physical viewport in the emulator layout; this is recorded as a
  limitation rather than represented as a full desktop first-viewport pass.

## Evidence assets

- `.impeccable/evidence/trek-306-inline-order-phone-current.png`
- `.impeccable/evidence/trek-306-inline-order-desktop-current.png`
- `.impeccable/evidence/trek-306-inline-order-320-current.png`
- `.impeccable/evidence/trek-306-inline-order-dirty-phone-current.png`
- `.impeccable/evidence/trek-306-inline-order-save-controls-phone-current.png`
- `.impeccable/evidence/trek-306-plan-phone-current.png`
- `.impeccable/evidence/trek-306-plan-desktop-current.png`

## Verification

- `npm test -- --run src/tests/nudgeCssConsolidation.test.js src/tests/WorkoutView.test.jsx`
  — 101/101 passed.
- `npm run build` — passed.
- `git diff --check` — passed.
