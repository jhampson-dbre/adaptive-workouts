# Task Review Lifecycle Evidence

Use these append-only, sanitized Trekker comment blocks for every non-trivial tracked implementation task. Do not edit a prior block: add a successor `Review-Baseline:`, `Review-Batch:`, `Review-Closure:`, or `Review-Invalidator:` block instead. Values are JSON only; never include secrets, tokens, credentials, personal data, or production values.

The coordinator records the immutable candidate only after the green diff, required simplification, and coordinator verification. `taskBaseSha`, candidate SHA, and terminal SHA are the immutable initial snapshot, so terminal equals candidate at baseline creation. Later additive batches derive the current terminal without mutating the baseline. Sync provenance, verification, risk, and the matrix reference are required. The planning commit is planning provenance, never a task review baseline.

## Review-Baseline

~~~~text
Review-Baseline:
```review-lifecycle
{
  "lifecycle": {
    "taskId": "TREK-000",
    "taskRange": { "baseSha": "<40-char SHA>", "candidateSha": "<candidate SHA>", "terminalSha": "<candidate SHA>" },
    "history": { "rewritten": false, "staleUpstream": false, "unaccountedIntegration": false },
    "baseline": {
      "id": "RB-TREK-000-01",
      "taskBaseSha": "<40-char SHA>",
      "candidateSha": "<candidate SHA>",
      "terminalSha": "<candidate SHA>",
      "sync": { "mainSha": "<40-char SHA>", "syncSha": "<40-char SHA>", "conflicts": false },
      "verification": ["<command and result reference>"],
      "risk": "low|medium|high",
      "matrixId": "RM-TREK-000-01",
      "authorities": [
        { "id": "RA-1", "kind": "technical", "reviewerId": "<original broad reviewer>" },
        { "id": "RA-2", "kind": "conformance", "reviewerId": "<original broad reviewer>" }
      ]
    },
    "expectedCoverage": ["criterion", "changed-surface", "risk"],
    "matrix": [
      { "id": "RM-1", "obligation": "criterion", "authorityId": "RA-1" },
      { "id": "RM-2", "obligation": "changed-surface", "authorityId": "RA-2" },
      { "id": "RM-3", "obligation": "risk", "authorityId": "RA-1" }
    ]
  }
}
```
~~~~

The matrix is exhaustive: include every acceptance criterion, changed surface, behavior-bug obligation, required UX scenario/evidence obligation, and each relevant high-risk boundary. Every row uses a stable authority ID. Record `N/A` as an authority-acknowledged obligation with a `covers` value and rationale, not by omitting it. Only `technical`, `conformance`, `ux`, and one named `specialist` authority are valid. UX rows require UX closure if UI implementation or prescribed UX evidence changes. The baseline precedes broad review and never embeds findings.

## Review-Batch and Review-Closure

~~~~text
Review-Batch:
```review-lifecycle
{
  "batch": {
    "id": "RBATCH-1",
    "baselineId": "RB-TREK-000-01",
    "findings": [{ "id": "RF-1", "authorityId": "RA-1", "severity": "P1", "matrixRows": ["RM-1"], "states": ["open", "accepted", "fixed-pending-closure", "closed"] }],
    "fromSha": "<candidate or prior terminal SHA>",
    "toSha": "<additive terminal SHA>",
    "artifactChanged": true,
    "evidenceChanged": true,
    "affectedMatrixRows": ["RM-1"],
    "affectedAuthorityIds": ["RA-1", "RA-2"],
    "closureRound": 1
  }
}
```
~~~~

Review-Closure:
```review-lifecycle
{
  "closure": {
    "id": "RC-1",
    "batchId": "RBATCH-1",
    "authorityId": "RA-1",
    "closerId": "<reviewer identity>",
    "fresh": true,
    "terminalSha": "<batch toSha>",
    "disposition": "closed"
  }
}
```
~~~~

Findings use stable `RF-*` IDs and only these transitions: `open -> accepted | rejected | escalated`, `accepted -> fixed-pending-closure -> closed`, and `escalated -> accepted | rejected`. Each append-only `Review-Batch:` introduces its frozen finding records; it never mutates the baseline. Record `artifactChanged` and `evidenceChanged` separately. Either change gets technical and conformance closure; repeat UX closure when required. An accepted P0/P1 batch has exactly one fresh replacement scoped closer for each affected authority, and that closer identity differs from the original broad reviewer. A terminal accepted or fixed-pending-closure finding is invalid unless the explicit two-round `Checkpoint:` and coordinator escalation path is recorded.

## Review-Invalidator and Summary

~~~~text
Review-Invalidator:
```review-lifecycle
{
  "invalidator": {
    "id": "RI-1",
    "baselineId": "RB-TREK-000-01",
    "trigger": "history-rewritten|stale-upstream|conflict|unrelated-range|evidence-stale|approved-intent-change|missing-authority",
    "decision": "new-cycle|escalated",
    "successorBaselineId": "RB-TREK-000-02"
  }
}
```
~~~~

Invalidators cover history rewrites, stale or unaccounted upstream integration, unresolved conflicts, unrelated task range work, stale evidence, material approved-intent/architecture change, and missing high-risk authority. A new-cycle invalidator names its successor; an escalated invalidator records coordinator escalation. The `Summary:` links every canonical block, terminal SHA, final verification, commit boundaries, and residual-risk disposition. Validate an evidence export with `node scripts/validate-review-lifecycle.mjs <file>` before treating it as reconcilable.
