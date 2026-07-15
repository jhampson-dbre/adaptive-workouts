# Agent Instructions

This repository is optimized for task-tracked AI agent work. Treat Trekker as the source of truth for planning, task state, and handoff notes.

## Coordination Model

The main agent session owns coordination. It may dispatch specialized subagents, but it remains responsible for Trekker state, final integration, verification, and user communication.

The user authorizes the main agent to dispatch the project-scoped subagents required by this repository workflow without a separate per-session delegation request. Use that authority deliberately: required planning reviewers may be dispatched before their approval gates, while the main agent keeps Trekker ownership and avoids unnecessary parallel work.

Use the role contracts in `docs/agents/`:

- `docs/agents/main-coordinator.md`: main session responsibilities
- `docs/agents/feature-planner.md`: main-session protocol for new feature brainstorming, design, and Trekker planning
- `docs/agents/architecture-design-reviewer.md`: design-spec architecture and product-fit review
- `docs/agents/senior-developer-reviewer.md`: implementation-plan sequencing, TDD, and execution-risk review
- `docs/agents/implementor.md`: TDD implementation work
- `docs/agents/spec-reviewer.md`: post-verification task-conformance review
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
- Planning conformance: after the user approves the design and before presenting Trekker task/subtask creation for approval, use the senior-developer-reviewer to review the proposed Trekker plan.
- Documentation-only, copy-only, or tiny config changes: main agent may handle directly.
- Every tracked implementation task: dispatch a fresh implementor. After targeted verification produces the final task diff and evidence, dispatch a fresh code reviewer and a fresh task-conformance spec reviewer; do not reuse either reviewer across task boundaries, even within the same epic.
- Any behavior change or bug fix: use the fresh implementor role unless the change is truly mechanical.
- Before dispatching an implementor for a behavior-bug task, reproduce the problem and identify its root cause, then use the repository `$bugfix-issue-class-audit` skill for every non-mechanical or user-facing behavior bug. A genuinely mechanical localized correction does not require the full audit when the coordinator documents why. For non-mechanical or user-facing bugs, a read-only spec reviewer validates the audit only; this narrow pre-implementation check is not routine task-start requirements discovery and does not replace the post-verification task-conformance review.
- Task-start spec-review dispatch is prohibited. Do not use the spec reviewer to invent, refine, or gate routine task-start requirements.
- Task conformance: run the post-verification spec reviewer alongside code review against the final diff, targeted verification evidence, and the Trekker task's approved intent; it checks conformance and does not invent new requirements.
- Final integration: before publishing an implementation branch or epic handoff,
  merge, PR approval, or epic closure, run the independent epic branch review with
  the epic reviewer and fresh epic spec/conformance review with the spec reviewer.
  Invoke `$epic-development-branch-completion` to coordinate this PR-stage or
  epic-completion handoff.

Parallel reviewers are allowed. Only one implementor may edit a given file set at a time. Reviewers are read-only unless the main agent explicitly asks them to prepare a patch.

An agent may receive a follow-up only for the same Trekker task when the coordinator
labels it as a same-task continuation and supplies the changed scope, new evidence,
and the decision needed. A follow-up must not silently expand into another task. For
post-review fixes in the same task, prefer a second fresh code reviewer; when that is
not practical, the original reviewer may perform an explicitly labeled delta review
of only the changes since its prior report. A task-conformance spec reviewer follows
the same boundary: use a fresh reviewer for each task, while a same-task follow-up is
limited to an explicitly labeled approved-intent clarification and its revised final
diff/evidence delta. A material plan conflict must go to senior-developer planning
conformance, not back to the spec reviewer.

Conformance escalation and re-review are explicit:

- For a small clarification that preserves approved intent, the coordinator updates the active Trekker task, records the decision, and sends the final changed diff and evidence through the affected task reviews again.
- For a material conflict with the approved task plan, stop task completion and return the plan to the senior-developer implementation-plan reviewer before changing Trekker planning records.
- For a product, architecture, data, auth, migration, or scope change, return to architecture/design review and obtain the applicable user approval before changing the design or plan.
- Any fix or clarification that changes the final task diff requires renewed code review and task-conformance review of that changed final diff; after committing a substantive final-integration change, rerun both the epic branch review and fresh epic spec/conformance review.

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
3. Create or switch to the focused `codex/` branch for the task or epic before any
   edits; confirm the branch and unrelated dirty files with `git status --short --branch`.
4. Mark the selected task `in_progress` before changing files.
5. Read the relevant code and tests before editing.

### Behavior-Bug Issue-Class Audit (Before Implementor Dispatch)

This coordinator-owned gate applies after reproduction and root-cause identification,
but before an implementor is dispatched. Invoke the repository
`$bugfix-issue-class-audit` skill for every non-mechanical or user-facing behavior
bug; document why a genuinely mechanical bug does not need it. It is bug triage and
scoping, not Feature Planning and not implementor execution. The coordinator must run a targeted search
for same-class usages (for example, the shared component, helper, state path,
validation rule, API contract, or repeated field) and add an audit note to the active
Trekker task. The note records the root cause, search method and results, every
candidate inspected, affected and unaffected surfaces with rationale, and the scope
decision.

