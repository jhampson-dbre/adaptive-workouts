import {
    isValidCatalogExercise,
    isValidV2ExerciseOccurrence,
    normalizeCatalogExercise,
    normalizeWorkoutSettings,
    wasPerformed,
} from './workoutSchema';
import { getNextSessionRecommendation } from './progression';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function invalidCatalogExerciseError(exercise) {
    const name = exercise?.name || 'Unnamed exercise';
    const id = exercise?.id || 'missing id';
    const error = new Error(`Invalid exercise configuration for "${name}" (${id}). Update it in Manage Catalog / Settings.`);
    error.name = 'InvalidCatalogExerciseError';
    return error;
}

function createOccurrenceSnapshot(exercise) {
    const snapshot = {
        id: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        tier: exercise.tier,
        trackingMode: exercise.trackingMode,
        sets: exercise.sets,
        prescribedSetCount: exercise.sets,
        dynamicTier: exercise.dynamicTier,
    };
    for (const key of ['linkedTo', 'isActive']) {
        if (hasOwn(exercise, key)) snapshot[key] = exercise[key];
    }
    return snapshot;
}

function createTimingRecord(index, setCount, restSeconds) {
    return {
        index,
        completed: false,
        plannedRestSeconds: index === setCount - 1 ? null : restSeconds,
        workDurationSeconds: null,
        actualRestSeconds: null,
    };
}

function enrichSelectedExercise(exercise, history, defaultRestSeconds, ordinal) {
    const occurrence = createOccurrenceSnapshot(exercise);
    occurrence.occurrenceId = `${exercise.id}:${ordinal}`;
    const restSeconds = exercise.restSeconds ?? defaultRestSeconds;
    if (exercise.trackingMode === 'simple') {
        occurrence.completed = false;
        occurrence.setRecords = Array.from({ length: exercise.sets }, (_, index) => (
            createTimingRecord(index, exercise.sets, restSeconds)
        ));
    } else if (exercise.trackingMode === 'bodyweight') {
        occurrence.targetReps = exercise.targetReps;
        occurrence.setRecords = Array.from({ length: exercise.sets }, (_, index) => ({
            ...createTimingRecord(index, exercise.sets, restSeconds),
            targetReps: exercise.targetReps,
            fullReps: 0,
            assistedReps: 0,
            eccentricReps: 0,
        }));
    } else {
        const recommendation = getNextSessionRecommendation(exercise, history);
        Object.assign(occurrence, {
            startingWeight: exercise.startingWeight,
            targetReps: exercise.targetReps,
            floorReps: exercise.floorReps,
            weightStep: exercise.weightStep,
            setRecords: Array.from({ length: exercise.sets }, (_, index) => ({
                ...createTimingRecord(index, exercise.sets, restSeconds),
                targetWeight: recommendation.recommendedWeight,
                targetReps: exercise.targetReps,
                actualWeight: recommendation.recommendedWeight,
                actualReps: exercise.targetReps,
                recommendationReason: index === 0 ? { ...recommendation } : {
                    recommendedWeight: recommendation.recommendedWeight,
                    reasonCode: 'BACKOFF_AWAITING_PRIOR_SET',
                },
            })),
        });
    }

    if (!isValidV2ExerciseOccurrence(occurrence)) {
        throw new Error(`Generated an invalid occurrence for "${exercise.name}" (${exercise.id}).`);
    }
    return occurrence;
}

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

