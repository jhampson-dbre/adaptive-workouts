# Feature Planning

Use this workflow when the user wants to brainstorm, design, or plan a new feature before implementation.

Codex planning is the scratchpad. Trekker is the durable source of truth.

Feature planning runs in the main agent session. A subagent may help draft or review, but the main agent owns the user conversation, approval gates, review integration, and Trekker writes.

Architecture/design and senior-developer reviews required by this workflow are
standingly authorized dispatches. The main coordinator should request them before
the applicable approval gate without asking for a separate delegation decision;
the user still controls design approval and Trekker record creation.

## Goals

- Preserve the creative design loop before committing to tracking.
- Avoid duplicate Trekker work.
- Turn approved feature designs into Trekker epics, tasks, subtasks, dependencies, and verification criteria.
- Keep execution Trekker-driven after planning.
- Validate plans with specialized reviewer feedback before asking for human approval.

## Phase 1. Search And Frame

Search Trekker before drafting anything durable:

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

Treat this as the proposed Trekker epic. It may live only in the conversation until approved.

For larger epics, propose saving a durable design document under `docs/specs/YYYY-MM-DD-feature-name.md` or another agreed path, then reference it from the Trekker epic after approval. For small features, conversation-only design is acceptable.

## Phase 4. Architecture / Design Review

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

Tasks:
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

## Phase 9. Create Trekker Records

After approval:

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

## Phase 10. Sync Session Plan

Before mirroring the implementation plan into execution, validate any planning-funnel
workflow feedback. Capture durable follow-ups under `EPIC-6` now, or explicitly
record why the feedback is deferred. Only then hand the approved, tracked plan to
execution.

Only after Trekker is accurate, mirror the immediate work in Codex `update_plan`.

Trekker wins if the session plan and Trekker ever diverge.

## Phase 11. Execution Handoff

Execution starts from Trekker:

```bash
trekker ready
trekker task show TREK-ID
trekker comment list TREK-ID
trekker history --entity TREK-ID
trekker dep list TREK-ID
trekker task update TREK-ID -s in_progress
```

Then use the normal TDD/subagent workflow in `docs/agent-workflow.md`.

## Planning Review Checklist

Before creating Trekker records, confirm:

- duplicate search was done
- user approved the design spec
- architecture/design review was run, or skipped with a reason for tiny low-risk work
- reviewer feedback was validated and incorporated, or rejected with reasons
- a durable spec file was proposed for larger epics
- planning conformance with the senior-developer implementation-plan reviewer was run, or skipped with a reason for tiny low-risk work
- implementation-plan reviewer feedback was validated and incorporated, or rejected with reasons
- user approved the implementation plan
- tasks are independently completable
- dependencies encode ordering
- subtasks are concrete
- each task has verification criteria
- implementation-specificity choices, permitted discretion, deferred checks, and completion boundaries are explicit where relevant
- deferred checks name their trigger, evidence, owner, and whether they need a follow-up task or subtask
- behavior tasks have TDD expectations
- execution can resume from Trekker alone
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
