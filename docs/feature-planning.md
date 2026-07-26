# Feature Planning

Use this workflow for a proposed feature, capability, workflow, or substantial
behavior change. Codex planning is temporary; Trekker and an approved spec are
durable when the work needs to survive the session.

## Minimal Flow

1. Start from a user-approved Discovery Brief and Decision Log, or record why
   discovery was explicitly skipped for a small, fully specified change.
2. Reuse current, complete duplicate-search evidence. Search Trekker only when that
   evidence is missing, incomplete, or stale for the approved scope.
3. Draft the smallest design that satisfies the approved outcome. Prefer an existing
   path, native behavior, or configuration before adding code, state, dependencies,
   or workflow.
4. Classify UI work as `required`, `optional`, or `skip-recorded`. Use UX design,
   architecture, or other specialist review only for a named material risk that
   needs independent judgment.
5. Obtain user approval for the proposed outcome and material design decisions.
6. Produce only the durable records needed to resume the work: a concise spec when
   design context is material, and Trekker tasks when the work is multi-step or must
   survive the session.
7. Begin implementation when the user's authorization includes it. Otherwise, leave
   a resumable handoff and ask once for implementation authorization.

A single user approval may cover the design, durable record creation, and
implementation when the requested scope makes that intent clear. Do not manufacture
separate approval ceremonies. Never treat planning approval as permission for a
materially different product, architecture, data, auth, migration, or scope decision.

## Proportional Design

Record only decisions an implementor cannot safely derive from the approved outcome
and repository conventions:

```text
Problem and desired outcome:
Non-goals:
User-visible behavior:
Material design decisions:
Affected surfaces:
Acceptance criteria:
Verification:
Open decisions or risks:
```

State what the design deliberately does not build and what evidence would justify
adding deferred complexity. Do not expand a solution to justify an epic, a review
role, or a durable document.

When persisted data, auth, migration, security, production configuration, or failure
recovery is affected, make the relevant contract explicit. For persisted timing or
duration data, name each affected field and its path, unit, precision, absence
semantics, reader/writer compatibility, migration behavior, and any recovery or
ownership metadata needed for deterministic restoration. Unresolved compatibility
is a blocking design decision, not an implementation detail.

## Proportional Review

Use reviewers only when their authority protects a named risk:

- Use `ux-design-reviewer` when required UI changes need independent judgment about
  flow, hierarchy, states, recovery, or accessibility.
- Use `architecture-design-reviewer` for material system-boundary, data, auth,
  migration, deployment, security, or failure risk.
- Use `senior-developer-reviewer` when task boundaries, dependencies, or verification
  are complex enough that the plan itself could introduce material delivery risk.

The coordinator validates findings before changing the plan. A material design
change returns to the affected design authority and user approval. A localized plan
correction returns only to the affected reviewer. Unchanged evidence does not trigger
another review.

## Durable Plan

Create the fewest independently useful Trekker records. A task should say:

- what outcome changes and where
- why it matters
- any real dependency or scope boundary
- what proves it works

Use dependencies only for required ordering. Put concrete implementation choices in
the plan only when consistency, compatibility, safety, or verification depends on
them. Label externally triggered verification with its trigger, owner, expected
evidence, and completion boundary.

The approved spec may be committed directly with the implementation when that is the
smallest coherent change. Create a separate planning task or commit only when it has
independent value, such as establishing a shared branch basis before multiple tasks
or preserving an approved artifact before implementation can begin. There is no
mandatory planning Task 1.

After authorized Trekker writes, mirror only the immediate work in the Codex session
plan. Trekker wins if the two diverge.

## Handoff

If implementation is authorized, continue with `docs/agent-workflow.md`. Otherwise,
add this comment to the first implementation task:

```text
Checkpoint: Implementation authorization not granted. Ask before starting.
```

Leave a concise handoff containing the approved outcome, durable references, next
ready task, unresolved decision, and exact authorization needed. When authorization
is later granted, add `Implementation authorization granted for <scope>.` to that
task; name the full scope when the grant covers later tasks. Stop for a material
decision or unverifiable behavior, not solely because a ceremonial phase has ended.
