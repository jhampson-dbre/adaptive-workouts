# Design context

## Classification

**Required.** This disposable translation materially changes hierarchy, layout,
responsive behavior, focus presentation, and dense-data treatment across Plan,
Performance, Review, and History.

## Visual thesis

Nudge feels like a capable training partner has prepared one continuous training table:
choices, effort, and remembered context rest along a shared structural rail instead of
being broken into a dashboard of cards. A warm field and open typography make the
experience approachable; deep plum and muted apricot add energy without generic
fitness-app orange. Performance tightens the same grammar into a connected session stack.

## Design plan

- **Color:** Canvas `#F7F0E6`, Paper `#FFFAF3`, Ink `#2D2628`, Plum `#633D57`,
  Apricot `#D96843`, Rule `#D9C9BB`.
- **Type:** Trebuchet MS for open, characterful display text; Aptos / Segoe UI Variable
  for reading; tabular numerals for timings and loads.
- **Layout:** one prepared surface on desktop; one connected effort stack on mobile;
  one comparison rail for Review; one memory line for History.
- **Signature:** the continuous partner rail, which places related choices and status
  on one surface and keeps explanations immediately beside the value they support.

```text
PLAN DESKTOP                         PERFORMANCE MOBILE
brand                               dark energy field
┌──────────── training table ────┐  ┌──── active context ────┐
│ welcome │ time + muscle choice │  └──┬─────────────────────┘
│         │                       │  ┌──┴ connected exercise ─┐
├───────── actions ───────────────┤  │ ready / inputs / action│
└─────────────────────────────────┘  ├────────────────────────┤
                                     │ concurrent rest states │
REVIEW DESKTOP                       └────────────────────────┘
actual/planned comparison rail       HISTORY MOBILE
confirmations │ honest save context  continuous memory line
```

## Self-critique before build

The initial warm direction risked becoming the familiar cream-canvas card stack. That
was rejected. The revised design uses continuous ruled surfaces, proximity, and one
shared rail; cards appear only where the active mobile exercise requires a bounded
operational target. Literal phase illustrations and rainbow exercise coding were also
removed because they add decoration rather than product meaning.

## Approved scenario artifact

| Screen | Job | Primary hierarchy | Meaningful states | Recovery / secondary path | Accessibility |
| --- | --- | --- | --- | --- | --- |
| Plan | Choose the workout inputs | 45-minute choice, selected groups, Generate Plan | Shoulders and Legs selected | Manage Catalog; Sign out | Native range and checkboxes, visible focus, large controls |
| Performance | Start the ready set without losing concurrent timing context | Ready set, target, Start set | Bench and Row resting independently; Plank remaining | Finish Workout | 44 px controls, text labels plus color, reduced-motion-safe |
| Review | Inspect what was confirmed before saving | Phase comparisons, confirmation counts, Save workout | Complete and partial items | Back to workout; preservation warning | Symbol plus text status, strong focus and contrast |
| History | Read remembered workout context | Date, phase timing, exercise records | Confirmed records and rest delta | Load older | Reflow at 320 px, readable text, no horizontal scrolling |
