# TREK-315 Settings catalog-first UX addendum

Status: proposed implementation artifact for task-level UX and architecture review.

This addendum supersedes the Defaults-first, three-job Settings topology in
`2026-08-07-epic-16-outside-workout-focus.md` (especially UX-309-01 through
UX-309-08) and the Add-before-list Catalog hierarchy in the incumbent Settings
surface brief and DESIGN.md. Catalog results now lead because scanning and
maintenance are the primary job; Add remains prominent as a secondary disclosure.
This does not reopen EPIC-16 or change its shell, navigation, persistence,
mutation, validation, focus, or feedback authority.

## Job, audience, and outcome

Settings is an infrequent, mobile-first **Operate** workspace for a trainee who
wants to find or change one configuration without learning the storage model.
The first view makes the exercise library immediately useful while keeping all
four jobs discoverable: Catalog, Defaults, Supersets, and Saved exercise orders.

Success means the user can scan or filter the Catalog quickly, add or edit an
exercise without losing context, understand current workout rules, and build a
valid superset with recoverable guidance. The four native disclosures remain
mounted so browser-owned open state never becomes application state and drafts,
pending work, retry state, and feedback survive switching.

## Direction: a compact training control board

The established Nudge world remains authoritative: hard-edged black, white,
concrete, and signal-yellow planes; condensed headings; Atkinson body copy;
native affordances; no shadows or decorative cards. Settings becomes a compact
training control board. A compact numbered job index precedes the disclosures and
links to each native summary, so every job remains promptly reachable even when
Catalog contains many rows. Each open body has one strong working plane and one
clear next action. Catalog leads with
scan controls and dense alphabetical rows. Defaults uses three factual rule
groups. Supersets uses a visible Choose → Arrange → Review progression around the
existing draft and save path. Signal yellow remains reserved for the current
primary action, never for every disclosure or status.

## Phone wireframe (390px; 320px uses the same single-column order)

```text
┌──────────────────────────────────────┐
│ SETTINGS                         Close│
│ Configure training without losing    │
│ what is already in progress.          │
│ 01 Catalog  02 Defaults                │
│ 03 Supersets  04 Saved orders          │  0
├──────────────────────────────────────┤
│ 01  CATALOG                [expanded] │  A
│     Find, add, and maintain exercises │
│ ┌──────────────────────────────────┐ │
│ │ Search exercises                │ │  B
│ │ Muscle group [All             ▾]│ │
│ │ □ Show inactive   Clear filters │ │
│ └──────────────────────────────────┘ │
│  8 EXERCISES                          │  C
│ ┌──────────────────────────────────┐ │
│ │ BARBELL ROW       ACTIVE         │ │
│ │ Back · Weighted · 3 sets         │ │
│ │ Default rest       Edit Deactivate│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ADD EXERCISE          [collapsed]│ │  D
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ 02  DEFAULTS              [collapsed]│  E
│ 03  SUPERSETS             [collapsed]│
│ 04  SAVED EXERCISE ORDERS [collapsed]│
├──────────────────────────────────────┤
│ Shared pending / success / error      │  F
└──────────────────────────────────────┘
```

- **0:** The compact job index contains same-page links to the four summary
  elements. Activating a link opens its destination and focuses the native
  summary without adding persisted selection state. The index remains before the
  potentially long Catalog so all jobs are promptly reachable.
- **A:** The four same-name native `details` summaries remain mounted and retain
  their native summary-toggle behavior. Catalog alone has `open` on fresh mount;
  job-index activation may open another destination directly.
- **B:** Filters are local presentation state. The inactive checkbox is off by
  default; Clear filters appears only when any filter differs from baseline.
- **C:** The stable results heading/status is programmatically focusable. Rows
  are derived alphabetically without mutating stored Catalog order.
- **D:** Add exercise is a secondary native disclosure, closed by default.
- **E:** Closed summaries still communicate each job's purpose; their bodies
  stay mounted and retain drafts, pending state, validation, and retry state.
- **F:** App-owned and cross-area feedback remains outside all job disclosures.

## Desktop wireframe (760px working column)

