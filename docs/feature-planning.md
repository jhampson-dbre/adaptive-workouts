# Feature Planning

Use this workflow when the user wants to brainstorm, design, or plan a new feature before implementation.

## Required Discovery Gate

Before formal feature planning, invoke `$feature-discovery` for every proposed
feature, capability, workflow, or substantial behavior change. The skill is a
collaborative discovery conversation, not Trekker work or implementation. Complete
its Discovery Brief and Decision Log, then obtain the user's explicit approval to
hand the brief to the `feature-planner-advisor` before starting this workflow. The
coordinator may inspect repository or Trekker context needed to ground discovery;
that exploratory lookup does not replace the formal duplicate-search gate below.

Skip discovery only when the user explicitly opts out or the request is a small,
fully specified mechanical task. State the exception and rationale in the planning
conversation. If discovery identifies a bug fix, refactor, or fully specified
execution task instead, use the applicable workflow rather than continuing with
feature planning.

Codex planning is the scratchpad. Trekker is the durable source of truth.

Feature planning runs in the main agent session. After discovery approval, the main
coordinator must enter actual Codex Plan Mode before new-feature design or formal
planning begins. In this document, "Feature Planning Mode" means that actual Codex
Plan Mode state through implementation-plan approval and the user's authorization
for Trekker creation and Task 1. Before any Trekker write, branch creation, spec
persistence, commit, or Task 1 execution, the coordinator must transition to write-
capable Default mode. A subagent may help draft or review, but the main agent owns
the user conversation, approval gates, review integration, and Trekker writes.

Architecture/design and senior-developer reviews required by this workflow are
standingly authorized dispatches. The main coordinator should request them before
the applicable approval gate without asking for a separate delegation decision;
the user still controls design approval and Trekker record creation.

## Goals

- Preserve the creative design loop before committing to tracking.
- Avoid duplicate Trekker work.
- Turn approved feature designs into Trekker epics, tasks, subtasks, dependencies, and verification criteria, beginning with a mandatory planning Task 1.
- Keep execution Trekker-driven after planning.
- Validate plans with specialized reviewer feedback before asking for human approval.

## Phase 1. Search And Frame

After discovery approval, search Trekker before drafting anything durable. If
repository or Trekker context was inspected to ground discovery, repeat this search
as the formal planning gate:

```bash
trekker search "distinctive-keyword"
trekker search "adjacent-keyword"
```

Review related tasks, comments, histories, and statuses when search finds plausible overlap.

Outcome:

- reuse existing work, or
- extend existing work, or
- proceed with a new feature proposal.

Do not create Trekker items in this phase unless the user explicitly asks.

## Phase 2. Brainstorm

Use Codex planning as a temporary whiteboard.

Clarify:

- problem or opportunity
- target user workflow
- constraints
- unknowns
- likely app areas touched
- risks
- possible feature slices

Outcome:

- concise feature direction
- open questions for the user
- no Trekker writes yet

## Phase 3. Design Spec

Draft an epic-level design spec for user approval.

Recommended shape:

```text
Title:
Problem:
Goals:
Non-goals:
User experience:
Behavior rules:
Data model / storage:
UI surfaces:
Edge cases:
Migration / deployment notes:
Testing strategy:
Acceptance criteria:
Open questions:
```

Treat this as the proposed Trekker epic. It may live only in the conversation until approved, but every approved feature plan must save the final spec under `docs/specs/YYYY-MM-DD-feature-name.md` or another agreed durable path during planning Task 1.

For any design that creates, reads, writes, migrates, reuses, or changes persisted
timing or duration data, add a `Persisted duration contract` table to the design
spec. Enumerate every existing and proposed duration field in the affected storage
and compatibility boundary; do not group fields whose semantics differ. For each
field, record:

- field name and full persisted path
- schema/app versions that read or write it
- storage unit
- rounding or precision policy at input, storage, and display boundaries
- nullability and the meaning of null, missing, zero, and any sentinel value
- cross-version read behavior, including how legacy units are detected or known
- write and migration behavior, including whether old and new versions can safely
  coexist

```text
| Field / persisted path | Reader/writer versions | Storage unit | Input/storage/display rounding or precision | Null/missing/zero/sentinel semantics | Cross-version reads / legacy-unit detection | Writes / migration / coexistence |
| --- | --- | --- | --- | --- | --- | --- |
```

The contract must resolve mixed-unit semantics explicitly (for example, a legacy
minutes field and a newer seconds field must not share an unresolved field name or
conversion rule). If compatibility cannot be made deterministic, keep it as a
blocking open question rather than deferring the decision to implementation.

