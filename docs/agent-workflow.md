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

Before any edit, create or switch to the focused `codex/` branch for the task or
epic. Confirm that branch and any unrelated dirty files with the status command.

If another task is already `in_progress`, decide whether it is the same work. If it is unrelated, tell the user before switching focus.

After completing a task in an active epic, continue with the next ready,
in-scope task in that epic when no blocker or approval gate remains. Checkpoint and
hand back only for a user decision, external blocker, meaningful scope expansion,
explicit pause/stop request, or authorized-work boundary. Do not select an
unrelated ready task merely because it appears in `trekker ready`; state why work
stopped or continued in the final handoff and after-action audit.
For a newly planned feature, completion of planning Task 1 is an authorized-work
boundary: later tasks require fresh explicit user approval before they may start.

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

Before editing a behavior bug, reproduce it, identify the root cause, and inspect
plausible callers or same-cause usages. Continue directly when the result is one
cohesive localized fix. Invoke `$bugfix-issue-class-audit` only when the search finds
multiple affected surfaces, unclear approved scope, a cross-boundary change, or a
meaningful current-task-versus-follow-up decision.

Record only the scope decision, focused regression check, and excluded or follow-up
work needed by the implementor. Use a pre-implementation spec reviewer only when that
decision may conflict with approved intent. Different causes, ownership areas, or
material design decisions remain separate work.

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
- `code-simplifier.md` for behavior-preserving cleanup of green task diffs
- `spec-reviewer.md` for post-verification task-conformance checks
- `code-reviewer.md` for bug/regression review
- `epic-reviewer.md` for pre-merge or epic-close review

Spawnable project-scoped Codex agents live in `.codex/agents/*.toml`. The Markdown files explain the roles; the TOML files make the implementation, review, and advisory roles available to Codex subagent workflows.

Subagents should return concise reports with files changed, tests run, findings, recommended Trekker notes, and workflow feedback when instructions were hard to execute. They should not update Trekker status directly.

Use this dispatch matrix:

- New feature planning: before entering Codex Plan Mode for formal feature planning, invoke
  `$feature-discovery` for every proposed feature, capability, workflow, or
  substantial behavior change. Require the user's approved Discovery Brief and
  Decision Log before duplicate confirmation or formal planning, unless
  an explicit user opt-out or small, fully specified mechanical-task exception is
  documented. Reuse a current, complete discovery search; refresh it only when
  missing, incomplete, or stale for the approved scope. Then
  follow the feature-planner protocol before creating Trekker items.
- Feature design approval: run architecture-design-reviewer before user approval when the design has a named material system-boundary, data, auth, migration, deployment, or failure risk; otherwise record the proportional skip rationale.
- Planning conformance: after design approval, run senior-developer-reviewer when the implementation plan has meaningful task boundaries, dependencies, or verification risk; otherwise record the proportional skip rationale.
- Documentation-only, copy-only, or tiny config changes: main agent may handle directly.
- Every tracked behavior task: dispatch a fresh implementor. After a green diff, run proportionate verification. Invoke `$code-simplification` only for a concrete complexity signal. Substantive behavior or risk changes receive fresh code and task-conformance review; the coordinator may verify mechanical or straightforward low-risk changes directly and record why specialist review was unnecessary.
- For UI work classified `required`, preserve the approved artifact and record rendered evidence for each materially changed scenario in `docs/templates/ux-evidence-matrix.md` using synthetic or de-identified data. A direct changed-surface defect or missing required rendered evidence blocks completion. Record unavailable tooling and the best safe alternative without turning it into a separate gate. Dispatch a ux-usability-reviewer only when the changed interaction needs independent usability judgment; code and conformance review follow their normal risk triggers.
- Behavior change or bug fix: use the fresh implementor role unless the change is purely mechanical.
- Before a behavior-bug implementor dispatch, reproduce the bug, identify its root cause, and inspect plausible same-cause usages. Invoke `$bugfix-issue-class-audit` only when material scope ambiguity remains; use a read-only pre-implementation spec reviewer only when the scope decision may conflict with approved intent.
- Task-start spec-review dispatch is prohibited. Do not use the spec reviewer to refine routine task-start requirements or to invent requirements.
- Task conformance: after targeted verification, use the spec reviewer for substantive, multi-part, ambiguous, or materially changed behavior. Provide the final diff, evidence, and approved intent; the reviewer may identify nonconformance but must not invent requirements.
- Code simplification: dispatch only when coordinator inspection identifies a concrete avoidable cost in the active task diff. Name that signal and authorize only the affected files. A no-edit result is valid; repository-wide cleanup is separate work.
- Final integration: before publishing an implementation branch or epic handoff,
  merge, PR approval, or epic closure, run the independent epic branch review with
  the epic reviewer and fresh epic spec/conformance review with the spec reviewer.
  Invoke `$epic-development-branch-completion` to coordinate that PR-stage or
  epic-completion handoff.

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