function getChronologicalHistory(history = []) {
    return history
        .filter(session => {
            if (!session?.date) return false;
            const date = new Date(session?.date);
            return !Number.isNaN(date.getTime());
        })
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function compareAtomicUnits(a, b) {
    if (a.neverPerformed !== b.neverPerformed) return a.neverPerformed ? -1 : 1;
    if (a.lastPerformedTime !== b.lastPerformedTime) return a.lastPerformedTime - b.lastPerformedTime;
    if (a.dynamicTier !== b.dynamicTier) return a.dynamicTier - b.dynamicTier;
    if (a.baseTier !== b.baseTier) return a.baseTier - b.baseTier;
    return a.catalogIndex - b.catalogIndex;
}

function formAtomicUnits(candidates, lastDates, today, catalogIndexes) {
    const candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]));
    const assigned = new Set();
    const units = [];

    for (const candidate of candidates.slice().sort((a, b) => catalogIndexes.get(a.id) - catalogIndexes.get(b.id))) {
        if (assigned.has(candidate.id)) continue;
        const linked = candidate.linkedTo
            ? candidateMap.get(candidate.linkedTo)
            : candidates.find(other => other.linkedTo === candidate.id);
        const members = [candidate];
        if (linked && !assigned.has(linked.id)) members.push(linked);
        members.sort((a, b) => catalogIndexes.get(a.id) - catalogIndexes.get(b.id));
        members.forEach(member => assigned.add(member.id));

        const performedTimes = members
            .map(member => lastDates[member.id]?.getTime())
            .filter(time => Number.isFinite(time));
        const lastPerformedTime = performedTimes.length > 0 ? Math.max(...performedTimes) : -Infinity;
        const neverPerformed = performedTimes.length === 0;
        units.push({
            members,
            groups: new Set(members.map(member => member.muscleGroup)),
            isTier4: members.some(member => member.tier === 4),
            time: members.reduce((total, member) => total + member.sets * 1.75, 0),
            lastPerformedTime,
            neverPerformed,
            age: neverPerformed ? Infinity : getCalendarDaysBetween(today, new Date(lastPerformedTime)),
            dynamicTier: Math.min(...members.map(member => member.dynamicTier)),
            baseTier: Math.min(...members.map(member => member.tier)),
            catalogIndex: Math.min(...members.map(member => catalogIndexes.get(member.id))),
        });
    }
    return units;
}

function isTier4QuotaOpen(history, catalogMap, requiredTier3Groups) {
    let resetBoundary = -Infinity;
    const performed = [];

    for (const session of getChronologicalHistory(history)) {
        if (!Array.isArray(session.exercises)) continue;
        const time = new Date(session.date).getTime();
        for (const occurrence of session.exercises) {
            if (!wasPerformed(session, occurrence)) continue;
            const classification = session.schemaVersion === 2 || session.schemaVersion === 3 || session.schemaVersion === 4
                ? occurrence
                : catalogMap.get(occurrence.id);
            if (!classification) continue;
            performed.push({ time, tier: classification.tier, muscleGroup: classification.muscleGroup });
            if (classification.tier === 4) resetBoundary = Math.max(resetBoundary, time);
        }
    }

    if (resetBoundary === -Infinity || requiredTier3Groups.size === 0) {
        return true;
    }
    const credited = new Set(
        performed
            .filter(item => item.tier === 3 && item.time > resetBoundary && requiredTier3Groups.has(item.muscleGroup))
            .map(item => item.muscleGroup),
    );
    return [...requiredTier3Groups].every(group => credited.has(group));
}