## Phase 4. Architecture / Design Review

Before architecture review, classify UI work as `required`, `optional`, or
`skip-recorded` and record the decision with a durable rationale for optional and
skip-recorded work. Required work needs a proportional scenario-indexed UX artifact
using `docs/templates/ux-evidence-matrix.md` and a fresh ux-design-reviewer before
architecture-design-reviewer. Architecture retains authority for system boundaries,
data, security, and feasibility; the UX reviewer validates the user-flow contract and
does not authorize product, Trekker, or architecture changes. If material architecture
changes alter the approved UX contract, return through UX design review before user
approval. Later evidence must re-probe capability on each future required run; do not
cache waivers.

Before telling the user the design is ready for approval, run the `architecture-design-reviewer` for all new feature epics. If the `feature-planner-advisor` is drafting the spec and can dispatch nested subagents, it should request this review itself; otherwise it must return a handoff packet for the main coordinator to dispatch. For very small, low-risk feature tweaks, the main agent may perform the same checklist inline, but must say why a subagent review was skipped.

Give the reviewer:

- draft design spec
- related Trekker search results
- relevant project context or prior specs
- known constraints and non-goals
- likely touched app surfaces
- unresolved questions

The main agent must validate each reviewer finding before changing the design. Valid feedback should be incorporated into the design spec. Rejected feedback should be recorded in a short `Review notes:` section with the reason.

If the reviewer finds a material design gap, revise the design and run another targeted architecture/design review before user approval.

Approval gate 1: show the revised design spec, including relevant review notes, and ask the user to approve or revise it before converting it into an implementation plan.

## Phase 5. Implementation Plan

After design approval, convert the spec into Trekker-shaped work:

- one epic
- small independently completable tasks
- subtasks for concrete implementation steps
- dependencies for required ordering
- verification criteria per task
- likely subagent roles per task
- TDD expectations per task

Every feature implementation plan starts with this planning boundary task:

```text
Task 1: Establish the epic feature branch and durable approved spec
  - create or switch to the focused `codex/` epic feature branch
  - save the user-approved design and implementation plan at the agreed spec path
  - commit only the approved planning artifact(s) in a scoped planning commit
  - record the branch name, spec path, and planning commit hash on the Trekker epic
  - add the Task 1 `Summary:` and mark Task 1 completed
```

Task 2 is the first implementation task and depends on Task 1. The implementation
plan must state that Task 2 and all later implementation remain `todo` until the
user gives a separate, fresh, explicit approval to continue after Task 1 completes.

For each verification criterion, label it as one of:

- immediate: can be run before the task is handed off
- deferred: requires a PR, deployment, production setup, or user action

For a deferred check, state its trigger, evidence, owner, and completion boundary.
Keep it in the implementation task only when that task remains open through the
trigger; otherwise create a dependent follow-up task or subtask. Do not describe a
deferred check as complete before its evidence exists.

Task descriptions should answer:

- what changes
- why it matters
- where work happens
- what proves it works

Subtasks should be concrete steps, not vague reminders.

Use this creation proposal format:

```text
Creation Proposal

Epic:
  Title:
  Description:
  Acceptance criteria:
  Design reference:
  Feature branch: recorded by Task 1
  Approved spec path: recorded by Task 1
  Planning commit: recorded by Task 1

Tasks:
  - Title: Establish the epic feature branch and durable approved spec
    Description: Create/switch branch, save and commit spec, and record branch/spec/planning-commit references on the epic.
    Depends on: none
    Verification: branch, committed spec, epic references, and Task 1 Summary agree
    TDD expectation: none; planning artifact only
    Suggested subagents: none unless explicitly useful
  - Title:
    Description:
    Depends on:
    Subtasks:
      - Title:
        Description:
    Verification:
    TDD expectation:
    Suggested subagents:

Dependencies:
  - DEPENDENT depends on BLOCKER because ...
```

## Phase 6. Planning Conformance Review

After the user approves the design and before telling the user the implementation plan is ready for Trekker creation approval, run planning conformance with the `senior-developer-reviewer` for all new feature epics. If the `feature-planner-advisor` is drafting the implementation plan and can dispatch nested subagents, it should request this review itself; otherwise it must return a handoff packet for the main coordinator to dispatch. For tiny, low-risk plans, the main agent may perform the same checklist inline, but must say why a subagent review was skipped.

Give the reviewer:

