import { describe, expect, it } from 'vitest';
import { activeWorkoutReducer, initializeActiveWorkout } from '../utils/activeWorkout';

const topReason = {
  decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null,
  sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100,
  reasonCode: 'STARTING_NO_ANCHOR',
};

function weighted(id = 'bench', sets = 3) {
  return {
    id, name: 'Bench Press', muscleGroup: 'Chest', tier: 1, trackingMode: 'weighted',
    sets, prescribedSetCount: sets, startingWeight: 100, targetReps: 8, floorReps: 6,
    weightStep: 5,
    setRecords: Array.from({ length: sets }, (_, index) => ({
      index, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8,
      completed: false,
      recommendationReason: index === 0 ? topReason : {
        recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET',
      },
    })),
  };
}

function bodyweight() {
  return {
    id: 'pullup', name: 'Pull Up', muscleGroup: 'Back', tier: 1,
    trackingMode: 'bodyweight', sets: 2, prescribedSetCount: 2, targetReps: 8,
    setRecords: Array.from({ length: 2 }, (_, index) => ({
      index, targetReps: 8, fullReps: 0, assistedReps: 0, eccentricReps: 0,
      completed: false,
    })),
  };
}

const reduce = (state, action) => activeWorkoutReducer(state, action);
const editWeight = (exerciseIndex, setIndex, field, value) => ({
  type: 'editWeightedActual', exerciseIndex, setIndex, field, value,
});
const toggle = (exerciseIndex, setIndex) => ({ type: 'toggleTrackedSet', exerciseIndex, setIndex });

