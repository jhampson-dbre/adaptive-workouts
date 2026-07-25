# Feature Planning

Use this workflow before implementation when a request needs new feature/product planning.
Canonical planning contracts remain in `AGENTS.md` and `docs/feature-planning.md`; this file is the actionable sequence.

## 1) Required Discovery Gate

For every proposed feature/capability workflow:

- invoke `$feature-discovery` and obtain an approved Discovery Brief + Decision Log, unless an explicit opt-out or documented mechanical-task exception applies.
- if discovery shows a bug/refactor/fully specified execution task, route to the applicable workflow instead.

## 2) Discovery & Design Scaffold

- search Trekker for duplicates as the formal planning gate.
- brainstorm shape, risks, tradeoffs, and open questions outside of Trekker.
- classify UI work as `required`, `optional`, or `skip-recorded`.
- preserve optional/skip-recorded rationale durably.

For `required` UX work: attach a proportional scenario artifact using
`docs/templates/ux-evidence-matrix.md` and request `ux-design-reviewer` before
architecture review.

## 3) Design Spec

Draft or refine the design with:

- problem, goals, non-goals, behavior constraints
- data/storage impact
- open questions and assumptions
- acceptance criteria

If persistence timing/duration is affected, include full compatibility contract:
field path, reader/writer versions, storage unit, rounding/precision policy,
null/missing/zero semantics, cross-version/read behavior, and write/migration strategy.
When reload recovery is in scope, include epoch/clock handling, elapsed/phase
boundaries, ownership/version identity, fallback, and null/absence semantics.

## 4) Required Reviews

Before user design approval:

1. architecture/design review via `architecture-design-reviewer`
2. optional/required feedback incorporation

Before user implementation-plan approval:

1. planning-conformance review via `senior-developer-reviewer`
2. incorporate required plan edits or record reasons

## 5) Planning Task 1 Constraint

Every approved feature plan must include this boundary task:

- set up or switch to focused `codex/` epic branch
- persist approved design at durable spec path
- commit only planning artifact(s) in a scoped planning commit
- record branch/spec/planning-commit references on the epic
- close Task 1 with `Summary:`

`Task 2` and all later tasks stay `todo` until separate explicit continuation approval.

## 6) Execution Transition

Feature Planning Mode means Codex Plan Mode in this repository.

- discovery/plan approval occurs in Plan Mode
- transition to write-capable Default mode before any Trekker write, branch/spec persistence, commit, or Task 1 execution

## 7) Required Execution Artifacts

When implementation-specific choices are deferred to execution:

- concrete named artifacts and mechanisms
- explicit implementation discretion
- deferred verification triggers and completion boundaries
- per-task TDD expectations

## 8) Handoff Checklist

For a completed planning pass, confirm:

- discovery gate decision and any opt-out rationale
- UX classification + rationale
- review feedback and incorporation decisions
- dependency plan and blocking rationale (artifact-blocking vs implementation-only)
- planning Task 1 references, durable spec, and follow-on task handoff
- continuation approval boundary is explicit
- any planning-funnel friction is captured under `EPIC-6` or documented as declined.

If `Task 1` completes, execution starts only from Trekker under a fresh user continuation approval.
