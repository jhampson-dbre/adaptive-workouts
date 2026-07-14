---
name: bugfix-issue-class-audit
description: Scope a behavior bug before an implementor is dispatched. Use after reproduction and root-cause identification for any non-mechanical or user-facing bug, and whenever a coordinator needs to search same-class usages, record affected and unaffected surfaces, decide current-task versus follow-up scope, and prepare the Trekker audit note and implementor handoff.
---

# Bug-Fix Issue-Class Audit

Use this coordinator-owned workflow after reproducing a behavior bug and identifying its root cause, before dispatching an implementor. It is bug triage and scope control, not feature planning, requirements discovery, or implementation.

## 1. Classify the bug

- Confirm the reproduction and root cause.
- Treat a bug as **mechanical** only when the correction is localized and has no meaningful user-facing behavior or same-class ambiguity. Record why the audit is not needed.
- For every non-mechanical or user-facing behavior bug, complete the audit below. When in doubt, audit.

## 2. Search the issue class

Search for all plausible instances of the confirmed cause: shared components, helpers, state paths, validation rules, API contracts, repeated fields, and tests. Use targeted repository searches and inspect each candidate rather than assuming search hits are affected.

Make an evidence matrix:

| Candidate | Evidence inspected | Affected? | Rationale | Test coverage |
| --- | --- | --- | --- | --- |
| `path or surface` | `search/result/test` | yes/no | `same cause or distinction` | `existing/needed` |

## 3. Decide scope

- Keep a finding in the current task only when it shares the confirmed root cause, fits approved product intent, and remains one cohesive, verifiable change.
- For a different root cause, independent risk or ownership, material scope/design decision, or loss of focused verification, propose a linked follow-up instead. Search Trekker for duplicates and obtain the required user approval before creating or materially changing that record.
- Record any current-task expansion in Trekker before implementation begins.

## 4. Record the audit

Prepare a coordinator-owned Trekker note before dispatching the implementor:

```text
Issue-class audit:
- Reproduction and root cause:
- Search method and results:
- Candidates inspected:
  - <surface>: affected/unaffected — rationale
- Affected surfaces and approved complete behavior/file scope:
- Unaffected surfaces and rationale:
- Regression-test matrix:
- Scope decision: current task expansion | no expansion | linked follow-up proposed
- Follow-up/duplicate search (if applicable):
```

Only the coordinator writes Trekker records or changes task scope.

## 5. Validate and hand off

- For a non-mechanical or user-facing behavior bug, send the completed audit to a read-only spec reviewer. The reviewer validates root cause, search evidence, affected/unaffected rationale, regression matrix, and scope decision against approved intent; it must not invent requirements. This narrow validation is the sole pre-implementation exception to the routine task-start spec-review prohibition.
- Put the approved complete behavior and file scope, audit result, and regression-test matrix in the implementor handoff. The implementor applies that scope and reports unexpected evidence; it does not rediscover sibling defects.
- Still run the fresh post-verification task-conformance review after implementation. Audit validation never replaces it.
