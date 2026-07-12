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

Serialize Trekker writes, including creates, updates, dependency changes, and
comments. Independent read-only lookups may run together only when safe. If Trekker
returns a transient `database is locked` error, retry the failed command
sequentially after a brief wait; do not batch it again with writes.

## 2. Start Exactly One Task

When the work is ready to begin:

```bash
git status --short --branch
trekker task update TREK-ID -s in_progress
```

If another task is already `in_progress`, decide whether it is the same work. If it is unrelated, tell the user before switching focus.

After completing a task in an active epic, continue with the next ready,
in-scope task in that epic when no blocker or approval gate remains. Checkpoint and
hand back only for a user decision, external blocker, meaningful scope expansion,
explicit pause/stop request, or authorized-work boundary. Do not select an
unrelated ready task merely because it appears in `trekker ready`; state why work
stopped or continued in the final handoff and after-action audit.

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

This repository treats required workflow roles as standing user authorization for
dispatch. The main agent may dispatch the required planning reviewers without a
separate per-session delegation request, while retaining Trekker ownership and
using subagents only where the dispatch matrix calls for them.

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
- Branch, PR, or epic readiness: use the epic reviewer before publishing an implementation branch or epic handoff, merge, or epic closure.

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

### Firebase Emulator Verification In The Sandbox

For emulator-backed Firebase checks, run the project script (currently `npm run
ci:rules`) rather than relying on a globally installed Firebase CLI. The script
resolves `firebase-tools/lib/bin/firebase.js` from the installed package and runs
it with Node, so the CLI version matches the project dependency.

In the sandboxed Windows environment, Firebase Tools may try to read or write host
configuration before tests start. Isolate that state with a temporary
`XDG_CONFIG_HOME` directory for the command, then remove it after completion. See
`scripts/ci-rules.mjs` for the established `mkdtempSync` / `spawnSync` / `rmSync`
pattern; preserve it when adding emulator-backed verification.

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

For verification that depends on a PR, deployment, production setup, or user
action, do not mark the check complete before the evidence exists. Keep the task
open with a `Checkpoint:` comment through the trigger, or create a dependent
follow-up task or subtask that records the trigger, owner, expected evidence, and
completion boundary.

## 10. Branch And PR Cadence

- Prefer a focused branch per task or small related task set.
- Use the `codex/` branch prefix unless the user asks for another naming scheme.
- Keep branch scope aligned with Trekker scope.
- For implementation branch or epic work, the default review handoff is a draft PR unless the user explicitly opts out. Before handing it back, complete the required code or epic review, commit and push the intended changes, open the draft PR, and confirm required checks are visible. Fix CI-only failures that are in scope; otherwise document the failure and exact next step.
- Use `gh` for PR creation when the GitHub connector lacks PR-create permission. Request escalation up front for known sandbox-limited git or `gh` publish operations instead of repeating failed attempts.
- For `gh pr create` or `gh pr edit`, write multiline Markdown into a temporary file and use `--body-file <path>`. Do not put escaped `\n` sequences in a command-line body argument: GitHub will render them literally. Remove the temporary file after the command succeeds.
- Run the code reviewer before marking a non-trivial task complete.
- Run the epic reviewer before publishing an epic or branch handoff, merging an epic branch, closing an epic, or merging a high-risk PR.
- Do not merge or deploy unless the user asked for that action.

## 11. Review Checklist

Before final response:

- Trekker status is accurate.
- `git status --short --branch` has been checked.
- Tests or build were run, or the reason they were skipped is clear.
- No unrelated files were changed.
- No secrets were added.
- User-facing production steps are documented when applicable.
- Deferred verification is either evidenced or documented as an open, checkpointed follow-up.
- Workflow friction from subagents has been validated, captured, or explicitly declined.
- The next ready task is surfaced when useful.

For non-trivial tracked work, PR-bound work, and epic work, perform an after-action
workflow audit before handoff:

- Did the user have to remind the agent about a required workflow step?
- Did work stop before the repository-defined handoff endpoint?
- Were predictable sandbox or permission failures retried instead of using the known escalation or fallback path?
- Did a subagent or reviewer expose bookkeeping, scope, or handoff drift?
- Do Trekker tasks and subtasks match the work actually completed?

Treat a user-reminded workflow miss as `Workflow feedback:` and validate it for an
`EPIC-6` follow-up. In the final response, state either that no workflow follow-up
was found or name the Trekker item created or updated.

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
