# EPIC-16 Outside-Workout Focus

## Status and approval checkpoint

Planning candidate for TREK-306, TREK-307, TREK-308, and TREK-309. UI quality is
`required` because these tasks materially change hierarchy, navigation, disclosure,
feedback, focus, interruption recovery, and narrow-width behavior.

This artifact is not implementation authorization. A fresh UX design review must
accept the applicable scenarios below, then the user must explicitly approve this
artifact. TREK-308 also requires that approval before architecture review. Any review
change to the selected topology returns here for one approval correction; unchanged
evidence does not create another loop.

## Job, audience, and shared outcome

An individual trainee, usually alone and using a phone around equipment, needs to
understand and complete one job at a time: plan and commit to today's workout, confirm
what was saved, recall prior work, or maintain workout defaults and exercises. Nudge
must make the current job and next useful action recognizable within five seconds,
without asking the trainee to parse optional administration first.

The shared goal-first journey is:

```text
Plan -> understand today's workout -> Start workout -> Perform -> Review
                                                        |
                                                        v
                                              factual saved receipt

From the shell at any safe point:
History -> scan Workouts -> disclose one exercise's set detail
Settings -> choose Defaults, Supersets, or Catalog -> complete that job
```

Recovery authority may interrupt this topology. If active-workout checking,
recovery, conflict, or another existing forced-workout condition applies, its Workout
surface wins until the current coordinator says another destination is safe.

One derived `canLeaveWorkout` boundary governs every shell destination change. It is
false while the session is checking or presenting recovery, while `blocked === true`
including immutable-save conflict, or while the canonical save is `save-pending`.
Workout remains forced in those states. This is derived from existing session truth;
it is not a navigation lock, new store, or persisted preference. In particular,
History cannot begin a first-page read while a save is still executing and then miss
the eventual saved workout.

## Shared design and minimality decisions

- Preserve the approved Nudge **Clear Signal** system and Operate mode. Current
  context comes first, then at most one dominant action, then quieter alternatives or
  disclosures. No visual redesign is in scope.
- Reuse native `details`/`summary`, existing buttons, current cards, current lazy
  destinations, and existing component/session state. Add no router, store,
  presentation preference, dependency, schema, migration, or persistence field.
- Keep each decision surface to four or fewer peer choices. The shell has three
  destination choices at most (Plan or active Workout, History, Settings); Sign out is
  a separated account utility, not a peer job. Settings has exactly three job
  summaries. Workout ready has Start plus one quieter Back-to-Plan utility; order
  moves remain contextual actions within exercise rows. Review and receipt have no
  more than two action peers.
- Signal yellow remains reserved for a current primary action. The saved receipt is
  an intentional exception: it is an endpoint, so its two exit utilities remain
  neutral rather than manufacturing another-workout urgency.
- Long names and long lists wrap; controls remain at least 44 by 44 CSS pixels. DOM,
  visual, focus, and screen-reader order agree. At 320 CSS pixels and 200 percent
  reflow, no horizontal scrolling or clipped focus indicator is acceptable.
- Factual data may be omitted when unavailable. No praise, readiness, coaching,
  recommendation, guilt, urgency, streak, trophy, or invented completion claim is
  added.

The materially simpler option was copy-only cleanup on the current long pages. It
cannot meet the named first-viewport and scan-first outcomes because optional order
controls, every saved set, and all three Settings jobs would remain in one linear
flow. The selected disclosures and one shell destination are the smallest mechanisms
that remove those verified hierarchy failures while retaining every capability.

## Selected direction and exact interaction topology

### TREK-306 — Plan and Workout ready

Keep `Generator`, `App`, `WorkoutView`, and the active-workout session in their
current ownership roles.

**Approved follow-up refinement (2026-08-08):** The trainee-directed refinement
replaces the separate order-only disclosure below Start with contextual move actions
inside each pre-start exercise row and adds a compact **Back to Plan** utility directly
after Start. This supersedes the original disclosure topology without changing the
durable workout, order-preference, save, focus, or interruption authorities below.

**Plan hierarchy**

1. `Plan` heading and concise purpose.
2. Available-time control.
3. Signal-yellow **Plan my workout** action in the first decision viewport where
   practical at 390 x 844 and 1440 x 900.
