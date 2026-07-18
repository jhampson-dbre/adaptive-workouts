# UX Quality Gate EPIC-8 Pilot Retrospective

Date: 2026-07-17

Task: TREK-206

Frozen build: `ce5a389a01a8718f220d5766181aec0730c4832e` (post-EPIC-8, pre-EPIC-11)

Pilot checkout: GUID-named detached worktree outside the workspace. The paused EPIC-11 checkout was not used or modified.

## Outcome

The pilot successfully exercised the gate with synthetic Google-provider authentication and local Auth/Firestore emulators. It found one high-impact frozen-commit UX defect and one unresolved validation-evidence gap. This is a gate-pilot result, not a usability pass and not authorization to change EPIC-8 product behavior.

The active-workout defect is the clearest finding: after a concurrent-start warning, Cancel, Confirm/Rest, and Undo restore an actionable set, but the old warning remains visible. The status therefore reports resolved conflict state as current state. This matches existing TREK-201, so no duplicate was created and no EPIC-11 task or checkout was modified; no product fix was made in TREK-206.

Detailed evidence is indexed in [the pilot evidence matrix](2026-07-17-ux-quality-gate-epic-8-evidence.md).

## Proportional pilot artifact

### Scenario A — Generate a plan

Single job: choose time/muscle constraints and generate a usable plan.

```text
[Header: Adaptive Hypertrophy       Manage Catalog]
[Generator card]
  Time Budget / slider
  Unrecovered muscle groups
  [Generate Plan]  <- primary, card bottom
[Fixed emulator notice]
```

Primary: Generate Plan. Utility: Manage Catalog. States: signed-out, loading, ready, generated, validation/error, and long-content scroll. Expected recovery is a visible actionable error with the affected control reachable after scrolling; the fixed emulator notice must not occlude the primary action or route exit.

### Scenario B — Operate an active workout

Single job: perform, confirm, recover, and finish one workout without conflicting timers.

```text
[Header]
[Active Workout / total elapsed / status]
  Exercise header [collapse utility]
  Ready: [Start set] <- primary
  Work: [Confirm attempt] <- primary | [Cancel timer] <- secondary
  Rest: next [Start set] <- primary | [Undo] <- secondary
  Locked: explanation, no action
[Finish Workout] <- route-exit action
[Fixed emulator notice]
```

Primary actions vary by state: Start set, Confirm attempt, or the next ready set. Secondary actions are Cancel timer and Undo. Utility is collapse. Finish Workout is an exit action, guarded while a timer is active. Feedback owner is the workout status region; expected retirement is immediately after the conflict resolves.

### Scenario C — Maintain the catalog

Single job: add or edit catalog entries while keeping destructive actions distinguishable.

```text
[Header: Back to Generator]
[Catalog card]
  Defaults / schedule
  Add form: name, category, tier, sets, tracking, [Add] <- primary
  Current Catalog: [Edit] [Save] <- editing primary | [Deactivate] <- destructive
[Fixed emulator notice]
```

States: dense list, mobile reflow, blank-name validation, Add, Edit/Save, Deactivate/Reactivate, and route exit. Expected recovery is proximal validation with a clear path back to Add/Edit; fixed-notice and list scrolling must not hide primary controls; unsaved route exit must have an explicit preservation/discard outcome.

## Review results

- Initial UX design review: requested artifact revision. Final disposition: the pilot artifact now records compact wireframes, state/action mapping, feedback ownership/retirement, recovery expectations, and explicit evidence classifications; no architecture review or usability-pass claim is made.
- Fresh rendered-usability review: needs changes for the stale active-timer feedback, unresolved blank-name recovery evidence, and the explicitly listed unverified matrix items. It did not claim a usability pass.
- No architecture, product-authority, authentication, data, migration, or scope escalation was authorized by this pilot.

## Findings

1. High: concurrent-start feedback does not retire after Cancel, Confirm/Rest, or Undo. The recovered set is actionable, but the stale status remains after 1.2 seconds.
2. Medium: blank-name Add remains an unresolved evidence gap. Native `required` was observed, but no proximal visible guidance or focus recovery was established; this is not classified as a confirmed product defect.
3. Medium: fixed emulator notice and long content require explicit reach/occlusion checks in later evidence; no horizontal overflow was observed at tested mobile widths.

Severity scale: High means the observed state can mislead or block a safety-sensitive current action; Medium means an unresolved evidence or recovery risk; Low means a limited or non-blocking observation.

## False positives, false negatives, and bias

No confirmed false positive was established. A clean console, centered desktop layout, or lack of horizontal overflow must not be mistaken for a usability pass. Potential false negatives remain for offline/network interruption, keyboard focus, 200% reflow, safe-area, reduced-motion, and touch-target behavior because the selected browser harness could not verify them reliably or safely.

Retrospective bias: one synthetic identity, one default catalog, one frozen build, one browser surface, manual exploratory actions, and coordinator-selected scenarios. No production credentials, production data, personal screenshots, or production mutations were used. Reviewers received the same coordinator evidence summary, so the review was not independent of observation selection.

## Evidence cost and safety

Setup required a detached checkout, a junction to the existing local `node_modules` (no install), a local Vite server, Auth/Firestore emulators, emulator sign-in, and manual viewport/state captures. Per-state capture was low cost after setup; the main recurring cost was resetting state between timer and catalog scenarios. All temporary processes were tracked for cleanup, and only the validated detached pilot worktree/junction are in scope for removal.

## Pilot limitations and handoff

The report records missing rather than passing evidence for keyboard/focus, offline/interruption, 200% zoom/reflow, safe-area, reduced-motion, and touch targets. TREK-206 remains blocked until the coordinator records a current-task applicability decision or completes the required evidence; TREK-207 and later tasks must not start before that handoff is resolved. The stale feedback defect is linked to existing TREK-201; no duplicate was created. TREK-206 itself does not implement that fix. The reviewers' evidence-handoff feedback is addressed by the persisted scenario-indexed matrix, but the remaining evidence blocker is intentionally not hidden.
