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

During planning, apply `AGENTS.md`'s approval-and-recording invariant to a proportional
set of blind user journeys. Write each scenario and goal from the perspective of a
trainee using the app as part of their training: state the relevant training context,
constraints, and desired training outcome. A scenario may prescribe a safe starting
condition, but must not prescribe an interface route, control sequence, expected
implementation, product walkthrough, or acceptance criteria. The reviewer decides how
to pursue the trainee's goal.

When an approved journey requires nontrivial preconditions, record its intended
starting boundary and whether pre-boundary setup is part of the named UX risk. If setup
is outside that risk, the coordinator owns staging and verifies the exact starting state
before dispatch using supported product or harness controls. The reviewer begins from
that state and does not recreate or assess the excluded setup. Do not stage past an
interaction whose usability is in scope. If the exact state cannot be delivered to the
reviewer's fresh context, treat that as a start-state capability gap rather than asking
the reviewer to approximate it.

## Pre-approval shaping

Before the coordinator first presents a material user-visible interaction recommendation
for approval, apply one bounded `$impeccable shape` advisory to the unresolved decision
or closely related decision cluster. Cover the person's context, flow and action
hierarchy, applied/draft/loading/success/failure/cancel states, placement and responsive
behavior, feedback, focus and announcements, recovery, accessibility, reversibility,
user agency, and the simplest sufficient non-goals. This applies during discovery and
planning, when resolving a UX-review finding, and when later evidence requires a
material change to approved UX.

Before first presenting coordinator-authored new or meaningfully revised in-app copy,
apply one bounded `$impeccable clarify` advisory to the interaction path and its
meaningful variants. This includes headings, explanations, helper text, labels,
loading/success/status messages, errors, empty states, recovery, confirmations,
consequences, accessible names, and announced state changes. Check ambiguous nouns and
verbs, actionability, message hierarchy, product terminology and voice, factual meaning,
emotional context, recovery, localization and realistic widths, dynamic values, and
singular, plural, or combination variants.

Reuse settled decisions, relevant repository behavior, `PRODUCT.md`, `DESIGN.md`, and
the surface context. Ask the user only when this exposes a genuinely unresolved product,
factual, legal, or domain decision. When interaction and copy are coupled, apply both
advisories in the same decision cycle and present one synthesized recommendation. Fold
the result into the existing Discovery Brief, Decision Log, scenario artifact,
reviewer-finding resolution, or concise recommendation; do not create a separate
Impeccable or copy artifact.

Skip interaction shaping for optional, skip-recorded, or genuinely mechanical UI work
with no material interaction choice. Skip copy clarification for exact user-provided or
already-approved wording, mechanical substitution within an approved template,
internal or developer-facing text, and corrections with no meaning change. Batch related
decisions and repeat an advisory only when new evidence creates a new material decision;
unchanged evidence does not rerun it.

These advisories are coordinator-owned design methods, not reviewers, approval
authorities, mandatory subagents, or additional gates. The ux-design-reviewer retains
independent UX judgment, the feature-planner-advisor retains plan and task-structure
responsibility, architecture retains system-boundary authority, and the user retains
approval of material product, UX, factual, and product-language decisions.

After implementation, exercise each materially changed scenario in a rendered surface
with synthetic or de-identified data. Give applicable changed-surface reviewers a
task-scoped evidence packet containing the build, viewport and starting state, actions,
observed result, artifact links when useful, and any material limitation. Summarize the
result, viewport, useful artifacts, and material limitations in the Trekker Summary or
PR. Use a task-specific evidence report only when scenario complexity or capability
gaps justify it; never require sensitive, personal, or production evidence.

For required core-journey UI whose outcome depends on context across screens, phases,
time, or physical usage, review the approved proportional journey set once per
stabilized combined evidence set. One journey may cover a cohesive changed surface;
use additional journeys only when materially distinct training goals, surfaces, states,
or UX-friction risks require independent observation. Keep the final task represented
by a shared journey in progress until this review is ready; earlier tasks may complete.

Dispatch a fresh ux-usability-reviewer with only the approved trainee goal and training
context, final build and starting state, and safe scenario controls. Keep the goal as
the trainee's desired training outcome or a question they need the product to answer,
not as a route, control operation, expected interpretation, or request to identify
interface elements.
When the feature's value is informational, let the reviewer choose one or two concrete
questions that matter in the supplied context before opening the feature, then report
the conclusions it can support, its confidence and evidence limits, and any friction in
getting there. An inability to answer is valid product evidence. Do not initially
provide task descriptions, acceptance criteria, approved artifacts, diffs, collected
evidence, captioned screenshots, expected labels or layout, observed-result narratives,
or implementation rationale. The reviewer traverses the final build live from before
the changed action through the next meaningful boundary, using the whole viewport and,
where realistic, proceeding without optional cleanup. If the reviewer cannot control
the live final build, the journey review is blocked. Screenshots, recordings, narrated
transitions, and previously collected evidence belong to changed-surface review and do
not substitute for an independent journey.

If new evidence reveals another materially affected surface or a previously
unrepresented scenario with high UX-friction risk, the coordinator may propose an
additional trainee journey. Obtain user approval and update the durable record before
dispatching it. Unchanged evidence does not trigger additional journeys.

After the reviewer records its independent findings, disclose approved intent or
changed-surface evidence only when needed to reconcile coverage or scope. Matching the
artifact does not erase an observed usability defect. A material claim about physical
usage needs representative evidence or a safe proxy; viewport fit alone does not prove
contextual legibility. Missing evidence for the named risk blocks. Related tasks on one
branch may share this journey and one remediation batch. Route defects caused by the
approved artifact back for design reconsideration; the reviewer does not redesign it.
Unchanged evidence does not trigger another review.

After reconciliation, the coordinator owns readiness and disposition. A defect caused
by or directly affecting the branch's changed area blocks and returns to its owning
task. A defect in approved intent blocks for product or design reconsideration unless
the proper authority explicitly defers it. Pre-existing friction does not silently
expand the branch: track it separately, and block only when it prevents, makes unsafe,
or materially invalidates the reviewed goal, or the branch worsens it. Repair an
environment or start-state problem immediately and repeat only the affected observation
when it blocks the named journey risk; otherwise treat it as an evidence limitation,
not a product defect. A missing observation blocks only when it covers the named
material risk. Severity sets priority, not scope.

Log each environment or start-state occurrence on the current Trekker task with a
stable issue-class label, observed state and effect, review lease or build context, and
immediate repair. Search Trekker for that label and adjacent terms. On the second
distinct occurrence, search EPIC-6 for a duplicate, then create or extend one workflow
improvement task linking the encounters and owning durable resolution; this follow-up
does not replace immediate repair. Do not create a new task for a lone occurrence.

When a changed interaction opens a browser-owned dialog, an active-dialog click
timeout is incomplete changed-surface evidence, not an unavailable-tooling
limitation; automation must handle the dialog concurrently with its trigger and
observe the expected terminal state before completion.

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

The static validator checks required files, model policy, registration, and CI wiring.
It does not enforce duplicated workflow prose or invoke agents, browsers, LLMs, or
network tools.
