# Adaptive Hypertrophy Tracker - Design Specification

## Overview
A lightweight, local-first web application designed to generate dynamic, time-adaptive hypertrophy workouts. Instead of strict rolling blocks, it calculates daily workouts based on available time budgets and the recovery times of specific muscle groups ("Days Since Last Trained"), while allowing manual overrides based on how recovered a muscle group feels that day.

## 1. Core Concepts & Data Models

### Muscle Groups vs. Exercises
- **Muscle Groups**: The biological target (e.g., Biceps, Shoulders, Chest, Triceps). Recovery tracking happens at the **Muscle Group** level.
- **Exercises**: The specific movements targeting those groups (e.g., Preacher Curls, Spider Curls).

### Time Calculation & Tracking
- **Budget**: `Sets * (1m work + 45s rest)`
- **Warm-up/Cool-down**: A global setting deducts a fixed amount of time from the input budget.
- **Actual Time Tracking**: The UI will include a "Start Workout" and "Finish Workout" button to compute the *actual* elapsed time versus the generated estimate.

### Exercise Groupings
- **Linked Exercises**: "All-or-Nothing" hard constraint. If they are linked, they MUST be scheduled together. If there isn't enough time for all of them in the budget, *none* of them are scheduled.
- **Superset Exercises**: Also an "All-or-Nothing" hard constraint, but executed in alternating sets (e.g., Set 1 Situps, Set 1 Twists, Set 2 Situps, Set 2 Twists).

### Priority Tiers (Exercise Categories)
The engine selects exercises based on a strict Tiered Priority System:
- **Tier 1 (Un-bumpable / Primary Target)**: The core alternating focus. Configurable (e.g., limited to Biceps and Shoulders). 
  - *Rotation*: The exercises used for a primary target rotate based on configuration (e.g., Biceps rotates between Preacher and Spider).
- **Tier 2 (High Urgency)**: Any floating exercise (Tier 3 or 4) that has crossed its configured "Stale Threshold" (e.g., has not been trained in > 5 days). This self-correcting loop ensures nothing is ignored forever.
- **Tier 3 (Standard Rotation)**: High-value floating targets (e.g., Incline Press, Chest Support Rows, Tricep Extensions, Dips). 
- **Tier 4 (Low Priority)**: Lower-priority floating targets (e.g., Core, Supplemental Legs) that only get scheduled if Tiers 1-3 have been satisfied and there is remaining time budget.
- **Fixed Block (Leg Day)**: Configured to a specific day of the week (e.g., Wednesday). Overrides normal tier logic.

## 2. Generator Algorithm

When the user clicks **Generate**:
1. **Input Phase**: User enters Time Available (e.g., 40 mins). The app presents a quick "Recovery Check" (e.g., "Are Biceps fully recovered?"). The user can mark a group as "Not Recovered" to force the generator to skip it today.
2. **Time Budget**: Deduct global warm-up setting (e.g., 10 mins). Remaining budget = 30 mins.
3. **Leg Day Logic**: 
   - If today is the configured Leg Day, schedule Leg Day.
   - If Leg Day is *overdue*, prompt the user: "Leg day is overdue. Do it today or skip to normal workout?" (If there is enough time).
4. **Primary Selection (Tier 1)**: If not Leg Day, determine the most overdue **recovered** Primary Target (Biceps vs Shoulders). Schedule it. Pick the next exercise in its configured rotation.
5. **Floating Selection (Tiers 2-4)**: 
   - Gather all Floating targets. Filter out constrained exercises (e.g. Supplemental Legs if within 2 days of a Leg Day, or exercises targeting unrecovered muscle groups).
   - Evaluate the "Days Since Last Trained" for each remaining exercise against its "Stale Threshold". If it exceeds the threshold, temporarily promote it to **Tier 2**.
   - Sort the remaining pool primarily by **Tier** (Tier 2 > Tier 3 > Tier 4), and secondarily by "Days Since Last Trained" descending within the same tier.
   - Iterate through sorted list. If an exercise fits in the remaining time budget, add it.
   - **Link Constraint**: If an exercise is linked/superset, the engine checks if *both/all* fit. If they don't, it skips them and moves to the next candidate.
6. Output the final generated stack.

## 3. Architecture & Persistence
- **Framework**: Vite + React
- **Styling**: Vanilla CSS with a premium dark mode aesthetic (glassmorphism, micro-animations, neon accents).
- **Storage**: `localStorage` (via a clean Service Layer to allow easy future migration to a cloud DB).
- **Data Structure**:
  - `history`: Array of completed workouts `{ date, actualDuration, exercises: [] }`
  - `settings`: Object `{ warmupTime, legDayOfWeek, primaryTargets: ['Biceps', 'Shoulders'] }`
  - `catalog`: The master list of exercises. Each exercise has its own **Tier**, **Stale Threshold**, **Override Default Sets**, rotation order, links, and supersets.

## 4. User Interface
- **Sidebar/Navigation**: Access to Settings, Exercise Catalog, and History logs.
- **Generator View**: Time input, Recovery Check toggles, Overdue Leg Day prompt, and "Generate" button.
- **Workout View**: "Start Workout" button. Interactive checklist of the generated exercises. "Finish Workout" button commits it to history with actual duration and resets the recovery clock.
