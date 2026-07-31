# TREK-229 Nudge translation bake-off comparison

Date: 2026-07-29

## Candidate mapping

- Candidate 1: vanilla Codex
- Candidate 2: frontend-design
- Candidate 3: Impeccable

The first assessment used neutral candidate labels and inspected the rendered
screens before reading the process handoffs.

## User decision

Candidate 3 (Impeccable) is the bake-off winner.

This selection closes the experiment only. The collected output remains historical
evidence and is not a visual contract, token source, mockup reference, or required
starting point for production design. No third-party tool, hook, generated product
context, or experimental implementation is retained.

The production redesign starts fresh. Future EPIC-13 work may choose any visual and
interaction direction that stays inside the existing product boundary: presentation
may change, but the work must not add product features, gamification, routes,
navigation, stored data, coaching logic, readiness claims, or other unsupported
behavior.

## Evaluator recommendation before user selection

Carry Candidate 1 forward as the basis of the Nudge interface system.

Candidate 1 best translates the approved A-r3 direction into an interface
grammar rather than merely recoloring the current application. Its warm clay
field, charcoal type, terracotta action color, ruled comparisons, and
room-like desktop compositions feel approachable without becoming cute or
decorative. Performance shifts into a focused workbench while Review and
History remain calm, legible records. It also preserves the clearest
simultaneous Bench Press and Row rest states and the strongest 320 px History
reflow.

## Comparative assessment

| Criterion | Candidate 1 — vanilla | Candidate 2 — frontend-design | Candidate 3 — Impeccable |
| --- | --- | --- | --- |
| Nudge fit | Strongest. Warm, plainspoken, competent, and visibly distinct from the current UI. | Polished and approachable, but plum actions, large rounded cards, pills, shadows, and the History rail feel more like a contemporary design-system treatment than a specific Nudge voice. | Calm and disciplined, but too restrained and sparse to establish a distinctive Nudge system. |
| Plan | The time-first editorial composition makes the product promise immediately legible. | Strong hierarchy and useful controls, but the large paper card and pill controls add generic visual mannerisms. | Clear and usable, but conventional and under-scaled on desktop. |
| Performance | Best focused mode shift and ready-set hierarchy. Bench and Row rest states remain separately visible without competing with Start set. | Highly polished, but the dark plum header and connected-card treatment feel less warm and plainspoken. | Competent hierarchy, but it reads as a refined version of the existing interface rather than a new expression. |
| Review | Strongest calm reflection state: phase comparison, confirmation status, warning, and actions scan as one coherent plane. | Visually strong but louder; the oversized completion headline and highlighted phase risk over-celebrating a partly confirmed workout. | Clear and disciplined, but less memorable and lower in visual hierarchy. |
| History and 320 px reflow | Best structured record and narrow reflow. Target, actual, confirmation, recommendation, and timing stay readable. | Readable, but the decorative rail consumes narrow-screen space and implies a sequence or relationship not required by the product. | Readable but typographically flat; important evidence is harder to compare quickly. |
| Accessibility evidence | Visible focus, non-color status, measured targets, reduced-motion handling, no overflow, and independent rendered review approval. | Strongest quantified contrast evidence and compliant target sizing; no direct blocker found. | Compliant targets, focus, contrast, and reflow evidence; advisory lint warnings only. |
| Scope discipline | Stayed inside the locked screens and product truth. | Stayed inside the locked screens and product truth. | The implemented candidate stayed in scope, but the added critique reopened locked navigation and product-behavior questions and suggested unsupported controls. |
| Process overhead | No skill installation; used the repository's existing UX gates and produced the required artifacts. | The skill contributed a coherent thesis and token proposal without changing product scope. | Added an unrequested root `PRODUCT.md`, an unapproved hooks file, and a broad critique whose strongest findings were outside this visual-translation task. |

## Carry-forward disposition

Do not extract tokens, visual principles, component patterns, or layout rules from any
candidate. Preserve only the collected bake-off evidence and this decision record.
Production design must not be prompted with the concept images, candidate screenshots,
candidate token proposals, or bake-off rationales unless the user later asks for them.

## Independent usability review

The fresh usability reviewer preferred Candidate 2's visual treatment, but
returned `blocked` for carrying it forward as-is:

- Candidate 2 and Candidate 3 depict collapsed Row and Plank entries without
  operable controls or expansion semantics. Candidate 1 uses full-row buttons
  with `aria-expanded` and visible affordances.
- Candidate 2 gives Performance an unsupported selected/current emphasis on
  Review. Candidate 1 has a related, smaller unsupported filled phase dot in
  History.
- Candidate 1 compresses History timing metadata to 11 px at mobile widths.

These findings informed the comparison but are not production requirements because no
candidate implementation or visual system will be carried forward.

## Verification

- All three candidates independently passed `npm run build`.
- All three candidate JSX entries passed `npx oxlint`; Candidate 3 emitted six
  Fast Refresh advisory warnings because its standalone entry defines local
  components.
- Each candidate supplied the six required rendered scenarios: desktop Plan,
  mobile Performance, desktop Review, mobile History, 320 px History reflow,
  and a meaningful keyboard-focus state.
- Candidate evidence is retained under `results/candidate-1`,
  `results/candidate-2`, and `results/candidate-3`.

## Decision status

Complete. Candidate 3 was selected by the user on 2026-07-29. The evidence is retained;
the production redesign will start without explicit concept or bake-off references.
