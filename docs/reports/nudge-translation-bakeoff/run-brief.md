# TREK-229 sealed translation bake-off

## Purpose

Translate the selected Nudge direction into a runnable UI three times:

1. Anthropic `frontend-design`
2. Impeccable
3. Vanilla Codex

The runs start from the same commit, use the same product truth and evidence contract,
and remain isolated. They are disposable experiments, not production implementations.
The coordinator will compare unlabeled outputs before revealing which tool produced each
candidate.

## Source direction

Read these repository-owned artifacts before making design decisions:

- `docs/reports/nudge-concept-selection.md`
- `docs/reports/nudge-concepts/prompt-a-r3-warm-training-partner.md`
- `docs/reports/nudge-concepts/nudge-concept-a-r3.png`
- `docs/reports/nudge-concepts/prior-session-baseline-rez-nudge.png`

The selected direction is **A-r3 — Warm Training Partner**. The earlier Nudge image is
the preferred tonal reference for warmth, ease, and plain-language confidence.

The images are directional references, not mockups to reproduce. Do not copy their exact
geometry, color values, icons, spacing, mobile shell, or invented product assumptions.
The statistical intelligence is the engine, not the visual expression. The result must
feel attentive, prepared, approachable, and calm while remaining a precise workout
instrument.

## Product truth

Use only the screens, labels, values, and states in the canonical A-r3 prompt. In
particular:

- Plan shows a 45-minute budget and only Shoulders and Legs selected as unrecovered.
- Performance shows Bench Press set 2 ready at `100 lb × 8`, with Bench Press resting
  for `0:38`, Row concurrently resting for `0:24`, and Plank showing `2 sets remaining`.
- Review shows `5 of 7 items confirmed`, duration `32:18`, the three supplied
  actual/planned phase values, and the supplied per-exercise confirmation counts.
- History shows the supplied July 26, 2026 workout, Bench Press and Pull Up records,
  recommendation text, timings, and `Load older`.

Do not add readiness scores, causal recovery claims, streaks, calories, heart rate,
achievements, new navigation, a Journal route, coaching commands, or other invented
behavior or content.

## What may change

This is a design translation, not a tracing exercise. You may change presentation markup,
composition, typography, spacing, shape, color, responsive layout, icon treatment, and
visual hierarchy. Keep semantic controls plausible and preserve the locked content and
state relationships.

Prefer a small standalone Vite entry over modifying production flows. Use the existing
React/Vite stack and CSS; add no runtime dependency. The experiment may add only:

- `trek-229-bakeoff.html`
- `src/trek-229-bakeoff.jsx`
- `src/trek-229-bakeoff.css`
- `docs/reports/nudge-translation-bakeoff/run-output/**`

The entry must accept `?screen=plan`, `?screen=performance`, `?screen=review`, and
`?screen=history`. Render one full-size screen at a time, not a scaled contact sheet.

## Required output

Create:

- `run-output/design-context.md` — the visual thesis and key design decisions.
- `run-output/token-proposal.md` — proposed color, type, spacing, radius, border,
  elevation, focus, and motion tokens. Proposals only; do not create root `DESIGN.md`.
- `run-output/handoff.md` — files changed, commands run, elapsed working time if known,
  tool-specific steps used, user questions or approval pauses, defects noticed, and
  remaining caveats.
- `run-output/plan-desktop.png` at 1440 × 900.
- `run-output/performance-mobile.png` at 390 × 844.
- `run-output/review-desktop.png` at 1440 × 900.
- `run-output/history-mobile.png` at 390 × 844.
- `run-output/history-reflow-320.png` at 320 × 844.
- `run-output/focus-visible.png` showing a meaningful keyboard focus state.
- `run-output/evidence.md` recording viewport, state, actions, observed result,
  accessibility checks, and any limitation for every image.

Use synthetic data only. Inspect every screenshot after capture and correct direct visual
defects before stopping. Verify:

- no horizontal scrolling at 320 px;
- readable dense History text;
- at least 44 × 44 px touch targets on mobile;
- obvious ready-set and primary-action hierarchy;
- both concurrent rest states remain distinct;
- focus is visible;
- status does not rely on color alone;
- text and essential controls meet WCAG AA contrast;
- reduced motion preserves meaning;
- fallback fonts do not break the layout.

Run at least `npm run build` and the smallest relevant checks for the files added. Do not
run the full test suite without a concrete failure signal.

## Isolation and stopping rules

- Work only in the assigned worktree and branch.
- Do not inspect another bake-off worktree, prompt, output, or branch.
- Do not update Trekker, commit, push, merge, or edit the coordinator worktree.
- Do not enable hooks.
- Do not modify production app files or install a new runtime dependency.
- Make reasonable design decisions without asking the user unless a skill explicitly
  requires an approval gate. Record every gate and response as process cost.
- Stop after the required output is complete and verified. The coordinator will retain
  the evidence and discard the implementation.

