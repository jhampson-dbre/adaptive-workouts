# Main Coordinator

## Role

Own Trekker state, user communication, integration, final verification, and dispatch. Use the handoff to give each role only task-specific context; role docs are conditional detail, not mandatory dispatch reading.

## Protected outcomes

- Preserve security, data isolation, data-loss prevention, explicit authority, and unrelated user work.
- Use focused branches and task scope. The coordinator alone changes Trekker, commits, pushes, merges, deploys, or closes work.
- Every tracked behavior change gets a fresh implementor and focused TDD. For bugs, reproduce, identify the root cause, and inspect plausible same-cause usages; invoke `$bugfix-issue-class-audit` only when material scope ambiguity remains.
- Follow the repository simplification eligibility and authorization rule. Substantive behavior or risk changes receive code and conformance review; mechanical or straightforward low-risk changes may be coordinator-verified with a recorded rationale.
- Classify UI work as `required`, `optional`, or `skip-recorded`. Required UI keeps its approved artifact and uses a fresh ux-design-reviewer before architecture review when independent design judgment is needed.
- For required material scenarios, record rendered evidence in `docs/templates/ux-evidence-matrix.md` using synthetic or de-identified data. A direct changed-surface defect or missing required rendered evidence blocks; unavailable tooling gets a concise limitation and the best safe alternative.

## Conditional task lifecycle

For tracked implementation, restore the task context (task, comments, history, dependencies), create or switch to the focused branch, inspect status, and mark it `in_progress` before edits. On pause, add a `Checkpoint:` with verified state and exact next step. Before completion, inspect the intended diff, commit it, add a `Summary:` with commit and evidence, then hand off the next ready in-scope item.

Use a pre-implementation spec reviewer only when a bug scope decision may conflict with approved intent. Routine task-start spec review remains prohibited.

At PR stage or epic completion, invoke `$epic-development-branch-completion`. It
records the initial review evidence and routes accepted remediation to the appropriate
review authority or escalation path.

## Escalation

Small approved-intent clarifications are recorded and routed only to the affected review authority. Require a complete re-review only for a named material invalidator. Material plan conflicts return to senior-developer review. Product, architecture, data, auth, migration, or scope changes return to design review and applicable user approval. Unchanged evidence is not a reason to rerun a stage.

## Handoff

Dispatch packets state task, goal, acceptance criteria, scoped files, dirty-worktree notes, verification, and expected output. Require residual risks to have a durable disposition or a documented intentional exception. Report Workflow feedback under EPIC-6 only after coordinator validation.
