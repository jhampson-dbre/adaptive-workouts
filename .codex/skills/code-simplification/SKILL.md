---
name: code-simplification
description: Coordinate a behavior-preserving simplification pass after green implementation and before final verification and reviews. Use for non-trivial code changes and conditionally after substantive review fixes that materially reshape complexity.
---

# Code Simplification Gate

This is a coordinator-owned workflow gate. It improves clarity in the active task's
green diff without changing behavior or broadening scope.

## 1. Decide whether the gate runs

Run after the implementor supplies green targeted evidence and before the
coordinator's final targeted/proportionate verification and fresh code plus
task-conformance reviews. Every non-trivial green code diff requires a fresh
code-simplifier dispatch, even when it may return no edits.

Pre-dispatch skip is allowed only for documentation/copy-only work or tiny mechanical
configuration changes. Record the exact skip rationale. No meaningful simplification
opportunity is a valid no-edit simplifier result, not a pre-dispatch skip. A green
test result alone is not a skip rationale.

After substantive review-driven fixes, rerun only if those fixes materially reshape
or reintroduce complexity. Permit at most one post-review rerun per task. Simplifier
edits or a request to re-verify never start another pass.

## 2. Bound the handoff

Provide the simplifier:

- approved Trekker task/spec and acceptance criteria
- current-session task diff and relevant tests
- explicit editable file list; default to files modified for this task/session
- green verification evidence and commands to repeat
- exact behavior/API/schema/error/order/determinism constraints
- unrelated dirty-file notes

Repository-wide simplification requires separate explicit authorization. Never infer
it from access to the repository.

## 3. Require a verifiable proposal

Before each edit, require a before/after rationale that identifies the needless
duplication, abstraction, nesting, or restating comment being removed and explains
why useful domain structure remains. Reject clever, compressed, indirect, speculative,
or line-count-only rewrites.

Do not authorize an edit unless targeted verification and proportionate broader
verification can demonstrate exact preservation of public behavior, API, schema,
error semantics, order, side-effect order, and determinism.

## 4. Integrate the result

Inspect every simplifier edit. Add it to the final task diff, run the coordinator's
final targeted and proportionate broader verification, then dispatch fresh code and
task-conformance reviewers with the changed final diff, evidence, and simplification
rationale. Any later change to that diff requires renewed reviews.

Record whether the gate ran or was skipped, authorized files, before/after rationale,
verification evidence, and whether the bounded post-review pass was consumed.
