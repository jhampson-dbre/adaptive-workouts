import { getHistory, getSettings, getCatalog } from './storage';

export function generateWorkout(timeBudget, unrecoveredGroups) {
    const history = getHistory();
    const settings = getSettings();
    const catalog = getCatalog();
    const staleThreshold = settings.staleThreshold || 5;
    
    // Find last pivot
    let lastPivot = null;
    for (let i = history.length - 1; i >= 0; i--) {
        const session = history[i];
        if (!session.exercises) continue;
        const pivotEx = session.exercises.find(
            e => {
                const catEx = catalog.find(c => c.id === e.id);
                return catEx && (catEx.muscleGroup === 'Biceps' || catEx.muscleGroup === 'Shoulders');
            }
        );
        if (pivotEx) {
            const catEx = catalog.find(c => c.id === pivotEx.id);
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
        
        candidates.push({ ...ex, dynamicTier });
    }
    
    // Sort by dynamic tier, then by base tier, then arbitrary
    candidates.sort((a, b) => {
        if (a.dynamicTier !== b.dynamicTier) return a.dynamicTier - b.dynamicTier;
        return a.tier - b.tier;
    });
    
    const workout = [];
    let totalTime = 0;
    
    for (const ex of candidates) {
        const estTime = ex.sets * 1.75;
        if (totalTime + estTime <= timeBudget) {
            workout.push(ex);
            totalTime += estTime;
        }
    }
    
    return workout;
}
