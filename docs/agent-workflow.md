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

### Behavior-Bug Issue-Class Audit (Coordinator Gate)

Before dispatching an implementor for a behavior-bug task, first reproduce the
problem and identify its root cause. Then, while the coordinator still owns scope,
perform a targeted same-class search: inspect repeated fields, shared components,
helpers, state paths, validation rules, or contracts that could carry the same cause.
This is pre-implementation bug triage/scoping, not Feature Planning and not
implementor execution.

Add an issue-class audit note to the active Trekker task before dispatch. Include the
root cause; search method and results; candidates inspected; affected and unaffected
surfaces with rationale; the proposed regression-test matrix; and a scope decision.
For non-mechanical or user-facing bugs, use a read-only spec-review dispatch to
validate this audit against approved task intent. It may report an unsupported scope
decision or escalation trigger, but cannot invent or refine requirements. This narrow
audit validation is the sole pre-implementation exception to the routine task-start
spec-review prohibition; post-verification task conformance remains required.

Put the approved complete file and behavior scope, audit result, and regression-test
matrix in the implementor handoff. The implementor implements that scope and is not
responsible for finding omitted siblings during coding. Expand the current task only
when a same-class finding shares the confirmed root cause, fits approved product
intent, and remains a cohesive, verifiable change. Record that expansion in Trekker
before dispatch. Otherwise use a linked follow-up—for a different root cause,
independent risk or ownership, a material scope/design decision, or loss of focused
verification. Search for duplicates and obtain the required approval before creating
or materially changing a follow-up, then record its linkage and rationale in the
audit note.

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
- `spec-reviewer.md` for post-verification task-conformance checks
- `code-reviewer.md` for bug/regression review
- `epic-reviewer.md` for pre-merge or epic-close review

Spawnable project-scoped Codex agents live in `.codex/agents/*.toml`. The Markdown files explain the roles; the TOML files make the implementation, review, and advisory roles available to Codex subagent workflows.

Subagents should return concise reports with files changed, tests run, findings, recommended Trekker notes, and workflow feedback when instructions were hard to execute. They should not update Trekker status directly.

Use this dispatch matrix:

- New feature planning: enter Feature Planning Mode and follow the feature-planner protocol before creating Trekker items.
- Feature design approval: run architecture-design-reviewer before presenting an epic design spec as ready for user approval, unless the feature is tiny and low-risk.
- Planning conformance: after design approval and before presenting the implementation plan for Trekker-creation approval, run senior-developer-reviewer, unless the plan is tiny and low-risk.
- Documentation-only, copy-only, or tiny config changes: main agent may handle directly.
- Every tracked implementation task: dispatch a fresh implementor. After targeted verification produces the final task diff and evidence, dispatch a fresh code reviewer and a fresh task-conformance spec reviewer. Do not reuse either reviewer across task boundaries, including tasks in the same epic.
- Behavior change or bug fix: use the fresh implementor role unless the change is purely mechanical.
- Before a behavior-bug implementor dispatch, complete and document the coordinator-owned issue-class audit. For non-mechanical or user-facing bugs, dispatch a read-only spec reviewer to validate the approved-intent scope audit; this is not routine task-start requirements discovery and does not replace post-verification task conformance.
- Task-start spec-review dispatch is prohibited. Do not use the spec reviewer to refine routine task-start requirements or to invent requirements.
- Task conformance: run the spec reviewer alongside code review only after targeted verification; provide the final diff, verification/TDD evidence, and approved Trekker intent. The reviewer may identify nonconformance but must not invent new requirements.
- Epic/PR conformance: use the epic reviewer in final integration before publishing an implementation branch or epic handoff, merge, PR approval, or epic closure.

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

An implementor, code reviewer, or spec reviewer may receive a follow-up only when it
remains the same Trekker task. The coordinator must label it as a same-task
continuation and provide the changed scope, new evidence, and requested decision; it
must not silently become a new task. After review-driven fixes, prefer a second fresh
code reviewer. If that is not practical, the original reviewer may perform an
explicitly labeled delta review limited to changes since its prior report. Use a fresh
task-conformance spec reviewer for each task; a same-task follow-up is limited to an
explicitly labeled approved-intent clarification and its revised final diff/evidence
delta. Route a material plan conflict to senior-developer planning conformance, not
back to the spec reviewer.

### Conformance Escalation And Re-Review

Keep the three conformance gates separate:

- **Planning conformance** is the senior-developer review after design approval and before Trekker creation. Its input is the approved design and proposed Trekker plan; its output is plan corrections or an escalation.
- **Task conformance** is the spec-reviewer check after targeted verification, alongside code review. Its input is the active Trekker task, final task diff, and verification evidence; its output is a conformance finding against approved intent, not a newly invented requirement.
- **Epic/PR conformance** is the epic-reviewer check during final integration. Its input is the cumulative diff, Trekker evidence, and PR/branch state; its output is release/merge readiness and cross-task conformance findings.

Route findings by impact:

- A small clarification consistent with approved intent: the coordinator updates the active Trekker task and records the decision, then re-runs the affected reviews on the changed final diff and evidence.
- A material task-plan conflict: pause completion and return to senior-developer implementation-plan review before changing planning records.
- A product, architecture, data, auth, migration, or scope change: return to architecture/design review and obtain the applicable user approval before updating the design or plan.
- Any change after task or final-integration review requires a new review of the changed final diff; use code review plus task conformance for task changes, and epic/PR conformance for final-integration changes.

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
8. Run planning conformance with the senior-developer implementation-plan reviewer, validate feedback, and incorporate it or record why it was rejected.
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

Before a final handoff for non-trivial tracked, PR-bound, or epic work, inventory
each residual or nonblocking handoff risk. This includes deferred verification,
reviewer notes, known caveats in the final response, and risks mentioned only in a
PR body. For every item, enumerate the risk and its disposition in the final
handoff; the disposition itself must be durable, not merely a note in the
`Summary:`, checkpoint, PR handoff, or final response:

- Search Trekker with one distinctive keyword before selecting any disposition.
- Link the existing task when it already owns the risk.
- Create or extend an appropriate backlog item only after the user approves the
  Trekker write.
- If no durable item is warranted, record an intentional-not-tracked exception in
  the active task's `Summary:` (or `Checkpoint:` when pausing), including the search
  result and concise rationale. This bounded Trekker record is the required durable
  exception; a PR body, chat note, or final response alone is not enough.

Do not let a residual risk exist only in chat, a PR body, or a general comment that
lacks this disposition. If user approval for the required Trekker write is pending,
keep the active task open with a `Checkpoint:` that names the proposed item,
duplicate-search result, owner, trigger, and rationale rather than treating the risk
as closed.

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
- Each completed task received code review and post-verification task conformance against its final diff and approved Trekker intent.
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
- Has every residual or nonblocking handoff risk been inventoried and given a
  duplicate-searched Trekker disposition (linked task, approved backlog item, or
  intentional-not-tracked `Summary:`/`Checkpoint:` exception with search result and
  rationale)?

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
