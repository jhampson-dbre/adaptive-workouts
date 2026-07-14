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
   - **Alternatives:** at least one credible simpler, narrower, or different approach that could achieve the same purpose.
   - **Experience:** primary workflow, confusing states, errors, accessibility, and recovery.
   - **System fit:** existing architecture, data, integrations, migration, privacy, performance, and operational constraints.
   - **Delivery:** scope slices, dependencies, failure modes, testability, and rollout risk.
5. Surface material disagreements and tradeoffs rather than silently selecting an answer. Keep a running list of decisions, rejected alternatives with reasons, assumptions, and unresolved questions.
6. Do not draft an epic, create Trekker records, dispatch formal design reviews, or start implementation during discovery.

## Completion Gate

Before proposing a handoff, confirm that the brief contains:

- problem, audience, goals, and explicit non-goals;
- preferred approach and meaningful alternatives considered;
- user-flow expectations and important edge cases;
- relevant code/data/deployment constraints;
- acceptance signals, risks, and unresolved assumptions.

Present a concise **Discovery Brief** with those sections and a **Decision Log**. Ask the user explicitly whether to send that brief to the `feature-planner-advisor`.

Only after the user approves, dispatch the advisor with the brief, relevant repository findings, and the instruction that the advisor resumes the project feature-planning workflow. The main agent retains user approval gates and Trekker ownership.

## Boundaries

- Treat the user as a co-designer: challenge an idea constructively, but do not turn the session into a hostile interrogation.
- Match depth to risk. Ask fewer questions for a small feature; examine data, auth, migration, security, or irreversible decisions more deeply.
- Preserve explicit user decisions. Do not reopen settled choices unless new evidence creates a material conflict.
- If discovery shows the request is actually a bug fix, refactor, or fully specified task, say so and hand off to the appropriate existing workflow instead of forcing feature planning.