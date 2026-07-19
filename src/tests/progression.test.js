import { describe, expect, it } from 'vitest';

import {
  BACKOFF_REASON_CODES,
  PROGRESSION_REASON_CODES,
  calculateBackoffRecommendation,
  getNextSessionRecommendation,
} from '../utils/progression';

const currentExercise = {
  id: 'bench',
  trackingMode: 'weighted',
  startingWeight: 100,
  targetReps: 8,
  floorReps: 5,
  weightStep: 10,
  sets: 3,
};

function weightedOccurrence({
  id = 'bench',
  targetReps = 8,
  floorReps = 5,
  weightStep = 5,
  actualWeight = 100,
  reps = [8, 5, 5],
  completed = reps.map(() => true),
} = {}) {
  const setRecords = reps.map((actualReps, index) => ({
    index,
    targetWeight: actualWeight,
    targetReps,
    actualWeight,
    actualReps,
    completed: completed[index],
    recommendationReason: index === 0 ? {
      decision: 'starting',
      sourceWorkoutId: null,
      sourceWorkoutDate: null,
      sourceAnchorWeight: null,
      appliedWeightStep: 0,
      recommendedWeight: actualWeight,
      reasonCode: 'STARTING_NO_ANCHOR',
    } : {
      recommendedWeight: actualWeight,
      reasonCode: 'BACKOFF_FLOOR_MET',
    },
  }));

  return {
    id,
    name: 'Bench Press',
    muscleGroup: 'Chest',
    tier: 3,
    trackingMode: 'weighted',
    sets: reps.length,
    prescribedSetCount: reps.length,
    startingWeight: 80,
    targetReps,
    floorReps,
    weightStep,
    setRecords,
  };
}

function workout({
  id = 'workout-1',
  date = '2026-07-10T10:00:00.000Z',
  status = 'completed',
  exercises = [weightedOccurrence()],
} = {}) {
  return { id, schemaVersion: 2, status, date, actualDuration: 30, exercises };
}

function v3Occurrence(options = {}) {
  const occurrence = weightedOccurrence(options);
  return {
    ...occurrence,
    occurrenceId: options.occurrenceId ?? `${occurrence.id}-occurrence`,
    setRecords: occurrence.setRecords.map((record, index) => ({
      ...record,
      plannedRestSeconds: index === occurrence.setRecords.length - 1 ? null : 90,
      workDurationSeconds: record.completed ? 30 : null,
      actualRestSeconds: index === occurrence.setRecords.length - 1 || !record.completed ? null : 80,
    })),
  };
}

function v3Workout({
  id = 'workout-v3',
  date = '2026-07-11T10:00:00.000Z',
  status = 'completed',
  exercises = [v3Occurrence()],
} = {}) {
  return { id, schemaVersion: 3, status, date, actualDurationSeconds: 1800, exercises };
}