- approved design spec
- proposed epic, tasks, subtasks, and dependencies
- verification criteria
- TDD expectations
- suggested subagent roles
- related Trekker context
- known constraints, risks, and non-goals

The main agent must validate each reviewer finding before changing the implementation plan. Valid feedback should be incorporated into the proposed Trekker records. Rejected feedback should be recorded in a short `Review notes:` section with the reason.

If planning conformance raises a material task-plan conflict, revise the plan and repeat planning conformance before requesting Trekker-creation approval. If it raises a product, architecture, data, auth, migration, or scope change, return to Phase 4 for architecture/design review and the applicable user approval before updating the implementation plan again.

## Phase 7. Implementation Specificity Pass

Before asking for Trekker creation approval, make the implementation choices that
would otherwise be left to the first implementor. For each task, record:

- named artifacts: the expected file, script, config key, route, or other concrete output
- chosen mechanism: the library, command pattern, lifecycle, or integration approach when it matters
- implementation discretion: decisions deliberately left to the implementor, with boundaries
- deferred verification: checks that require an external event, such as a PR, deployment, or production setup
- completion boundary: whether the task may be completed locally or must remain open until its deferred check occurs

Keep this pass proportional: small tasks need only short, concrete notes. Resolve
meaningful choices before approval so the Trekker records do not make future
implementors guess, while leaving ordinary coding details open where they do not
affect consistency or verification.

## Phase 8. Approval Gate

Before writing to Trekker, show the proposed epic/task/subtask structure and ask for approval. Include relevant review notes so the user can see what changed during reviewer validation.

Do not create or update Trekker records until the user approves the implementation plan.

Approval gate 2: ask the user to approve Trekker record creation.

This approval authorizes creation of the approved Trekker plan and execution of
planning Task 1 only. State explicitly that it does not authorize Task 2 or any
feature implementation. Codex Plan Mode remains active through this approval, then
ends. The coordinator must transition to write-capable Default mode before creating
or updating Trekker records or performing any Task 1 filesystem or Git action.

## Phase 9. Create Trekker Records

After approval:

Transition out of Codex Plan Mode into write-capable Default mode before running
any command below. Do not perform Trekker writes, create or switch branches, persist
the spec, commit, or execute Task 1 while still in Plan Mode.

```bash
trekker epic create -t "Epic title" -d "Approved design summary"
trekker task create -t "Task title" -d "What/why/where/verification" -e EPIC-ID -p 2
trekker subtask create -t "Step title" -d "Concrete step" --parent TREK-ID
trekker dep add DEPENDENT-TASK-ID BLOCKING-TASK-ID
```

Use exact command syntax supported by the local Trekker CLI. Before bulk creation, inspect `trekker --help` or an existing successful local command pattern if syntax is uncertain.

Create records, dependencies, and comments sequentially so each write is durable
before the next begins. Parallelize only independent, read-only context lookups. On
a transient `database is locked` error, retry the failed command sequentially after
a brief wait rather than re-running a bulk command.

Add comments to the epic or first task when needed to preserve:

- approved design link or summary
- user decisions
- known non-goals
- unresolved risks

The epic must preserve the focused branch name, durable spec path, and planning
commit hash. These references are mandatory rather than optional comments.

## Phase 10. Complete Planning Task 1

In write-capable Default mode, execute only Task 1:

1. Create or switch to the focused `codex/` epic feature branch.
2. Save the approved design and implementation plan at the agreed durable spec path.
3. Commit the planning artifact(s) in a scoped commit.
4. Record the branch name, spec path, and planning commit hash on the epic.
5. Add a `Summary:` with the same references and mark only Task 1 completed.

Task 1 completion is the explicit end of the overall discovery, design, and formal-
planning handoff, even though actual Codex Plan Mode ended after the approval gate.
It is not the start of feature implementation.

## Phase 11. Sync Session Plan

Before mirroring the implementation plan into execution, validate any planning-funnel
workflow feedback. Capture durable follow-ups under `EPIC-6` now, or explicitly
record why the feedback is deferred. Only then prepare the approved, tracked plan
for a resumable handoff.

Only after Trekker is accurate, mirror the immediate work in Codex `update_plan`.

Trekker wins if the session plan and Trekker ever diverge.

## Phase 12. Approval-Bounded Execution Handoff

Leave Task 2 and every later implementation task `todo`, and leave the epic open.
Ask the user for a fresh, explicit approval to continue. Approval of the design,
implementation plan, Trekker writes, or Task 1 does not satisfy this execution gate.