4. Native optional recovery/constraint disclosure, closed by default.
5. Adjacent load, validation, leg-day choice, and retry feedback when invoked.

Seven recovery constraints are inputs within one optional disclosure, not seven peer
page choices. Very large text or user-agent warning content may push the action below
the physical viewport; DOM order and immediate adjacency still remain authoritative.

**Workout-ready hierarchy**

1. Journey progress, `Workout ready` heading, and current generated-workout truth.
2. Bounded compact summary: planned duration, exercise count, set count, and at most
   the first three ordered exercise names or named superset blocks followed by a
   factual `and N more` count when needed. Do not invent readiness or rationale.
3. Signal-yellow **Start workout** in the first decision viewport at the reference
   phone and desktop sizes for the normal fixture.
4. Compact neutral **Back to Plan** directly after Start. It discards only the staged,
   unstarted workout, preserves Plan inputs and authoritative order-operation truth,
   and returns focus through the existing keyed Plan destination.
5. `Exercises` heading and the complete generated order. Each pre-start exercise row
   contains its contextual **Earlier/Later** controls beside the expandable exercise
   control. Supersets move atomically and announce that relationship without adding a
   second order-only list or disclosure. Passive `Saved exercise order applied`
   remains adjacent to the list when true.
6. After the exercise rows, render the dirty today-only explanation, **Save order for
   future workouts**, and adjacent lifecycle feedback only when applicable.

Moving or expanding a row is presentation only around the durable generated workout.
It does not reset the dirty comparison, captured save candidate, move focus,
operation, or later Start result. Pending keeps the existing bounded Start gate;
indeterminate, failure/retry, late success, override, and eviction semantics remain
exactly as owned today. Interruption/remount restores authoritative workout and
App-owned operation state without a new persisted presentation preference.

This supersedes only TREK-300's visible pre-start placement because the whole order
editor is now optional. It preserves TREK-294's atomic block, save, focus, lifecycle,
and recovery contract and TREK-296's inset/reflow behavior inside the disclosure.

### TREK-307 — Review and saved receipt

Review keeps the current frozen candidate and save state. Its hierarchy is:

1. `Review` heading.
2. Bounded factual receipt preview: recorded set and exercise totals, total duration,
   and phase durations when available.
3. Closed **Planned work not recorded** disclosure when omissions exist.
4. Adjacent save/reconciliation/conflict feedback.
5. **Save workout** as the one primary action and **Back to workout** as secondary;
   existing conflict actions replace, rather than join, these controls.
6. Closed **Review recorded exercises** disclosure with per-exercise confirmed counts
   and other unbounded factual detail.

After definitive success, keep a stable factual receipt instead of collapsing to
`This workout is complete`:

1. Focused `Workout saved` heading and polite `Saved to workout history` status.
2. The same frozen bounded totals and duration; omit unavailable facts and retain the
   closed omissions and recorded-exercise disclosures for partial or long work.
3. Neutral **Return to plan**, then neutral **Copy workout results**. Clipboard
   success/error remains adjacent, repeatable, and focus-preserving.

The active-workout session owns one minimal transient `savedReceipt` payload derived
from the already frozen canonical save candidate immediately before definitive-save
cleanup clears the active workout. It contains only the facts needed by the approved
receipt and survives lazy destination remounts or a safe History detour. Clear it on
explicit **Return to plan**, authenticated-identity retirement, or staging a newly
generated workout. Do not persist it, retain `activeWorkout` after save, reconstruct
it from History, or introduce a separate receipt store.

No embedded History disclosure is required in the receipt because History becomes a
primary shell destination. Successful persistence and the fresh History read retain
the TREK-305 synchronization contract; a History read failure never retracts a
truthful successful save and instead belongs to History recovery.

### TREK-308 — History / Workouts

Add **History** as a primary shell destination through the existing `App` +
`LazyDestination` model. Do not add a URL route. The shell exposes:

```text
[Plan or Workout] [History] [Settings]                         [Sign out]
```

The Plan/Workout label reflects session truth. If `canLeaveWorkout` is true, History
opens without discarding a live session or saved receipt and **Workout** returns to
the same authoritative state. If that predicate is false, Workout wins and History
and Settings are unavailable until the existing authority releases them. Opening
History after a definitive save starts a fresh first-page read; no saved-completion
shortcut is added.

