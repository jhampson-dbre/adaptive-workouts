import { describe, expect, it } from 'vitest';
import {
  activeWorkoutReducer,
  initializeActiveWorkout,
  resolveFinishCandidate,
} from '../utils/activeWorkout';
import { buildCompletedV3WorkoutDocument } from '../utils/workoutSchema';

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

  it('allows temporary empty weight and bodyweight edits but prevents confirming them', () => {
    let state = initializeActiveWorkout([weighted('bench', 2), bodyweight()]);
    state = reduce(state, editWeight(0, 0, 'actualWeight', ''));
    expect(state.exercises[0].setRecords[0].actualWeight).toBe('');
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[0].completed).toBe(false);

    state = reduce(state, editWeight(0, 0, 'actualWeight', '95.5'));
    state = reduce(state, editWeight(0, 0, 'actualReps', 4));
    state = reduce(state, toggle(0, 0));
    expect(state.exercises[0].setRecords[1].targetWeight).toBe(85.5);
    state = reduce(state, editWeight(0, 0, 'actualWeight', ''));
    expect(state.exercises[0].setRecords[1].targetWeight).toBe(85.5);
    state = reduce(state, editWeight(0, 0, 'actualWeight', '90'));
    expect(state.exercises[0].setRecords[1].targetWeight).toBe(80);

    for (const field of ['fullReps', 'assistedReps', 'eccentricReps']) {
      state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 1, setIndex: 0, field, value: '' });
      expect(state.exercises[1].setRecords[0][field]).toBe('');
      state = reduce(state, toggle(1, 0));
      expect(state.exercises[1].setRecords[0].completed).toBe(false);
      state = reduce(state, { type: 'editBodyweightActual', exerciseIndex: 1, setIndex: 0, field, value: 1 });
    }
    state = reduce(state, toggle(1, 0));
    expect(state.exercises[1].setRecords[0].completed).toBe(true);
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

