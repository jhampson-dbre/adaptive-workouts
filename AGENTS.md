# Agent Instructions

Trekker is the durable source of task state, planning, and handoff notes. The main session owns user communication, Trekker, integration, and final verification.

In Code Mode, within each bounded stage, run independent, functions.exec-available tool calls concurrently in one `functions.exec` call. Use `await Promise.allSettled([...])` when partial results are useful, and inspect every result; use `await Promise.all([...])` only when any failure should abort the batch. Keep dependencies, waits/resumes, approvals, conflicting or interdependent mutations, and adaptive investigations where each result may change the next step sequential. Do not split otherwise batchable inspections across outer tool calls.

## Proportionality and anti-circularity

Existing workflow text is migration input, not an acceptance criterion. Keep or block on a rule or reviewer finding only when it protects a named safety, authority, evidence, or outcome risk. Prefer the smallest sufficient workflow; unchanged evidence must not trigger another loop.

## Global boundaries

- Preserve security, data isolation, data-loss prevention, production configuration, and unrelated user changes. Never expose or alter secrets.
- The coordinator alone updates Trekker, commits, pushes, merges, deploys, and closes work. Subagents report suggested comments only.
- Work on a focused `codex/` branch and inspect `git status --short --branch` before edits and handoff. Do not revert user work or broaden scope silently.
- A dispatch packet names the task, goal, accepted scope, files, dirty-worktree notes, verification, and expected output. TOMLs contain the executable role contract; role docs provide conditional detail when a named risk applies.
- Stop and escalate a material product, architecture, data, auth, migration, scope, or unverifiable-behavior change. Do not loop solely because evidence is unchanged.

## Dispatch and evidence

- Every tracked behavior change uses a fresh implementor. Before non-mechanical/user-facing bug implementation, reproduce, identify root cause, perform the issue-class audit, and record its scope and regression matrix.
- Behavior changes use focused TDD: demonstrate the expected failing test, make the smallest passing change, then run proportionate verification.
- After a non-trivial green diff, the coordinator runs `$code-simplification` for the current-session task files. A no-edit result is valid; simplifier edits require final verification and fresh code plus task-conformance review. Documentation/copy-only or tiny mechanical configuration work may record a skip rationale.
- Required UI is classified during discovery and preserves its approved UX artifact. The coordinator records per-run bounded capability probes and rendered evidence in `docs/templates/ux-evidence-matrix.md`; missing prescribed rendered evidence requires a resumable `Checkpoint:`. Direct changed-surface usability defects block; unsupported harnesses need complete metadata, fallback, and evidence obligation.
- Planning requires an approved Discovery Brief (or documented exception), duplicate search, appropriate design/UX review, user approval, and senior-developer conformance before Trekker creation. Task 1 persists the approved spec; implementation waits for fresh authorization.
- Classify UI work as `required`, `optional`, or `skip-recorded`. Required work uses a fresh ux-design-reviewer before architecture-design-reviewer; architecture retains authority, and material architecture changes that alter the approved UX contract return through UX design review before user approval.
- Required UI has per-run bounded capability probes. Missing prescribed rendered evidence blocks and requires a resumable `Checkpoint:`; direct changed-surface usability finding blocks, while unsupported-by-harness is nonblocking only with complete metadata, fallback, and evidence obligation.
- Before PR publication or epic completion, run independent cumulative epic and conformance reviews of the merge-base range and complete working-tree state. After additive remediation, use the epic-completion workflow's Git-delta routing; rerun both gates only for a recorded material invalidator.

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
