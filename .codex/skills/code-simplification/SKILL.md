---
name: code-simplification
description: Investigate one coordinator-authorized $ponytail-review candidate on a materially changed, stabilized green in-scope diff without changing behavior.
---

# Code Simplification

Use this coordinator-owned pass only for one bounded candidate from the single
`$ponytail-review` proposal pass on a materially changed, stabilized green in-scope
diff. Proposals are not edit authority; the coordinator rejects irrelevant or
out-of-scope proposals before authorizing investigation.

Provide the candidate, authorized files, relevant behavior constraints, diff, and green
evidence. Repository-wide cleanup requires separate authorization.

Trace actual callers, observable behavior, clarity, and applicable risks. Remove only
the named cost with the smallest safe edit or decline. Prefer deletion and existing or
native mechanisms over new structure. Do not perform unrelated cleanup, speculative
refactoring, or line-count compression. Preserve observable behavior and any applicable
public API, schema, error, ordering, security, and determinism contract.

Run the smallest check that would catch a regression from an edit. The coordinator
verifies and routes only an actual changed diff. A no-edit result is valid when the
candidate is unsafe or not meaningful; unchanged evidence never starts another pass.
