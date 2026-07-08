# Agent Workflow

Use this workflow for all tracked work in this repository.

## 1. Recover Context

Start from Trekker, not from guesses.

```bash
trekker ready
trekker task show TREK-ID
trekker comment list TREK-ID
trekker history --entity TREK-ID
trekker dep list TREK-ID
```

If the user describes work without a task id, search first:

```bash
trekker search "keyword"
```

Use one distinctive keyword at a time. Multi-word searches are narrower and can miss related work.

## 2. Start Exactly One Task

When the work is ready to begin:

```bash
git status --short --branch
trekker task update TREK-ID -s in_progress
```

If another task is already `in_progress`, decide whether it is the same work. If it is unrelated, tell the user before switching focus.

## 3. Inspect Before Editing

Read the files, tests, and specs related to the task.

Common context sources:

- `src/utils/engine.js` for workout generation behavior
- `src/utils/storage.js` for Firestore persistence
- `src/components/*.jsx` for UI flows
- `src/tests/*.js` and `src/tests/*.jsx` for expected behavior
- `docs/superpowers/specs/` for historical design notes
- `.env.example`, `firebase.json`, and `firestore.rules` for Firebase behavior

## 4. Implement Conservatively

- Match the existing React/Vite style.
- Keep edits scoped to the task.
- Prefer small, testable changes.
- Do not rewrite unrelated components.
- Do not change generated or dependency files unless the task requires it.
- Preserve user and agent artifacts you did not create.

## 5. Use TDD For Behavior Changes

For bug fixes, feature work, storage changes, engine changes, and user-facing behavior changes:

1. Add or update a test that describes the desired behavior.
2. Run the targeted test and confirm it fails for the expected reason.
3. Implement the smallest passing change.
4. Run the targeted test again.
5. Refactor only after tests pass.

If TDD is not practical, document why in the Trekker `Checkpoint:` or `Summary:` comment.

Documentation-only changes, copy changes, and deployment-console work may skip TDD, but should still be verified appropriately.

## 6. Use Subagents Deliberately

The main agent owns Trekker and final decisions. Subagents are advisory or implementation helpers.

Use role contracts in `docs/agents/`:

- `main-coordinator.md` for session ownership
- `feature-planner.md` as the main-session protocol for new feature brainstorming, design, and Trekker planning
- `architecture-design-reviewer.md` for epic-level design review before user approval
- `senior-developer-reviewer.md` for Trekker-shaped implementation-plan review before user approval
- `implementor.md` for TDD patches
- `spec-reviewer.md` for requirement and acceptance checks
- `code-reviewer.md` for bug/regression review
- `epic-reviewer.md` for pre-merge or epic-close review

Spawnable project-scoped Codex agents live in `.codex/agents/*.toml`. The Markdown files explain the roles; the TOML files make the implementation, review, and advisory roles available to Codex subagent workflows.

Subagents should return concise reports with files changed, tests run, findings, recommended Trekker notes, and workflow feedback when instructions were hard to execute. They should not update Trekker status directly.

Use this dispatch matrix:

- New feature planning: enter Feature Planning Mode and follow the feature-planner protocol before creating Trekker items.
- Feature design approval: run architecture-design-reviewer before presenting an epic design spec as ready for user approval, unless the feature is tiny and low-risk.
- Trekker creation approval: run senior-developer-reviewer before presenting the implementation plan as ready for user approval, unless the plan is tiny and low-risk.
- Documentation-only, copy-only, or tiny config changes: main agent may handle directly.
- Behavior change or bug fix: use the implementor role unless the change is purely mechanical.
- Ambiguous requirements, user-facing behavior, migration behavior, auth/storage behavior, or acceptance changes: use the spec reviewer.
- Non-trivial code changes: use the code reviewer before task completion.
- Branch, PR, or epic readiness: use the epic reviewer before merge or epic closure.

Use this handoff packet:

```text
Role:
Model tier:
Trekker id:
Goal:
Restored Trekker context:
Acceptance criteria:
Files in scope:
Files out of scope:
Current branch and dirty worktree notes:
Expected verification:
Expected output:
Workflow feedback, if any:
```

Only one implementor may edit a file set at a time. Reviewers may run in parallel and should remain read-only unless explicitly asked to patch.

## 7. Plan New Features

For new feature requests, use `docs/feature-planning.md`.

