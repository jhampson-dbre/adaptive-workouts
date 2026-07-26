# Git-Native Risk-Proportional Epic Review

Status: Approved

## Problem

Final epic review currently restarts both cumulative reviews after any committed fix.
A localized remediation therefore discards valid review work even when approved intent,
high-risk boundaries, and most evidence are unchanged.

The previous proposed solution (`8186b27` through `191dbf5`) added an append-only
review lifecycle, coverage matrix, finding state machine, evidence parser, and
final-integration equivalence engine. Those mechanisms solved a broader audit problem
than this workflow requires.

## Decision

Use Git as the review ledger.

The first final-integration pass reviews the complete merge-base range with independent
technical and conformance authorities. It records the exact reviewed SHA. Later fixes
receive review only from authorities affected by the delta unless a material invalidator
requires a new cumulative pass.

No custom lifecycle schema, baseline-cycle IDs, exhaustive coverage matrix, evidence
parser, or equivalence validator is introduced.

## Goals

- Preserve one cumulative technical review and one independent cumulative conformance
  review before publication or epic completion.
- Close localized findings by reviewing the additive Git delta and affected evidence.
- Reuse valid review and verification evidence tied to an unchanged SHA.
- Fail closed when the change affects intent, high-risk boundaries, history, or required
  evidence.
- Stop repeated review loops when evidence is unchanged.

## Non-goals

- Proving task-review equivalence through machine-validated Trekker records.
- Replacing task-level review, required UX review, or specialist authority.
- Weakening security, data, auth, migration, deployment, or data-loss safeguards.
- Creating a general review-state framework or prompt-evaluation framework.
- Requiring a fresh reviewer merely because a fix has a particular severity label.

## Review model

### 1. Initial cumulative review

At PR stage or epic completion, the coordinator:

1. Computes `merge_base = git merge-base <target> HEAD`.
2. Confirms the intended cumulative range and complete working-tree state.
3. Runs proportionate verification.
4. Dispatches independent epic technical and epic conformance reviews against the same
   evidence.
5. Records `reviewed_sha = HEAD`, findings, verification references, and residual risks.

This initial pass is never replaced by task summaries or prior task reviews.

### 2. Remediation

Accepted findings are fixed and committed additively. The coordinator inspects
`reviewed_sha..HEAD`, records the changed evidence, and classifies the delta.

A delta is eligible for scoped closure only when all of these remain true:

- `reviewed_sha` is an ancestor of `HEAD`;
- every new commit belongs to the accepted remediation;
- approved epic intent and acceptance criteria are unchanged;
- no security, data, auth, migration, deployment, architecture, or other high-risk
  boundary is introduced or materially expanded;
- prior evidence remains applicable and changed evidence is identified;
- the complete working-tree state is clean or fully included in the handoff.

Task count and branch size do not determine eligibility. The actual delta and affected
risk determine eligibility.

### 3. Affected-authority closure

For an eligible delta, dispatch only the authorities whose reviewed concern changed:

- **Technical:** implementation, tests, build behavior, or technical evidence changed.
- **Conformance:** approved behavior, acceptance evidence, or interpretation of intent
  changed.
- **UX:** required UI behavior or prescribed rendered evidence changed.
- **Specialist:** the specialist's named risk boundary changed.

The original reviewer is the preferred closer because it already holds the review
context. A replacement reviewer is used only when the original is unavailable, has a
material conflict, or the changed high-risk boundary requires fresh independence.

The closure handoff contains the original finding, `reviewed_sha..HEAD`, affected
evidence, verification results, and the current SHA. It does not request a repeat of
unchanged cumulative analysis.

### 4. Material invalidators

Run a new cumulative technical plus conformance review when any of these occurs:

- reviewed history was rewritten or no longer contains `reviewed_sha`;
- a merge or conflict resolution materially affects the reviewed range;
- unrelated work entered the remediation range;
- approved intent, architecture, scope, or acceptance criteria changed;
- a security, data, auth, migration, deployment, or other high-risk boundary was added
  or materially expanded;
