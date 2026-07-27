# TREK-97 History Pagination UX Evidence

`UX-ARTIFACT: trek-97-history-pagination@v2`

This is the authoritative, planning-only UX artifact for TREK-97. It captures the
approved contract before implementation; it is not rendered implementation evidence.
All data used by future execution evidence must be synthetic or de-identified local
data.

## Planning classification

| Field | Record |
| --- | --- |
| Classification | `required` |
| Applicability rationale | Workout-history pagination changes an interactive disclosure, asynchronous feedback, keyboard focus, recovery, and the relationship between saved history and an active workout. |
| Proportional artifact | `docs/reports/trek-97-history-ux-evidence.md`; six scenario records and compact wireframes cover the approved state and recovery lifecycle without prescribing implementation. |
| Planning artifact revision | `UX-ARTIFACT: trek-97-history-pagination@v2`; authoritative location: this file. |
| Planning wireframe status | `planning-only`; wireframes below describe intended flow and are not rendered evidence. |
| Required UX design review | Required; approved UX contract recorded in TREK-97 comment CMT-252. |
| Architecture authority | Architecture retains authority for system boundaries, data, security, and feasibility. |

## Approved hierarchy and feedback contract

The disclosure is a utility for the single job of browsing prior workouts without
blocking the active workout. `Load older` is secondary; retry controls are contextual;
there are no destructive actions. It retains its existing placement below the active
workout and completion summary, expanding in document flow without covering or
displacing active-workout controls. Feedback uses one mutually exclusive live-feedback
slot: polite loading, success, or end messages, or the current alert on failure.

```text
Workout history disclosure [expanded | collapsed]
  Prior-workout cards (newest first)
  [Load older]                 secondary, while more results exist
  Loading / success / end text  polite, one current message
  Alert + [Retry...]            replaces the polite message only on failure
```

Future rendered evidence is required at 320 px, 375 px, 768 px, and 1280 px at normal
zoom, plus representative narrow and desktop evidence at 375 px and 1280 px at 200%
zoom, including keyboard and focus behavior. Before every execution run, capability
must be re-probed; the records below intentionally contain no inferred capability or
execution result.

## Persisted duration compatibility contract

Pagination returns stored history documents verbatim. Existing schema classification
remains authoritative: no duration field is inferred from another field, no unit is
converted, and TREK-97 performs no history write, backfill, or migration. Legacy, v2,
and v3 records continue to coexist under their existing contracts.

| Full persisted path | Readers / writers | Storage, input, and display precision | Null, missing, zero, and sentinel semantics | Version detection, reads, writes, and coexistence |
| --- | --- | --- | --- | --- |
| `users/{uid}/history/{workoutId}.actualDuration` on a legacy document without `schemaVersion` | Historical/local-migration data may contain it; the legacy history reader conditionally displays it. TREK-97 only reads and returns it. | Existing finite nonnegative minutes; no input or storage rounding is added. The history card displays the stored number followed by `mins`. | Optional for legacy. Missing, `null`, negative, or nonfinite values omit the duration line without invalidating the whole legacy document. Zero is valid and displays as `0 mins`. There is no sentinel. | Absence of `schemaVersion` selects legacy behavior. No inference from seconds, conversion, rewrite, or migration. Legacy records coexist unchanged with v2/v3. |
| `users/{uid}/history/{workoutId}.actualDuration` on `schemaVersion: 2` | Existing v2 builder/writer and v2 history reader; TREK-97 only reads and returns it. | Finite nonnegative minutes with caller-provided numeric precision; no additional input/storage rounding. Display uses the stored number followed by `mins`. | Required for valid v2. Missing, `null`, negative, or nonfinite values make the versioned document malformed. Zero is valid. There is no sentinel. | Exact `schemaVersion: 2` selects v2 minute semantics. V3 forbids this field. No conversion or migration; v2 remains readable beside legacy/v3. |
| `users/{uid}/history/{workoutId}.actualDurationSeconds` | Existing v3 active-workout builder/writer and v3 history reader; TREK-97 only reads and returns it. | Elapsed millisecond deltas are divided by 1000, rounded to the nearest whole second with `Math.round`, then clamped to zero. The resulting nonnegative integer seconds are stored without further rounding and displayed as `M:SS`. | Required for valid v3. Missing, `null`, negative, fractional, or nonfinite values make the document malformed. Zero is valid. There is no sentinel. | Exact `schemaVersion: 3` selects this canonical total and forbids `actualDuration`. No legacy/v2 inference, conversion, rewrite, or migration. |
| `users/{uid}/history/{workoutId}.exercises[].setRecords[].plannedRestSeconds` | Existing v3 generator/active-workout writer and v3 history reader; TREK-97 only reads and returns it. | Integer seconds; configured non-final values are 5-600 inclusive and display as `M:SS`, with no storage/display-unit conversion. | Final sets require `null`. A non-final missing, `null`, fractional, or out-of-range value is invalid. Zero is not valid for a non-final set and is not a sentinel. | Valid only inside v3 set records. No legacy/v2 inference or migration. |
| `users/{uid}/history/{workoutId}.exercises[].setRecords[].workDurationSeconds` | Existing v3 active-workout writer and v3 history reader; TREK-97 only reads and returns it. | Elapsed millisecond deltas are divided by 1000, rounded to the nearest whole second with `Math.round`, then clamped to zero. The resulting nonnegative integer seconds are stored without further rounding and displayed as `M:SS`. | Confirmed sets require an integer; unconfirmed sets require `null`. Zero is valid confirmed work, not missing. There is no sentinel. | Valid only inside v3 set records. No legacy/v2 inference, conversion, rewrite, or migration. |
| `users/{uid}/history/{workoutId}.exercises[].setRecords[].actualRestSeconds` | Existing v3 active-workout/Finish writer and v3 history reader; TREK-97 only reads and returns it. | Elapsed millisecond deltas are divided by 1000, rounded to the nearest whole second with `Math.round`, then clamped to zero. The resulting nonnegative integer seconds are stored without further rounding, displayed as `M:SS`, and compared directly with planned rest. | Persisted completed non-final sets require an integer; unconfirmed and final sets require `null`. Zero is valid. A live unsaved rest may transiently be `null`, but TREK-97 paginates persisted history only. There is no sentinel. | Valid only inside v3 set records. No legacy/v2 inference, conversion, rewrite, or migration. |