function selectDiverseUnits({ units, representedGroups, remainingTime, quotaOpen, staleThreshold }) {
    const selected = [];
    const remaining = new Set(units);

    const fits = unit => unit.time <= remainingTime;
    const coversUnrepresented = unit => [...unit.groups].some(group => !representedGroups.has(group));
    const select = unit => {
        selected.push(unit);
        remaining.delete(unit);
        remainingTime -= unit.time;
        unit.groups.forEach(group => representedGroups.add(group));
    };
    const representativeUnits = predicate => {
        const representatives = new Set();
        const groupsWithRepresentative = new Set();
        const ordered = [...remaining].filter(predicate).sort(compareAtomicUnits);
        for (const unit of ordered) {
            for (const group of unit.groups) {
                if (representedGroups.has(group) || groupsWithRepresentative.has(group)) continue;
                representatives.add(unit);
                groupsWithRepresentative.add(group);
            }
        }
        return [...representatives].sort(compareAtomicUnits);
    };
    const discardNonFitting = unit => remaining.delete(unit);
    const isOlderDiverse = unit => unit.age > 1 && coversUnrepresented(unit);

    let tier4Promoted = false;
    const runDiversityPhase = () => {
        while (true) {
            const representatives = representativeUnits(isOlderDiverse);
            const candidate = representatives.find(unit => (
                !unit.isTier4
                || (!tier4Promoted && (quotaOpen || unit.neverPerformed || unit.age > staleThreshold))
            ));
            if (!candidate) return;
            if (!fits(candidate)) {
                discardNonFitting(candidate);
                continue;
            }
            select(candidate);
            if (candidate.isTier4) tier4Promoted = true;
        }
    };

    runDiversityPhase();

    while (true) {
        const representatives = representativeUnits(isOlderDiverse);
        const candidate = representatives.find(unit => unit.isTier4);
        if (!candidate) break;
        if (!fits(candidate)) {
            discardNonFitting(candidate);
            runDiversityPhase();
            continue;
        }
        select(candidate);
    }

    for (const unit of [...remaining]
        .filter(unit => unit.age > 1 && !coversUnrepresented(unit))
        .sort(compareAtomicUnits)) {
        if (fits(unit)) select(unit);
        else discardNonFitting(unit);
    }

    while (true) {
        const representatives = representativeUnits(unit => unit.age <= 1 && coversUnrepresented(unit));
        if (representatives.length === 0) break;
        const candidate = representatives[0];
        if (fits(candidate)) select(candidate);
        else discardNonFitting(candidate);
    }
    for (const unit of [...remaining].filter(unit => unit.age <= 1).sort(compareAtomicUnits)) {
        if (fits(unit)) select(unit);
        else discardNonFitting(unit);
    }

    return selected;
}

/**
 * Get days since last leg day.
 */
