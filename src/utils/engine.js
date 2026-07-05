/**
 * Calculate difference in calendar days between two dates.
 */
function getCalendarDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(date2);
    d2.setHours(0, 0, 0, 0);
    return Math.round(Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Get days since last leg day.
 */
export function getDaysSinceLastLegDay(history, today = new Date()) {
    let lastLegDate = null;
    for (let i = history.length - 1; i >= 0; i--) {
        const session = history[i];
        if (session.exercises && session.exercises.some(ex => ex.muscleGroup === 'Legs' && ex.tier === 3)) {
            lastLegDate = new Date(session.date);
            break;
        }
    }
    if (!lastLegDate) return Infinity;
    
    return getCalendarDaysBetween(today, lastLegDate);
}

export function getDayOfWeek(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

export function checkIsLegDay(date, unrecoveredGroups, history, settings) {
    if (!settings.legDayOfWeek || settings.legDayOfWeek === 'None') return false;
    if (unrecoveredGroups.includes('Legs')) return false;
    
    const daysSinceLastLeg = getDaysSinceLastLegDay(history, date);
    if (getDayOfWeek(date) === settings.legDayOfWeek && daysSinceLastLeg >= 4) {
        return true;
    }
    return false;
}

export function generateWorkout(timeBudget, unrecoveredGroups = [], forceLegDay = false, catalog, history, settings) {
    const staleThreshold = settings.staleThreshold || 5;
    
    const today = new Date();
    const daysSinceLastLeg = getDaysSinceLastLegDay(history, today);
    let isLegDay = forceLegDay || checkIsLegDay(today, unrecoveredGroups, history, settings);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrowLegDay = checkIsLegDay(tomorrow, unrecoveredGroups, history, settings);

    const catalogMap = new Map(catalog.map(c => [c.id, c]));

    // ── Dynamic Pivot Engine ──────────────────────────────────────────────────
    // Step 1: Discover all Tier 1 muscle groups from the catalog (sorted for
    //         stable N-way rotation).
    const tier1Groups = [
        ...new Set(
            catalog
                .filter(ex => ex.tier === 1 && ex.isActive !== false)
                .map(ex => ex.muscleGroup)
        )
    ].sort();

    // Step 2: Determine today's pivot group.
    //         Scan history (newest first) for the most recent session that
    //         contained a Tier 1 exercise, then advance one position in the list.
    let todayPivot = tier1Groups[0] ?? null; // default: first alphabetical group
    if (tier1Groups.length > 0) {
        let lastPivotGroup = null;
        for (let i = history.length - 1; i >= 0; i--) {
            const session = history[i];
            if (!session.exercises) continue;
            const pivotEx = session.exercises.find(e => {
                const catEx = catalogMap.get(e.id);
                return catEx && catEx.tier === 1 && tier1Groups.includes(catEx.muscleGroup);
            });
            if (pivotEx) {
                lastPivotGroup = catalogMap.get(pivotEx.id).muscleGroup;
                break;
            }
        }
        if (lastPivotGroup !== null) {
            const idx = tier1Groups.indexOf(lastPivotGroup);
            todayPivot = tier1Groups[(idx + 1) % tier1Groups.length];
        }
    }

    // Find last completion date for each exercise
    const lastDates = {};
    for (const session of history) {
        if (!session.exercises) continue;
        for (const ex of session.exercises) {
            lastDates[ex.id] = new Date(session.date);
        }
    }

    // Step 3: Internal rotation — pick the single least-recently-done Tier 1
    //         exercise for todayPivot. All others in that group are skipped.
    let chosenPivotExId = null;
    if (todayPivot !== null) {
        const pivotCandidates = catalog.filter(
            ex => ex.tier === 1 && ex.muscleGroup === todayPivot && ex.isActive !== false
        );
        if (pivotCandidates.length > 0) {
            pivotCandidates.sort((a, b) => {
                const dateA = lastDates[a.id] ? lastDates[a.id].getTime() : -Infinity;
                const dateB = lastDates[b.id] ? lastDates[b.id].getTime() : -Infinity;
                return dateA - dateB; // oldest (or never done) first
            });
            chosenPivotExId = pivotCandidates[0].id;
        }
    }
    
    // Filter and compute dynamic tier
    let candidates = [];
    for (const ex of catalog) {
        if (ex.isActive === false) {
            continue;
        }

        if (unrecoveredGroups.includes(ex.muscleGroup)) {
            continue;
        }

        // Skip exercises from a non-today Tier 1 pivot group
        if (tier1Groups.includes(ex.muscleGroup) && ex.tier === 1 && ex.muscleGroup !== todayPivot) {
            continue;
        }

        // Internal rotation: skip Tier 1 pivot exercises that are not the chosen one
        if (ex.tier === 1 && ex.muscleGroup === todayPivot && ex.id !== chosenPivotExId) {
            continue;
        }

        let dynamicTier = ex.tier;
        
        if (ex.tier === 1 && ex.muscleGroup === todayPivot && ex.id === chosenPivotExId) {
            dynamicTier = 1; // keep at Tier 1 priority
        } else {
            const lastDate = lastDates[ex.id];
            if (lastDate) {
                const daysSince = getCalendarDaysBetween(today, lastDate);
                if (daysSince > staleThreshold) {
                    dynamicTier = 2; // High urgency
                }
            } else if (history.length > 0) {
                // If never done but we have history, it's stale
                dynamicTier = 2;
            }
        }

        if (ex.muscleGroup === 'Legs') {
            if (ex.tier === 3) {
                if (isLegDay) {
                    dynamicTier = 0; // absolute priority
                } else if (settings.legDayOfWeek && settings.legDayOfWeek !== 'None') {
                    continue; // Skip Tier 3 Legs entirely on non-Leg days
                }
            } else if (ex.tier === 4) {
                // Supplemental Filter (+/- 1 day)
                if (isLegDay || daysSinceLastLeg <= 1 || isTomorrowLegDay) {
                    continue; // Skip supplemental legs
                }
            }
        }
        
        candidates.push({ ...ex, dynamicTier });
    }
    
    // Sort by dynamic tier, then by base tier, then arbitrary
    candidates.sort((a, b) => {
        if (a.dynamicTier !== b.dynamicTier) return a.dynamicTier - b.dynamicTier;
        return a.tier - b.tier;
    });
    
    const workout = [];
    let totalTime = 0;
    const addedIds = new Set();
    
    if (isLegDay) {
        const primaryLegs = candidates.filter(ex => ex.muscleGroup === 'Legs' && ex.dynamicTier === 0);
        let legTime = 0;
        primaryLegs.forEach(ex => legTime += (ex.sets * 1.75));
        
        if (legTime <= timeBudget) {
            primaryLegs.forEach(ex => {
                workout.push(ex);
                addedIds.add(ex.id);
            });
            totalTime += legTime;
        } else {
            // If they don't fit, mark as added so the main loop skips them entirely
            primaryLegs.forEach(ex => addedIds.add(ex.id));
        }
    }
    
    for (const ex of candidates) {
        if (addedIds.has(ex.id)) continue;

        let linkedEx = null;
        if (ex.linkedTo) {
            linkedEx = candidates.find(c => c.id === ex.linkedTo);
        } else {
            // Also check if any candidate is linked TO this one
            linkedEx = candidates.find(c => c.linkedTo === ex.id);
        }

        if (linkedEx && !addedIds.has(linkedEx.id)) {
            const estTime1 = ex.sets * 1.75;
            const estTime2 = linkedEx.sets * 1.75;
            if (totalTime + estTime1 + estTime2 <= timeBudget) {
                workout.push(ex, linkedEx);
                totalTime += (estTime1 + estTime2);
                addedIds.add(ex.id);
                addedIds.add(linkedEx.id);
            }
        } else {
            const estTime = ex.sets * 1.75;
            if (totalTime + estTime <= timeBudget) {
                workout.push(ex);
                totalTime += estTime;
                addedIds.add(ex.id);
            }
        }
    }
    
    return workout;
}
