# Agent Workflow

Use this router for tracked work. `AGENTS.md` owns repository-wide boundaries;
Trekker owns durable task state; role TOMLs own executable agent contracts. Follow a
linked skill or role document only when its named condition applies.

## Start

1. Recover the task, comments, history, dependencies, branch, and worktree state.
   Search Trekker first when no task id is known. Reuse current evidence instead of
   repeating searches.
2. Confirm the requested outcome, accepted scope, and authorization boundary. On a
   resumed implementation task, the latest explicit authorization comment controls:
   stop and ask when it says authorization was not granted; proceed only within the
   scope of a later grant. Planning approval alone does not imply implementation
   authorization.
3. Work on one focused `codex/` branch and one coherent task at a time. Preserve
   unrelated changes.

Serialize Trekker writes. Independent read-only lookups may run together. Retry only
the failed write after a transient lock; do not repeat successful writes.

For new feature planning, use `docs/feature-planning.md`. Planning may proceed
directly into implementation when the user's authorization already covers the
approved scope; otherwise persist a resumable handoff and ask once.

## Inspect And Implement

Read the affected implementation, tests, callers, and approved intent before editing.
Prefer the existing path and the smallest change that protects the outcome.

For a behavior bug, reproduce it, identify the root cause, and inspect plausible
same-cause usages. Invoke `$bugfix-issue-class-audit` only when that inspection finds
material scope ambiguity, multiple affected boundaries, or a meaningful
current-task-versus-follow-up decision.

For a behavior change:

1. Add or update the focused test and confirm the expected failure.
2. Make the smallest passing change.
3. Run the focused test and proportionate surrounding checks.

Record why TDD was impractical for documentation, copy, mechanical configuration,
or externally verifiable work.

## Dispatch By Risk

The coordinator owns user communication, Trekker, integration, commits, and final
verification. A dispatch packet contains only the goal, approved scope, relevant
files and context, dirty-worktree notes, constraints, expected verification, and
expected output.

- Every tracked behavior change uses a fresh `implementor`.
- Use `code-simplifier` only after identifying a concrete complexity signal in a
  green task diff.
- Use `code-reviewer` for substantive behavior or material correctness/regression
  risk.
- Use `spec-reviewer` after verification when approved intent is substantive,
  multi-part, ambiguous, or materially affected. It checks conformance; it does not
  invent requirements.
- For required UI, preserve the approved UX artifact and rendered evidence. Use
  `ux-usability-reviewer` only when the changed interaction needs independent
  usability judgment.
- Before publishing an implementation branch or completing an epic, use
  `$epic-development-branch-completion` for the independent cumulative epic and
  conformance reviews.

Documentation, copy, and tiny mechanical configuration may be handled directly.
Reviewers remain read-only unless expressly authorized to patch. One editor owns a
file set at a time.

Validate every finding. Route changed evidence only to the authority affected by the
change. A complete re-review requires a named material invalidator; unchanged
evidence never triggers another pass.

## Verify And Complete

Choose the smallest verification set that would catch a regression in the changed
surface. Expand only for a concrete dependency or failure signal. Project commands
are listed in `AGENTS.md`.

Before committing:

- inspect the task diff and working tree
- confirm only intended files are staged
- run the proportionate checks
- resolve or durably record any real residual risk

Complete a tracked task with a scoped commit and a Trekker `Summary:` containing the
outcome, commit, verification, and remaining risk. Use a `Checkpoint:` instead when
an external trigger, user decision, or material blocker prevents completion. Do not
mark deferred evidence complete before it exists.

At PR or epic-completion stage, the cumulative review range is the merge base through
the committed branch tip plus the complete working-tree state. After a review fix,
review only the affected delta unless the fix materially invalidates the cumulative
conclusion. For implementation branch or epic work, use the draft-PR handoff unless
the user explicitly opts out: after final-integration reviews, push, open the draft
PR, and confirm required checks are visible and passing or documented with exact next
steps; never merge or deploy without user authorization.

## Escalate

Stop and ask for direction when the next step requires:

- a material product, architecture, data, auth, migration, or scope decision
- destructive or externally consequential authority not already granted
- unverifiable behavior that affects acceptance

Do not stop for routine implementation choices, a completed ceremonial phase, or
unchanged review evidence. Report genuine workflow ambiguity as `Workflow feedback:`
for coordinator validation; durable process improvements belong under EPIC-6.