describe('active workout state', () => {
  it('deep clones inputs and toggles simple exercises independently', () => {
    const input = [
      { id: 'a', name: 'A', muscleGroup: 'Core', tier: 1, sets: 1, prescribedSetCount: 1 },
      { id: 'b', name: 'B', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false },
    ];
    let state = initializeActiveWorkout(input);
    expect(state.exercises).not.toBe(input);
    expect(state.exercises[0]).not.toBe(input[0]);
    expect(state.exercises[0]).toMatchObject({ trackingMode: 'simple', completed: false });
    state = reduce(state, { type: 'toggleSimpleExercise', exerciseIndex: 1 });
    expect(state.exercises.map(exercise => exercise.completed)).toEqual([false, true]);
    expect(input[1].completed).toBe(false);
  });

  it('enforces a per-exercise contiguous prefix while exercises interleave', () => {
    let state = initializeActiveWorkout([weighted('one'), weighted('two')]);
    state = reduce(state, toggle(0, 1));
    expect(state.exercises[0].setRecords[1].completed).toBe(false);
    state = reduce(state, toggle(0, 0));
    state = reduce(state, toggle(1, 0));
    expect(state.exercises.map(exercise => exercise.setRecords[0].completed)).toEqual([true, true]);
    state = reduce(state, toggle(0, 1));
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords.map(record => record.completed)).toEqual([true, true, false]);
    state = reduce(state, toggle(0, 1));
    expect(state.exercises[0].setRecords.map(record => record.completed)).toEqual([true, false, false]);
  });

  it('recommends only the immediate next set using actuals and monotonic target ceilings', () => {
    let state = initializeActiveWorkout([weighted()]);
    state = reduce(state, editWeight(0, 0, 'actualWeight', 110));
    state = reduce(state, editWeight(0, 0, 'actualReps', 4));
    state = reduce(state, toggle(0, 0));
    const [, next, farther] = state.exercises[0].setRecords;
    expect(next).toMatchObject({
      targetWeight: 100, actualWeight: 100,
      recommendationReason: { reasonCode: 'BACKOFF_BELOW_FLOOR', dropSteps: 2 },
    });
    expect(farther.recommendationReason.reasonCode).toBe('BACKOFF_AWAITING_PRIOR_SET');

    state = reduce(state, editWeight(0, 1, 'actualWeight', 120));
    state = reduce(state, editWeight(0, 1, 'actualReps', 8));
    state = reduce(state, toggle(0, 1));
    expect(state.exercises[0].setRecords[2].targetWeight).toBe(100);
  });

  it('keeps confirmed targets immutable and ignores earlier edits once a later set is confirmed', () => {
    let state = initializeActiveWorkout([weighted()]);
    state = reduce(state, toggle(0, 0));
    state = reduce(state, toggle(0, 1));
    const confirmedTarget = state.exercises[0].setRecords[1].targetWeight;
    const downstreamTarget = state.exercises[0].setRecords[2].targetWeight;
    state = reduce(state, editWeight(0, 0, 'actualReps', 0));
    expect(state.exercises[0].setRecords[1].targetWeight).toBe(confirmedTarget);
    expect(state.exercises[0].setRecords[2].targetWeight).toBe(downstreamTarget);
  });

  it('syncs untouched prefills but preserves dirty overrides through unconfirm and recompute', () => {
    let state = initializeActiveWorkout([weighted()]);
    state = reduce(state, toggle(0, 0));
    state = reduce(state, editWeight(0, 1, 'actualWeight', 77));
    state = reduce(state, editWeight(0, 1, 'actualReps', 3));
    state = reduce(state, toggle(0, 0));
    state = reduce(state, editWeight(0, 0, 'actualReps', 5));
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[1]).toMatchObject({ targetWeight: 95, actualWeight: 77, actualReps: 3 });
    state = reduce(state, toggle(0, 0));
    state = reduce(state, editWeight(0, 0, 'actualReps', 4));
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[1]).toMatchObject({ targetWeight: 90, actualWeight: 77, actualReps: 3 });
  });

  it('rejects edits to locked future rows and restores awaiting rationale when relocked', () => {
    let state = initializeActiveWorkout([weighted(), bodyweight()]);
    const initial = state;
    state = reduce(state, editWeight(0, 1, 'actualWeight', 77));
    state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 1, setIndex: 1, field: 'fullReps', value: 3 });
    state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 1, setIndex: 99, field: 'fullReps', value: 3 });
    expect(state).toBe(initial);

    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[1].recommendationReason.reasonCode).toBe('BACKOFF_FLOOR_MET');
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[1].recommendationReason).toEqual({
      recommendedWeight: state.exercises[0].setRecords[1].targetWeight,
      reasonCode: 'BACKOFF_AWAITING_PRIOR_SET',
    });
  });

  it('allows completed actual edits, ignores invalid numbers, and gives the final set no backoff effect', () => {
    let state = initializeActiveWorkout([weighted('bench', 2)]);
    state = reduce(state, toggle(0, 0));
    state = reduce(state, toggle(0, 1));
    state = reduce(state, editWeight(0, 1, 'actualReps', 3));
    expect(state.exercises[0].setRecords[1].actualReps).toBe(3);
    const unchanged = state;
    state = reduce(state, editWeight(0, 1, 'actualReps', -1));
    state = reduce(state, editWeight(0, 1, 'actualWeight', Number.NaN));
    expect(state).toBe(unchanged);
    expect(state.exercises[0].setRecords).toHaveLength(2);
  });

  it('allows a temporary empty actual-reps edit, prevents confirming it, and recomputes after replacement', () => {
    let state = initializeActiveWorkout([weighted('bench', 2)]);
    state = reduce(state, editWeight(0, 0, 'actualReps', ''));
    expect(state.exercises[0].setRecords[0].actualReps).toBe('');

    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[0].completed).toBe(false);

    state = reduce(state, editWeight(0, 0, 'actualReps', '6'));
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[0].completed).toBe(true);

    state = reduce(state, editWeight(0, 0, 'actualReps', ''));
    expect(state.exercises[0].setRecords[1].targetWeight).toBe(100);
    state = reduce(state, editWeight(0, 0, 'actualReps', '4'));
    expect(state.exercises[0].setRecords[1]).toMatchObject({
      targetWeight: 90,
      recommendationReason: { reasonCode: 'BACKOFF_BELOW_FLOOR', dropSteps: 2 },
    });
  });

  it('tracks separate bodyweight categories, total, and a confirmed zero-rep attempt', () => {
    let state = initializeActiveWorkout([bodyweight()]);
    state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 0, setIndex: 0, field: 'fullReps', value: 3 });
    state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 0, setIndex: 0, field: 'assistedReps', value: 2 });
    state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 0, setIndex: 0, field: 'eccentricReps', value: 1 });
    expect(state.exercises[0].setRecords[0]).toMatchObject({ fullReps: 3, assistedReps: 2, eccentricReps: 1 });
    state = reduce(state, toggle(0, 0));
    state = reduce(state, toggle(0, 1));
    expect(state.exercises[0].setRecords[1].completed).toBe(true);
  });
});
