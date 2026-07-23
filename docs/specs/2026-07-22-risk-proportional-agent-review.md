# Risk-Proportional Agent Review Workflow

Status: Approved on 2026-07-22

## Problem

The current agent workflow applies strong implementation and review gates, but it can repeat broad reviews after small remediation changes, blur the distinction between planning commits and implementation baselines, and generate review evidence that is difficult to compare across tasks. The code-simplification gate also lacks a controlled evidence base for deciding when it is valuable.

This design keeps independent technical and conformance judgment while making review ranges, authority, closure, and escalation explicit. It also creates a reversible simplifier pilot without weakening the active workflow before evidence exists.

## Goals

- Make each implementation review range immutable and reproducible.
- Preserve independent technical and approved-intent review.
- Close findings with scoped evidence instead of automatically repeating full reviews.
- Give accepted P0/P1 remediation an independent fresh closer without adding a third broad review.
- Define when a review baseline is invalid and when escalation is required.
- Let final-integration review consume consistent task evidence without weakening branch-wide review.
- Evaluate a narrower simplifier policy using a bounded, auditable pilot.

## Non-goals

- Reducing review rigor for high-risk, user-facing, security, storage, authentication, migration, deployment, or PWA work.
- Replacing required UX design or usability review.
- Replacing the behavior-bug issue-class audit.
- Making the planning artifact commit serve as an implementation review baseline.
- Using EPIC-6 workflow tasks to measure simplifier-pilot outcomes.
- Changing product behavior in this planning task.

## UX classification

UI work is `skip-recorded`. This feature changes agent coordination, Git/Trekker evidence, and reviewer contracts; it introduces no user-facing interaction or visual state. Any later implementation task that changes application UI must be classified independently under the UX quality gate.

## Commit and baseline model

Three commits have distinct meanings:

1. **Planning commit** — Task 1 saves this approved design artifact on the epic branch. It is durable planning evidence only.
2. **Task base (`task_base_sha`)** — recorded for each implementation task after every required upstream synchronization and immediately before task implementation begins.
3. **Review baseline (`review_baseline_sha`)** — an immutable candidate commit created only after implementation is green, the required simplification pass has finished, and coordinator verification has passed.

Before the first implementation task, synchronize current `main` into the epic branch with a non-rewriting merge. Record `main_sha`, the resulting `sync_sha`, and whether conflicts occurred. Do not rebase, amend, squash, or otherwise rewrite the planning commit. The synchronization commit is excluded from the task review range by recording `task_base_sha` only after synchronization.

Each review candidate is named `RB-<TASK-ID>-<cycle>`. A candidate is never moved or rewritten. Accepted fixes are additive commits. The terminal reviewed SHA is recorded separately from the candidate baseline.

## Review lifecycle

For each non-trivial tracked implementation task:

1. Complete TDD implementation and required simplification under the active workflow.
2. Run targeted and proportionate broader verification.
3. Commit the green candidate and record the immutable review baseline.
4. Build the coverage and authority matrix.
5. Dispatch one fresh technical code reviewer and one fresh task-conformance reviewer against the same baseline and evidence. Run required UX usability review separately when applicable. Add at most one specialist reviewer when a specific high-risk boundary warrants it.
6. Collect and normalize all findings before starting fixes.
7. Decide every finding, implement accepted findings as a batch where practical, verify the additive diff, and request scoped closure from the authority responsible for each finding.
8. Record the terminal SHA and canonical summary only after all blocking findings are closed or explicitly escalated and resolved.

### Coverage and authority matrix

The matrix must exhaustively map:

- every task acceptance criterion;
- every changed surface;
- every approved behavior-bug issue-class obligation;
- every required UX scenario and evidence obligation;
- every relevant high-risk boundary, or an explicit `N/A` with rationale.

Each row identifies its authoritative reviewer: technical, conformance, UX, or the named specialist. A reviewer may raise cross-boundary concerns, but only the assigned authority closes the row unless the workflow explicitly replaces that closer.

### Finding state machine

Finding identifiers are stable and append-only. Valid transitions are:

