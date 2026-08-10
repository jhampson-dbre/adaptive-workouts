# EPIC-17 Workout Trends UX Artifact

Status: approved by the user on 2026-08-10 after fresh UX design review; architecture
review subsequently found the design feasible within the existing History boundary.

## Job, audience, and outcome

An authenticated trainee, usually using a phone between workouts, enters the existing
primary History destination to answer one factual question: how has one exercise they
actually performed changed across a familiar calendar range? This is an Operate surface
inside Nudge's approved Clear Signal system. Success means the trainee can find an
eligible exercise, select a range, understand recorded totals on real workout dates,
and inspect the confirmed sets behind any point without interpreting coaching language.

## Topology and interaction thesis

History keeps one heading and gains two peer views. **Workouts** remains the initial
view and preserves TREK-308 exactly. **Exercises** is a deliberate secondary view; it
does not alter the saved destination preference or the Workouts paging model. Use two
ordinary view-switch buttons rather than tabs: each exposes its pressed state, names the
view it opens, and moves focus to that view's level-three heading after activation.

```text
History
  [Workouts] [Exercises]
       |          |
       |          +-- eligible exercise list + focused name filter
       |                         |
       |                         +-- one selected exercise
       |                               [1M] [3M] [6M] [1Y]
       |                                      |
       |                           complete selected-range read
       |                                      |
       |                     factual summary + calendar plot
       |                                      |
       |                      evidence scrubber / numeric fallback
       |                                      |
       |                         confirmed set evidence
       |
       +-- unchanged scan-first workout history
```

The focal moment is not a progress judgment. It is the trainee moving the evidence
scrubber to a real workout date and seeing that point's totals and set composition update
together. Signal yellow identifies only the selected History view, selected range, or
active point as one coherent current state; it does not imply success or improvement.

## Exercises list

- Opening Exercises starts one complete supported one-year discovery read. While it is
  pending, keep the Exercises heading and one adjacent live loading status, but render
  no prior or partial exercise list. A whole-request failure shows one Retry action and
  no list. Retry keeps focus on itself while pending, announces the new attempt, and
  moves focus to the filter after success. Switching away does not change Workouts;
  returning starts a fresh complete discovery read.
- Render only saved exercise-ID plus saved tracking-mode identities with an eligible
  occurrence in the completed discovery window. Order identities by last-trained date
  newest first, then latest eligible name, saved ID, and tracking mode for deterministic
  ties.
- Use the latest eligible saved name and show the last-trained date. When one saved ID
  has both tracking modes, label the identities plainly so they never appear combined.
- Put an explicitly labelled name filter before the list. Filtering is local, focused,
  case-insensitive name matching; it is not generalized search.
- Each result is one square, full-width, at-least-44px action. Long names wrap without
  hiding the mode or date. Selection opens the detail in the same History surface and
  places focus on its exercise heading. A visible Back to exercises action restores
  focus to the selected list row; if filtering removed that row, restore focus to the
  filter.
- No eligible identities and no filter matches are distinct neutral states. Neither
  invents suggestions or routes the trainee elsewhere.

## Single-exercise detail

Order the detail for scanability:

1. Back to exercises, exercise name, tracking-mode label.
2. Range control with 1M, 3M, 6M, and 1Y; 3M is the default on each newly selected
   exercise. The selected range is programmatically exposed.
3. One adjacent loading/error region for the whole selected-range request.
4. Only after that request completes successfully: factual summary, calendar plot,
   evidence controls, and confirmed set evidence.

Changing range immediately updates the range control's selected state to the requested
range and starts a whole-request replacement. Remove every prior summary, plot, scrubber,
and evidence value while that request is pending so stale results cannot masquerade as
the requested range. A failure keeps the requested range selected, shows one Retry
action, and renders no partial result. Retry requests that selected range again and
focuses the factual-summary heading on success. Every successful initial or replacement
read selects the latest real workout in the completed range as the active evidence point.

When a completed selected range contains no eligible workout, keep the exercise heading,
mode, and range controls visible; replace every summary, plot, scrubber, and evidence
region with neutral `No recorded workouts in this range` copy. Announce the empty result
and move focus to that message after a user-initiated range change or Retry.

