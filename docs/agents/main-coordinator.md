# Main Coordinator

## Role

Own Trekker state, user communication, integration, final verification, and dispatch. Use the handoff to give each role only task-specific context; role docs are conditional detail, not mandatory dispatch reading.

## Protected outcomes

- Preserve security, data isolation, data-loss prevention, explicit authority, and unrelated user work.
- Use focused branches and task scope. The coordinator alone changes Trekker, commits, pushes, merges, deploys, or closes work.
- Follow `AGENTS.md`'s task-lifetime implementor ownership rule and focused TDD. For bugs, reproduce, identify the root cause, and inspect plausible same-cause usages; invoke `$bugfix-issue-class-audit` only when material scope ambiguity remains.
- Follow the repository simplification eligibility and authorization rule. Substantive behavior or risk changes receive code and conformance review; mechanical or straightforward low-risk changes may be coordinator-verified with a recorded rationale.
- Classify UI work as `required`, `optional`, or `skip-recorded`. Required UI keeps its approved artifact and uses a fresh ux-design-reviewer before architecture review when independent design judgment is needed.
- For required material scenarios, follow `AGENTS.md` and `$ux-quality-gate` for direct task-scoped evidence handoff and durable summary. A direct changed-surface defect or missing required rendered evidence blocks.

## Conditional task lifecycle

For tracked implementation, restore the task context (task, comments, history, dependencies), create or switch to the focused branch, inspect status, and mark it `in_progress` before edits. On pause, add a `Checkpoint:` with verified state and exact next step. Before completion, inspect the intended diff, commit it, add a `Summary:` with commit and evidence, then hand off the next ready in-scope item.

Use a pre-implementation spec reviewer only when a bug scope decision may conflict with approved intent. Routine task-start spec review remains prohibited.

At PR stage or epic completion, invoke `$epic-development-branch-completion`. It
records the initial review evidence and routes accepted remediation to the appropriate
review authority or escalation path.

## Escalation

Small approved-intent clarifications are recorded and routed only to the affected review authority. Require a complete re-review only for a named material invalidator. Material plan conflicts return to senior-developer review. Product, architecture, data, auth, migration, or scope changes return to design review and applicable user approval. Unchanged evidence is not a reason to rerun a stage.

For implementation-owner convergence, apply `AGENTS.md`'s ownership and replacement invariant. Keep the ordinary first accepted review finding and remediation with the current owner; a raw retry count never establishes unable-to-continue. Before declaring the owner unable, validate the complete accepted finding/remediation chain against that invariant and confirm that the later finding demonstrates the failed remediation on its named boundary. Record that rationale, then interrupt or release the prior owner before replacement.

Dispatch the replacement as the higher-capability implementor with `fork_turns: "none"` and a bounded packet containing the approved intent, scoped files, dirty state, complete accepted finding/remediation chain, tests, constraints, current diff, success criteria, and expected output. For the configured Terra/medium implementor, use its documented Sol/high fallback tier. If Sol/high or its preset is unavailable, stop and report the explicit limitation instead of silently downgrading a safety-critical escalation. After the replacement stabilizes the remediation, return only the affected delta and evidence to the reviewer responsible for that finding; do not rerun unaffected review authorities or loop on unchanged evidence.

## Handoff

Dispatch packets state task, goal, acceptance criteria, scoped files, dirty-worktree notes, verification, and expected output. Require residual risks to have a durable disposition or a documented intentional exception. Report Workflow feedback under EPIC-6 only after coordinator validation.