Only one implementor or simplifier may edit a file set at a time. Reviewers may run in parallel and should remain read-only unless explicitly asked to patch.

A simplifier handoff names the observed complexity and the smallest relevant check.
Run final verification after an edit. Route changed evidence only to the affected
review authority; request a complete re-review only when a named material invalidator
makes the prior conclusion stale. Unchanged evidence never triggers another pass.

### Conformance Escalation And Re-Review

Keep the three conformance gates separate:

- **Planning conformance** is the senior-developer review after design approval and before Trekker creation. Its input is the approved design and proposed Trekker plan; its output is plan corrections or an escalation.
- **Task conformance** is the spec-reviewer check used after targeted verification when approved intent is substantive, multi-part, ambiguous, or materially affected. Its input is the active Trekker task, final task diff, and verification evidence; its output is a conformance finding against approved intent, not a newly invented requirement.
- **Final integration** has two independent gates: the epic-reviewer's branch review
  and a fresh spec reviewer's epic spec/conformance review. Both inspect the committed
  cumulative range, complete working-tree evidence, Trekker evidence, and PR/branch
  state; together they produce release/merge readiness and cross-task conformance
  findings.

Route findings by impact:

- A small clarification consistent with approved intent: the coordinator updates the active Trekker task and records the decision, then re-runs the affected reviews on the changed final diff and evidence.
- A material task-plan conflict: pause completion and return to senior-developer implementation-plan review before changing planning records.
- A product, architecture, data, auth, migration, or scope change: return to architecture/design review and obtain the applicable user approval before updating the design or plan.
- After a review fix, route only the changed delta and affected evidence to the relevant authority. Require both task reviews again only for a named material invalidator. Route final-integration fixes through `$epic-development-branch-completion`.

## 7. Plan New Features

For new feature requests, use `docs/feature-planning.md`.

After discovery approval, the main coordinator enters actual Codex Plan Mode before
new-feature design or formal planning begins. The repository's "Feature Planning
Mode" protocol name means that actual Codex Plan Mode state. A subagent may provide
an advisory draft or review, but the main agent owns user interaction, approval
gates, and Trekker writes. Codex Plan Mode continues through implementation-plan
approval and authorization for Trekker creation plus Task 1, then the coordinator
must transition to write-capable Default mode before any Trekker or repository write.

Before duplicate confirmation or formal planning, invoke `$feature-discovery` for every
proposed feature, capability, workflow, or substantial behavior change. Continue
only after the user approves its Discovery Brief and Decision Log. The sole
exceptions are an explicit user opt-out or a small, fully specified mechanical task;
document the exception and rationale. If discovery classifies the request as a bug
fix, refactor, or fully specified execution task, route it to the applicable
workflow instead of the feature-planning workflow. Reuse a current, complete
discovery duplicate search; search or refresh Trekker only when that evidence is
missing, incomplete, or stale for the approved scope.

Short version:

1. Complete `$feature-discovery` and obtain approval of its Discovery Brief and
   Decision Log, unless a documented exception applies.
