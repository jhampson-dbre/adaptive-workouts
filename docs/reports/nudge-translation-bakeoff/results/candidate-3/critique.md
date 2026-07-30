---
target: trek-229-bakeoff.html
total_score: 26
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-07-29T13-34-35Z
slug: trek-229-bakeoff-html
invocation: read-only
---
Method: dual-agent (A: /root/critique_design_a · B: /root/trek229_code_review)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Timers and counts are clear; generated, saved, loading, and error transitions are absent. |
| 2 | Match System / Real World | 3 | Training language is strong, but “Unrecovered Muscle Groups” and “preserve” require interpretation. |
| 3 | User Control and Freedom | 2 | Review has a return path; Plan, Performance, and History lack a wider navigation or workout-exit model. |
| 4 | Consistency and Standards | 4 | Ruled planes, action hierarchy, typography, spacing, and status treatments are cohesive. |
| 5 | Error Prevention | 2 | Defaults and constrained controls help, but recovery-selection and incomplete-save consequences are ambiguous. |
| 6 | Recognition Rather Than Recall | 3 | Targets and state remain visible; route relationships and larger app location must be inferred. |
| 7 | Flexibility and Efficiency | 1 | The happy path is concise, but presets, direct time entry, skip/reorder, and expert accelerators are absent. |
| 8 | Aesthetic and Minimalist Design | 4 | The interface is focused, quiet, and free of decorative card clutter. |
| 9 | Error Recovery | 2 | Incomplete work is identified, but its adaptive consequence and other recovery states are not explained. |
| 10 | Help and Documentation | 2 | Useful inline hints exist; recovery and incomplete-save semantics need equivalent contextual help. |
| **Total** |  | **26/40** | **Acceptable, near Good** |

## Design Specificity Verdict

**High functional specificity; medium brand specificity.**

The composition is recognizably Nudge: planning begins with available time and recovery exclusions, Performance centers a ready set and concurrent rest state, and Review and History preserve set-level evidence. The warm paper canvas, ruled sections, rust action color, and tabular numerals create a coherent prepared-training-room character.

The remaining ownability gap is interaction feedback. Another thoughtful strength tracker could reuse much of the same visual system. Nudge’s distinct promise—history adapting today’s session around an irregular life—is present in the data, but only faintly expressed at generation, save, and completion moments.

**Deterministic scan:** `detect.mjs` returned exit code 0 with `[]`: zero findings, zero rules, and no file locations. It found no additional issues and produced no false positives.

**Visual overlays:** Live browser inspection covered Plan, Performance, Review, and History. Mutable injection was blocked by the Browser URL security policy, so no reliable user-visible overlay was created. Browser visibility remained false and console findings were empty.

## Overall Impression

This is a visually disciplined and unusually calm fitness interface. Its strongest moment is the ready-set instrument: the hierarchy matches how a trainee thinks under load. The biggest opportunity is to make Nudge’s adaptive decisions and consequences as legible as its visual hierarchy.

## What’s Working

1. **The product model drives the composition.** Plan foregrounds time and recovery rather than a calendar or split.
2. **Performance scans in the correct order.** Exercise, set state, target, actuals, rationale, and action follow the trainee’s immediate decision sequence.
3. **The responsive foundation is strong.** Mobile controls meet the 44px floor, focus is visible, dense History reflows to 320px, and status does not rely on color alone.

## Cognitive Load

**Moderate: three checklist failures.**

- Plan exposes seven recovery choices at once, exceeding the four-item working-memory guideline.
- Recovery choices and three adjacent actions create a busy decision region even though the action hierarchy remains clear.
- History flattens target, actual, confirmation, rationale, work, planned rest, actual rest, and delta into prose rather than progressively disclosing secondary detail.

Single focus, grouping, visual hierarchy, one-thing-at-a-time sequencing, and in-context workout values all pass.

## Emotional Journey

Entry feels calm, competent, and nonjudgmental because the available time leads. Performance is the peak: it gives the trainee a focused instrument rather than a dashboard. The valley is the simultaneous `ready` state and two rest countdowns, which leave immediate priority ambiguous. Review is the high-stakes moment, but “preserve” reassures against data loss without explaining how incomplete records affect future adaptation. History ends factually rather than closing the loop with what today’s work means for the next irregular session.

## Priority Issues

### P1 — Incomplete-save consequences are unclear

**Why it matters:** The user cannot tell whether unconfirmed work becomes skipped, attempted, incomplete, or evidence for the next recommendation.

**Fix:** State beside “Save workout” exactly what will be recorded and what will or will not influence future plans.

**Suggested command:** `$impeccable clarify`

### P1 — Concurrent timing states do not establish priority

**Why it matters:** Bench Press is both resting and “ready,” while Row has another countdown. The user must infer whether starting early is allowed, recommended, or an override.

**Fix:** Distinguish “available now” from “recommended after rest,” identify the next recommended action, and explain what starting early does to the timer.

**Suggested command:** `$impeccable clarify`

### P2 — Recovery selection is behaviorally inverted

**Why it matters:** A checked “Unrecovered Muscle Group” can be misread as the muscle group the user wants to train, especially when tired or rushed.

**Fix:** Add direct instruction such as “Select anything to avoid today,” then reflect the exclusions near the generated-plan action.

**Suggested command:** `$impeccable clarify`

### P2 — Mobile History is readable but not quickly comparable

**Why it matters:** At 320px, critical confirmation and performance evidence compete with secondary timing details in consecutive wrapped prose.

**Fix:** Use compact labeled rows for target versus actual, and disclose secondary timing detail on demand.

**Suggested command:** `$impeccable layout`

### P2 — The routes lack a visible spatial model

**Why it matters:** Screen headers identify the current view but do not show how to reach Plan, History, or safely leave an active workout.

**Fix:** Introduce the smallest persistent “Today / History” model plus explicit workout exit or skip controls.

**Suggested command:** `$impeccable layout`

## Persona Red Flags

**Alex, impatient power user:** The time slider has no direct-entry or preset path. Performance shows no skip, reorder, repeat, or keyboard accelerator. Utility actions occupy Plan while expert workout controls are absent.

**Sam, accessibility-dependent user:** Native controls, semantic labels, 44px targets, and visible focus are strong. Dynamic timers still need a deliberate announcement strategy; every-second announcements would overwhelm, while silence would hide state. The incomplete/save relationship needs explicit programmatic guidance.

**Morgan, interrupted busy parent:** The focused mobile workout fits one-handed use, but nothing reassures them that active progress, edited actuals, or incomplete review survives app switching or interruption.

**Devin, fatigued shift worker:** Time-first planning fits changing availability. The negative term “Unrecovered” and multiple simultaneous countdowns impose avoidable interpretation when attention is low.

## Minor Observations

- “45 minutes. I’ve got one ready.” conflicts with the still-required “Generate Plan” action.
- Generous desktop Plan spacing may push the primary action below the fold on shorter laptops.
- Review’s warning and save action are spatially separated on desktop.
- The accessible blue focus ring is visually foreign to the otherwise tightly controlled palette.
- Empty History, no eligible workout, invalid numeric entry, connectivity loss, and saved-success states are not represented.

## Questions to Consider

1. Should Nudge celebrate schedule adherence, or explicitly celebrate useful progress made despite today’s constraint?
2. Does the trainee need every active timer, or only the next meaningful choice and why it is recommended?
3. Can “unconfirmed” become user language such as “not completed,” “skipped,” or “save as planned only”?