Without approval, stop with a fully resumable Trekker handoff containing the branch,
spec, planning commit, dependencies, Task 1 `Summary:`, later `todo` tasks, and open
epic status. Do not mark Task 2 or any implementation task `in_progress`.

Only after the fresh continuation approval does execution start from Trekker:

```bash
trekker ready
trekker task show TREK-ID
trekker comment list TREK-ID
trekker history --entity TREK-ID
trekker dep list TREK-ID
trekker task update TREK-ID -s in_progress
```

Then use the normal TDD/subagent workflow in `docs/agent-workflow.md`.

## Planning UX Quality Gate

During discovery, classify UI work as `required`, `optional`, or `skip-recorded` and
preserve that decision in the Discovery Brief and durable plan. Optional and
skip-recorded decisions require a rationale. Required work must attach a proportional,
scenario-indexed UX artifact based on `docs/templates/ux-evidence-matrix.md` before
formal design review. The artifact records the screen's job, action hierarchy and
placement, compact wireframe, meaningful states, recovery, and feedback lifecycle;
its evidence records are completed proportionally during execution.

For required work, dispatch a fresh ux-design-reviewer before architecture-design-reviewer.
Architecture retains authority for system boundaries, data, security, and feasibility;
UX review validates the user-flow contract and does not grant product or Trekker
authority. A material architecture change that alters the approved UX contract returns
through UX design review before user approval. Every future required evidence run must
re-probe capability; do not cache waivers. The planning
artifact records capability fields separately so later evidence can distinguish
applicability, per-run probe, `capability_state`, unsupported metadata, evidence kind,
outcome, evidence obligation, disposition, changed-surface routing, and allowed
recommendation.

## Planning Completion Checklist

Across the approval, record-creation, and Task 1 completion stages, confirm:

- `$feature-discovery` was completed and its Discovery Brief was user-approved before formal planning, or the explicit opt-out/small-mechanical exception and rationale were recorded
- UI work was classified as `required`, `optional`, or `skip-recorded`; optional and skip-recorded decisions have durable rationale
- required UI work has the proportional scenario-indexed artifact and a fresh UX design review before architecture review
- duplicate search was done
- user approved the design spec
- architecture/design review was run, or skipped with a reason for tiny low-risk work
- reviewer feedback was validated and incorporated, or rejected with reasons
- a durable spec path was chosen for the approved feature plan
- planning conformance with the senior-developer implementation-plan reviewer was run, or skipped with a reason for tiny low-risk work
- implementation-plan reviewer feedback was validated and incorporated, or rejected with reasons
- user approved the implementation plan
- the plan-approval grant is explicitly limited to Trekker creation and planning Task 1
- Codex Plan Mode ended after approval and the coordinator transitioned to write-capable Default mode before every Trekker, filesystem, branch, spec, commit, or Task 1 mutation
- the implementation plan begins with Task 1 for the branch, durable approved spec, scoped planning commit, and epic references
- tasks are independently completable
- dependencies encode ordering
- subtasks are concrete
- each task has verification criteria
- implementation-specificity choices, permitted discretion, deferred checks, and completion boundaries are explicit where relevant
- timing designs include a complete persisted-duration contract covering field/path, unit, rounding/precision, nullability/absence semantics, and cross-version read/write/migration compatibility
- deferred checks name their trigger, evidence, owner, and whether they need a follow-up task or subtask
- behavior tasks have TDD expectations
- execution can resume from Trekker alone
- only Task 1 was executed during planning; Task 2 and later tasks remain `todo`, the epic remains open, and fresh explicit continuation approval is still required
- reviewer or planner workflow feedback has been validated and either incorporated into the workflow, linked to a Trekker follow-up, or declined with a reason

## Planning Funnel Self-Improvement

The planning funnel should improve from real planning friction.

Durable planning-funnel follow-ups belong under `EPIC-6: Agent Workflow Improvements` with a `[Planning]` title prefix. Use the same epic for execution, review, Trekker, and agent-behavior improvements so cross-boundary workflow problems stay in one backlog.

During feature planning, capture workflow feedback when duplicate search does not recover enough context, the design spec template is missing a needed section, review handoffs lack enough context, approval gates are unclear, Trekker mapping is awkward or lossy, or reviewer feedback repeatedly causes the same kind of rework.

Use the standard workflow feedback format:

```text
Workflow feedback:
- Issue:
- Impact:
- Suggested change:
- Scope:
- Urgency:
```

The main coordinator validates the feedback before changing the funnel. Small clarifications may be folded into the planning branch. Larger changes should become a Trekker task under `EPIC-6` before being implemented.