2. Search Trekker for duplicates or related work as the formal planning gate.
3. Brainstorm in Codex planning space only.
4. Draft a proportionate design spec from the approved Minimality decision; do not expand the solution to justify an epic.
5. For a named material architecture risk, run architecture/design review, validate feedback, and incorporate it or record why it was rejected; otherwise record the proportional skip rationale.
6. Get user approval.
7. Choose a durable spec file under `docs/specs/` for every approved feature plan.
8. Convert the spec into a Trekker implementation plan: epic, tasks, subtasks, dependencies, and verification.
9. For meaningful task, dependency, or verification risk, run senior-developer planning conformance, validate feedback, and incorporate it or record why it was rejected; otherwise record the proportional skip rationale.
10. While still in Codex Plan Mode, get user approval of the implementation plan and authorization to create Trekker records and execute planning Task 1 only.
11. Transition out of Codex Plan Mode into write-capable Default mode before any Trekker write, branch creation, spec persistence, commit, or Task 1 execution.
12. In Default mode, create or update Trekker.
13. In Default mode, execute and complete only Task 1: create or switch to the focused epic feature branch, save and commit the approved spec, and record the branch name, spec path, and planning commit hash on the epic.
14. Treat Task 1 completion as the end of the overall discovery, design, and planning handoff; actual Codex Plan Mode ended after step 10.
15. Leave later tasks `todo` and the epic open; require a fresh explicit user approval before Task 2 or any implementation task starts or becomes `in_progress`.
16. Mirror only the current session with `update_plan` after Trekker is accurate.

Do not create durable Trekker records during brainstorming unless the user explicitly approves.
Implementation-plan/Trekker approval authorizes Task 1 only, not feature
implementation. If the user does not approve continuation, preserve a resumable
handoff in Trekker with the Task 1 `Summary:`, branch/spec/planning-commit references,
dependencies, later `todo` tasks, and the open epic.

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
git diff -- <task files>
git add <intended task files>
git commit -m "<scoped task summary>"
trekker comment add TREK-ID -a "codex" -c "Summary: ..."
trekker task update TREK-ID -s completed
trekker ready
```

Before that commit, inspect the task diff and confirm only intended task work is
staged. Each completed task must have its own scoped commit before selecting the next
task. The `Summary:` comment must include that commit hash, what changed, what was
verified, and any residual risk. If the work exposed friction in the agent workflow,
include the validated feedback or the follow-up Trekker id.

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

At PR stage or epic completion, invoke `$epic-development-branch-completion`.
It verifies per-task commit and Trekker `Summary:` boundaries, assembles cumulative
and complete working-tree evidence, runs both final-integration gates, and guides the
draft-PR handoff. Those gates are the initial cumulative pass; the skill also routes
any remediation closure. The coordinator retains Trekker, approval, push, and PR ownership.

- Prefer a focused branch per task or small related task set.
- Use the `codex/` branch prefix unless the user asks for another naming scheme.
- Keep branch scope aligned with Trekker scope.
- Create or switch to the focused branch before editing an epic or focused task set.
- Before PR stage or epic completion, dispatch the two independent cumulative
  final-integration reviews for the initial pass: the epic reviewer for branch review
  and a fresh spec reviewer for epic spec/conformance. Each receives the cumulative
  range from
  `git merge-base <target> HEAD` through `HEAD`, plus `git status --short --branch`,
  `git diff`, and `git diff --cached`; no reviewer may assume that unstaged changes
  are the complete epic.
- If either review requires a substantive final-integration fix, commit that intended
  post-review work first, then use `$epic-development-branch-completion` to resolve
  the remediation before publication.
- For implementation branch or epic work, the default review handoff is a draft PR unless the user explicitly opts out. Before handing it back, complete the initial gates and any required scoped or cumulative remediation closures, commit and push the intended changes, open the draft PR, and confirm required checks are visible. Fix CI-only failures that are in scope; otherwise document the failure and exact next step.
- Use `gh` for PR creation when the GitHub connector lacks PR-create permission. Request escalation up front for known sandbox-limited git or `gh` publish operations instead of repeating failed attempts.
- For `gh pr create` or `gh pr edit`, write multiline Markdown into a temporary file and use `--body-file <path>`. Do not put escaped `\n` sequences in a command-line body argument: GitHub will render them literally. Remove the temporary file after the command succeeds.
- Run the code reviewer before completing a task with substantive behavior or material risk.
- Before publishing an epic or branch handoff, merging an epic branch, closing an epic,
  or merging a high-risk PR, complete the initial gates and any remediation closure
  required by `$epic-development-branch-completion`.
- Do not merge or deploy unless the user asked for that action.

## 11. Review Checklist

Before final response:

- Trekker status is accurate.
- `git status --short --branch` has been checked.
- Tests or build were run, or the reason they were skipped is clear.
- Specialist reviews required by the task's behavior and risk were completed; any coordinator-only low-risk verification has a short rationale.
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