- required evidence is missing, stale, contradictory, or cannot be tied to the current
  artifact.

The coordinator records the concrete invalidator. Reviewer preference or unchanged
evidence is not an invalidator.

### 5. Verification reuse

- A successful result may be reused only for the exact unchanged SHA and matching
  environment/configuration.
- A changed SHA receives verification proportionate to the delta.
- Full CI runs when required by publication policy, changed risk, stale evidence, or a
  concrete failure signal; reviewer independence alone does not rerun it.
- Reviewers consume coordinator-supplied evidence and request additional verification
  only for a named unresolved risk.

### 6. Stop and escalation

- A passing scoped closure completes that authority; it does not restart cumulative
  review.
- A further localized fix receives another scoped review of only the new delta.
- After two unsuccessful scoped-closure rounds on the same remediation path, record a
  `Checkpoint:` and ask the user or appropriate decision owner for direction.
- Unchanged evidence never triggers another reviewer or test run.

## Durable evidence

Trekker needs one concise final-review note, not a workflow database:

```text
Final-Review:
- target / merge base / reviewed SHA
- cumulative technical and conformance dispositions
- accepted findings and remediation commit range
- scoped or cumulative decision, with affected authorities or concrete invalidator
- verification references tied to the relevant SHA
- terminal SHA and residual-risk disposition
```

Git supplies immutable commit identity, ancestry, and deltas. Trekker supplies intent,
decisions, and handoff continuity.

## Implementation scope

Update only the active workflow surfaces that control epic completion:

- `AGENTS.md`
- `.codex/skills/epic-development-branch-completion/SKILL.md`
- `.codex/agents/epic-reviewer.toml`
- `.codex/agents/spec-reviewer.toml`
- `docs/agents/epic-reviewer.md`
- `docs/agents/spec-reviewer.md`
- `docs/agents/main-coordinator.md`
- the final-integration section of `docs/agent-workflow.md`
- focused workflow-contract tests only where they protect authority, invalidators,
  reviewed-SHA routing, or stopping behavior

Do not add a lifecycle parser, evidence template, final-integration decision program,
new dependency, or prose-snapshot validator.

## Acceptance signals

- A one-function remediation can close with only the affected authority reviewing its
  additive delta.
- A material auth, data, migration, architecture, or intent change triggers both
  cumulative authorities.
- Multi-task epic branches remain eligible for scoped closure.
- Exact-SHA evidence is reused; changed or stale evidence is rerun proportionately.
- No unchanged evidence causes another review or verification loop.
- The implementation is primarily deletion or concise contract edits and introduces no
  review-state engine.

## Alternatives considered

- **Always repeat both cumulative reviews:** simple but not risk-proportional.
- **Machine-validated lifecycle and equivalence engine:** auditable but solves an
  unproven compliance need and makes bookkeeping a gate.
- **Skip final epic review when task reviews passed:** cheapest but misses cumulative and
  cross-task risks.

## Risks and mitigations

- **Coordinator under-classifies a material delta:** use the explicit invalidator list
  and fail closed when evidence cannot establish scope.
- **Scoped reviewer lacks context:** include the original finding, reviewed SHA, delta,
  and changed evidence; permit the reviewer to request cumulative context for a named
  risk.
- **Stale verification is reused:** require exact SHA plus matching environment/config.
- **Review findings expand scope:** coordinator retains scope and authority decisions;
  material expansion returns to the user or design authority.

## Decision log

- Keep the initial independent cumulative technical and conformance reviews.
- Make remediation review proportional to the actual Git delta, not task count.
- Prefer the original reviewer for scoped closure; freshness is risk-triggered.
- Use Git for topology and Trekker for concise decisions.
- Reject custom review lifecycle and equivalence infrastructure.
- UX classification: `skip-recorded`; this changes internal agent coordination only.
