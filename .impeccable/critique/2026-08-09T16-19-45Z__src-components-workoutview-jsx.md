---
target: superset inclusion in the Plan exercise list
total_score: 31
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
timestamp: 2026-08-09T16-19-45Z
slug: src-components-workoutview-jsx
---
Method: dual-agent (A: /root/superset_critique_design · B: /root/superset_critique_evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 3 | Expand/collapse and remaining-set states are explicit. |
| 2 | Match System / Real World | 4 | Superset, positions, exercise names, and planned sets match training language. |
| 3 | User Control and Freedom | 3 | Group ordering is reversible through Earlier/Later and Back to Plan remains available. |
| 4 | Consistency and Standards | 3 | Strong visual consistency; collapsed aria-controls currently references an absent node. |
| 5 | Error Prevention | 4 | Boundary actions disable and the superset moves as one unit. |
| 6 | Recognition Rather Than Recall | 4 | Membership, range, set count, and disclosure state remain visible. |
| 7 | Flexibility and Efficiency | 3 | Collapsing and whole-group movement support quick planning. |
| 8 | Aesthetic and Minimalist Design | 3 | Collapsed state is economical; expanded state repeats some context. |
| 9 | Error Recovery | 2 | Reordering is reversible, but visible undo is absent in the captured state. |
| 10 | Help and Documentation | 2 | Grouping is understandable, though visible copy does not explicitly say the pair moves together. |
| **Total** | | **31/40** | **Good** |

## Design Specificity Verdict

The result feels authored for this product rather than category-interchangeable. The two-digit exercise sequence, condensed typography, hard-edged sign planes, restrained yellow superset identifier, and grouped ordering controls extend the incumbent Clear Signal language. The collapsed 03–04 number rail is the strongest choice: it preserves sequence while making two positions read as one movable unit. Expanded mode correctly returns 03 and 04 to their member rows.

The deterministic detector returned zero stylistic findings. Live browser evidence confirmed the collapsed and expanded layouts fit at 320px without horizontal overflow, keep 44px action targets, preserve focus on disclosure, and expose native disclosure/group semantics. The browser/source pass found one semantic issue the design assessment could not see: collapsed aria-controls points to a conditionally absent member list.

## What Works

- The collapsed vertical endpoint rail fixes the original numbering discontinuity and aligns with solo exercise gutters.
- Earlier/Later remains in the same right action rail as ordinary exercises and convincingly applies to the whole group.
- The collapsed summary exposes both names, exercise count, planned sets, and disclosure state without competing with Start Workout.
- Expanded members regain ordinary 03 and 04 numbering, so the mental model stays stable.
- At 320px, the collapsed block is 304.7px wide in a 305px document; the expanded block is also 304.7px with no horizontal overflow. Earlier/Later targets are 44px high.

## Priority Issues

### [P2] Collapsed aria-controls references an absent element

The disclosure keeps aria-controls while the controlled member list is conditionally removed from the DOM. Browser evidence confirmed aria-expanded=false and controlledTargetExists=false. Keep the controlled list mounted and hidden, or omit aria-controls while collapsed, so the IDREF remains valid.

### [P2] Expanded mode has substantial repeated context

The parent repeats both names and set totals, then each member repeats its name, remaining sets, disclosure state, and a standalone Superset N of 2 line. At 320px the expanded group is 441.3px tall, pushing later exercises well below the fold. This is understandable but administratively heavy. If refined later, compress or remove the standalone member-position lines in the planning view rather than redesigning the parent.

### [P2] Disclosure is visually quiet

Expand and Collapse appear at the end of the metadata sentence. The whole left panel is a correct native button, but a first-time scanner may initially read it as information rather than disclosure. A compact directional cue or slightly stronger disclosure treatment would improve recognition without competing with Earlier/Later.

### [P3] Expanded and collapsed headers shift alignment grammar

Collapsed mode uses the number rail and an indented summary; expanded mode removes the rail and moves compact SUPERSET · 03–04 metadata to the left edge. The state remains clear, but the jump feels like a small layout replacement. This is optional polish, not a ship blocker.

## Cognitive Load

Low. No local decision point exceeds four controls. Grouping, hierarchy, progressive disclosure, and working-memory demands are sound. Expanded mode is the only weak spot because repeated membership information creates several similarly weighted strata.

## Emotional Journey

Start Workout remains the peak action. The collapsed group turns a more complex training structure into one confident, understandable unit. Expansion is the only valley because it substantially lengthens the planning list, but it remains calm and factual rather than confusing.

## Persona Red Flags

- Jordan, first-timer: may not immediately recognize the summary as expandable or know that Earlier/Later moves both exercises.
- Casey, distracted mobile user: touch targets and grouping are strong; the 441px expanded block pushes later exercises far below the fold.
- Sam, accessibility-dependent user: native buttons, aria-expanded, descriptive labels, disabled states, and focus retention are strong; the broken collapsed aria-controls association should be corrected.

## Minor Observations

- Bench Press and Pull-Up is a better title than a generic Superset 1 because it keeps recognition immediate.
- The collapsed group saves more conceptual complexity than physical height; that is still the right tradeoff.
- The small rule between 03 and 04 can briefly resemble a fraction, but the adjacent yellow Superset label resolves it.
- Preserve the fixed right action rail during any future polish.

## Provocative Questions

- Could expanded mode show only information that was unavailable while collapsed?
- Is the standalone Superset 1 of 2 / 2 of 2 copy helping planning actions, or only restating the parent?
- Would a subtle directional cue improve disclosure recognition without adding visual noise?
- Does visible whole-group movement need clarification, or is button placement enough after one use?
