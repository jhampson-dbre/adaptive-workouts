# Workout Muscle-Group Diversity

## Status

Approved on 2026-07-14 after feature discovery, architecture review, and user
approval. This document is the implementation contract for EPIC-9.

## Problem

Limited workout slots can be spent on multiple exercises from one muscle group
while sufficiently rested groups are omitted. For example, a generated workout
might contain a Tier 1 lateral shoulder raise, chest-supported rows, and incline
rows instead of using the third slot for eligible Chest or Core work.

## Goals

- Broaden muscle-group coverage within generated workouts.
- Rotate eligible work oldest-first before it becomes stale.
- Include Tier 4 work regularly without repeatedly displacing Tier 3 muscle-group
  coverage.
- Retain duplicate-group and recent work as fallback so usable workout time is not
  unnecessarily left empty.

## Non-goals

- No Settings control or other user-facing configuration.
- No persistence-schema or generated-workout-schema change.
- No change to the public `generateWorkout` signature.
- No change to Tier 1 pivot selection or internal rotation.
- No change to the mandatory Tier 3 leg-day block policy.
- No hard one-exercise-per-muscle-group cap.
- No broader validation or repair of linked catalog configuration.
- No deployment or merge work as part of the feature implementation.

## User Experience

The policy is automatic. The generator continues to attempt the configured primary
leg block and chosen Tier 1 pivot using their existing ordering, fit, and atomicity
behavior. Only work that actually fits and is selected consumes time or marks its
muscle groups represented.

When time permits, the generator prefers sufficiently rested exercises from muscle
groups not yet represented in the workout. Duplicate-group exercises remain
available after diverse options are exhausted or cannot fit. Work completed today
or yesterday is held until the final fallback phase.

## Recency and Completion Semantics

- Reuse the shared completion-aware `wasPerformed` behavior for recency, quota
  resets, and Tier 3 coverage credit.
- V2 simple work counts only when its exercise occurrence is completed.
- V2 weighted and bodyweight work counts when at least one set record is completed.
- Malformed V2 occurrences fail closed under the existing shared predicate.
- Legacy history retains its existing presence-based compatibility behavior.
- Today and yesterday are recent: calendar age is less than or equal to one day.
- Older work has a calendar age greater than one day.
- Never-performed work is ordered as oldest and is treated as stale.
- Otherwise, an exercise is stale only when its calendar age is greater than the
  configured `staleThreshold`.

## History Attribution

- Quota state is reconstructed from completed workout history; no persisted counter
  is introduced.
- V2 occurrences use their saved `tier` and `muscleGroup` snapshots when classifying
  historical work.
- Historical Tier 3 coverage receives credit only when the snapshot muscle group is
  still present in the current required Tier 3 coverage set.
- Legacy occurrences resolve their exercise IDs through the current catalog.
- The most recent workout timestamp containing performed Tier 4 work is the quota
  reset boundary. Tier 3 work in that same workout does not earn post-reset credit.
- Equivalent timestamps are compared by parsed epoch time. Tier 3 credit must be
  strictly later than the reset boundary, regardless of timestamp string or offset.

## Required Tier 3 Coverage Set

The current required set contains muscle groups with at least one active,
generation-eligible floating Tier 3 candidate.

- Unrecovered groups are excluded for the current generation.
- Tier 3 Legs reserved by an active configured leg-day policy are excluded.
- Tier 3 Legs participate normally when no leg-day reservation applies.
- Candidate fit does not change the coverage requirement. An otherwise eligible
  Tier 3 unit remains required even when the current time budget is too small for it.
- Catalog activation, removal, tier changes, and muscle-group changes recalculate
  the current required set immediately.

## Tier 4 Rolling Coverage Quota

- With no prior completed Tier 4 work, ordinary Tier 4 promotion starts open.
- After a completed Tier 4 occurrence, ordinary Tier 4 promotion reopens only after
  every group in the current required Tier 3 set has a strictly later completed
  Tier 3 occurrence.
- Only completed Tier 3 exercises provide coverage credit. Tier 1 or Tier 4 work for
  the same muscle group does not provide Tier 3 credit.
- Any completed Tier 4 occurrence resets the cycle, including Tier 4 work selected
  through fallback.
- A never-performed or stale Tier 4 atomic unit may bypass a closed coverage quota.
- At most one fitting Tier 4 atomic unit is promoted into the diversity-first phase
  per generated workout.
