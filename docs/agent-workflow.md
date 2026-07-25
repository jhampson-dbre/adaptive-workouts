# Agent Workflow

Use this workflow for all tracked non-planning work.

This document is the execution-level playbook. Canonical process semantics (gates, lifecycle format, and final-integration rules) live in `AGENTS.md`.

## 1. Recover Context

Start from Trekker and treat it as durable truth.

```bash
trekker ready
trekker task show TREK-ID
trekker comment list TREK-ID
trekker history --entity TREK-ID
trekker dep list TREK-ID
```

If the user describes work without a task id, search first with one distinctive keyword:

```bash
trekker search "keyword"
```

Serialize Trekker writes. Retry transient `database is locked` read/write failures sequentially after a brief wait.

## 2. Start One Task

- Confirm clean branch context first with `git status --short --branch`.
- Mark the selected task `in_progress` before edits.
- Create or switch to the focused `codex/` branch before editing.
- Keep one active implementation task when practical.
- After Task 1 planning completion, treat `Task 2` and later tasks as continuation-work requiring fresh explicit user approval before starting.

## 3. Inspect Before Editing

Read relevant source, tests, specs, and prior context before first edit:

- related app files and tests
- migration/config/rule context (`firestore.rules`, `.env.example`, scripts, CLI docs)
- `docs/specs/` references for approved feature design intent

## 4. Execution Pattern

- Make the smallest scoped changes possible.
- Preserve unrelated user files and existing tests.
- For behavior changes, follow TDD:
  1. Add/update a failing test.
  2. Confirm failure for expected reason.
  3. Implement minimal fix.
  4. Re-run targeted test.

For non-mechanical behavior changes, run `node scripts/validate-review-lifecycle.mjs` or other task-specific validation as defined by role docs.

## 5. Feature Planning Exception

If this work is new feature planning, do not use this workflow directly. Use `docs/feature-planning.md`, then return to this workflow only for execution starting with Task 1.

## 6. Subagent Coordination

Use role prompts in `docs/agents/*.md` and `.codex/agents/*.toml`. For each dispatch, send the standard role handoff packet:

- role
- model tier
- Trekker id
- goal
- inputs/context
- files in/out scope
- expected verification commands
- expected output format

Do **not** ask users for separate authorization for required workflow reviewers that are already mandated by `AGENTS.md`.

Use these role boundaries:
- `implementor` for scoped implementation
- `code-simplifier` before final verification
- `code-reviewer` and `spec-reviewer` on final diff
- `epic-reviewer` and fresh spec review for final integration, coordinated through `$epic-development-branch-completion`

## 7. Review-Lifecycle Baseline and Closure

For non-trivial implementation tasks, follow the immutable baseline and scoped-closure structure in `AGENTS.md`:

- `Review-Baseline:` after green implementation, simplification, and coordinator verification
- `Review-Batch:` for additive remediation
- `Review-Closure:` for technical + conformance evidence deltas
- `Review-Invalidator:` for stale/conflicting/rewritten/unaccounted scope changes
- `Checkpoint:` and `Summary:` in Trekker as required for pauses/completions

Use this only as an append-only structure; do not rewrite baseline terms.

## 8. Verification and Handoff

Use risk-appropriate verification:

- narrow logic: targeted test command(s)
- shared behavior/UI/storage/auth/deployment: targeted tests + build/lint as needed

Before completion:

- include relevant `Summary:` / `Checkpoint:` text in Trekker
- commit intended scoped diff
- mark task complete only after scoped verification supports it
- keep deferred checks checkpointed until evidence exists
- inventory residual handoff risks and assign a durable disposition (duplicate search first, then backlog, or intentional-not-tracked exception in Summary/Checkpoint)

## 9. PR/Branch Handoff

At PR stage or epic handoff:

- complete both final-integration gates (`$epic-development-branch-completion`, `epic-reviewer`, fresh `spec-reviewer`)
- keep `git status --short --branch` and branch evidence current
- open draft PR only at the expected review completion boundary unless user opts out

