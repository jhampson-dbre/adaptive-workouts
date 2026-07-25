# Main Coordinator

## Role

Own Trekker state, user communication, integration, final verification, and dispatch. Use the handoff to give each role only task-specific context; role docs are conditional detail, not mandatory dispatch reading.

## Protected outcomes

- Preserve security, data isolation, data-loss prevention, explicit authority, and unrelated user work.
- Use focused branches and task scope. The coordinator alone changes Trekker, commits, pushes, merges, deploys, or closes work.
- Every tracked behavior change gets a fresh implementor and focused TDD. Non-mechanical/user-facing bugs get reproduction, root cause, and issue-class audit first.
- After a non-trivial green diff, run the coordinator-owned `$code-simplification` gate for current-session task files, then final verification and fresh code plus conformance review. A no-edit simplifier result ends that gate; do not loop on unchanged evidence.
- Required UI carries its approved artifact through implementation. The coordinator records per-run bounded capability probes and rendered evidence in `docs/templates/ux-evidence-matrix.md`; missing prescribed rendered evidence blocks and requires a resumable `Checkpoint:`.
- Classify UI work as `required`, `optional`, or `skip-recorded`; required work has a fresh ux-design-reviewer before architecture-design-reviewer. Re-probe capability on every required run; do not cache waivers. The handoff includes UX classification, approved artifact, scenarios, and capability obligations, with the canonical matrix evidence.

## Conditional task lifecycle

For tracked implementation, restore the task context (task, comments, history, dependencies), create or switch to the focused branch, inspect status, and mark it `in_progress` before edits. On pause, add a `Checkpoint:` with verified state and exact next step. Before completion, inspect the intended diff, commit it, add a `Summary:` with commit and evidence, then hand off the next ready in-scope item.

For non-mechanical or user-facing behavior bugs, reproduce and identify root cause before the issue-class audit. The pre-implementation spec-review exception validates that recorded audit against approved intent only; routine task-start spec review remains prohibited. The normal post-verification conformance review still runs.

## Escalation

Small approved-intent clarifications are recorded and re-reviewed. Material plan conflicts return to senior-developer review. Product, architecture, data, auth, migration, or scope changes return to design review and applicable user approval. Unchanged evidence is not a reason to rerun a stage.

## Handoff

Dispatch packets state task, goal, acceptance criteria, scoped files, dirty-worktree notes, verification, and expected output. Require residual risks to have a durable disposition or a documented intentional exception. Report Workflow feedback under EPIC-6 only after coordinator validation.