describe('next-session weighted progression', () => {
  it('requires successfully loaded history to be an array', () => {
    expect(() => getNextSessionRecommendation(currentExercise, null)).toThrow(/history.*array/i);
    expect(() => getNextSessionRecommendation(currentExercise, {})).toThrow(/history.*array/i);
  });

  it('uses starting weight with null provenance when no eligible anchor exists', () => {
    expect(getNextSessionRecommendation(currentExercise, [])).toEqual({
      decision: 'starting',
      sourceWorkoutId: null,
      sourceWorkoutDate: null,
      sourceAnchorWeight: null,
      appliedWeightStep: 0,
      recommendedWeight: 100,
      reasonCode: PROGRESSION_REASON_CODES.STARTING_NO_ANCHOR,
    });
  });

  it.each([
    {
      label: 'increases after all prescribed work qualifies',
      occurrence: weightedOccurrence({ actualWeight: 105, reps: [8, 5, 6] }),
      decision: 'increase',
      recommendedWeight: 115,
      appliedWeightStep: 10,
      reasonCode: PROGRESSION_REASON_CODES.INCREASE_ALL_SETS_QUALIFIED,
    },
    {
      label: 'decreases after a top set below the historical floor',
      occurrence: weightedOccurrence({ actualWeight: 105, reps: [4, 0, 0], completed: [true, false, false] }),
      decision: 'decrease',
      recommendedWeight: 95,
      appliedWeightStep: 10,
      reasonCode: PROGRESSION_REASON_CODES.DECREASE_TOP_BELOW_FLOOR,
    },
    {
      label: 'holds when the top set is below its historical target',
      occurrence: weightedOccurrence({ actualWeight: 105, reps: [7, 5, 5] }),
      decision: 'hold',
      recommendedWeight: 105,
      appliedWeightStep: 0,
      reasonCode: PROGRESSION_REASON_CODES.HOLD_TOP_BELOW_TARGET,
    },
    {
      label: 'holds when prescribed sets are incomplete',
      occurrence: weightedOccurrence({ actualWeight: 105, reps: [8, 5, 0], completed: [true, true, false] }),
      decision: 'hold',
      recommendedWeight: 105,
      appliedWeightStep: 0,
      reasonCode: PROGRESSION_REASON_CODES.HOLD_INCOMPLETE_SETS,
    },
    {
      label: 'holds when a completed backoff is below its historical floor',
      occurrence: weightedOccurrence({ actualWeight: 105, reps: [8, 4, 5] }),
      decision: 'hold',
      recommendedWeight: 105,
      appliedWeightStep: 0,
      reasonCode: PROGRESSION_REASON_CODES.HOLD_BACKOFF_BELOW_FLOOR,
    },
  ])('$label', ({ occurrence, decision, recommendedWeight, appliedWeightStep, reasonCode }) => {
    const result = getNextSessionRecommendation(currentExercise, [workout({ exercises: [occurrence] })]);
    expect(result).toEqual({
      decision,
      sourceWorkoutId: 'workout-1',
      sourceWorkoutDate: '2026-07-10T10:00:00.000Z',
      sourceAnchorWeight: 105,
      appliedWeightStep,
      recommendedWeight,
      reasonCode,
    });
  });

  it('uses a manual top-set override as the anchor and current configuration for one step', () => {
    const source = weightedOccurrence({ actualWeight: 137.5, weightStep: 2.5, reps: [8, 6, 5] });
    expect(getNextSessionRecommendation({ ...currentExercise, weightStep: 7.5 }, [workout({ exercises: [source] })]))
      .toMatchObject({ sourceAnchorWeight: 137.5, recommendedWeight: 145, appliedWeightStep: 7.5 });
  });

  it.each([
    {
      reps: [8, 5, 6], completed: [true, true, true], decision: 'increase', recommendedWeight: 115,
      appliedWeightStep: 10, reasonCode: PROGRESSION_REASON_CODES.INCREASE_ALL_SETS_QUALIFIED,
    },
    {
      reps: [4, 0, 0], completed: [true, false, false], decision: 'decrease', recommendedWeight: 95,
      appliedWeightStep: 10, reasonCode: PROGRESSION_REASON_CODES.DECREASE_TOP_BELOW_FLOOR,
    },
    {
      reps: [7, 5, 5], completed: [true, true, true], decision: 'hold', recommendedWeight: 105,
      appliedWeightStep: 0, reasonCode: PROGRESSION_REASON_CODES.HOLD_TOP_BELOW_TARGET,
    },
    {
      reps: [8, 5, 0], completed: [true, true, false], decision: 'hold', recommendedWeight: 105,
      appliedWeightStep: 0, reasonCode: PROGRESSION_REASON_CODES.HOLD_INCOMPLETE_SETS,
    },
    {
      reps: [8, 4, 5], completed: [true, true, true], decision: 'hold', recommendedWeight: 105,
      appliedWeightStep: 0, reasonCode: PROGRESSION_REASON_CODES.HOLD_BACKOFF_BELOW_FLOOR,
    },
  ])('applies existing progression rules to valid v3 weighted history ($decision)', ({
    reps, completed, decision, recommendedWeight, appliedWeightStep, reasonCode,
  }) => {
    const source = v3Occurrence({
      occurrenceId: 'session-bench',
      actualWeight: 105,
      reps,
      completed,
    });

    expect(getNextSessionRecommendation(currentExercise, [v3Workout({ exercises: [source] })]))
      .toMatchObject({
        decision,
        sourceWorkoutId: 'workout-v3',
        sourceWorkoutDate: '2026-07-11T10:00:00.000Z',
        sourceAnchorWeight: 105,
        appliedWeightStep,
        recommendedWeight,
        reasonCode,
      });
  });

  it('excludes a malformed v3 workout as a whole but preserves v2 per-occurrence fallback', () => {
    const validV3Match = v3Occurrence({ actualWeight: 250, reps: [8] });
    const malformedV3Sibling = {
      ...v3Occurrence({ id: 'row', occurrenceId: 'row-occurrence', reps: [8] }),
      setRecords: [],
    };
    const malformedV2Sibling = { ...weightedOccurrence({ id: 'row' }), sets: 4 };
    const validV2Match = weightedOccurrence({ actualWeight: 130, reps: [7] });
    const history = [
      v3Workout({
        id: 'malformed-v3',
        date: '2026-07-13T10:00:00.000Z',
        exercises: [validV3Match, malformedV3Sibling],
      }),
      workout({
        id: 'valid-v2-partial',
        date: '2026-07-12T10:00:00.000Z',
        exercises: [malformedV2Sibling, validV2Match],
      }),
    ];

    expect(getNextSessionRecommendation(currentExercise, history))
      .toMatchObject({ sourceWorkoutId: 'valid-v2-partial', sourceAnchorWeight: 130 });
  });

  it('matches v3 history by catalog id and scans occurrences in persisted order', () => {
    const occurrenceIdOnlyMatch = v3Occurrence({
      id: 'row', occurrenceId: 'bench', actualWeight: 250, reps: [7],
    });
    const firstCatalogMatch = v3Occurrence({
      occurrenceId: 'bench-first', actualWeight: 125, reps: [7],
    });
    const secondCatalogMatch = v3Occurrence({
      occurrenceId: 'bench-second', actualWeight: 175, reps: [7],
    });

    expect(getNextSessionRecommendation(currentExercise, [v3Workout({
      exercises: [occurrenceIdOnlyMatch, firstCatalogMatch, secondCatalogMatch],
    })])).toMatchObject({ sourceAnchorWeight: 125 });
  });

  it('uses historical snapshots and permits prospective set-count changes and single-set progression', () => {
    const historicalTwoSets = weightedOccurrence({ targetReps: 10, floorReps: 7, reps: [10, 7] });
    const changedCurrent = { ...currentExercise, targetReps: 20, floorReps: 15, sets: 4, weightStep: 6 };
    expect(getNextSessionRecommendation(changedCurrent, [workout({ exercises: [historicalTwoSets] })]))
      .toMatchObject({ decision: 'increase', recommendedWeight: 106 });

    const singleSet = weightedOccurrence({ reps: [8] });
    expect(getNextSessionRecommendation(currentExercise, [workout({ exercises: [singleSet] })]))
      .toMatchObject({ decision: 'increase', recommendedWeight: 110 });
  });

  it('clamps decreases at zero while recording the full current step as applied', () => {
    const source = weightedOccurrence({ actualWeight: 5, reps: [4], completed: [true] });
    expect(getNextSessionRecommendation(currentExercise, [workout({ exercises: [source] })]))
      .toMatchObject({ decision: 'decrease', recommendedWeight: 0, appliedWeightStep: 10 });
  });

  it('sorts without mutation and deterministically resolves equal dates by source id', () => {
    const laterId = workout({ id: 'z-workout', exercises: [weightedOccurrence({ actualWeight: 200, reps: [7] })] });
    const earlierId = workout({ id: 'a-workout', exercises: [weightedOccurrence({ actualWeight: 120, reps: [7] })] });
    const old = workout({ id: 'old', date: '2026-07-01T10:00:00.000Z', exercises: [weightedOccurrence({ actualWeight: 80, reps: [8] })] });
    const history = [old, laterId, earlierId];
    const before = structuredClone(history);

    expect(getNextSessionRecommendation(currentExercise, history))
      .toMatchObject({ sourceWorkoutId: 'a-workout', sourceAnchorWeight: 120 });
    expect(history).toEqual(before);
  });

  it('skips newer ineligible data and scans occurrences in persisted order', () => {
    const malformedMatch = { ...weightedOccurrence({ actualWeight: 250 }), sets: 4 };
    const skippedTop = weightedOccurrence({ actualWeight: 240, completed: [false, false, false] });
    const firstValid = weightedOccurrence({ actualWeight: 130, reps: [7] });
    const secondValid = weightedOccurrence({ actualWeight: 180, reps: [7] });
    const history = [
      { date: '2026-07-13', exercises: [{ id: 'bench' }] },
      workout({ id: '', date: '2026-07-12T12:00:00.000Z', exercises: [weightedOccurrence({ actualWeight: 230 })] }),
      workout({ id: 'draft', date: '2026-07-12T11:00:00.000Z', status: 'draft' }),
      workout({ id: 'new-invalid', date: '2026-07-12T10:00:00.000Z', exercises: [malformedMatch, skippedTop] }),
      workout({ id: 'anchor', date: '2026-07-11T10:00:00.000Z', exercises: [
        weightedOccurrence({ id: 'other', actualWeight: 999 }),
        firstValid,
        secondValid,
      ] }),
    ];

    expect(getNextSessionRecommendation(currentExercise, history))
      .toMatchObject({ sourceWorkoutId: 'anchor', sourceAnchorWeight: 130 });
  });
});

