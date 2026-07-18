# UX Quality Gate EPIC-8 Pilot Retrospective

Date: 2026-07-17

Task: TREK-206

Frozen build: `ce5a389a01a8718f220d5766181aec0730c4832e` (post-EPIC-8, pre-EPIC-11)

Pilot checkout: GUID-named detached worktree outside the workspace. The paused EPIC-11 checkout was not used or modified.

## Outcome

The pilot successfully exercised the gate with synthetic Google-provider authentication and local Auth/Firestore emulators. The resumed evidence run converted several previously unresolved rows into confirmed frozen-commit defects and explicit harness limitations. This is a gate-pilot result, not a usability pass and not authorization to change EPIC-8 product behavior.

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

Primary: Generate Plan. Utility: Manage Catalog. There is no secondary or destructive action in this scenario. States: signed-out, loading, ready, generated, validation/error, and long-content scroll. Loading feedback belongs to the generator action; validation/application feedback belongs to the generator card, with one current error at a time. Expected recovery is a visible actionable error with the affected control reachable after scrolling; successful retry, successful generation, or route exit retires the error. The fixed emulator notice must not occlude the primary action or route exit.

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

Primary actions vary by state: Start set, Confirm attempt, or the next ready set. Secondary actions are Cancel timer and Undo. Utility is collapse; there is no destructive action. Finish Workout is an exit action, guarded while a timer is active. Feedback owner is the workout status region; expected retirement is immediately after the conflict resolves. Collapse must preserve the active-set/timer context in its summary. Background, reload, or route interruption must resume the same active context or expose explicit recovery; it must not silently discard an active workout.

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

Primary actions are Add in the add state and Save in the edit state; Edit and Save are state alternatives, not simultaneous actions for the same item. Cancel is secondary. Deactivate is destructive; Reactivate is its recovery action. Back to Generator and Close are route-exit/utility actions. States: dense list, mobile reflow, blank-name validation, Add, Edit/Save, Deactivate/Reactivate, and route exit. Validation and mutation feedback belongs to the affected form or catalog item, with one current message per operation; correction, successful save/add, cancel, or route exit retires it. Expected recovery is proximal validation with a clear path back to Add/Edit; fixed-notice and list scrolling must not hide primary controls; unsaved route exit must have an explicit preservation/discard outcome.

## Review results

- Initial UX design review requested artifact revision. The artifact now records compact wireframes, state/action mapping, feedback ownership/retirement, recovery expectations, and explicit evidence classifications. A fresh design review still found the proposed pilot completion disposition in conflict with the approved frozen plan; reviewer acceptance cannot amend that plan.
- Initial rendered-usability review requested changes for stale active-timer feedback, blank-name recovery evidence, and unverified matrix items. A fresh review found the corrected matrix internally sufficient as a retrospective record, but that evidence-integrity result does not override the approved completion blocker. No usability pass is claimed.
- No architecture, product-authority, authentication, data, migration, or scope escalation was authorized by this pilot.

## Findings

1. High: concurrent-start feedback does not retire after Cancel, Confirm/Rest, or Undo. The recovered set is actionable, but the stale status remains after 1.2 seconds.
2. High: blank-name Add fails silently. The invalid required input is inside a `noValidate` form; no native or inline message appears, and focus remains on Add.
3. High: unsaved catalog edits are discarded on Back to Generator with no warning or explicit discard/preservation outcome.
4. Medium: the rendered 240px narrow viewport horizontally overflows, and numerous mobile controls measure below 44 CSS pixels without a documented exception. Actual 200% browser zoom/reflow remains untested.
5. Medium: generator failure is visible and retryable, but the error is not a live region and does not receive a useful focus handoff.
6. Medium: fixed-notice reach and rectangular-viewport occlusion passed at the tested positions. Actual safe-area and reduced-motion preferences remain static risks because the harness cannot emulate them and the frozen CSS contains no corresponding accommodation.

Severity scale: High means the observed state can mislead or block a critical current action, or can silently discard user work; Medium means an unresolved evidence or recovery risk; Low means a limited or non-blocking observation.

## False positives, false negatives, and bias

No confirmed false positive was established. A clean console, centered desktop layout, or lack of horizontal overflow at one width must not be mistaken for a usability pass. The resumed run reduced false-negative risk by safely exercising local network interruption, blank validation, unsaved exit, equivalent narrow reflow, touch-target measurement, collapse/expand, and notice clearance. Potential false negatives remain for sequential keyboard navigation, actual browser zoom, device safe areas, reduced-motion preference emulation, saved-history reload, and active-workout resume because the selected harness could not isolate them faithfully.

Retrospective bias: one synthetic identity, the default catalog plus one resumed-run synthetic entry, one frozen build, one browser surface, manual exploratory actions, and coordinator-selected scenarios. No production credentials, production data, personal screenshots, or production mutations were used. Reviewers received the same coordinator evidence summary, so the review was not independent of observation selection.

## Evidence cost and safety

Setup required a detached checkout, a junction to the existing local `node_modules` (no install), a local Vite server, Auth/Firestore emulators, emulator sign-in, and manual viewport/state captures. Per-state capture was low cost after setup; the main recurring costs were resetting state between timer/catalog scenarios and the authentication invalidation caused by the deliberate emulator restart. The resumed run used only tracked local processes for its interruption fixture. All temporary processes were tracked for cleanup, and only the validated detached pilot worktree/junction are in scope for removal.

## Pilot limitations and handoff

The corrected matrix preserves defects, partial results, inconclusive interruption evidence, and static risks without calling them passes. The stale feedback defect remains linked to existing TREK-201; no duplicate was created, EPIC-11 was not modified, and TREK-206 implements no product fix. Under the currently approved plan, the remaining required evidence gaps keep TREK-206 resumable and block TREK-207. A narrowly bounded frozen-historical-pilot amendment is documented in the matrix as a proposal only; it requires design review, explicit user approval, planning-conformance review, and updated Trekker intent before it could permit completion.
