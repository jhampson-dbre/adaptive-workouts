---
name: epic-development-branch-completion
description: Finish an epic development branch for draft-PR review or epic completion. Use at PR stage, before publishing an implementation branch or epic handoff, before merge approval, or before closing an epic to verify task commit boundaries, run both final-integration review gates on the cumulative branch range, address findings, and prepare the push/PR/check-status handoff.
---

# Epic Development-Branch Completion

Use this coordinator-owned workflow after the epic's intended tasks are complete or
the branch otherwise reaches PR stage. It packages existing repository review and
handoff requirements; it does not replace task-level verification or authorize
reviewers to push, merge, create a PR, or update Trekker.

## 1. Establish the handoff evidence

1. Select and state the target branch, then compute `git merge-base <target> HEAD`.
2. Inspect the committed cumulative range `<merge-base>...HEAD`, not only local
   changes. Confirm it includes every intended completed-task commit.
3. Inspect the complete working tree separately with all of:
   - `git status --short --branch`
   - `git diff`
   - `git diff --cached`
4. For every completed epic task, confirm intended work was committed before
   completion and that its Trekker `Summary:` contains the task commit hash and
   required verification evidence. Reconcile any mismatch before final review.

## 2. Run independent final-integration gates

First run `node scripts/validate-final-integration-decision.mjs <evidence.json>` and record its decision, reason codes, and exact reviewed SHA. **Final-integration equivalence** is eligible only for one clean low/medium-risk implementation task whose canonical `RB-<task>-<cycle>` baseline identity, producer-validation reference, base/candidate/terminal topology, exhaustive row coverage, technical/conformance closure records (authority, kind, closed/pass disposition, terminal SHA, evidence reference), invalidator records, terminal Summary, and every ordered non-planning commit reconcile. The CLI verifies each planning commit is an ancestor of task base, then verifies Git task-base/candidate/terminal ancestry and ordered commits; do not substitute self-asserted SHA, tree, or patch IDs. Planning commits are separate and never a review baseline. Malformed, stale, rewritten, merge-affected, conflict-resolved, high-risk, multi-task, invalidated, dirty, scope-drifted, incomplete, or unaccounted evidence requires **full cumulative gates**. Eligible evidence preserves the two independent authorities below while avoiding redundant cumulative re-analysis; it never waives escalation, reviewed-SHA, or draft-PR checks.

When the decision is **ineligible**, dispatch both full cumulative reviews from the same evidence packet:

- **Epic branch review:** an epic reviewer examines branch readiness, cross-task
  regressions, task evidence, residual risks, and publication state.
- **Epic spec/conformance review:** a fresh spec reviewer examines the same
  cumulative range and working tree against approved epic intent.

Supply each reviewer with the target branch, merge-base commit, cumulative diff,
working-tree evidence, Trekker task evidence, approved intent, verification results,
and draft-PR state when one exists. Neither review substitutes for the other.

When the decision is **eligible**, dispatch the same two independent authorities as
scoped acknowledgements of the validated canonical task evidence and exact reviewed
SHA. Do not ask them to repeat cumulative branch analysis; retain escalation and
draft-PR check handoff requirements.

## 3. Resolve final-integration findings

- For a substantive finding, make the intended fix, run appropriate verification,
  and commit the fix before repeating final integration.
- Recompute the merge-base range and re-run **both** gates against the updated
  committed range and current complete working-tree evidence.
- Repeat only when a further substantive change is required. Escalate material plan
  or product-scope conflicts through the repository's planning/design workflow.

## 4. Publish the draft-PR handoff

After both gates are ready and all intended work is committed:

1. Push the branch.
2. Open a draft PR unless the user explicitly opts out.
3. Confirm required checks are visible and either passing or documented with the
   exact next step.
4. Record residual risks with their durable Trekker disposition; PR text alone is
   not durable tracking.

The coordinator retains Trekker writes, approval decisions, pushing, PR creation,
and final user communication. Do not merge or deploy unless the user asked.