```text
open -> accepted | rejected | escalated
accepted -> fixed-pending-closure -> closed
escalated -> accepted | rejected
```

A rejected finding records rationale. An escalated finding records the decision owner and resolution. Findings are batched before remediation so overlapping feedback is reconciled once.

### Scoped closure

Every remediation batch that changes an artifact or its verification evidence receives scoped closure from both technical and conformance authorities. Required UX closure is also repeated when UI implementation or prescribed UX evidence changed. The closure packet includes the original baseline, additive diff, affected matrix rows, prior findings, new verification evidence, and current terminal SHA.

The original same-task reviewer is the default closer. For an accepted P0/P1 remediation batch, use exactly one fresh scoped closer for each affected authority. That fresh closer replaces the original closer for the batch; it is not an additional full review. Unaffected authorities do not get an extra P0/P1 reviewer.

### Invalidation and escalation

A baseline is invalid when its history was rewritten, its task base is stale after an unaccounted upstream integration, unresolved conflicts affect the reviewed range, the range contains unrelated task work, required evidence is missing or no longer matches the artifact, a material approved-intent or architecture change occurred, or a high-risk boundary lacks its required authority.

Invalidation creates a new immutable review cycle; it does not mutate the old record. Two unsuccessful scoped-closure rounds for the same remediation path require a `Checkpoint:` and coordinator escalation. They do not automatically create a new baseline or authorize scope expansion.

## Durable Trekker evidence

Trekker remains the source of truth. The implementation must define append-only, machine-checkable blocks with stable identifiers:

- `Review-Baseline:` — task base, candidate ID/SHA, terminal SHA, sync provenance, verification, risk classification, and matrix reference.
- `Review-Batch:` — included finding IDs, decision states, additive commit range, changed evidence, and affected authorities.
- `Review-Closure:` — closer identity/freshness, authority, scope, evidence reviewed, disposition, and terminal SHA.
- `Review-Invalidator:` — trigger, affected baseline, decision, and successor cycle or escalation.
- `Summary:` — completed task result, final verification, commit boundaries, remaining risks, and links to canonical blocks.

Validation must reject duplicate IDs, illegal state transitions, stale SHA references, missing authority closure, incomplete coverage, and histories that do not reconcile with the recorded task range.

## Final integration boundary

`TREK-246` remains the owner of branch-level final-integration equivalence and publication readiness. It consumes canonical task-review evidence but does not merely trust task summaries. It must reconcile the cumulative `git merge-base <target> HEAD..HEAD` history, current staged and unstaged evidence, task commit boundaries, and all canonical review blocks.

Stale, rewritten, conflicted, multi-task, high-risk, or otherwise unaccounted histories are ineligible for equivalence and receive both full final-integration gates. Eligible histories may avoid redundant re-analysis only where complete task evidence proves the same authority and scope were already reviewed. The epic reviewer and fresh epic spec/conformance reviewer remain independent final gates. `TREK-249` depends on the task-review lifecycle work so UX closure ownership is not implemented twice.

## Code-simplifier pilot

The pilot is separate and reversible. Until activation criteria are met, all tasks continue using the existing simplification process.

### Cohort

- Ten eligible, non-trivial, low- or medium-risk code tasks.
- Documentation-only, copy-only, and tiny mechanical configuration tasks remain existing pre-dispatch skips and do not enter the cohort.
- High-risk tasks remain mandatory simplifier dispatches and do not enter the cohort.
- **All EPIC-6 tasks are excluded from the cohort, metrics, audit sequence, and causal attribution.** They still run through the active simplifier process when otherwise required and may be recorded only as operational observations.

### Treatment and audit

The activation task defines deterministic eligibility, predicted-run/predicted-skip criteria, metric fields, and a fixed enrollment ledger. Every third eligible predicted skip, by ledger order, receives a blinded simplifier audit. Audit results do not retroactively change the treatment assignment.

The ledger validator must reject duplicate enrollment, missing sequence numbers, EPIC-6 inclusion, changed assignment after enrollment, incomplete metrics, and unclosed pilot tasks.

### Timing and decision