- The promotion slot is consumed only when the unit fits and is selected.
- This is a promotion cap, not a total Tier 4 cap. Additional unrepresented Tier 4
  units remain eligible in the Tier 4 fallback phase.
- An empty required Tier 3 set leaves ordinary Tier 4 promotion open.

## Atomic Candidate Units

Existing active, recovery, pivot, and leg-day filters run before linked units are
formed.

- If a linked partner is filtered out, preserve current behavior: the surviving
  candidate remains selectable alone.
- A surviving linked pair is a single fit and selection unit.
- A unit containing any Tier 4 member is Tier 4 for quota purposes.
- A unit's effective recency is its freshest member's last-performed date.
- A unit is never performed only when every member is never performed.
- Recent classification and stale bypass use effective unit recency. One old member
  cannot promote a bundle containing a recently performed member.
- Atomic units are deduplicated by identity even when one linked unit is the oldest
  representative for multiple muscle groups.
- A unit remains diversity-eligible while it covers at least one unrepresented
  muscle group. Selecting it marks every member muscle group represented and removes
  the unit from further consideration.
- Catalog position is the final deterministic tie-breaker.

## Selection Algorithm

After the existing primary-leg-block and chosen Tier 1 attempts, build the workout
through the following phases. Represented groups update only when a fitting unit is
actually selected.

### Phase 1: Diversity-first representatives

For each older-than-one-day, unrepresented muscle group, find the atomic unit whose
effective recency is oldest. Never-performed units sort first.

Merge all Tier 3 representatives with at most one quota-open or stale-bypass Tier 4
representative. Order the merged representatives oldest-first regardless of Tier 3
versus Tier 4.

Representatives are advanced dynamically during fit-aware selection. If a group's
oldest unit does not fit, skip that unit and expose the group's next-oldest remaining
unit in the same phase, then recompute global oldest-first ordering. The group remains
unrepresented until a unit that covers it is actually selected.

For Tier 4 promotion, scan eligible representatives oldest-first until one fitting
Tier 4 unit is selected or the candidates are exhausted. A non-fitting Tier 4 unit
neither consumes nor blocks the promotion slot.

### Phase 2: Unrepresented Tier 4 fallback

Consider remaining older-than-one-day Tier 4 representatives for still-unrepresented
groups. This includes quota-closed Tier 4 units and additional Tier 4 units beyond
the single promotion slot.

Every unrepresented Tier 4 fallback in this phase precedes every duplicate-group
unit.

### Phase 3: Older duplicate groups

Consider remaining older-than-one-day units whose muscle groups are already
represented. Duplicates are allowed so the generator can continue filling useful
workout time.

### Phase 4: Recent final fallback

Consider units performed today or yesterday only after all older phases. Within the
recent pool, prefer unrepresented groups before recent duplicate groups.

The one-day boundary is absolute: an older duplicate-group unit precedes a recent
Tier 4 unit, even when that Tier 4 muscle group is unrepresented.

### Ordering and Fit Within Phases

- Primary ordering is effective recency, oldest first.
- Equal recency is resolved by computed dynamic tier, base tier, then catalog order.
- Existing dynamic stale promotion remains provenance and a tie-breaker; it does not
  allow a stale duplicate to jump ahead of an eligible unrepresented group.
- A unit that does not fit is skipped without stopping the phase. Later smaller units,
  including the next-oldest unit for the same still-unrepresented group, remain
  eligible under that phase's tier and quota rules.

## Data and API Impact

- Keep the `generateWorkout` signature unchanged.
- Keep the generated exercise occurrence and saved workout schemas unchanged.
- Keep implementation helpers private to the engine unless a concrete maintainability
  problem is reviewed and approved during implementation.
- No Firestore, authentication, Settings, migration, or deployment changes are
  required.

## Compatibility with Bounded History

The current application loads enough history to reconstruct per-exercise recency,
the latest completed Tier 4 reset boundary, and post-boundary Tier 3 coverage.
TREK-97 must preserve equivalent facts if history reads become paginated or bounded.
This feature must not silently calculate quota state from an incomplete history
horizon.

## Edge Cases

- Mandatory work that does not fit is not selected and does not mark a group
  represented.
- Multiple stale Tier 4 units still receive at most one promoted slot; remaining
  unrepresented units continue through Tier 4 fallback.
