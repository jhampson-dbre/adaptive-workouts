---
name: code-simplification
description: Remove an accepted complexity signal from the bounded $ponytail-review pass on a materially changed, stabilized green in-scope diff without changing behavior.
---

# Code Simplification

Use this coordinator-owned pass only for an accepted complexity signal from the
single bounded `$ponytail-review` proposal pass on a materially changed, stabilized
green in-scope diff. Proposals are hypotheses, not edit authority; no accepted signal
means no dispatch and no ceremony.

Provide the named signal, authorized files, relevant behavior constraints, diff, and
green evidence. Repository-wide cleanup requires separate authorization.

Remove only the named cost. Prefer deletion and existing or native mechanisms over
new structure. Do not perform unrelated cleanup, speculative refactoring, or
line-count compression. Preserve observable behavior and any applicable public API,
schema, error, ordering, security, and determinism contract.

Run the smallest check that would catch a regression from the simplification.
Coordinator inspection integrates the edit, records the cut, verification, and routing,
and routes only evidence changed by it to the affected review authority. Repeat complete
reviews only for a named material invalidator. A no-edit result is valid when the
accepted simplification is unsafe or not meaningful; unchanged evidence never starts
another pass.
