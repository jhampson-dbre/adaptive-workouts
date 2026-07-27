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

Dispatch both reviews from the same evidence packet:

- **Epic branch review:** an epic reviewer examines branch readiness, cross-task
  regressions, task evidence, residual risks, and publication state.
- **Epic spec/conformance review:** a fresh spec reviewer examines the same
  cumulative range and working tree against approved epic intent.

Supply each reviewer with the target branch, merge-base commit, cumulative diff,
working-tree evidence, Trekker task evidence, approved intent, verification results,
and draft-PR state when one exists. Record `reviewed_sha = HEAD` for their shared
evidence packet. Neither review substitutes for the other.

## 3. Resolve final-integration findings

For an accepted finding, make the intended additive fix, run verification proportionate
to its delta, commit it, and inspect `reviewed_sha..HEAD` plus the complete working
tree. Record the current SHA, changed evidence, and routing decision.

Use scoped closure only when `reviewed_sha` remains an ancestor; every new commit is
accepted remediation; approved intent is unchanged; no security, data, auth, migration,
deployment, architecture, or other high-risk boundary is introduced or materially
expanded; prior evidence still applies and changed evidence is identified; and the
working tree is clean or fully included in the handoff. Task count and branch size are
not invalidators.

- Dispatch only authorities whose concern changed: technical for implementation, tests,
  build behavior, or technical evidence; conformance for approved behavior, acceptance
  evidence, or intent interpretation; UX or a specialist for its changed named boundary.
  Prefer the original reviewer; replace it only for unavailability, material conflict,
  or a changed high-risk boundary requiring fresh independence.
- Re-run both cumulative gates only for a recorded material invalidator: rewritten or
  non-ancestor history; a material merge/conflict resolution; unrelated remediation
  work; changed approved intent, architecture, scope, or acceptance criteria; a new or
  expanded high-risk boundary; or missing, stale, contradictory, or untieable required
  evidence.
- Reuse successful verification only for the exact unchanged SHA with matching
  environment/configuration. Changed SHAs get proportionate verification; reviewer
  independence alone does not rerun CI. Reviewers request more verification only for a
  named unresolved risk.
- A passing scoped closure ends that authority. After two unsuccessful scoped rounds on
  one remediation path, record a `Checkpoint:` and escalate; unchanged evidence does
  not start another review or verification run.

Supply scoped reviewers the original finding, `reviewed_sha..HEAD`, affected evidence,
verification results, and current SHA. Escalate material plan or product-scope conflicts
through the repository's planning/design workflow.

## 4. Publish the draft-PR handoff

After both gates are ready and all intended work is committed:

1. Push the branch.
2. Open a draft PR unless the user explicitly opts out.
3. Confirm required checks are visible and either passing or documented with the
   exact next step.
4. Record only concrete remaining conditions that could affect safety, authority,
   accepted behavior, verification validity, or release readiness with their durable
   Trekker disposition; PR text alone is not durable tracking. Rejected alternatives,
   unbuilt optional mechanisms, and absent speculative validators are not residual
   risks or missing evidence.

The coordinator retains Trekker writes, approval decisions, pushing, PR creation,
and final user communication. Do not merge or deploy unless the user asked.