```text
┌────────────────────────────────────────────────────────────────────┐
│ SETTINGS                                                Close      │
│ A compact control board for exercises and workout rules.           │
│ 01 Catalog  ·  02 Defaults  ·  03 Supersets  ·  04 Saved orders    │
├────────────────────────────────────────────────────────────────────┤
│ 01 CATALOG · Find, add, and maintain exercises          [expanded] │
│ ┌─────────────────────────────┬──────────────────────────────────┐ │
│ │ Search exercises            │ Muscle group [All             ▾]│ │
│ │ □ Show inactive             │ Clear filters (conditional)     │ │
│ └─────────────────────────────┴──────────────────────────────────┘ │
│ 8 EXERCISES                                                       │
│ BARBELL ROW     Back · Weighted · 3 sets · Default rest           │
│ ACTIVE                                             Edit Deactivate │
│ ───────────────────────────────────────────────────────────────── │
│ DUMBBELL PRESS  Chest · Weighted · 3 sets · 90 sec rest           │
│ ACTIVE                                             Edit Deactivate │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ ADD EXERCISE                                        [collapsed]││
│ └────────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│ 02 DEFAULTS · Recovery, workout timing, and schedule   [collapsed]│
│ 03 SUPERSETS · Choose, arrange, and review combinations[collapsed]│
│ 04 SAVED EXERCISE ORDERS · Clear remembered orders     [collapsed]│
├────────────────────────────────────────────────────────────────────┤
│ Shared pending / success / error                                  │
└────────────────────────────────────────────────────────────────────┘
```

Desktop widens controls and row facts but preserves phone reading order. It does
not become a separate dashboard, sidebar, table, or persistent two-pane layout.

### Primary-action hierarchy

| State | Signal-yellow action | Neutral actions |
| --- | --- | --- |
| Catalog idle | Collapsed **Add exercise** summary | Filters, Clear filters, Edit, Deactivate/Reactivate |
| Add exercise open | **Add exercise** submit | Add summary, Advanced controls, Cancel/recovery actions |
| Catalog row edit | **Save exercise** | Cancel, other locked row actions |
| Defaults | None; values save through their established change/blur semantics | All controls use native neutral treatment |
| Superset Choose or Arrange | **Next** | Back, Cancel, member/order controls |
| Superset Review | **Save superset** | Back, Cancel |
| Saved exercise orders | None | Clear/retry/confirmation controls retain destructive-neutral treatment |

Only one yellow action appears at a time. Opening Add neutralizes its summary;
starting a row edit or Superset flow neutralizes other candidate actions.

## Interaction contract

### Catalog and filters

- Derive visible rows with a copied alphabetical sort; never reorder the
  persisted Catalog array.
- Apply case-insensitive name matching and exact muscle-group filtering together.
  Hide inactive exercises at baseline.
- Distinguish a truly empty Catalog, a filtered empty result, and an inactive-only
  Catalog. Recovery is factual and offers only actions already in scope: Add,
  Clear filters, or Show inactive.
- Edit and Deactivate/Reactivate remain direct row actions and preserve the
  Catalog-wide mutation lock. If deactivation hides the focused row, focus the
  results heading/status and announce that the exercise was deactivated and hidden.

### Add exercise

- Keep the existing draft, validation, one submit, and write path.
- Lead with name, muscle group, and tracking mode. Reveal only mode-required
  progression inputs just in time.
- Put sets, priority, rest override, and linked exercise inside an optional
  Advanced controls disclosure. A compact factual summary mirrors the current
  draft; it does not make recommendations or promise results.
- Switching Settings jobs or closing/reopening Add does not erase the draft or a
  failed-save recovery path.

### Defaults

- Group the existing controls into Recovery, Workout timing, and Schedule working
  planes. Show the current value prominently and explain its direct effect in one
  sentence.
- Preserve every current save-on-change or save-on-blur boundary, overlapping-save
  behavior, validation range, dirty state, retry, and focus behavior.

### Supersets

- Add one ephemeral presentation step over the existing `supersetDraft`: Choose,
  Arrange, Review. Editing seeds the same draft and flow; Back/Next never writes.
- Choose lists only currently eligible exercises while keeping assigned, inactive,
  paused, or invalid existing-group recovery truthful.
- Arrange exposes the existing order controls and unequal-set compatibility
  guidance. Every reorder keeps an accessible announcement and stable focus.
- Review states member order, set compatibility, and rest placement before the
  existing save. Validation remains authoritative and users can return without
  losing choices. Failure preserves the draft for retry; success returns to the
  existing saved-list behavior.

#### Superset presentation states

| State | Visible content | Forward boundary, focus, and recovery |
| --- | --- | --- |
| Choose | Eligible active exercise selectors, selected count, and factual assigned/inactive guidance for an edited group | **Next** stays disabled until at least two distinct eligible members are selected. Validation feedback is associated with the selectors; editing enters here with the existing members selected. |
| Arrange | Ordered member list, existing Move up/down controls, set counts, unequal-set guidance, and rest-placement control | **Next** validates current compatibility through the existing validator. Reorder announcements and focus remain on the moved member control. **Back** returns to Choose without changing the draft. |
| Review | Member order, set compatibility, and rest placement as read-only facts | **Save superset** invokes the existing write path. **Back** returns to Arrange. Failure stays in Review, associates the error with Retry, preserves the draft, and focuses the existing retry action; success returns to the saved group list and established focus target. |