History initially renders the **Workouts** view directly. Do not add a one-item tab
control. TREK-312 may later add the separately approved Exercises view; no chart,
scrubber, trend calculation, or preference is anticipated here.

**Workouts hierarchy**

1. Focused `History` heading, then `Workouts` subheading and loading/error status.
2. Newest-first workout articles. The scan row shows only saved facts: date, duration
   when available, confirmed work total, omission/partial status when derivable, and
   a compact exercise list with each exercise's confirmed count.
3. Each exercise is a native disclosure whose summary names the exercise and
   confirmed/planned count. Its body reuses the existing per-set performance,
   timing, and saved rationale records. At most one exercise needs to be opened to
   inspect its sets; sibling disclosures may remain independently open because they
   are inspection, not peer job selection.
4. **Load older** follows the loaded articles. Older-page failure retains all loaded
   cards and focuses **Retry older workouts**; exhaustion replaces paging with the
   existing polite end message.

Legacy entries retain guarded summaries. Malformed entries remain factual unavailable
cards. Initial empty, loading, failure/retry, pagination, deduplication, newest-first
order, and interruption behavior remain the existing `WorkoutHistory` authority.

### TREK-309 — Settings jobs

Keep one Settings route/destination and all existing `Settings` component mutation,
validation, dirty, editor, retry, serialized-save, and focus owners. After the
Settings heading and any cross-destination order-preference operation panel, present
exactly three exclusive native disclosures using the same `name`:

1. **Defaults** — open initially; default rest, warmup, cooldown, leg-day controls,
   validation, save-on-change feedback, and their retries.
2. **Supersets** — current groups, create/edit/remove/reactivate flows, confirmations,
   pending states, feedback, and retries.
3. **Catalog** — Add exercise first, then Current catalog; one existing row editor or
   deactivation confirmation at a time, with all inactive/reactivation behavior.

Opening one job closes the other two natively. All three bodies stay mounted so
values, editor identity, validation errors, pending mutations, retry state, and DOM
focus targets are not destroyed. When a hidden job produces actionable failure, its
summary exposes a factual `Needs attention` text status without moving focus or
opening automatically; reopening restores context and the existing retry target.
Because closed native disclosure bodies are hidden from the accessibility tree, one
shared visible live-feedback region sits outside all three bodies. It reports the
latest pending completion or failure with the affected job name while focus remains
in the visible job; hidden-body live regions are not relied upon. The affected closed
summary also exposes `Needs attention` for an actionable failure. No active-job
preference is stored, and a fresh Settings mount starts at Defaults. Close and safe
destination switching retain the current dirty-work authority; this artifact does
not add a new leave-confirmation policy.

Catalog remains one job even with long content. Search, grouping, filtering, batch
actions, and multiple simultaneous editors are deliberately excluded.

## State ownership and implementation boundaries

| Owner | Retained authority / smallest allowed change |
| --- | --- |
| `App` | Auth/access, shell destination, forced Workout routing, Plan inputs, Settings dirty flag, and preference-save lifecycle. Add only the transient `history` destination, safe shell labels/returns, and one `canLeaveWorkout` predicate derived from existing session truth. |
| `Generator` | Plan inputs, loading/history prerequisites, generation, validation, and leg-day decision. Reorder presentation so primary precedes optional content; add no planning state. |
| Active-workout reducer/session/coordinator | Generated workout, atomic order moves, phase/recovery state, frozen Review candidate, immutable save, reconciliation, conflict, and interruption recovery. Add one transient session-owned `savedReceipt` derived from the frozen candidate before cleanup and cleared only at the named lifecycle boundaries; no engine or persistence change. |
| `WorkoutView` | Workout-ready disclosure presentation, Review hierarchy, saved-receipt rendering, focus/live feedback, and active controls. It consumes existing App/session facts only. |
| `WorkoutHistory` | Lazy first read, refresh key, page cursor, deduplication, schema classification, guarded rendering, retry/exhaustion, and appended-card focus. Adapt it for a destination and progressive per-exercise detail without changing read semantics. |
| `Settings` | Existing local drafts, dirty derivation, editors, confirmations, validation, mutation serialization, retry, and focus refs. Native job disclosures hide but do not unmount these owners. |
| Storage, schema, Firebase rules | Existing user-owned reads/writes and isolation remain unchanged. No new field, write, query shape, migration, or auth behavior. |