For a non-mechanical or user-facing behavior bug, dispatch a read-only spec reviewer
to validate the audit against the already approved task intent. That reviewer may
identify an unsupported scope decision or escalation trigger, but must not invent or
refine requirements. This is the limited issue-class-audit exception to the
task-start spec-review prohibition; dispatch the normal fresh task-conformance
reviewer again after implementation verification.

Include the approved complete behavior and file scope, the audit result, and the
required regression-test matrix in the implementor handoff. Implementors apply that
scope; they are not responsible for discovering omitted sibling defects while coding.
Expand the current task only when a finding shares the confirmed root cause, remains
within approved product intent, and can be implemented and verified as one cohesive
change. Record the expanded scope in Trekker before dispatch. Use a linked follow-up
when the finding has a different root cause, independent risk or ownership, requires
a material scope/design decision, or would prevent focused verification. Search for a
duplicate and obtain the required user approval before creating or materially changing
that follow-up; record the linkage and rationale in the audit note.

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
2. Inspect the task diff and run `git status --short --branch`; confirm only intended
   task files changed.
3. Commit all intended task work with a scoped commit before marking the task
   `completed` or selecting the next task. Record the resulting commit hash in the
   task's `Summary:` comment.
4. Add a `Summary:` comment to the Trekker task.
5. Include TDD evidence for behavior changes: failing test, implementation, passing verification. If TDD was skipped, explain why.
6. Mark the task `completed`.
7. Run `trekker ready` and report the next ready task.
8. If workflow friction was discovered, either document why no change is needed or create/link a follow-up Trekker task.

When the active task belongs to an epic, continue with the next ready, in-scope
task in that epic unless a user decision, external blocker, meaningful scope
expansion, explicit pause/stop request, or authorized-work boundary requires a
handoff. The new-feature planning boundary below is such an authorized-work
boundary: after planning Task 1, do not continue to Task 2 without fresh explicit
user approval. Do not switch to an unrelated ready task merely because it appears
in `trekker ready`.

Before final handoff for non-trivial tracked, PR-bound, or epic work, run an
after-action workflow audit: confirm no required step needed a user reminder, the
repository handoff endpoint was reached, known sandbox/permission fallbacks were
used rather than retried blindly, reviewer feedback did not expose scope or
bookkeeping drift, and Trekker matches reality. Inventory every residual or
nonblocking handoff risk (including deferred verification, reviewer notes, and PR
body caveats), search for a duplicate, then give each one a durable Trekker
disposition: link an existing task, create or extend an appropriate backlog task, or
record an intentional-not-tracked exception in the active task's `Summary:` (or
`Checkpoint:` when pausing) with the duplicate-search result and concise rationale.
Creating or materially changing a backlog item still requires the user approval that
applies to Trekker writes; until that approval exists, leave the active task
checkpointed with the proposed item and rationale. Treat a user-reminded workflow
miss as `Workflow feedback:` and validate it for `EPIC-6`; state in the final
response whether no follow-up was found or name the Trekker item created or updated.

Do not mark work complete without a `Summary:` comment.

## Tracking Rules

- Search before creating tasks: use one distinctive keyword at a time, such as `trekker search "auth"` or `trekker search "migration"`.
- Serialize Trekker writes (create, update, dependency, and comment operations). Run reads in parallel only when they are independent and known safe; on a transient `database is locked` error, wait briefly and retry the failed command sequentially.
- Prefer extending existing tasks over creating duplicates.
- Keep one active implementation task when practical.
- If a task is partly done, leave it `in_progress` with a `Checkpoint:` comment.
- If work is blocked by outside setup or user action, document the blocker clearly in Trekker.
- Do not use ad hoc notes, chat summaries, or local todo files as the durable system of record.

## New Feature Planning

Use `docs/feature-planning.md` for new feature work.

Codex planning is a temporary scratchpad for brainstorming and shaping the feature. Trekker is the durable source of truth after the user approves the plan.

Feature planning is a main-session mode, not a hidden delegated workflow. The main agent may ask the feature-planner-advisor for an advisory draft, but the main agent owns the planning conversation, approval gates, review integration, and Trekker creation.

Before entering formal Feature Planning Mode, invoke the repository
`$feature-discovery` skill for every proposed feature, capability, workflow, or
substantial behavior change. Discovery is a collaborative, pre-planning
conversation: it produces a user-approved Discovery Brief and Decision Log before
the formal duplicate-search gate, feature-planner-advisor, design review, or
Trekker planning begins. The coordinator may inspect repository or Trekker context
needed to ground discovery; that exploratory lookup does not replace the formal
duplicate search after discovery. Skip it
only when the user explicitly opts out or the request is a small, fully specified
mechanical task; record the applicable exception and rationale. If discovery shows
the request is actually a bug fix, refactor, or fully specified execution task,
route it to that workflow instead of forcing feature planning.

Planning flow:

1. Complete `$feature-discovery` and obtain user approval of its Discovery Brief,
   unless a documented exception applies.
