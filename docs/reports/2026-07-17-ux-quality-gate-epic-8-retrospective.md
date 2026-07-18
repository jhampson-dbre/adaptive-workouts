# UX Quality Gate EPIC-8 Pilot Retrospective

Date: 2026-07-17

Task: TREK-206

Frozen build: `ce5a389a01a8718f220d5766181aec0730c4832e` (post-EPIC-8, pre-EPIC-11)

Pilot checkout: GUID-named detached worktree outside the workspace. The paused EPIC-11 checkout was not used or modified.

## Outcome

The pilot successfully exercised the gate with synthetic Google-provider authentication and local Auth/Firestore emulators. The final uninterrupted run converted saved-history reload into a rendered pass, active-workout reload into a confirmed frozen-product defect, and the four browser limitations into complete capability-aware fallback records. This is a gate-pilot result, not a usability pass and not authorization to change EPIC-8 product behavior.

Two active-workout findings are especially useful. First, after a concurrent-start warning, Cancel, Confirm/Rest, and Undo restore an actionable set while the old warning remains visible; this maps to existing TREK-201. Second, reloading a running Overhead Press set timer retains authentication but silently discards the workout and returns to Generate Workout. Duplicate searches found no task that owns reload recovery; completed TREK-90 records it as previously out of scope. No EPIC-8 or EPIC-11 product code was changed in TREK-206.

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

- Initial UX design review requested artifact revision. The artifact now records compact wireframes, state/action mapping, feedback ownership/retirement, recovery expectations, and explicit evidence classifications. The user subsequently approved the architecture- and planning-reviewed capability-aware amendment, which is now persisted in the workflow spec and TREK-206 through TREK-209.
- Initial rendered-usability review requested changes for stale active-timer feedback, blank-name recovery evidence, and unverified matrix items. A fresh pre-amendment review found the corrected matrix internally sufficient as a retrospective record, but review alone cannot amend scope or authorize product acceptance. No usability pass is claimed.
- No architecture, product-authority, authentication, data, migration, or scope escalation was authorized by this pilot.

## Findings

1. High: concurrent-start feedback does not retire after Cancel, Confirm/Rest, or Undo. The recovered set is actionable, but the stale status remains after 1.2 seconds.
2. High: reloading an active set timer silently discards the workout and returns to Generator, with no explanation, recovery, or explicit exit. Authentication remains intact, so emulator restart is not the cause.
3. High: blank-name Add fails silently. The invalid required input is inside a `noValidate` form; no native or inline message appears, and focus remains on Add.
4. High: unsaved catalog edits are discarded on Back to Generator with no warning or explicit discard/preservation outcome.
5. Medium: the rendered 240px narrow viewport horizontally overflows, and numerous mobile controls measure below 44 CSS pixels without a documented exception. A 640px half-width proxy passed visually; actual browser zoom remains untested.
6. Medium: generator failure is visible and retryable, but the error is not a live region and does not receive a useful focus handoff.
7. Medium: fixed-notice reach and rectangular-viewport occlusion passed at the tested positions. Actual safe-area and reduced-motion preferences remain static risks because the harness cannot emulate them and the frozen CSS contains no corresponding accommodation.

Severity scale: High means the observed state can mislead or block a critical current action, or can silently discard user work; Medium means an unresolved evidence or recovery risk; Low means a limited or non-blocking observation.

## False positives, false negatives, and bias

No confirmed false positive was established. A clean console, centered desktop layout, or lack of horizontal overflow at one width must not be mistaken for a usability pass. The final run removed the history/reload false-negative risk and produced a determinate active-reload defect without restarting the emulator. Residual false-negative risk remains for real sequential keyboard traversal, actual browser zoom, device safe areas, and reduced-motion preference behavior. Their approved fallbacks satisfy this pilot's evidence obligations but deliberately do not claim rendered passes.

Retrospective bias: one synthetic identity, the default catalog plus one resumed-run synthetic entry, one frozen build, one browser surface, manual exploratory actions, and coordinator-selected scenarios. No production credentials, production data, personal screenshots, or production mutations were used. Reviewers received the same coordinator evidence summary, so the review was not independent of observation selection.

## Evidence cost and safety

Setup required a detached checkout, a junction to the existing local `node_modules` (no install), a local Vite server, Auth/Firestore emulators, emulator sign-in, and manual viewport/state captures. Per-state capture was low cost after setup. The final history and active-resume scenarios shared one emulator, server, browser, authentication session, synthetic identity, and stable UID, avoiding the earlier restart confounder. All tracked processes were stopped, and the validated detached worktree and junction were removed without touching the paused EPIC-11 checkout or workspace dependencies.

## Pilot limitations and handoff

The corrected matrix preserves defects, partial results, unsupported capabilities, and static risks without calling them passes. Recommendation: `evidence-complete-with-residual-capability-risk`; this describes historical-pilot evidence completeness, not product usability acceptance. The stale feedback defect remains linked to TREK-201. Active-workout reload recovery has no owning task after duplicate searches for `active workout`, `resume`, and `reload`; creating or extending a backlog item requires user approval. EPIC-11 was not modified, and TREK-206 implements no product fix. Once that residual finding has a durable disposition and fresh final reviews accept the evidence, TREK-206 can complete; TREK-207 remains `todo` until separate user approval.