## Scenario-indexed UX matrix

All scenario data is synthetic or de-identified. `Phone` means 390 x 844; `desktop`
means 1440 x 900; `reflow` means 320 CSS pixels as the 200-percent proxy. Keyboard
checks include DOM order, visible focus, activation, and focus recovery; screen-reader
checks include names, expanded state, live-region/alert role, and reading order.

| ID | Required scenario and viewport/input | Required outcome / recovery evidence |
| --- | --- | --- |
| UX-306-01 | Plan default; phone + desktop, touch + keyboard | Time and **Plan my workout** precede the closed optional disclosure; primary is in the first decision viewport for the normal fixture; focus and 44px targets are visible. |
| UX-306-02 | Plan long names/content and all constraints; phone + reflow | Optional content wraps without overflow; primary remains before it in DOM/reading order; constraint labels and validation remain associated. |
| UX-306-03 | Workout ready default with long workout/names; phone + desktop | Bounded truthful totals and at most three names plus `and N more` precede dominant **Start workout**, compact **Back to Plan**, and the exercise list; Start remains promptly discoverable in the first decision viewport for both normal and long phone fixtures. |
| UX-306-04 | Pre-start order editing; phone, desktop, touch, keyboard, reflow | Existing exercise rows expose contextual atomic move controls without a duplicate order-only panel; superset context, positions, disabled boundaries, and accessible names remain usable; long labels wrap without separating controls from their exercise. |
| UX-306-05 | Dirty today-only order and return to baseline | Move focus follows the moved block/control; polite announcement identifies position and today-only scope; future-save appears only while dirty and retires at baseline. |
| UX-306-06 | Preference save pending then indeterminate, including interruption/destination detour | Pending gates Start only for the existing bound; indeterminate truthfully releases Start without retry; captured operation and adjacent feedback survive remount without duplicate write. |
| UX-306-07 | Preference save definitive failure/retry | Today's order and captured candidate remain; adjacent alert and focused retry are available; Start remains available under existing semantics. |
| UX-306-08 | Preference save success, override, eviction, or late settlement | Factual success is focusable when still pre-start and otherwise never steals focus; dirty baseline retires; detailed scope/eviction truth remains adjacent to the pre-start save controls or inside the existing post-Start panel. |
| UX-307-01 | Full Review through successful save; phone + desktop | Bounded totals and durations make the save decision clear within five seconds; unbounded exercise facts remain in a closed disclosure; primary/secondary order and focus transition are correct. |
| UX-307-02 | Partial and long Review; phone + reflow, keyboard + touch | Bounded recorded-work totals lead and **Save workout** stays promptly discoverable; omissions and per-exercise facts are closed by default and accessible on demand; long names/counts wrap; no facts disappear on Back and return. |
| UX-307-03 | Retryable save failure | Frozen candidate and context remain, alert names failure, retry resubmits the identical payload, and Back remains governed by current session semantics. |
| UX-307-04 | Indeterminate/reconciliation state | Copy distinguishes `Check again` from failure; busy/disabled semantics and live status remain truthful through interruption. |
| UX-307-05 | Immutable-save/account conflict | Frozen Review remains; only existing Keep pending/Exit recovery choices appear; focus and agency are preserved. |
| UX-307-06 | Saved receipt, full and partial/long; phone + desktop + reflow | Focused `Workout saved`, persistence status, frozen factual summary, and optional omissions stay visible; no praise or invented fact; no overflow. |
| UX-307-07 | Copy success, clipboard unavailable/rejected, repeated retry | Copy stays enabled and focused; polite success or actionable alert replaces prior feedback; **Return to plan** remains available. |
| UX-307-08 | Save/receipt interruption, safe History detour, and keyboard/screen reader | The transient session-owned receipt survives lazy remount and History return without retaining the active workout or refetching facts; explicit Return to plan, identity retirement, or new generation clears it; heading focus occurs once per material state; live announcements are not duplicated. |
| UX-308-01 | Plan -> History -> Workouts -> Plan; phone + desktop | History is a primary shell choice, lazy-loads on entry, focuses its heading, and returns to preserved Plan inputs. |
| UX-308-02 | Active Workout -> History -> Workout, plus blocked/pending attempts | When `canLeaveWorkout` is true, the detour preserves exactly one live session and current set/timers; return neither discards, duplicates, nor resurrects work. Checking/recovery, `blocked === true`, and `save-pending` force Workout and prevent stale pre-save History reads. |
| UX-308-03 | Successful save -> History | Entry performs a fresh first-page read and shows the saved workout per TREK-305; no stale empty contradiction or duplicate persistence. |
| UX-308-04 | Dense recent history and one exercise detail; phone + desktop | Scan rows expose date, duration, confirmed work, omissions, and exercise counts without set parsing; per-exercise disclosure reveals current detailed records. |
| UX-308-05 | Partial/long workout, long names, interruption; phone + reflow | Partial truth remains explicit; disclosures and scroll position/state remain usable after interruption; detail wraps without horizontal overflow. |
| UX-308-06 | Legacy and malformed entries | Legacy renders guarded available facts; malformed renders unavailable truth; neither invents completion, duration, or set claims. |
| UX-308-07 | Empty, initial loading, initial offline/error/retry | One clear status or alert appears in reading order; retry is keyboard/touch accessible; empty is factual and contains no invented campaign. |
| UX-308-08 | Older-page loading, failure/retry, dedupe, exhaustion | Loaded cards remain; busy state is named; failure focuses retry; append focuses first new heading; final message replaces paging. |
| UX-308-09 | Keyboard, screen reader, touch, 320/reflow across shell and details | Shell order, headings, article summaries, disclosure names/states, set detail, pagination, 44px targets, focus outlines, and no horizontal overflow are evidenced. |
| UX-309-01 | Settings initial job selection; phone + desktop | Defaults opens initially; three job summaries are visible in the first decision region and identify the correct job within five seconds; only one is open. |
| UX-309-02 | Switch jobs and resume dirty/editor context | Opening another native disclosure does not unmount or reset inputs, current editor, validation, confirmation, retry, or pending state; reopening restores the same context. |
| UX-309-03 | Dirty/failing Defaults; keyboard + shared live region | Invalid values remain editable; alerts are associated; save failure/retry survives switching; the outside shared region names the affected job and the closed summary exposes `Needs attention` without focus theft. |
| UX-309-04 | Superset create/edit/remove/reactivate and failures | Existing one-editor, confirmation, serialization, retry, pause/reactivate, feedback, and focus-return contracts remain inside Supersets. |
| UX-309-05 | Long Catalog add/edit; phone + reflow, touch + keyboard | Add precedes Current catalog; long content wraps; one editor retains every field and error through job switching; current yellow/neutral action hierarchy remains. |
| UX-309-06 | Catalog deactivate/reactivate and retry | Superset consequences and choices remain factual; pending disables conflicting actions; failure retains context and retry; focus returns to the correct row/action. |
| UX-309-07 | Settings loading/initial failure and Close/destination interruption | Whole-surface loading/error authority remains; retry works; safe close/return preserves App-owned state and current dirty-authority behavior; no persistent active-job preference. |
| UX-309-08 | Settings keyboard, screen reader, touch, 320/reflow | Three summaries expose heading/expanded state in reading order; nested controls remain reachable only when visible; focus is not clipped; 44px targets and no horizontal overflow. |
| UX-309-09 | A pending mutation completes or fails after another job opens | The visible shared region announces the outcome and affected job outside closed bodies; focus stays in the visible job; failure marks the closed summary `Needs attention`; reopening restores the existing context and retry target. |
| UX-16-COPY | Post-focus clarity pass across the shared shell/destination navigation, Plan, Workout ready, Review, saved receipt, History/Workouts, and Settings; phone + desktop + reflow | In each complete interaction path, shell labels, headings, actions, helper text, loading, empty, success, error, retry, and interruption messages state what happened, what matters, and what happens next in plain, consistent Nudge terminology. Visible labels and accessible names agree; long, dynamic, and user-controlled text can expand without hiding meaning or the primary action. |

