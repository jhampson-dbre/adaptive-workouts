---
name: ux-quality-gate
description: Protect material UI outcomes with proportional design and rendered evidence. Use when interaction flow, hierarchy, viewport placement, state lifecycle, feedback, recovery, or accessibility is materially affected.
---

# UX Quality Gate

During discovery, classify UI work as `required`, `optional`, or `skip-recorded` and
record a short rationale. Required work keeps an approved scenario artifact covering
the screen's job, action hierarchy, meaningful states, recovery, and accessibility.
Use a fresh ux-design-reviewer before architecture review when that artifact needs
independent design judgment.

After implementation, exercise each materially changed scenario in a rendered surface
with synthetic or de-identified data. Record the build, viewport and starting state,
actions, observed result, rendered evidence, and any material limitation in
`docs/templates/ux-evidence-matrix.md`. Never require sensitive, personal, or
production evidence.

Static inspection may establish a defect but cannot prove usability. A direct
changed-surface defect or missing rendered evidence for a required material scenario
blocks completion. If the preferred harness is unavailable, record the safe method
attempted, the limitation, and the best available alternative; unsupported tooling
alone is not a defect when sufficient alternative evidence exists.

Use a ux-usability-reviewer when the changed interaction needs independent usability
judgment. The reviewer stays within the approved UX scope and does not replace product,
architecture, security, accessibility certification, or Trekker authority. Unchanged
evidence does not trigger another review.

## CI Boundary

The static validator checks required files, model policy, the evidence record fields,
and CI wiring. It does not enforce duplicated workflow prose or invoke agents,
browsers, LLMs, or network tools.
