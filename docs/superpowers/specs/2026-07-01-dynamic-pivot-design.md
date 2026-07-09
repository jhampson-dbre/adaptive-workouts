# Dynamic Pivot Engine Design

## Purpose
The Adaptive Workouts generator currently hardcodes 'Biceps' and 'Shoulders' as the only Tier 1 alternating pivot muscle groups. We need to generalize this so the engine dynamically detects Tier 1 muscle groups defined in the catalog and cycles through them day-by-day in an N-way rotation, while continuing to enforce a maximum of 2 Tier 1 muscle groups via the UI.

## Requirements
- Dynamically detect all Tier 1 muscle groups defined in the catalog (e.g., Biceps, Shoulders, Chest).
- Cycle through these Tier 1 groups day-by-day (N-way rotation).
- Only select ONE Tier 1 exercise per muscle group for the day (internal rotation based on least-recently-done).
- Any other Tier 1 exercises for the pivot group should be skipped entirely for that day.
- Enforce the limit of at most two Tier 1 muscle groups in the Settings UI. Demotion of an existing Tier 1 exercise must occur before saving if a new one is added that exceeds the limit.

## Architecture & Data Flow

### engine.js
- Identify `tier1Groups` by finding all muscle groups that have at least one Tier 1 exercise in the catalog.
- Determine `lastPivotGroup` by scanning the history for the most recent session containing an exercise from `tier1Groups`.
- Calculate `todayPivotGroup` by taking the next group in `tier1Groups` after `lastPivotGroup`.
- Fetch all Tier 1 exercises for `todayPivotGroup`, sort them by last date done, and pick the oldest one (`chosenPivotExId`).
- Filter logic:
  - If a candidate is in a `tier1Group` but not `todayPivotGroup`, skip it.
  - If a candidate is Tier 1 and in `todayPivotGroup` but is not `chosenPivotExId`, skip it (internal rotation).

### Settings.jsx
- On saving an edit (`handleSaveEdit`) or adding a new exercise (`handleAdd`), determine the projected number of unique Tier 1 muscle groups.
- If the number exceeds 2, show an alert blocking the save, prompting the user to demote an existing Tier 1 exercise.

## Error Handling
- If history is empty, `todayPivotGroup` defaults to the first alphabetical Tier 1 group.
- If there are no Tier 1 exercises in the catalog at all, the engine should bypass the pivot rotation logic entirely.
