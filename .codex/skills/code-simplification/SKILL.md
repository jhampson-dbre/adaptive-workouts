---
name: code-simplification
description: Remove a concrete complexity signal from a green task diff without changing behavior. Use when coordinator inspection finds needless abstraction, duplication, branching, files, configuration, dependencies, or similar implementation cost; do not run merely because a diff is non-trivial.
---

# Code Simplification

Use this coordinator-owned pass only after inspection identifies a concrete
complexity signal in a green task diff. No signal means no dispatch and no ceremony.

Provide the named signal, authorized files, relevant behavior constraints, diff, and
green evidence. Repository-wide cleanup requires separate authorization.

Remove only the named cost. Prefer deletion and existing or native mechanisms over
new structure. Do not perform unrelated cleanup, speculative refactoring, or
line-count compression. Preserve observable behavior and any applicable public API,
schema, error, ordering, security, and determinism contract.

Run the smallest check that would catch a regression from the simplification.
Coordinator inspection integrates the edit and routes changed evidence only to the
review authority it affects. Repeat complete reviews only for a named material
invalidator. A no-edit result is valid when the proposed simplification is unsafe or
not meaningful; unchanged evidence never starts another pass.