- Mixed-tier linked units consume the Tier 4 promotion slot when promoted.
- A non-fitting promoted Tier 4 candidate does not consume the slot.
- Tight-budget selection continues scanning for smaller fitting units.
- Unrecovered, inactive, non-pivot Tier 1, and leg-filtered candidates retain their
  existing exclusions.
- Skipped or malformed V2 Tier 4 work does not reset the quota.
- Reordered input history and equivalent timestamp offsets produce deterministic
  results.

## Testing Strategy

Use vertical TDD slices in `src/tests/engine.test.js`, pinning the Vitest clock and
restoring real timers after each case.

Required coverage includes:

- The motivating Shoulder/Back/Back replacement.
- Tight-budget scanning when the first diverse candidate does not fit.
- Calendar ages zero, one, two, `staleThreshold`, and `staleThreshold + 1`.
- Oldest-first ordering across Tier 3 and Tier 4.
- Quota closed, open, reset, no prior reset, and empty required Tier 3 set.
- Same-workout and same-epoch Tier 3/Tier 4 reset boundaries.
- Equivalent timestamp strings with different offsets and strictly later coverage.
- Skipped and malformed occurrences not changing quota state.
- Never-performed and stale Tier 4 bypass.
- The single Tier 4 promotion cap and non-fitting promotion behavior.
- Quota-closed older Tier 4 fallback ahead of duplicate groups.
- Older duplicates ahead of all recent Tier 4 work.
- Recent unrepresented groups ahead of recent duplicates.
- Budget-independent Tier 3 coverage requirements.
- Mixed-tier, recent-member, multi-group, and filtered-partner linked behavior.
- Pivot, primary-leg reservation, floating legs, recovery, inactivity, and actual
  selected-work representation.
- Catalog reclassification and V2 snapshot versus legacy lookup behavior.
- Malformed and unordered history plus stable equal-recency tie-breaking.
- Full fallback behavior when diverse choices are exhausted.

Record each expected failing test and its subsequent passing evidence. Final local
verification is the targeted engine suite followed by `npm run ci:check` and
`git diff --check`.

## Acceptance Criteria

- A workout like Shoulder/Back/Back becomes Shoulder/Back/eligible older Chest or
  Core when time permits.
- An older unrepresented group outranks a stale duplicate group.
- Completed Tier 3 muscle-group coverage gates ordinary Tier 4 promotion.
- Never-performed and stale Tier 4 work cannot be starved.
- No more than one fitting Tier 4 atomic unit is diversity-promoted per workout.
- Additional older unrepresented Tier 4 fallback remains ahead of older duplicates.
- Older duplicates remain ahead of all work performed today or yesterday.
- Within recent final fallback, unrepresented groups precede recent duplicates.
- Existing pivot, leg-day, recovery, fit, linking, and completion-aware behavior
  remains intact.
- Results are deterministic under history ordering, catalog changes, equal
  timestamps, and tight time budgets.
- No Settings, persistence schema, public API, migration, or deployment change is
  introduced.

## Decision Log

- Duplicate muscle groups are allowed only after diverse choices are exhausted or
  cannot fit; diversity is a preference, not a hard cap.
- The diversity recency gate is more than one calendar day.
- Work completed today or yesterday is final fallback.
- The one-day boundary outranks diversity: older duplicates precede recent Tier 4.
- Diversity outranks dynamic stale promotion for duplicate groups.
- Tier 1 pivot, primary leg-day blocks, and surviving linked units retain their
  existing special handling.
- Representatives and groups are ordered oldest-first regardless of Tier 3 versus
  Tier 4; tier resolves equal recency only.
- Tier 4 frequency uses a completed-history coverage quota rather than a fixed
  cooldown or numeric ratio.
- Tier 3 coverage credit requires completed Tier 3 work.
- Unrepresented older Tier 4 fallback outranks duplicate work even when the ordinary
  Tier 4 promotion quota is closed.
- The policy is automatic and introduces no user setting.

## Alternatives Considered

- **Hard one-per-group cap:** rejected because it can leave useful workout time
  empty.
- **Strict Tier 3 before Tier 4:** rejected because it can starve Tier 4 work.
- **Fixed workout cooldown:** rejected because it is disconnected from individual
  exercise freshness and irregular workout cadence.
- **Pre-stale window alone:** rejected because multiple Tier 4 exercises can still
  cluster across workouts.
- **Fixed Tier 3-to-Tier 4 ratio:** rejected because it replaces an arbitrary
  cooldown with an arbitrary quota ratio.
