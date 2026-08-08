---
name: feature-discovery
description: Collaboratively discover and stress-test proposed product features before formal planning. Use automatically when a user proposes a new feature, capability, workflow, or substantial behavior change and needs requirements discovery, alternative exploration, and multiple viewpoints before involving the feature-planner-advisor. Skip only when the user explicitly opts out or the request is already a small, fully specified mechanical change.
---

# Feature Discovery

Work with the user to turn a feature idea into a decision-ready brief. This is a collaborative discovery conversation, not implementation planning and not Trekker work.

## Workflow

1. Ground the discussion in the repository: inspect the relevant code, specs, tests, and related Trekker work before asking questions that the project can answer.
2. State the initial problem, intended audience, and observed constraints in plain language. Mark guesses as assumptions.
3. Ask one high-value question at a time. Prefer concrete choices when a decision has clear alternatives; do not interrogate the user about facts discoverable from the repository.
4. Explore the feature through these lenses:
   - **Outcome:** user problem, success signal, and non-goals.
   - **Minimality:** identify the smallest observable outcome and test existing behavior, policy, configuration, or native platform support before proposing new code or state.
   - **Alternatives:** compare the preferred approach with at least one materially simpler end-to-end option. Prefer the simpler option unless it fails a named outcome or material risk.
   - **Experience:** primary workflow, confusing states, errors, accessibility, and recovery.
   - **System fit:** existing architecture, data, integrations, migration, privacy, performance, and operational constraints.
   - **Delivery:** scope slices, dependencies, failure modes, testability, and rollout risk.
5. Surface material disagreements and tradeoffs rather than silently selecting an answer. Challenge proposed persistent state, schemas, parsers, validators, agents, or gates; keep one only when it prevents a concrete failure that the simpler option cannot. Keep a running list of decisions, rejected alternatives with reasons, assumptions, and unresolved questions.
6. Do not draft an epic, create Trekker records, dispatch formal design reviews, or start implementation during discovery.

## UX Quality Gate classification

Classify UI work as `required`, `optional`, or `skip-recorded` during discovery and
record a short rationale. Required work names the materially changed scenarios and a
proportional artifact covering the intended flow, states, recovery, and accessibility.
Execution follows `$ux-quality-gate` for task-scoped rendered proof. Discovery does not
itself dispatch the reviewer or replace architecture authority.

## Completion Gate

Before proposing a handoff, confirm that the brief contains:

- problem, audience, goals, and explicit non-goals;
- preferred approach and meaningful alternatives considered;
- a **Minimality** decision:
  - smallest sufficient outcome;
  - existing or native path considered;
  - added mechanisms and the named risk each prevents;
  - why the materially simpler option is insufficient;
  - complexity deliberately deferred;
- user-flow expectations and important edge cases;
- relevant code/data/deployment constraints;
- acceptance signals, risks, and unresolved assumptions.
- UX Quality Gate classification and rationale; for required work, the planned
  scenario-indexed artifact and UX-review handoff.

Present a concise **Discovery Brief** with those sections and a **Decision Log**. Ask the user explicitly whether to send that brief to the `feature-planner-advisor`.

Only after the user approves, dispatch the advisor with the brief, relevant repository findings, and the instruction that the advisor resumes the project feature-planning workflow. The main agent retains user approval gates and Trekker ownership.

## Boundaries

- Treat the user as a co-designer: challenge an idea constructively, but do not turn the session into a hostile interrogation.
- Match depth to risk. Ask fewer questions for a small feature; examine data, auth, migration, security, or irreversible decisions more deeply.
- Preserve explicit user decisions. Do not reopen settled choices unless new evidence creates a material conflict.
- If discovery shows the request is actually a bug fix, refactor, or fully specified task, say so and hand off to the appropriate existing workflow instead of forcing feature planning.
