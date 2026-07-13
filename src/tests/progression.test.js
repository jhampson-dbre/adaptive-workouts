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