## Verification and evidence plan

Implementation must use focused TDD per task: first demonstrate the expected failing
hierarchy/state test, then make the smallest passing change. Reuse current focused
suites for `Generator`, `WorkoutView`, `WorkoutHistory`, `Settings`, App lazy
navigation, active-workout recovery/session, and the existing TREK-294/300 lifecycle.
Do not rerun broad tests without a new failure signal.

After each screen's focus and layout changes stabilize, run one bounded
`$impeccable clarify` pass over its complete interaction path before collecting final
rendered evidence. This pass may refine labels, helper text, status, empty, success,
error, retry, and recovery messages when the implementation exposes ambiguity. It
must preserve factual product meaning, stored-data truth, current action consequences,
Nudge voice, and the task's exclusions; it must not invent coaching, readiness,
recommendation, timing, persistence, or recovery claims. A copy change that would
alter product behavior, legal meaning, data semantics, or approved intent is an
escalation, not an implementation detail. Verify the shared shell and each changed
screen in context at phone, desktop, and reflow widths, including contextual
Plan/Workout destination labels, long names, pluralization, dynamic and
user-controlled values, accessible names, and announced state changes.

For each changed scenario, record starting state, viewport, input method, actions,
observed result, screenshot or semantic evidence, and material limitation. A compact
evidence set may cover multiple matrix rows when it directly proves each named state.
At minimum capture phone and desktop default topology, 320/reflow for every dense
surface, keyboard focus for disclosure/retry/return paths, and live-region or alert
semantics for pending, failure, indeterminate, conflict, and success. Existing
TREK-233, TREK-235, TREK-236, TREK-296, and TREK-300 assets are comparison baselines,
not post-change acceptance evidence.