2. Search Trekker for duplicates or related work as the formal planning gate (even
   if exploratory Trekker context was inspected to ground discovery).
3. Brainstorm and identify open questions without creating Trekker items.
4. Draft an epic-level design spec.
5. Run architecture/design review, validate the feedback, and either incorporate it or record why it was not accepted.
6. Present the revised design spec to the user for approval.
7. Choose the durable spec path under `docs/specs/`; every approved feature plan
   will save its spec there during planning Task 1.
8. Convert the approved design into an implementation plan: epic, tasks, subtasks, dependencies, and verification. Task 1 must create or switch to the focused `codex/` epic feature branch, save and commit the approved spec, and record the branch name, spec path, and planning commit hash on the epic.
9. Run planning conformance with the senior-developer implementation-plan reviewer, validate the feedback, and either incorporate it or record why it was not accepted.
10. Ask for approval before creating or updating Trekker records.
11. Create Trekker epic/task/subtask records and dependencies.
12. Stay in Plan Mode and execute only Task 1. Complete it with its scoped planning commit and `Summary:`, and record the branch/spec/planning-commit references on the epic. Task 1 completion is the explicit end of discovery, design, and planning.
13. Validate and capture planning-funnel workflow feedback under `EPIC-6`, or explicitly record why it is deferred.
14. Leave Task 2 and every later implementation task `todo`, leave the epic open, and hand off from Trekker. Ask for a fresh explicit user approval to continue before starting or marking Task 2 (or any implementation task) `in_progress`.
15. Mirror only the current session in `update_plan` after Trekker is correct.

Do not create Trekker epics, tasks, or subtasks from brainstorming unless the user has approved the design and implementation plan.
Approval of the implementation plan and Trekker writes authorizes planning Task 1
only; it is not approval to implement the feature. Without the separate continuation
approval, the branch, committed spec, epic references, task statuses, and Task 1
`Summary:` must make the handoff fully resumable without chat context.

## Repo Safety

- Do not revert user changes unless the user explicitly asks.
- Treat untracked files as user-owned unless you created them in the current task.
- Run `git status --short --branch` before edits and before the final response.
- Keep edits scoped to the active task.
- Avoid unrelated refactors, formatting churn, dependency churn, and generated output unless required.
- Never commit secrets. Production Firebase values belong in Vercel environment variables or local ignored env files.

## Branch And PR Cadence

At PR stage or epic completion, invoke `$epic-development-branch-completion`. It
checks per-task commit and `Summary:` boundaries, prepares cumulative and complete
working-tree evidence, runs the two final-integration gates, and guides the draft-PR
handoff while the coordinator retains Trekker, push, PR, and approval ownership.

- Prefer a focused branch per task or small related task set.
- Use the `codex/` branch prefix unless the user asks for another naming scheme.
- Keep branch scope aligned with Trekker scope.
- Open a PR when the task or task set is ready for review.
- Run the code reviewer before marking a non-trivial task complete.
- Before PR stage or epic completion, run two independent final-integration gates: an
  epic branch review and an epic spec/conformance review. Both reviewers inspect the
  cumulative `git merge-base <target> HEAD` range through `HEAD`, not only unstaged
  changes, and separately receive `git status --short --branch`, `git diff`, and
  `git diff --cached` so staged and unstaged integration work is both visible.
- If a final-integration finding requires a substantive change, commit the intended
  post-review fix first. Then re-run both final-integration reviews against the
  updated committed range and current clean or fully reported working-tree evidence;
  begin another loop only when a further substantive change is required.
- For implementation branch or epic work, the default review handoff is a draft PR unless the user explicitly opts out: complete both final-integration reviews, commit and push intended changes, open the draft PR, and confirm required checks are visible, passing, or documented with exact next steps. Prefer `gh` when the GitHub connector cannot create PRs, and request escalation for known sandbox-limited git or `gh` publish operations.
- When creating or editing a PR with `gh`, write a multiline Markdown body to a temporary file and pass it with `--body-file`; never pass a shell-escaped string containing literal `\n`. Remove the temporary file after the command succeeds.

## Review Expectations

Every task should get a quick spec review and code review before completion:

- Does the implementation satisfy the Trekker task and any referenced spec?
- Are edge cases handled for the changed behavior?
- For behavior-bug tasks, does the final diff and regression-test matrix cover every affected surface in the approved issue-class audit, with no unexplained divergence?
- Are failures visible enough to troubleshoot?
- Did the right tests run?
- Is there any production setup or deployment checklist item still open?

If a user asks for a review, lead with findings ordered by severity, using file and line references when applicable.

For non-trivial tasks, use the specialized role docs:

- Implementor for TDD implementation.
- Code review and task conformance after targeted verification, against the final diff and approved Trekker intent.
- Both final-integration gates—epic branch review and fresh epic spec/conformance
  review—before merging, closing an epic, or publishing an implementation handoff.

Routine task-start spec review is prohibited. Escalate a material requirements or
design conflict through the conformance rules instead of using the spec reviewer to
invent requirements.

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