describe('within-session backoff recommendations', () => {
  it.each([
    { reps: 6, expected: 100, steps: 0, code: BACKOFF_REASON_CODES.FLOOR_MET },
    { reps: 5, expected: 95, steps: 1, code: BACKOFF_REASON_CODES.BELOW_FLOOR },
    { reps: 4, expected: 90, steps: 2, code: BACKOFF_REASON_CODES.BELOW_FLOOR },
    { reps: 3, expected: 85, steps: 3, code: BACKOFF_REASON_CODES.BELOW_FLOOR },
    { reps: 0, expected: 85, steps: 3, code: BACKOFF_REASON_CODES.BELOW_FLOOR },
  ])('scales and caps the drop for $reps reps', ({ reps, expected, steps, code }) => {
    const result = calculateBackoffRecommendation({
      actualWeight: 100,
      actualReps: reps,
      floorReps: 6,
      weightStep: 5,
      sessionTopTarget: 110,
      priorAssignedTargetWeights: [110, 105],
    });
    expect(result).toMatchObject({ recommendedWeight: expected, dropSteps: steps, reasonCode: code });
  });

  it('uses actual override weight, clamps at zero, and applies every monotonic ceiling', () => {
    expect(calculateBackoffRecommendation({
      actualWeight: 4,
      actualReps: 0,
      floorReps: 6,
      weightStep: 5,
      sessionTopTarget: 100,
      priorAssignedTargetWeights: [100],
    })).toMatchObject({ recommendedWeight: 0, rawWeight: 0 });

    const overriddenUp = calculateBackoffRecommendation({
      actualWeight: 150,
      actualReps: 8,
      floorReps: 6,
      weightStep: 5,
      sessionTopTarget: 140,
      priorAssignedTargetWeights: [140, 130],
    });
    expect(overriddenUp).toMatchObject({ recommendedWeight: 130, priorTargetCeiling: 130 });

    const historyTargets = [140, 130];
    calculateBackoffRecommendation({
      actualWeight: 120,
      actualReps: 8,
      floorReps: 6,
      weightStep: 5,
      sessionTopTarget: 115,
      priorAssignedTargetWeights: historyTargets,
    });
    expect(historyTargets).toEqual([140, 130]);
  });

  it('rejects malformed numeric inputs instead of emitting an unsafe recommendation', () => {
    expect(() => calculateBackoffRecommendation({
      actualWeight: Number.NaN,
      actualReps: 5,
      floorReps: 6,
      weightStep: 5,
      sessionTopTarget: 100,
      priorAssignedTargetWeights: [100],
    })).toThrow(/invalid/i);
  });
});
