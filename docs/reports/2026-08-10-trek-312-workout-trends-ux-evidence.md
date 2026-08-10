# TREK-312 rendered UX evidence

Date: 2026-08-10

Build: `codex/epic-17-workout-trends` working tree after TREK-311 commits `bef4f5c` and `c9ac580`

Surface: authenticated private-access lease with the synthetic `workout-trends` scenario, reference date 2026-08-10

## Rendered journeys

| Scenario | Viewport | Observed result |
| --- | --- | --- |
| Workouts continuity | 390 x 844 | History opens on Workouts with the existing chronological workout cards and view heading focus. |
| Discovery and filter | 390 x 844 | Exercises moves focus to the filter after one complete discovery read. Bench Press, Pull-Up, and the long Triceps identity are ordered by last trained date. A non-matching filter shows the neutral no-match state, and clearing it restores the list. |
| Weighted evidence | 390 x 844 | Bench Press defaults to 3M and shows three irregular real dates, latest/range-high/previous-session/session-count facts, and confirmed sets. Home selects May 27 (2280 lb); ArrowRight selects July 7 (2700 lb) while focus stays on the native scrubber. |
| Bodyweight evidence | 390 x 844 | Pull-Up keeps Full, Assisted, and Eccentric totals separate in the summary, selected-workout label, and each confirmed set. |
| Sparse and empty range | 390 x 844 | The long Triceps identity shows one-record copy in 3M. Selecting 1M removes all prior facts/evidence and focuses `No recorded workouts in this range.` |
| Narrow reflow | 320 x 700 | The long exercise name wraps in the detail heading, range controls form a 2-by-2 grid, and the reading/focus order remains intact without clipped trend content. |
| Desktop | 1440 x 900 | The same semantic order is preserved; the native scrubber expands with the content column and confirmed evidence remains below it. |
| Active workout recovery | 1440 x 900 | After planning and starting a workout, opening History shows Workouts without replacing the active session. Returning through the Workout navigation resumes the same Warmup state and elapsed timer. |

The native numeric/date scrubber is the canonical visualization and accessibility fallback; no optional SVG or chart dependency is present. Signal yellow is limited to pressed view/range state. The feature adds no authored motion, so reduced-motion users receive immediate state updates without delayed evidence.

## Captures

![Phone exercise list](assets/trek-312/phone-exercise-list.jpg)

![Phone weighted evidence scrubber](assets/trek-312/phone-weighted-scrubber.jpg)

![Long exercise name at 320px](assets/trek-312/narrow-long-name.jpg)

![Desktop weighted detail](assets/trek-312/desktop-weighted.jpg)

## Async and recovery evidence

The healthy seeded lease directly exercised successful discovery/detail reads and user-initiated range replacement. Focused component tests provide deterministic coverage for pending loading states, whole-request discovery and detail errors, Retry focus retention and recovery, stale-response rejection, unmount/view replacement, empty discovery, filtered-empty state, back-to-row/filter focus, and removal of prior results during range replacement. These states were not fabricated in the rendered build by disrupting the shared emulator.

## Verification

- `npm test -- --run src/tests/storage.test.js src/tests/trendProjection.test.js src/tests/WorkoutHistory.test.jsx src/tests/App.lazyNavigation.test.jsx src/tests/emulatorScenarios.test.js` — 93 passed, including the mixed date-only/ISO visible-calendar ordering regression.
- Touched-file lint — passed.
- Production build — passed after the final production-code correction.
- `git diff --check` — passed.
