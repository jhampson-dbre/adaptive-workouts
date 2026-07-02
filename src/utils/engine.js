import { getHistory, getSettings, getCatalog } from './storage';

export function getDaysSinceLastLegDay(history) {
    let lastLegDate = null;
    for (let i = history.length - 1; i >= 0; i--) {
        const session = history[i];
        if (session.exercises && session.exercises.some(ex => ex.muscleGroup === 'Legs' && ex.tier === 3)) {
            lastLegDate = new Date(session.date);
            break;
        }
    }
    if (!lastLegDate) return Infinity;
    return (new Date().getTime() - lastLegDate.getTime()) / (1000 * 60 * 60 * 24);
}

export function getDayOfWeek(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

export function generateWorkout(timeBudget, unrecoveredGroups = [], forceLegDay = false) {
    const history = getHistory();
    const settings = getSettings();
    const catalog = getCatalog();
    const staleThreshold = settings.staleThreshold || 5;
    
    const daysSinceLastLeg = getDaysSinceLastLegDay(history);
    const today = new Date();
    let isLegDay = forceLegDay;
    
    if (!isLegDay && settings.legDayOfWeek && settings.legDayOfWeek !== 'None' && !unrecoveredGroups.includes('Legs')) {
        if (getDayOfWeek(today) === settings.legDayOfWeek && daysSinceLastLeg >= 4) {
            isLegDay = true;
        }
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrowLegDay = settings.legDayOfWeek && getDayOfWeek(tomorrow) === settings.legDayOfWeek;

    const catalogMap = new Map(catalog.map(c => [c.id, c]));

    // Find last pivot
    let lastPivot = null;
    for (let i = history.length - 1; i >= 0; i--) {
        const session = history[i];
        if (!session.exercises) continue;
        const pivotEx = session.exercises.find(
            e => {
                const catEx = catalogMap.get(e.id);
                return catEx && (catEx.muscleGroup === 'Biceps' || catEx.muscleGroup === 'Shoulders');
            }
        );
        if (pivotEx) {
            const catEx = catalogMap.get(pivotEx.id);
            lastPivot = catEx.muscleGroup;
            break;
        }
    }
    
    const todayPivot = lastPivot === 'Biceps' ? 'Shoulders' : 'Biceps';

    // Find last completion date for each exercise
    const lastDates = {};
    for (const session of history) {
        if (!session.exercises) continue;
        for (const ex of session.exercises) {
            lastDates[ex.id] = new Date(session.date);
        }
    }
    
    const now = new Date();

    // Filter and compute dynamic tier
    let candidates = [];
    for (const ex of catalog) {
        if (ex.isActive === false) {
            continue;
        }

        if (unrecoveredGroups.includes(ex.muscleGroup)) {
            continue;
        }

        const isPivotGroup = ex.muscleGroup === 'Biceps' || ex.muscleGroup === 'Shoulders';
        if (isPivotGroup && ex.muscleGroup !== todayPivot) {
            continue; // Skip the non-pivot for today
        }

        let dynamicTier = ex.tier;
        
        if (isPivotGroup && ex.muscleGroup === todayPivot) {
            dynamicTier = 1;
        } else {
            const lastDate = lastDates[ex.id];
            if (lastDate) {
                const daysSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
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
                }
            } else if (ex.tier === 4) {
                // Supplemental Filter
                if (isLegDay || daysSinceLastLeg < 1 || isTomorrowLegDay) {
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
        }
        // If they don't fit, none of them are added.
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
