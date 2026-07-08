# Agent Instructions

This repository is optimized for task-tracked AI agent work. Treat Trekker as the source of truth for planning, task state, and handoff notes.

## Coordination Model

The main agent session owns coordination. It may dispatch specialized subagents, but it remains responsible for Trekker state, final integration, verification, and user communication.

Use the role contracts in `docs/agents/`:

- `docs/agents/main-coordinator.md`: main session responsibilities
- `docs/agents/feature-planner.md`: main-session protocol for new feature brainstorming, design, and Trekker planning
- `docs/agents/architecture-design-reviewer.md`: design-spec architecture and product-fit review
- `docs/agents/senior-developer-reviewer.md`: implementation-plan sequencing, TDD, and execution-risk review
- `docs/agents/implementor.md`: TDD implementation work
- `docs/agents/spec-reviewer.md`: acceptance criteria and spec fit
- `docs/agents/code-reviewer.md`: focused bug/regression review
- `docs/agents/epic-reviewer.md`: full epic or branch review before merge

Native Codex custom agents live in `.codex/agents/`:

- `.codex/agents/implementor.toml`
- `.codex/agents/spec-reviewer.toml`
- `.codex/agents/code-reviewer.toml`
- `.codex/agents/epic-reviewer.toml`
- `.codex/agents/feature-planner-advisor.toml`
- `.codex/agents/architecture-design-reviewer.toml`
- `.codex/agents/senior-developer-reviewer.toml`

The Markdown files are the human-readable role contracts. The TOML files are the project-scoped Codex agents that can be spawned. Keep both in sync when changing role behavior.

Subagents may recommend Trekker comments, but only the main agent updates Trekker status or closes tasks.

Prefer lightweight models for simple or moderate tasks, spec review, and code review. Use a stronger model for high-risk architecture, auth/storage/deployment changes, and full epic or pre-merge review. If an exact model named in the role docs is not available, use the nearest available model tier.

## Workflow Self-Improvement

Treat workflow and agent-instruction friction as product feedback for the development process.

Durable workflow-improvement follow-up tasks belong under `EPIC-6: Agent Workflow Improvements`.

Agents should report self-improvement feedback when instructions are ambiguous, conflicting, missing required context, too broad to execute reliably, inconsistent across files, or causing repeated rework.

Use this format in subagent reports when relevant:

```text
Workflow feedback:
- Issue:
- Impact:
- Suggested change:
- Scope: AGENTS.md | docs/agent-workflow.md | docs/feature-planning.md | docs/agents/<role>.md | .codex/agents/<role>.toml | Trekker template
- Urgency: now | next cleanup | backlog
```

The main coordinator must validate workflow feedback before acting on it. Small clarifications may be included in the current branch when they directly affect the active work. Larger process changes should become a Trekker task under `EPIC-6`, linked back to the task, epic, PR, or planning session where the friction was found.

Use one standing epic instead of separate planning and execution epics. Workflow problems often cross planning, execution, review, and Trekker handoff boundaries, so `EPIC-6` is the single backlog for process improvements.

Use this task-title pattern under `EPIC-6`:

```text
[Planning] Clarify design review handoff requirements
[Execution] Tighten TDD evidence format
[Review] Add code-reviewer checklist for Firestore rules
[Trekker] Improve dependency creation guidance
```

Use this task-description shape:

```text
Observed during:
Problem:
Impact:
Suggested change:
Files likely affected:
Acceptance criteria:
- The ambiguity is resolved in AGENTS.md, docs, and .codex agents as needed.
- Markdown role docs and TOML prompts remain in sync.
- A future agent can follow the revised workflow without extra chat context.
```

Do not let subagents edit their own role contracts unless the main coordinator explicitly asks for a patch.

## Subagent Dispatch Matrix

Use subagents deliberately:

- New feature planning: the main agent enters Feature Planning Mode and follows the feature-planner protocol before creating Trekker items.
- Feature design review: use the architecture-design-reviewer before presenting an epic design spec as ready for user approval.
- Implementation plan review: use the senior-developer-reviewer before presenting Trekker task/subtask creation as ready for user approval.
- Documentation-only, copy-only, or tiny config changes: main agent may handle directly.
- Any behavior change or bug fix: use the implementor role unless the change is truly mechanical.
- Ambiguous requirements, user-facing behavior, migration behavior, auth/storage behavior, or acceptance criteria changes: use the spec reviewer before or alongside implementation.
- Non-trivial code changes: use the code reviewer before completing the Trekker task.
- Branch, PR, or epic readiness review: use the epic reviewer before merge or epic closure.

Parallel reviewers are allowed. Only one implementor may edit a given file set at a time. Reviewers are read-only unless the main agent explicitly asks them to prepare a patch.

## Subagent Handoff Packet

When dispatching a subagent, the main agent must provide:

- role to use
- model tier to use
- Trekker task or epic id
- task goal and restored Trekker context
- acceptance criteria
- files in scope
- files out of scope
- current branch and dirty worktree notes
- expected verification commands
- expected output format

Subagents must report files changed or reviewed, tests run, findings, risks, any suggested Trekker comment text, and `Workflow feedback:` when the workflow or role instructions made the task harder to execute reliably.

## Required Workflow

Before starting implementation:

1. Run `trekker ready` or inspect the task the user names.
2. Restore task context:
   - `trekker task show TREK-ID`
   - `trekker comment list TREK-ID`
   - `trekker history --entity TREK-ID`
   - `trekker dep list TREK-ID`
3. Run `git status --short --branch` and note unrelated dirty files.
4. Mark the selected task `in_progress` before changing files.
5. Read the relevant code and tests before editing.

For behavior changes, use TDD:

1. Write or update a failing test that captures the expected behavior.
2. Run the targeted test and confirm it fails for the expected reason.
3. Implement the smallest change that passes.
4. Run the targeted test again.
5. Broaden verification when the change touches shared logic, UI flow, storage, auth, deployment, or PWA behavior.

Before pausing:

1. Add a `Checkpoint:` comment to the active Trekker task.
2. Include what was verified, what changed, and the exact next step.
3. Include any validated workflow feedback or link to a follow-up Trekker task.

Before marking complete:

1. Run the smallest meaningful verification for the change.
2. Run `git status --short --branch` and confirm only intended files changed.
3. Add a `Summary:` comment to the Trekker task.
4. Include TDD evidence for behavior changes: failing test, implementation, passing verification. If TDD was skipped, explain why.
5. Mark the task `completed`.
6. Run `trekker ready` and report the next ready task.
7. If workflow friction was discovered, either document why no change is needed or create/link a follow-up Trekker task.

Do not mark work complete without a `Summary:` comment.

## Tracking Rules

- Search before creating tasks: use one distinctive keyword at a time, such as `trekker search "auth"` or `trekker search "migration"`.
- Prefer extending existing tasks over creating duplicates.
- Keep one active implementation task when practical.
- If a task is partly done, leave it `in_progress` with a `Checkpoint:` comment.
- If work is blocked by outside setup or user action, document the blocker clearly in Trekker.
- Do not use ad hoc notes, chat summaries, or local todo files as the durable system of record.

## New Feature Planning

Use `docs/feature-planning.md` for new feature work.

Codex planning is a temporary scratchpad for brainstorming and shaping the feature. Trekker is the durable source of truth after the user approves the plan.

Feature planning is a main-session mode, not a hidden delegated workflow. The main agent may ask the feature-planner-advisor for an advisory draft, but the main agent owns the planning conversation, approval gates, review integration, and Trekker creation.

Planning flow:

1. Search Trekker for duplicates or related work.
2. Brainstorm and identify open questions without creating Trekker items.
3. Draft an epic-level design spec.
4. Run architecture/design review, validate the feedback, and either incorporate it or record why it was not accepted.
5. Present the revised design spec to the user for approval.
6. For larger epics, propose saving a durable spec under `docs/specs/`.
7. Convert the approved design into an implementation plan: epic, tasks, subtasks, dependencies, and verification.
8. Run senior-developer implementation-plan review, validate the feedback, and either incorporate it or record why it was not accepted.
9. Ask for approval before creating or updating Trekker records.
10. Create Trekker epic/task/subtask records and dependencies.
11. Mirror only the current session in `update_plan` after Trekker is correct.

Do not create Trekker epics, tasks, or subtasks from brainstorming unless the user has approved the design and implementation plan.

## Repo Safety

- Do not revert user changes unless the user explicitly asks.
- Treat untracked files as user-owned unless you created them in the current task.
- Run `git status --short --branch` before edits and before the final response.
- Keep edits scoped to the active task.
- Avoid unrelated refactors, formatting churn, dependency churn, and generated output unless required.
- Never commit secrets. Production Firebase values belong in Vercel environment variables or local ignored env files.

## Branch And PR Cadence

- Prefer a focused branch per task or small related task set.
- Use the `codex/` branch prefix unless the user asks for another naming scheme.
- Keep branch scope aligned with Trekker scope.
- Open a PR when the task or task set is ready for review.
- Run the code reviewer before marking a non-trivial task complete.
- Run the epic reviewer before merging an epic branch, closing an epic, or merging a high-risk PR.
- Do not merge, push, or deploy unless the user asked for that action.

## Review Expectations

Every task should get a quick spec review and code review before completion:

- Does the implementation satisfy the Trekker task and any referenced spec?
- Are edge cases handled for the changed behavior?
- Are failures visible enough to troubleshoot?
- Did the right tests run?
- Is there any production setup or deployment checklist item still open?

If a user asks for a review, lead with findings ordered by severity, using file and line references when applicable.

For non-trivial tasks, use the specialized role docs:

- Spec review before implementation when requirements are ambiguous or user-facing behavior changes.
- Implementor for TDD implementation.
- Code review before task completion.
- Epic review before merging or closing an epic.

## Project Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Tests: `npm test -- --run`
- Lint: `npm run lint`
- Firebase emulators: `npm run emulators`

For narrow changes, run targeted tests when available. For deployment or shared behavior, run build plus relevant tests.

## App Context

This is a React/Vite adaptive workout app using Firebase Auth, Firestore, Vercel, and PWA support.

Important files:

- `src/App.jsx`: auth gate and main view routing
- `src/components/Login.jsx`: Google sign-in UI
- `src/components/Generator.jsx`: workout generation flow
- `src/components/Settings.jsx`: settings and catalog editing
- `src/components/WorkoutView.jsx`: workout history and saving
- `src/utils/engine.js`: workout generation logic
- `src/utils/storage.js`: Firestore-backed storage and migration helpers
- `src/utils/firebase.js`: Firebase initialization and emulator wiring
- `firestore.rules`: production Firestore user isolation rules
- `vite.config.js`: Vite and PWA configuration
- `.env.example`: required production Firebase env vars

See also:

- `docs/agent-workflow.md`
- `docs/feature-planning.md`
- `docs/project-context.md`
- `docs/agents/main-coordinator.md`
- `docs/agents/feature-planner.md`
- `docs/agents/architecture-design-reviewer.md`
- `docs/agents/senior-developer-reviewer.md`
- `docs/agents/implementor.md`
- `docs/agents/spec-reviewer.md`
- `docs/agents/code-reviewer.md`
- `docs/agents/epic-reviewer.md`
- `.codex/agents/`