Feature Planning Mode runs in the main agent session. A subagent may provide an advisory draft or review, but the main agent owns user interaction, approval gates, and Trekker writes.

Short version:

1. Search Trekker for duplicates or related work.
2. Brainstorm in Codex planning space only.
3. Draft an epic-level design spec.
4. Run architecture/design review, validate feedback, and incorporate it or record why it was rejected.
5. Get user approval.
6. For larger epics, propose a durable spec file under `docs/specs/`.
7. Convert the spec into a Trekker implementation plan: epic, tasks, subtasks, dependencies, and verification.
8. Run senior-developer implementation-plan review, validate feedback, and incorporate it or record why it was rejected.
9. Get user approval to create Trekker records.
10. Create or update Trekker.
11. Mirror only the current session with `update_plan` after Trekker is accurate.

Do not create durable Trekker records during brainstorming unless the user explicitly approves.

## 8. Verify

Choose verification based on risk.

Small logic change:

```bash
npm test -- --run
```

Shared UI, storage, auth, deployment, or PWA behavior:

```bash
npm test -- --run
npm run build
npm run lint
```

Known current lint warnings may exist outside the touched area. Do not treat unrelated existing warnings as task blockers, but report them if relevant.

## 9. Handoff Or Complete

If pausing:

```bash
trekker comment add TREK-ID -a "codex" -c "Checkpoint: ..."
```

Include:

- current state
- files touched
- verification already run
- exact next step
- blockers or user action needed
- validated workflow feedback, or a linked follow-up Trekker task when process changes are needed

If complete:

```bash
git status --short --branch
trekker comment add TREK-ID -a "codex" -c "Summary: ..."
trekker task update TREK-ID -s completed
trekker ready
```

The `Summary:` comment should say what changed, what was verified, and any residual risk. If the work exposed friction in the agent workflow, include the validated feedback or the follow-up Trekker id.

For behavior changes, include TDD evidence:

```text
Summary: ...
TDD: added failing test for <behavior>; confirmed failure with <command>; implemented <change>; passing verification: <command>.
```

If TDD was skipped:

```text
Summary: ...
TDD: skipped because <reason>. Verification: <command or manual check>.
```

## 10. Branch And PR Cadence

- Prefer a focused branch per task or small related task set.
- Use the `codex/` branch prefix unless the user asks for another naming scheme.
- Keep branch scope aligned with Trekker scope.
- Open a PR when the task or task set is ready for review.
- Run the code reviewer before marking a non-trivial task complete.
- Run the epic reviewer before merging an epic branch, closing an epic, or merging a high-risk PR.
- Do not merge, push, or deploy unless the user asked for that action.

## 11. Review Checklist

Before final response:

- Trekker status is accurate.
- `git status --short --branch` has been checked.
- Tests or build were run, or the reason they were skipped is clear.
- No unrelated files were changed.
- No secrets were added.
- User-facing production steps are documented when applicable.
- Workflow friction from subagents has been validated, captured, or explicitly declined.
- The next ready task is surfaced when useful.

## 12. Workflow Self-Improvement Loop

Agent workflows are allowed to improve, but changes should be intentional and traceable.

Use `EPIC-6: Agent Workflow Improvements` as the standing backlog epic for durable planning, execution, review, Trekker, and agent-behavior improvements. Do not create separate planning-process or execution-process epics unless the user explicitly asks; most workflow issues cross those boundaries.

Use this loop when any agent reports trouble following the instructions:

1. Capture the report in this format:

```text
Workflow feedback:
- Issue:
- Impact:
- Suggested change:
- Scope:
- Urgency:
```

2. Validate the feedback against the actual task, code, Trekker state, and role docs.
3. Decide whether it is:
   - `current-branch`: a small clarification needed for the active work
   - `follow-up`: a real process improvement that should become a Trekker task under `EPIC-6`
   - `declined`: not a workflow problem after review
4. If it becomes follow-up work, create or update a Trekker task and link it from the active task's `Checkpoint:` or `Summary:`.
5. Keep `.codex/agents/*.toml` and matching `docs/agents/*.md` files in sync when role behavior changes.

Use this task-title pattern for `EPIC-6` follow-ups:

```text
[Planning] Short issue
[Execution] Short issue
[Review] Short issue
[Trekker] Short issue
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

Subagents must not update their own instructions or Trekker state unless the main coordinator explicitly asks for a patch.