## H1 — First expansion and initial result states

```text
[Workout history ▸]  -- activate -->  [Workout history ▾]  Loading workout history…
                                         first 20 newest cards
                                         20 workouts loaded.
                                         [Load older]
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H1` — Open history and receive its initial result state |
| Changed surface | Workout-history disclosure and initial card list |
| Applicability | `applicable`; this is the entry path for browsing saved workouts. |
| Approved flow | First expansion starts the request only then. Focus remains on the disclosure. The success state shows the first 20 newest workouts and `20 workouts loaded.`; the empty state says `No workouts logged yet.`; failure shows `Couldn’t load workout history.` and `Retry`. Loading says `Loading workout history…`. |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |

## H2 — Load older successfully

```text
20 newest cards
[Load older] -- activate --> Loading workout history… (button busy/disabled)
40 cards
^ focus: first heading in newly appended 20; scroll nearest
20 older workouts loaded.
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H2` — Append the next page of older workouts |
| Changed surface | Load-older control, appended cards, focus, and status feedback |
| Applicability | `applicable`; history has more results after the initial page. |
| Approved flow | `Load older` queries 21 documents, appends the first 20 cards, uses the extra document only to determine `hasMore`, and continues after the 20th displayed document so the undisplayed extra document begins the next page. It is busy and disabled while loading. On success focus moves to the first newly appended card heading using temporary `tabindex="-1"`, with nearest scrolling, and status says `20 older workouts loaded.` |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |

## H3 — Recover from later-page failure

```text
existing cards remain
[Load older] --> alert: Couldn’t load older workouts. [Retry older workouts]
                         -- retry --> same request; alert clears; no duplicate cards
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H3` — Retry an older-workouts request after failure |
| Changed surface | Existing list, contextual alert, and retry control |
| Applicability | `applicable`; a request for a later page fails. |
| Approved flow | Keep already loaded cards. Show alert `Couldn’t load older workouts.` with `Retry older workouts`. When this replaces the focused `Load older` control, move focus to the retry button. During retry, keep that button mounted, busy, and disabled with label `Retrying older workouts…`; clear the matching error and do not duplicate cards. Successful retry follows H2 focus behavior. |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |

## H4 — End of available history

```text
existing cards + [Load older] --> final cards appended
focus first appended heading (or end message when none appended)
All available workouts are shown.
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H4` — Reach the end of available workout history |
| Changed surface | Final appended cards, end message, and Load-older replacement |
| Applicability | `applicable`; the final page has been reached. |
| Approved flow | Replace `Load older` with `All available workouts are shown.`. Focus the first newly appended heading, or the end message with temporary `tabindex="-1"` if no new items were returned. |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |

## H5 — Preserve history state across collapse and reopen

```text
expanded: request/page state pending or loaded
        -- collapse --> no live announcement
        -- reopen --> retained cards/pending state; no replay
stale or duplicate request generation/cursor response --> ignored
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H5` — Retain history lifecycle state without stale updates |
| Changed surface | Disclosure lifecycle, asynchronous feedback, ordering, and stale-result handling |
| Applicability | `applicable`; a user collapses and reopens while data is pending or after pages load. |
| Approved flow | Collapse/reopen retains loaded and pending state. Do not announce while collapsed and do not replay feedback on reopen. Request generation/cursor rejects stale or duplicate responses. Ordering is newest-first, with date ties by descending document ID. The current malformed/legacy fallback remains; documents missing a date are excluded. |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |

## H6 — Generator history cap and intentionally absent pagination

```text
Generator
  newest 100 raw returned docs --> existing busy/history-unavailable retry behavior
  no [Load older], no pagination cursor, no older-only anchor
```

| Field | Record |
| --- | --- |
| Scenario ID and name | `H6` — Keep generator history bounded and free of pagination UI |
| Changed surface | Generator history query and its existing retry states; no pagination control surface |
| Applicability | `applicable`; the generator consumes historical workouts but is not a history browser. |
| Approved flow | The generator receives the newest 100 raw documents returned by the ordered query and retains existing busy/history-unavailable retry behavior. Documents with an invalid but present date consume the cap; documents missing the ordered date field remain excluded. It has no pagination UI; older-only anchors are intentionally absent. |
| Planning wireframe | `planning-only`; compact wireframe above. |
| Per-run capability probe | `not-probed` |
| `capability_state` | `not-probed` |
| Unsupported metadata | `not-applicable-before-probe` |
| Evidence kind | `not-run` |
| Outcome | `not-run` |
| Changed-surface routing | `not-run` |
| Evidence obligation | `not-run` |
| Disposition | `not-run` |
| Allowed recommendation | `not-run` |
| Build / commit | `not-run` |
| Fixture / data revision | `not-run` |
| Requested and actual viewport | `not-run` (execution obligation: 320/375/768/1280 px and 200% zoom) |
| Starting state | `not-run` |
| Action | `not-run` |
| Observed result | `not-run` |
| Evidence link and limitation | `planning-only`; no rendered evidence has been collected. |