The fresh UX design reviewer receives this artifact and task-scoped rendered proof.
After implementation, the usability reviewer blocks only on a direct changed-surface
defect or missing required evidence. Architecture review for TREK-308 verifies safe
destination/session ownership and fresh-read boundaries; it must not expand into a
router, store, or History redesign.

## Explicit exclusions and open decisions

Across all four tasks: no workout-engine, ordering algorithm, schema, migration,
Firebase rule, auth, user-isolation, active-workout recovery, immutable-save,
navigation-recovery authority, or unrelated visual-system change.

- TREK-306: no drag-and-drop, post-Start reorder, Settings change, route, sticky
  control, preference manager, or speculative control framework.
- TREK-307: no new persistence, recommendation, praise/gamification, History IA,
  another-workout campaign, or fabricated receipt fact.
- TREK-308: no search, filtering, grouping, bulk tools, pagination redesign, trends,
  eligibility/calculation, Exercises chart/scrubber, persistent navigation preference,
  schema/write/migration change, or TREK-305 reimplementation.
- TREK-309: no new route, stored active-job preference, search, grouping, filtering,
  batch actions, configuration framework, multiple editors, or visual redesign.

No material product decision remains open. Builder-level copy may be shortened only
if it preserves the factual meanings and accessible names above. If exclusive native
`details name` behavior is not supported by the project's browser baseline, escalate
before substituting custom state; the allowed fallback is one local, non-persistent
active-job value that keeps all job bodies mounted and preserves the same focus,
dirty, editor, pending, and retry contracts.

## Decision log

- Keep Plan primary-before-optional and move all pre-start ordering behind one native
  disclosure after the compact summary and Start action.
- Preserve Generator/App/WorkoutView/session ownership and every existing contextual
  order lifecycle state.
- Keep the receipt across lazy remounts in one transient session-owned payload derived
  before definitive-save cleanup; clear it on Return to plan, identity retirement, or
  new generation, and never persist or reconstruct it from History.
- Promote History through the existing lazy shell rather than a route, and make
  Workouts scan-first with per-exercise detail on demand.
- Derive one `canLeaveWorkout` predicate from existing checking/recovery, blocked, and
  save-pending truth so unsafe destination changes remain on Workout without a lock
  or compensating refresh mechanism.
- Keep Settings in one destination and express its three jobs as exclusive native
  disclosures whose mounted content preserves in-progress work.
- Follow each stabilized focus/layout change with a bounded whole-path copy-clarity
  pass before final rendered evidence; resolve local ambiguity without inventing new
  product claims or scope.
- Prefer no one-item Workouts tab and no saved-completion History shortcut; both add
  controls without improving the approved outcome.