describe('active workout timing state machine', () => {
  const timedWeighted = (id = 'bench', sets = 3) => {
    const exercise = weighted(id, sets);
    exercise.occurrenceId = `${id}:0`;
    exercise.setRecords = exercise.setRecords.map((record, index) => ({
      ...record,
      plannedRestSeconds: index === sets - 1 ? null : 60,
      workDurationSeconds: null,
      actualRestSeconds: null,
    }));
    return exercise;
  };

  const timedSimple = () => ({
    id: 'plank', occurrenceId: 'plank:0', name: 'Plank', muscleGroup: 'Core', tier: 1,
    trackingMode: 'simple', sets: 2, prescribedSetCount: 2, completed: false,
    setRecords: [0, 1].map(index => ({
      index, completed: false, plannedRestSeconds: index === 0 ? 30 : null,
      workDurationSeconds: null, actualRestSeconds: null,
    })),
  });

  const startWorkout = (state, timestamp = 1_000) => reduce(state, { type: 'startWorkout', timestamp });
  const startSet = (state, exerciseIndex, setIndex, timestamp) => reduce(state, {
    type: 'startSet', exerciseIndex, setIndex, timestamp,
  });
  const confirmSet = (state, exerciseIndex, setIndex, timestamp) => reduce(state, {
    type: 'confirmSet', exerciseIndex, setIndex, timestamp,
  });
  const cancelSet = (state, exerciseIndex, setIndex) => reduce(state, {
    type: 'cancelSet', exerciseIndex, setIndex,
  });
  const undoSet = (state, exerciseIndex, setIndex) => reduce(state, {
    type: 'undoSet', exerciseIndex, setIndex,
  });

  it('requires an explicit workout start and permits only one global work timer', () => {
    let state = initializeActiveWorkout([timedWeighted(), timedSimple()]);
    expect(state).toMatchObject({ workoutStartedAt: null, activeWorkTimer: null });
    expect(startSet(state, 0, 0, 2_000)).toBe(state);

    state = startWorkout(state, 1_000);
    expect(state.workoutStartedAt).toBe(1_000);
    expect(startWorkout(state, 9_000)).toBe(state);
    state = startSet(state, 0, 0, 2_000);
    expect(state.activeWorkTimer).toMatchObject({
      id: 'work-1', occurrenceId: 'bench:0', exerciseIndex: 0, setIndex: 0, startedAt: 2_000,
    });
    expect(startSet(state, 1, 0, 2_500)).toBe(state);
  });

  it('rejects legacy completion toggles after timed workout start', () => {
    let state = initializeActiveWorkout([timedWeighted(), timedSimple()]);
    state = reduce(state, toggle(0, 0));
    state = reduce(state, { type: 'toggleSimpleExercise', exerciseIndex: 1 });
    expect(state.exercises[0].setRecords[0].completed).toBe(true);
    expect(state.exercises[1].completed).toBe(true);

    state = initializeActiveWorkout([timedWeighted(), timedSimple()]);
    state = startWorkout(state);
    expect(reduce(state, toggle(0, 0))).toBe(state);
    expect(reduce(state, { type: 'toggleSimpleExercise', exerciseIndex: 1 })).toBe(state);

    state = startSet(state, 0, 0, 2_000);
    state = confirmSet(state, 0, 0, 3_000);
    const confirmed = state;
    expect(reduce(state, toggle(0, 0))).toBe(confirmed);
    const result = resolveFinishCandidate(state, 4_000);
    expect(() => buildCompletedV3WorkoutDocument({
      ...result.candidate,
      date: '2026-07-16T12:00:00.000Z',
    })).not.toThrow();
  });

  it('validates confirmation by mode, clamps duration, and supports cancel without rest', () => {
    let state = startWorkout(initializeActiveWorkout([timedWeighted(), timedSimple()]));
    state = reduce(state, editWeight(0, 0, 'actualReps', ''));
    state = startSet(state, 0, 0, 2_000);
    expect(confirmSet(state, 0, 0, 3_000)).toBe(state);

    state = cancelSet(state, 0, 0);
    expect(state.activeWorkTimer).toBeNull();
    expect(state.exercises[0].setRecords[0]).toMatchObject({
      completed: false, workDurationSeconds: null, actualRestSeconds: null,
    });
    expect(state.exercises[0].setRecords[0]._activeRest).toBeUndefined();

    state = reduce(state, editWeight(0, 0, 'actualReps', 8));
    state = startSet(state, 0, 0, 4_000);
    state = confirmSet(state, 0, 0, 3_000);
    expect(state.exercises[0].setRecords[0]).toMatchObject({
      completed: true, workDurationSeconds: 0, actualRestSeconds: null,
      _activeRest: { id: 'rest-3', startedAt: 3_000 },
    });

    state = startSet(state, 1, 0, 5_000);
    state = confirmSet(state, 1, 0, 5_501);
    expect(state.exercises[1].setRecords[0]).toMatchObject({ completed: true, workDurationSeconds: 1 });
  });

  it('requires all bodyweight inputs and ignores render-only tick actions', () => {
    const timedBodyweight = bodyweight();
    timedBodyweight.occurrenceId = 'pullup:0';
    timedBodyweight.setRecords = timedBodyweight.setRecords.map((record, index) => ({
      ...record,
      plannedRestSeconds: index === 0 ? 60 : null,
      workDurationSeconds: null,
      actualRestSeconds: null,
    }));
    let state = startWorkout(initializeActiveWorkout([timedBodyweight]));
    state = reduce(state, {
      type: 'editBodyweightActual', exerciseIndex: 0, setIndex: 0, field: 'fullReps', value: '',
    });
    state = startSet(state, 0, 0, 2_000);
    expect(confirmSet(state, 0, 0, 3_000)).toBe(state);
    const ticking = reduce(state, { type: 'renderTick', timestamp: 30_000 });
    expect(ticking).toBe(state);

    state = reduce(state, {
      type: 'editBodyweightActual', exerciseIndex: 0, setIndex: 0, field: 'fullReps', value: 0,
    });
    state = confirmSet(state, 0, 0, 3_000);
    expect(state.exercises[0].setRecords[0].completed).toBe(true);
  });

  it('keeps rests concurrent across occurrences and closes only the prior same-occurrence rest', () => {
    let state = startWorkout(initializeActiveWorkout([timedWeighted('one'), timedWeighted('two')]));
    state = startSet(state, 0, 0, 2_000);
    state = confirmSet(state, 0, 0, 4_000);
    const firstRest = state.exercises[0].setRecords[0]._activeRest;
    state = startSet(state, 1, 0, 5_000);
    state = confirmSet(state, 1, 0, 6_000);
    expect(state.exercises[0].setRecords[0]._activeRest).toEqual(firstRest);
    expect(state.exercises[1].setRecords[0]._activeRest).toBeDefined();

    state = startSet(state, 0, 1, 9_499);
    expect(state.exercises[0].setRecords[0]).toMatchObject({ actualRestSeconds: 5 });
    expect(state.exercises[0].setRecords[0]._activeRest).toBeUndefined();
    expect(state.exercises[1].setRecords[0]._activeRest).toBeDefined();
    expect(startSet(state, 0, 2, 10_000)).toBe(state);
  });

  it('never starts rest after a final set', () => {
    let state = startWorkout(initializeActiveWorkout([timedSimple()]));
    state = startSet(state, 0, 0, 2_000);
    state = confirmSet(state, 0, 0, 3_000);
    state = startSet(state, 0, 1, 4_000);
    state = confirmSet(state, 0, 1, 6_000);
    expect(state.exercises[0].setRecords[1]).toMatchObject({
      completed: true, workDurationSeconds: 2, actualRestSeconds: null,
    });
    expect(state.exercises[0].setRecords[1]._activeRest).toBeUndefined();
  });

  it('undoes only the latest live-rest prefix, relocks weighted next, and gives reconfirmed rest a new identity', () => {
    let state = startWorkout(initializeActiveWorkout([timedWeighted()]));
    state = startSet(state, 0, 0, 2_000);
    state = confirmSet(state, 0, 0, 3_000);
    const firstRestId = state.exercises[0].setRecords[0]._activeRest.id;
    state = undoSet(state, 0, 0);
    expect(state.exercises[0].setRecords[0]).toMatchObject({
      completed: false, plannedRestSeconds: 60, workDurationSeconds: null, actualRestSeconds: null,
      actualWeight: 100, actualReps: 8,
    });
    expect(state.exercises[0].setRecords[0]._activeRest).toBeUndefined();
    expect(state.exercises[0].setRecords[1].recommendationReason.reasonCode)
      .toBe('BACKOFF_AWAITING_PRIOR_SET');

    state = startSet(state, 0, 0, 4_000);
    state = confirmSet(state, 0, 0, 5_000);
    expect(state.exercises[0].setRecords[0]._activeRest.id).not.toBe(firstRestId);
    state = startSet(state, 0, 1, 7_000);
    expect(undoSet(state, 0, 0)).toBe(state);
  });

  it('resolves a frozen Finish candidate from one timestamp without mutating active state', () => {
    let state = startWorkout(initializeActiveWorkout([timedWeighted('one'), timedWeighted('two')]), 1_000);
    state = startSet(state, 0, 0, 2_000);
    expect(resolveFinishCandidate(state, 9_000)).toMatchObject({
      status: 'blocked-active-work', activeWorkTimer: { occurrenceId: 'one:0', setIndex: 0 },
    });
    state = confirmSet(state, 0, 0, 3_000);
    state = startSet(state, 1, 0, 4_000);
    state = confirmSet(state, 1, 0, 5_000);
    const before = structuredClone(state);

    const result = resolveFinishCandidate(state, 8_501);
    expect(result.status).toBe('ready');
    expect(result.candidate.actualDurationSeconds).toBe(8);
    expect(result.candidate.exercises[0].setRecords[0].actualRestSeconds).toBe(6);
    expect(result.candidate.exercises[1].setRecords[0].actualRestSeconds).toBe(4);
    expect(result.candidate.exercises[0].setRecords[0]._activeRest).toBeUndefined();
    expect(state).toEqual(before);
    expect(Object.isFrozen(result.candidate)).toBe(true);
    expect(() => { result.candidate.exercises[0].name = 'changed'; }).toThrow();
    const document = buildCompletedV3WorkoutDocument({
      ...result.candidate,
      date: '2026-07-16T12:00:00.000Z',
    });
    expect(document).toMatchObject({
      schemaVersion: 3,
      actualDurationSeconds: 8,
    });
    expect(document.exercises.map(item => item.setRecords[0].actualRestSeconds)).toEqual([6, 4]);

    const later = resolveFinishCandidate(state, 10_000);
    expect(later.candidate.actualDurationSeconds).toBe(9);
    expect(later.candidate.exercises[0].setRecords[0].actualRestSeconds).toBe(7);
  });
});
