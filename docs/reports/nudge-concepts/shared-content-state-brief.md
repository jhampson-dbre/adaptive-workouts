# Nudge concept shared content and state brief

Use this brief unchanged for all three concepts. The concepts may change layout,
typography, color, density, and visual grammar, but not the product behavior, content,
states, or viewport set.

## Product

Nudge is an adaptive strength training partner. It remembers completed work, prepares a
workout from the user's available time and current inputs, explains load
recommendations, times active work and rest, and records the result. It is attentive,
precise, warm without simulated intimacy, and energetic only while the user is
training. Recommendations remain recommendations.

## One contact sheet, four frames

Render one high-resolution 16:9 contact sheet containing four clearly separated,
straight-on web-app frames. Do not use phone or laptop mockup devices.

### 1. Desktop · Plan · 1440 × 900

- Brand: `Nudge`
- Descriptor: `Adaptive strength training partner`
- Primary heading: `Generate Workout`
- Grounded preparation line: `45 minutes. I've got one ready.`
- Time input: `Time Budget (minutes)` with value `45`; range 15–120, step 5
- Group heading: `Unrecovered Muscle Groups`
- Options: Biceps, Shoulders, Back, Chest, Triceps, Core, Legs
- Show Shoulders and Legs selected with checkboxes
- Primary action: `Generate Plan`
- Secondary shell actions: `Manage Catalog` and `Sign out`

### 2. Mobile · Performance · 390 × 844

- Brand: `Nudge`
- Phase heading: `Performance`
- State label: `Active Workout`
- Total elapsed: `12:40`
- Help: `Start a ready set. Only one work timer can run at a time.`
- Expanded exercise: `Bench Press` · `Chest` · `1/3` · `rest 0:38 remaining`
- Ready row: `Set 2: ready`
- Target: `100 lb × 8`
- Inputs: `Actual weight` = `100`; `Actual reps` = `8`
- Explanation: `Held at 100 lb: prior set met the floor.`
- Primary action: `Start set`
- Collapsed exercise: `Row` · `Back` · `1/3` · `rest 0:24 remaining`
- Collapsed exercise: `Plank` · `Core` · `0/2` · `2 sets remaining`
- Secondary completion action: `Finish Workout`
- Make both concurrent rest states clear without implying the user must wait.

### 3. Desktop · Review · 1440 × 900

- Brand: `Nudge`
- Primary heading: `Review`
- Summary: `5 of 7 items confirmed`
- `Duration: 32:18`
- `Warmup: 4:58 actual / 5:00 planned`
- `Performance: 24:22 actual / 25:00 planned`
- `Cooldown: 2:58 actual / 3:00 planned`
- `Bench Press: 2 of 3 sets confirmed`
- `Pull Up: 2 of 2 sets confirmed`
- `Plank: 1 of 2 sets confirmed`
- Notice: `Some planned work remains unconfirmed. Saving will preserve those unconfirmed records.`
- Secondary action: `Back to workout`
- Primary action: `Save workout`

### 4. Mobile · History · 390 × 844

- Brand: `Nudge`
- Expanded disclosure: `Workout history`
- Entry heading: `July 26, 2026`
- `Duration: 32:18`
- `Warmup: Planned 5:00 · Actual 4:58`
- `Performance: Planned 25:00 · Actual 24:22`
- `Cooldown: Planned 3:00 · Actual 2:58`
- Exercise: `Bench Press` · `3 sets · weighted`
- Set 1: `Target: 100 lb × 8 reps · Actual: 100 lb × 8 reps · Confirmed`
- Explanation: `Held at 100 lb: prior top set was below its target.`
- Timing: `Work: 0:36 · Planned rest: 1:00 · Actual rest: 1:08 · +0:08`
- Exercise: `Pull Up` · `2 sets · bodyweight`
- Set 1: `Target: 8 reps · Full: 5 · Assisted: 2 · Eccentric: 1 · Total: 8 · Confirmed`
- Pagination action: `Load older`

## Shared constraints

- Preserve one obvious primary action and state hierarchy in each frame.
- Treat numbers, timers, targets, recommendations, and phase comparisons as primary
  interface material.
- Use upright, disciplined typography and tabular numerals where useful.
- Keep all text legible and controls plausible; this is a usable responsive web app, not
  a mood board.
- At mobile width, avoid horizontal scrolling and preserve at least 44 × 44 px targets.
- Show visible keyboard focus, strong contrast, and non-color status cues in at least one
  frame. Meaning must survive reduced motion.
- Use warm paper, graphite, ink, or oxidized-metal influence only when it serves the
  chosen concept.
- Do not add readiness scores, streaks, calories, heart rate, recovery claims,
  achievements, charts without real data, new navigation, a Journal route, or coaching
  commands.
- Avoid generic gradients, glass panels, neon dashboards, decorative metrics,
  bodybuilding motifs, racing italics, excessive cards, guilt, hype, fake urgency, and
  simulated intimacy.
- Favor a small coherent system over a component catalog.
