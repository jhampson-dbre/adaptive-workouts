# UX evidence

## Planning

- Classification: `required`
- Rationale: the experiment materially changes responsive hierarchy, focus, dense-history
  reflow, touch controls, and workout-state presentation.
- Approved artifact: canonical A-r3 prompt plus `design-context.md`; independent UX design
  review approved the scenario before implementation.
- Build / commit: Vite development render from
  `7dbaad158f7ac6ee59f5df8874a4253e407908a9` with the uncommitted bakeoff files.
- Data: repository-supplied synthetic scenario only.

## Plan desktop

- Viewport and starting state: 1440 × 900; `?screen=plan`; 45 minutes with Shoulders and
  Legs selected.
- Actions: loaded the standalone route and inspected the complete viewport.
- Observed result: time choice, selected groups, and `Generate Plan` form one clear path;
  secondary actions remain available without competing.
- Rendered evidence: `plan-desktop.png`.
- Accessibility checks: native range and checkboxes; visible labels; primary action has
  white text on dark terracotta; no meaning depends on color.
- Material limitation: static experiment; controls are presentation-only.

## Performance mobile

- Viewport and starting state: 390 × 844; `?screen=performance`; Bench Press set 2 ready,
  Bench Press resting at 0:38, Row resting at 0:24, Plank with 2 sets remaining.
- Actions: loaded the route; measured every button and number input.
- Observed result: ready target and `Start set` lead; both concurrent rests remain distinct
  and explicitly say `rest … remaining`; the full screen fits the viewport.
- Rendered evidence: `performance-mobile.png`.
- Accessibility checks: all interactive targets are 44–60 px high; collapsed rows are
  semantic buttons with expanded state and full accessible names; ready/rest meaning uses
  words and symbols as well as color.
- Material limitation: timers are fixed evidence values and do not count down.

## Review desktop

- Viewport and starting state: 1440 × 900; `?screen=review`; 5 of 7 confirmed, duration
  32:18, and all supplied phase and exercise values.
- Actions: loaded the route and inspected actual/planned alignment, partial confirmation,
  warning placement, and action hierarchy.
- Observed result: phase comparisons align with tabular numerals; partial confirmation is
  marked with a dash and text; the warning sits immediately beside the save actions.
- Rendered evidence: `review-desktop.png`.
- Accessibility checks: confirmation states use explicit text and symbols; primary and
  secondary actions remain distinct without color alone.
- Material limitation: actions are presentation-only.

## History mobile

- Viewport and starting state: 390 × 844; `?screen=history`; expanded July 26, 2026 record.
- Actions: loaded the route and inspected the entire supplied record.
- Observed result: phase timing, both exercise records, recommendation, rest timing, and
  `Load older` all fit in one readable document flow.
- Rendered evidence: `history-mobile.png`.
- Accessibility checks: `Load older` is 46 px high; confirmation includes a check and
  text; dense values retain upright system type and tabular numerals.
- Material limitation: only the supplied first-set detail is represented.

## History 320 px reflow

- Viewport and starting state: 320 × 844; same expanded History route.
- Actions: resized to 320 px and measured document and control bounds.
- Observed result: document width and scroll width both equal 320 px; there is no
  horizontal scrolling; labeled values wrap into rows; `Load older` remains visible,
  292 × 46 px, and ends at y=787.
- Rendered evidence: `history-reflow-320.png`.
- Accessibility checks: no type-size reduction at the breakpoint; labels remain adjacent
  to their values; touch target remains above 44 px.
- Material limitation: verified in the bundled browser rather than a physical device.

## Keyboard focus

- Viewport and starting state: 1440 × 900 Review.
- Actions: moved keyboard focus to `Back to workout`.
- Observed result: the focused secondary action has a 4 px blue outline with approximately
  3 px offset, clearly separated from both the control border and terracotta primary.
- Rendered evidence: `focus-visible.png`.
- Accessibility checks: focus is not conveyed by color fill or position change; reduced
  motion removes all animation and preserves every state.
- Material limitation: this is directional WCAG verification, not accessibility
  certification. The fallback stack is Aptos, Segoe UI, then Arial; no separate OS/font
  matrix was available, and the layouts use wrapping rather than fixed text widths.

## Final rendered review

- Independent UX usability review: `APPROVE`.
- Blocking defects: none.
- Non-blocking caveat: History timing metadata is compact at 11 px but remained legible
  in both required mobile captures.
