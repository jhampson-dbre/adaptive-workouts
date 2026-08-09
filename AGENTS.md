# Agent Instructions

Trekker is the durable source of task state, planning, and handoff notes. The main session owns user communication, Trekker, integration, and final verification.

In Code Mode, within each bounded stage, run independent, functions.exec-available tool calls concurrently in one `functions.exec` call. Use `await Promise.allSettled([...])` when partial results are useful, and inspect every result; use `await Promise.all([...])` only when any failure should abort the batch. Keep dependencies, waits/resumes, approvals, conflicting or interdependent mutations, and adaptive investigations where each result may change the next step sequential. Do not split otherwise batchable inspections across outer tool calls.

## Proportionality and anti-circularity

Existing workflow text is migration input, not an acceptance criterion. Keep or block on a rule or reviewer finding only when it protects a named safety, authority, evidence, or outcome risk. Prefer the smallest sufficient workflow; unchanged evidence must not trigger another loop.
Use `$maintain-agent-workflows` for changes to agent prompts, roles, skills, workflow gates, validators, or review routing.

## Global boundaries

- Preserve security, data isolation, data-loss prevention, production configuration, and unrelated user changes. Never expose or alter secrets.
- The coordinator alone updates Trekker, commits, pushes, merges, deploys, and closes work. Subagents report suggested comments only.
- Work on a focused `codex/` branch and inspect `git status --short --branch` before edits and handoff. Do not revert user work or broaden scope silently.
- A dispatch packet names the task, goal, accepted scope, files, dirty-worktree notes, verification, and expected output. TOMLs contain the executable role contract; role docs provide conditional detail when a named risk applies.
- Stop and escalate a material product, architecture, data, auth, migration, scope, or unverifiable-behavior change. Do not loop solely because evidence is unchanged.

## Dispatch and evidence

- Conformance and final-integration reviewers receive one current, non-conflicting statement of approved intent. Before dispatch, reconcile later user-approved decisions into Trekker and identify superseded statements.
- Unexplained verification failures that pass on replay still receive durable recurrence handling before task closure: search Trekker for the same failure signature or behavior; if absent, comment on the current task as the first occurrence with the failure and replay evidence; if already recorded, create or extend a reliability task for deterministic reproduction and same-cause inspection. Include the failure in a reviewer packet only when it affects that reviewer's named risk or evidence.
- Each tracked behavior-change task starts with one fresh implementor. Reuse that implementor for same-task continuations, including review fixes; replace it only when unavailable, unable to continue, or unwilling. Never reuse an implementor across Trekker task boundaries. Reproduce bugs, identify the root cause, and inspect plausible same-cause callers before editing; use `$bugfix-issue-class-audit` only when that inspection reveals material scope ambiguity.
- Before dispatching the two `$impeccable critique` assessment subagents for authenticated app UI, the main session starts seeded review leases in fixed slots 1 and 2 with `npm run ux:private-access -- start --slot N --scenario UX-10-XX --viewport WIDTHxHEIGHT`, verifies both returned URLs, and gives each subagent only its assigned slot, session, URL, and scenario controls. If either lease or URL fails, dispatch neither and stop every acquired lease. Subagents use fresh browser tabs and produce critique evidence but do not start, reconfigure, or stop Firebase or Vite. The main session owns both leases through a finally-style cleanup that attempts both stops independently.
- Behavior changes use focused TDD: demonstrate the expected failing test, make the smallest passing change by reusing existing or native mechanisms, then run proportionate verification.
- Before final integration, run one bounded `$ponytail-review` proposal pass when a stabilized green in-scope diff adds or materially reshapes control or data flow, state, side effects, boundaries, reusable machinery, dependencies, or configuration, or otherwise requires tracing beyond the local edit to understand its design. Skip locally obvious leaf edits that introduce no new mechanism, even when they change executable code; when uncertain, run the pass. The coordinator rejects irrelevant or out-of-scope proposals and may authorize one bounded candidate for investigation, naming the candidate, files, constraints, and green evidence. Proposals are not edit authority. One pass applies per stabilized evidence set; later deltas retrigger only when independently eligible, and unchanged evidence never retriggers it. The coordinator runs proportionate verification and review routing only for an actual changed diff.
- Required UI is classified during discovery and preserves its approved UX artifact. Exercise each materially changed scenario in a rendered surface using synthetic or de-identified data and pass the task-scoped evidence directly to applicable reviewers. A direct changed-surface defect or missing required rendered evidence blocks; unavailable tooling gets a concise limitation and the best safe alternative.
- Planning starts from an approved Discovery Brief (or documented exception) and
  reuses current duplicate evidence. Invoke design, UX, or senior review only for a
  named material risk. Persist approved intent when it has durable value.
  Implementation may continue when the user's authorization already covers the
  approved scope; otherwise leave a resumable plan and ask once.
- Classify UI work as `required`, `optional`, or `skip-recorded`. Required work keeps a proportional scenario artifact and uses a fresh ux-design-reviewer before architecture review when independent design judgment is needed. Architecture retains authority; material architecture changes to the approved UX contract return through UX review before user approval.
- Substantive behavior or risk changes receive independent code and task-conformance review. Mechanical or straightforward low-risk changes may use coordinator verification with a recorded rationale. Coordinators may close objective bookkeeping or factual/provenance corrections through verification when they leave the reviewed artifact, behavior, approved intent, material evidence, authority boundary, verification, release risk, and substantive review conclusion unchanged. After a review fix, route only the delta and affected evidence to the authority whose concern changed; rerun both reviews only for a named material invalidator.
- Before PR publication or epic completion, run independent cumulative epic and conformance reviews of the merge-base range and complete working-tree state, except an unchanged, clean single-task branch may reuse its accepted task-completion evidence under the epic-completion workflow. Otherwise, including multi-task or materially invalidated branches, use cumulative gates. After additive remediation, use the epic-completion workflow's Git-delta routing; rerun both gates only for a recorded material invalidator.
- For implementation branch or epic work, use the draft-PR handoff unless the user explicitly opts out: after those reviews, push, open the draft PR, and confirm required checks are visible and passing or documented with exact next steps.

## Roles

Use the project role contracts in `docs/agents/` and corresponding `.codex/agents/*.toml`: architecture-design-reviewer, feature-planner-advisor, senior-developer-reviewer, implementor, code-simplifier, code-reviewer, spec-reviewer, epic-reviewer, ux-design-reviewer, and ux-usability-reviewer. Keep model and reasoning assignments unchanged. Reviewers are read-only unless the coordinator expressly authorizes a patch.

## Workflow feedback

Report workflow ambiguity, missing context, or repeated rework as `Workflow feedback:`. The coordinator validates it; durable improvements belong under `EPIC-6: Agent Workflow Improvements`. Do not create tracking records without coordinator authority.

## Project commands

- Install: `npm install`
- Tests: `npm test -- --run`
- Build: `npm run build`
- Lint: `npm run lint`
- Firebase rules: `npm run ci:rules`