## Factual content

- Weighted mode: one point per workout containing the sum of confirmed actual weight
  multiplied by confirmed actual repetitions. Label the value as volume and preserve
  the app's saved weight unit. Evidence lists the confirmed weight and repetitions for
  each included set.
- Bodyweight mode: one point per workout with separate full, assisted, and eccentric
  repetition totals. Do not combine the three series. Evidence lists each confirmed set
  in those same categories.
- Show only recorded dates. Missing sessions never render as zeroes.
- Range membership and plot/scrubber dates use the same calendar-date interpretation
  as Workouts History: ISO timestamp values resolve to the viewer's local calendar date,
  while saved date-only values retain their literal calendar date. A selected range
  includes its complete local end date.
- The summary contains latest recorded value, change from the previous eligible session,
  range high, and session count. Bodyweight facts remain series-specific where a single
  combined number would be misleading. Use neutral increase/decrease/no-change language.
- One eligible workout is a **record**, not a trend: show its date, totals, and evidence;
  omit previous-session change and use explicit one-record copy.

## Plot and evidence scrubber

Use semantic HTML plus a minimal inline SVG only if it improves the calendar shape.
No chart dependency is introduced. The horizontal axis represents actual dates across
the selected calendar window; irregular gaps remain visible. Every plotted value also
exists in an ordinary labelled numeric/date control and evidence region, so the SVG is
not required to understand or operate the feature.

- The numeric/date fallback is the canonical interactive control. It exposes one step
  per recorded workout, its position and count, date, and current totals.
- Pointer interaction on the SVG chooses the nearest real recorded workout. Native
  Pointer Events support touch, pen, and mouse without separate gesture paths.
- Left/Right moves to the previous/next recorded workout; Home/End moves to the first/
  last. Selection does not wrap. Focus remains on the scrubber while its labelled value
  and the evidence region update.
- A polite status announces the newly selected date and totals. Confirmed set evidence
  is a stable region below it, not a tooltip or hover-only surface.
- Reduced motion removes animated transitions. Normal motion may use one brief state
  transition but never delay values or evidence.

## Responsive and accessibility contract

- Phone first: all controls and evidence stay in one reading column; range controls may
  form a 2-by-2 grid at 320px/200-percent reflow but retain logical order and 44px targets.
- Desktop widens the plot and may place factual summary beside it only when reading and
  focus order remain summary, plot/scrubber, then evidence.
- The SVG is supplemental and hidden from the accessibility tree when its complete
  meaning is already exposed by the labelled control and evidence region.
- Color is never the only distinction among tracking modes, bodyweight series, selected
  points, loading, or error states. Text labels and line/marker shapes carry identity.
- Long exercise names, large weight/rep values, sparse dates, and twelve months of
  eligible points wrap or scroll only inside the plot region; the page must not gain
  horizontal overflow.

## Shared required scenarios

1. Enter History and confirm the unchanged Workouts view, paging, and return behavior.
2. Switch to Exercises, filter a mixed list, select a weighted identity, and inspect
   irregular 3M dates with pointer and keyboard scrubbing.
3. Select a bodyweight identity and verify separate full, assisted, and eccentric series
   and evidence.
4. Exercise each range and confirm no result is displayed before the complete request.
5. Cover one record, no data in the selected range, no eligible exercises, no filter
   matches, loading, whole-request error, Retry, and deterministic focus return.
6. Verify touch, keyboard, screen-reader/numeric fallback, reduced motion, long labels,
   phone, desktop, and 320px/200-percent reflow.
7. Complete one goal-first journey from entering History through inspecting a point,
   with an existing active workout when safe navigation is available, and verify the
   workout remains authoritative on return.

## Boundaries

Preserve TREK-308's History shell, Workouts presentation/pagination, active-workout
recovery, forced-navigation authority, and save-refresh contract. Do not add exercise
comparison, weekly aggregation, generalized search, coaching, progress judgments,
forecasts, scores, gamification, inferred values, decorative motion, analytics writes,
schema migration, or a chart framework without a separately proven accessibility need.