The step label is an ordered text list with the current step exposed using
`aria-current="step"`; it is not a tablist, route, persisted preference, or second
state machine. Cancel from any step follows the existing draft cancellation and
focus-return contract.

### Saved exercise orders

- The fourth native disclosure owns only the existing App-provided preference
  operation panel; Settings does not copy or reinterpret its lifecycle state.
- The existing **Clear saved exercise orders** affordance remains available
  unconditionally because Settings has no authoritative persisted-presence fact.
  It stays safe and idempotent through the existing App/storage contract; Settings
  must not infer presence from operation or workout-session baseline state.
- Existing confirmation, captured operation, disabled/pending semantics,
  indeterminate truth, success, failure, and retry remain authoritative. The clear
  action stays neutral/destructive, never yellow.
- Pending, success, and failure remain visible in the shared outside feedback
  region if this disclosure closes. Actionable failure adds `Needs attention` to
  the closed summary without opening it or moving focus. Reopening exposes the
  same retry/confirmation context; settlement never duplicates a write.
- Focus after success returns to the Saved exercise orders summary or the existing
  stable panel heading. Failure focuses the existing retry target only when the
  job is visible; a closed-job outcome never steals focus.

## Scenario matrix

| ID | Starting state and action | Required observable result |
| --- | --- | --- |
| UX-315-01 | Fresh Settings mount at phone and desktop, including a dense Catalog | The four-link job index precedes the disclosures and reaches each matching native summary; summaries remain in Catalog, Defaults, Supersets, Saved exercise orders order; Catalog alone starts open. |
| UX-315-02 | Typical active Catalog; type name, select muscle, combine filters | Rows update case-insensitively, remain alphabetical, and stored order is unchanged. |
| UX-315-03 | Any non-baseline filter; clear it | Clear filters is visible only while active and restores the inactive-hidden baseline. |
| UX-315-04 | Empty, filtered-empty, and inactive-only data | Each state explains the condition and offers only the relevant Add, Clear filters, or Show inactive recovery. |
| UX-315-05 | Edit, deactivate, and reactivate compact rows | Existing mutation, validation, confirmation, retry, and lock semantics remain; hidden deactivation moves focus to results and announces the outcome. |
| UX-315-06 | Add simple, weighted, and bodyweight exercises | Mode fields appear just in time; Advanced preserves optional values; summary stays factual; existing submit path saves once. |
| UX-315-07 | Add validation or save failure; switch jobs and return | Draft, errors, retry state, and current Add disclosure state remain usable. |
| UX-315-08 | Open Defaults and edit each rule group | Current values and effects are legible; existing change/blur, overlap, dirty, retry, and feedback semantics are unchanged. |
| UX-315-09 | Create a superset through Choose → Arrange → Review → Save | Choices persist between steps; eligibility, order, set compatibility, rest placement, and final save are clear. |
| UX-315-10 | Back, edit, unequal sets, failed save, retry, remove/reactivate | The existing draft and validator remain authoritative; recovery never creates a second model or write path. |
| UX-315-11 | Start drafts or async work, switch disclosures, receive closed-area outcome | Bodies remain mounted and all cross-area/App-owned feedback remains visible and truthful outside disclosures. |
| UX-315-12 | Keyboard and screen reader traversal | Summary expanded state, labels, errors, steps, reorders, results count, focus recovery, and announcements are programmatically clear. |
| UX-315-13 | 320px width and 200% reflow | Reading order remains single-column, targets remain at least 44px, focus is not clipped, and there is no horizontal overflow. |
| UX-315-14 | Saved-order clear confirmation; pending/indeterminate; success; failure/retry while open and closed | The unconditional Clear affordance never claims persisted presence, the body mirrors App-owned operation truth, no write duplicates, outside feedback remains visible, `Needs attention` marks actionable closed failure, and focus follows the named visible/closed behavior. |

## Boundaries and acceptance

- Reuse native `details`, inputs, select, checkbox, and existing local state. Add no
  route, modal, dependency, schema, persistence, drag-and-drop, bulk action,
  recommendation, analytics, virtualization, or reusable Settings framework.
- Preserve destructive safeguards, saved-order ownership, dirty authority, shared
  feedback, and all current Catalog, Defaults, and Superset storage contracts.
- Align `.impeccable/surfaces/src-components-settings-jsx.md` with this addendum's
  approved four-job, scan-first hierarchy; do not rewrite global DESIGN.md because
  the established Nudge visual system remains unchanged.
- Rendered task evidence must cover every matrix row at a representative phone and
  desktop size, with dedicated 320px reflow and keyboard/focus observations.
- A direct changed-surface defect, lost draft/feedback, persisted sort/filter/step,
  or missing required rendered observation blocks completion.