export function getDaysSinceLastLegDay(history, today = new Date()) {
    let lastLegDate = null;
    const chronologicalHistory = getChronologicalHistory(history);
    for (let i = chronologicalHistory.length - 1; i >= 0; i--) {
        const session = chronologicalHistory[i];
        if (Array.isArray(session.exercises) && session.exercises.some(ex => (
            wasPerformed(session, ex) && ex.muscleGroup === 'Legs' && ex.tier === 3
        ))) {
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
    const performanceSeconds = timeBudget * 60;
    if (!Number.isFinite(performanceSeconds) || performanceSeconds < 0 || !Number.isInteger(performanceSeconds)) {
        throw new RangeError('Time budget must be a nonnegative number of whole seconds.');
    }
    const normalizedSettings = normalizeWorkoutSettings(settings);
    const staleThreshold = normalizedSettings.staleThreshold || 5;
    const chronologicalHistory = getChronologicalHistory(history);
    const normalizedCatalog = catalog.map(normalizeCatalogExercise);
    for (const exercise of normalizedCatalog) {
        if (exercise?.isActive !== false && !isValidCatalogExercise(exercise)) {
            throw invalidCatalogExerciseError(exercise);
        }
    }
    
    const today = new Date();
    const daysSinceLastLeg = getDaysSinceLastLegDay(history, today);
    let isLegDay = forceLegDay || checkIsLegDay(today, unrecoveredGroups, history, settings);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrowLegDay = checkIsLegDay(tomorrow, unrecoveredGroups, history, settings);

    const catalogMap = new Map(normalizedCatalog.map(c => [c.id, c]));

    // ── Dynamic Pivot Engine ──────────────────────────────────────────────────
    // Step 1: Discover all Tier 1 muscle groups from the catalog (sorted for
    //         stable N-way rotation).
    const tier1Groups = [
        ...new Set(
            normalizedCatalog
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
        for (let i = chronologicalHistory.length - 1; i >= 0; i--) {
            const session = chronologicalHistory[i];
            if (!Array.isArray(session.exercises)) continue;
            const pivotEx = session.exercises.find(e => {
                if (!wasPerformed(session, e)) return false;
                const catEx = catalogMap.get(e.id);
                return catEx
                    && catEx.tier === 1
                    && tier1Groups.includes(catEx.muscleGroup);
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
    for (const session of chronologicalHistory) {
        if (!Array.isArray(session.exercises)) continue;
        for (const ex of session.exercises) {
            if (wasPerformed(session, ex)) lastDates[ex.id] = new Date(session.date);
        }
    }

    // Step 3: Internal rotation — pick the single least-recently-done Tier 1
    //         exercise for todayPivot. All others in that group are skipped.
    let chosenPivotExId = null;
    if (todayPivot !== null) {
        const pivotCandidates = normalizedCatalog.filter(
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
    for (const ex of normalizedCatalog) {
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
            } else if (chronologicalHistory.length > 0) {
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
    
    const workout = [];
    let totalTime = 0;
    const addedIds = new Set();
    const representedGroups = new Set();
    const catalogIndexes = new Map(normalizedCatalog.map((exercise, index) => [exercise.id, index]));
    const addMembers = members => {
        for (const member of members) {
            workout.push(member);
            addedIds.add(member.id);
            representedGroups.add(member.muscleGroup);
        }
    };
    
    if (isLegDay) {
        const primaryLegs = candidates.filter(ex => ex.muscleGroup === 'Legs' && ex.dynamicTier === 0);
        let legTime = 0;
        primaryLegs.forEach(ex => legTime += (ex.sets * 1.75));
        
        if (legTime <= timeBudget) {
            addMembers(primaryLegs);
            totalTime += legTime;
        } else {
            // If they don't fit, mark as added so the main loop skips them entirely
            primaryLegs.forEach(ex => addedIds.add(ex.id));
        }
    }

    let selectableCandidates = candidates.filter(candidate => !addedIds.has(candidate.id));
    let atomicUnits = formAtomicUnits(selectableCandidates, lastDates, today, catalogIndexes);
    const pivotUnit = atomicUnits.find(unit => unit.members.some(member => member.id === chosenPivotExId));
    if (pivotUnit) {
        if (totalTime + pivotUnit.time <= timeBudget) {
            const pivotFirstMembers = [
                pivotUnit.members.find(member => member.id === chosenPivotExId),
                ...pivotUnit.members.filter(member => member.id !== chosenPivotExId),
            ];
            addMembers(pivotFirstMembers);
            totalTime += pivotUnit.time;
        } else {
            pivotUnit.members.forEach(member => addedIds.add(member.id));
        }
    }

    selectableCandidates = candidates.filter(candidate => (
        !addedIds.has(candidate.id)
        && candidate.tier !== 1
        && candidate.dynamicTier !== 0
    ));
    atomicUnits = formAtomicUnits(selectableCandidates, lastDates, today, catalogIndexes);
    const requiredTier3Groups = new Set(
        selectableCandidates
            .filter(candidate => candidate.tier === 3)
            .map(candidate => candidate.muscleGroup),
    );
    const quotaOpen = isTier4QuotaOpen(history, catalogMap, requiredTier3Groups);
    const selectedUnits = selectDiverseUnits({
        units: atomicUnits,
        representedGroups,
        remainingTime: timeBudget - totalTime,
        quotaOpen,
        staleThreshold,
    });
    for (const unit of selectedUnits) addMembers(unit.members);
    
    const generatedWorkout = workout.map((exercise, ordinal) => enrichSelectedExercise(
        exercise,
        history,
        normalizedSettings.defaultRestSeconds,
        ordinal,
    ));
    Object.defineProperty(generatedWorkout, 'phaseTargets', {
        value: Object.freeze({
            warmupSeconds: normalizedSettings.warmupSeconds,
            performanceSeconds,
            cooldownSeconds: normalizedSettings.cooldownSeconds,
        }),
    });
    return generatedWorkout;
}