Evaluate when all ten eligible tasks are closed or at day 60, whichever comes first. If the minimum evidence needed for a decision is not available at day 60, allow one documented extension of no more than 30 days. Otherwise retain the current mandatory policy and record the evidence gap.

Graduation thresholds must be fixed during activation and include at least escaped-defect or review-finding regressions, verification/rework impact, audit-discovered meaningful simplification opportunities, and measurable coordination cost. `TREK-254` may recommend adoption, modification, or rejection but may not silently change the workflow; policy changes require an approved follow-up.

## Rollout and failure handling

- Land the task-review lifecycle and validator before changing final-integration equivalence.
- Land and verify final-integration consumption before activating the simplifier pilot.
- Keep every change reversible and preserve existing full-review fallbacks.
- Treat malformed or incomplete evidence as ineligible, not as an implicit pass.
- Checkpoint any task when evidence cannot be made internally consistent.
- Do not use review optimization to expand approved product or task scope.

## Implementation plan

### TREK-251 — Establish the spec and branch

Create `codex/epic-6-risk-proportional-review` from then-current `main`, commit this approved spec only, record branch/spec/commit references on EPIC-6, and stop. The planning commit is not a review baseline. TDD is not applicable.

### TREK-252 — Add immutable task-review baselines and scoped finding closure

Depends on `TREK-251`. Before implementation, merge current `main` without rewriting the planning commit and record the sync tuple. Update coordinator and reviewer Markdown/TOML contracts, canonical templates, examples, and validators. Cover baseline creation, exhaustive matrices, stable finding transitions, batched fixes, scoped closure, P0/P1 fresh replacement closers, invalidators, escalation, and the UX-authority boundary. Use fixture-driven tests that first fail on malformed and incomplete evidence, then pass after the implementation.

### TREK-246 — Consume task evidence at final integration

Existing task, updated to depend on `TREK-252`. Reconcile canonical task evidence with the cumulative branch range; explicitly reject stale, rewritten, conflicted, multi-task, high-risk, and unaccounted cases; retain two independent full gates for ineligible histories; and own branch publication readiness. Use failing fixtures for eligible and ineligible histories before implementation.

### TREK-253 — Activate the evidence-triggered simplifier pilot

Depends on `TREK-246`. Freeze eligibility, prediction, audit ordering, metrics, graduation thresholds, and timebox. Implement the append-only enrollment ledger and validator. Explicitly exclude all EPIC-6 work from cohort membership and evaluation data while preserving its normal active-process simplifier handling. Test eligibility and assignment boundaries before activation.

### TREK-254 — Evaluate the simplifier pilot

Depends on `TREK-253`. Evaluate the frozen cohort at completion or the time boundary, validate the ledger, report threshold outcomes and limitations, and recommend adopt/modify/reject. Any policy mutation requires separate approval and tracked implementation.

### Related dependency

`TREK-249` depends on `TREK-252`; it consumes the canonical closure model for required UX evidence rather than defining a parallel lifecycle.

## Verification and review roles

- Every behavior-changing implementation task uses a fresh implementor and TDD.
- Every non-trivial green task diff uses the active code-simplification gate until an approved pilot outcome changes policy.
- The coordinator performs final targeted and proportionate broader verification.
- Fresh technical and task-conformance reviewers inspect each immutable baseline.
- Required UI work also receives fresh UX usability review with prescribed evidence.
- Final integration uses a fresh epic reviewer and fresh epic spec/conformance reviewer.
- Markdown role contracts and `.codex/agents/*.toml` prompts must remain synchronized.

## Acceptance criteria

- A future coordinator can identify the task base, immutable candidate, additive remediation, terminal SHA, and authority for every required review row without chat context.
- Review records reject ambiguity instead of silently granting equivalence.
- P0/P1 remediation has one independent fresh scoped closer per affected authority, without redundant broad review.
- Final integration can distinguish eligible task evidence from histories requiring full review.
- The simplifier pilot is bounded, reproducible, reversible, and cannot enroll or evaluate EPIC-6 tasks.
- Planning Task 1 ends after this artifact is committed and referenced; all implementation tasks remain `todo` until fresh user approval.
