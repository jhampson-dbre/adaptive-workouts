# Set-Level Weight Tracking & Auto-Progression Design

## 1. Data Model Updates

### Catalog (Settings)
Each exercise in the catalog will receive new properties to govern progression:
- `baseWeight`: The initial starting weight for the exercise before any workouts are recorded (e.g., 30 lbs).
- `targetReps`: The goal number of reps per set where the user stops if not reaching failure (e.g., 10).
- `progressReps`: The threshold to increase the weight (e.g., 8).
- `regressReps`: The threshold to decrease the weight (e.g., 5).
- `weightStep`: The increment/decrement amount (e.g., 5 lbs).

### Workout History
Currently, a completed workout just saves the catalog exercise objects. This will change to store the actual set data:
```javascript
{
  id: "1",
  name: "Barbell Curl",
  sets: [
    { targetWeight: 30, targetReps: 10, actualWeight: 30, actualReps: 10 },
    { targetWeight: 30, targetReps: 10, actualWeight: 30, actualReps: 8 },
    { targetWeight: 30, targetReps: 10, actualWeight: 30, actualReps: 6 }
  ]
}
```

## 2. Progression Algorithm (Top Set Base Weight)

When generating a workout, we evaluate the previous workout's performance to determine today's targets. 

**First Time Rule**: If there is no previous workout recorded for an exercise, all sets will simply use the `baseWeight` and `targetReps` defined in the Catalog.

If a previous workout exists:

1. **Calculate the new `baseWeight` from Set 1 (Top Set)**:
   - Use Set 1's `actualWeight` as the reference point (this handles cases where the user manually changed the weight during the workout).
   - If Set 1 `actualReps >= progressReps` → `baseWeight = actualWeight + weightStep`.
   - If Set 1 `actualReps <= regressReps` → `baseWeight = actualWeight - weightStep`.
   - Otherwise → `baseWeight = actualWeight`.

2. **Calculate target weights for Sets 2 & 3 (Fatigue Offsets)**:
   - If the *previous* Set N `actualReps >= progressReps`, its target weight for today is the new `baseWeight`.
   - If the *previous* Set N `actualReps < progressReps`, its target weight drops to `baseWeight - weightStep`.
   - *This guarantees the spread is never more than 1 progression step, while accounting for fatigue on later sets.*

## 3. UI Updates

### Workout View (Active Workout)
- **Expandable Sets**: Tapping an exercise expands it to show individual sets (as seen in the mockup).
- **Pre-populated Inputs**: Each set row has number inputs for `Actual Weight` and `Actual Reps`. **These are pre-populated with the target weight and target reps.** If the user hits the target, they simply tap the checkbox to complete the set. If they performed differently, they can edit the values before checking it off.
- **Checkboxes**: Instead of checking off the whole exercise, you check off each set.

### Settings View (Catalog Editor)
- **Progression Fields**: When editing an exercise in the catalog, new input fields will appear for `Base Weight`, `Target Reps`, `Progress at Reps`, `Regress at Reps`, and `Weight Step`.
- **Defaults**: Sensible defaults (e.g., 10 target, 8 progress, 5 regress, 5lb step) will be provided for new exercises.
