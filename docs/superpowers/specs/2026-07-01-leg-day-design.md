# Leg Day Feature Design Spec

## Overview
The "Leg Day" feature introduces a fixed, calendar-based block into the adaptive generator. When triggered, the generator overrides normal tier logic to enforce a strict block of primary leg exercises. Supplemental leg exercises are carefully filtered around this day to ensure adequate recovery.

## Configuration (Settings UI)
- **Leg Day Dropdown**: Users can select a specific day of the week for Leg Day (`['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']`). The default is `None`.
- **Validation**: If a user selects a day, the system verifies that there is at least one **Tier 3 Leg Exercise** in the catalog. If not, an alert warns the user to add one.

## Categorizing Leg Exercises
Because Tier 1 is strictly reserved for core alternating pivots (Biceps/Shoulders):
- **Primary Legs**: Defined as any Leg exercise assigned to **Tier 3**. (In the UI, this will display as `Tier 3 (Primary Leg Day)` if the muscle group is Legs).
- **Supplemental Legs**: Defined as any Leg exercise assigned to **Tier 4**. (In the UI, this will display as `Tier 4 (Supplemental)`).

*(Note: If the Leg Day dropdown is set to `None`, Tier 3 and Tier 4 Leg exercises simply act as normal floating exercises within the normal generation logic.)*

### The "Linked" Enforcement
Leg Day exercises are intended to run as a complete block. To prevent an unlinked Tier 3 leg exercise from stealing priority, the engine will enforce that **Primary Leg exercises act as a unified block**:
- During generation, the engine gathers all Tier 3 Leg exercises. 
- It treats them as an "all-or-nothing" time block.
- To reflect this, the Settings UI will hide the "Link To" dropdown for Tier 3 Leg exercises and display a note: *"Primary Leg exercises are automatically linked together on Leg Day."*

## Generator Logic

### 1. Triggering Leg Day
The engine uses smart anchors to determine when to trigger Leg Day, preventing infinite shifts if run early/late. Leg Day is triggered if:
- **Configured Day:** Today matches the `legDayOfWeek` setting, AND it has been at least **4 days** since the last Leg Day. (This handles cases where you ran it early/late earlier in the week).
- **Unrecovered Override:** If Leg Day triggers, but the user marks "Legs" as unrecovered on the generator screen, Leg Day is skipped today and pushed to tomorrow.

### 2. Smart Prompts
If Leg Day does not trigger naturally, the UI may show a prompt (if the user's input `timeBudget` is large enough to fit the primary leg block):
- **Early Prompt:** If tomorrow is the configured Leg Day, and it has been at least 4 days since the last Leg Day: 
  > *"Tomorrow is Leg Day. Want to do it a day early?"*
- **Overdue Prompt:** If it has been **> 7 days** since a workout containing a Tier 3 Leg exercise was logged:
  > *"Leg Day is 3 days overdue! (10 days since last Leg workout). Do it today or skip?"*

### 3. Building the Workout
When Leg Day is triggered, it acts as a **Tier 1 Pivot**:
- All **Tier 3 Leg Exercises** are temporarily promoted to Tier 1 status.
- They are scheduled first, absorbing the time budget.
- Any leftover time budget is filled with floating exercises (Tier 2/3/4).

### 4. The Supplemental Filter
To ensure recovery, **Tier 4 Leg Exercises (Supplemental)** are subject to strict exclusion rules:
1. **Never on Leg Day**: Supplemental legs are explicitly excluded from the floating pool on an active Leg Day.
2. **Before Leg Day**: Excluded if today is **1 day before** the configured `legDayOfWeek`.
3. **After Leg Day**: Excluded if it has been **< 1 day since** a Tier 3 Leg exercise was actually logged in the history.
