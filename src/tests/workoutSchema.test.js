import { describe, expect, it } from 'vitest';

import {
  TRACKING_MODES,
  buildCompletedWorkoutDocument,
  buildCompletedV3WorkoutDocument,
  classifyWorkoutDocument,
  hasConfirmedWork,
  isLegacyWorkoutDocument,
  isMalformedV2WorkoutDocument,
  isValidCatalogExercise,
  isValidV2ExerciseOccurrence,
  isValidV2WorkoutDocument,
  isValidV2WorkoutEnvelope,
  isValidV3ExerciseOccurrence,
  isValidV3WorkoutDocument,
  normalizeCatalogExercise,
  wasPerformed,
} from '../utils/workoutSchema';

const weightedExercise = {
  id: 'bench',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  tier: 2,
  linkedTo: 'press',
  isActive: true,
  trackingMode: 'weighted',
  sets: 2,
  prescribedSetCount: 2,
  startingWeight: 100,
  targetReps: 8,
  floorReps: 5,
  weightStep: 5,
  setRecords: [
    {
      index: 0,
      targetWeight: 105,
      targetReps: 8,
      actualWeight: 110,
      actualReps: 8,
      completed: true,
      recommendationReason: {
        decision: 'increase',
        sourceWorkoutId: 'workout-1',
        sourceWorkoutDate: '2026-07-10T10:00:00.000Z',
        sourceAnchorWeight: 100,
        appliedWeightStep: 5,
        recommendedWeight: 105,
        reasonCode: 'all-sets-met-floor',
      },
    },
    {
      index: 1,
      targetWeight: 105,
      targetReps: 8,
      actualWeight: 105,
      actualReps: 0,
      completed: false,
      recommendationReason: {
        recommendedWeight: 105,
        reasonCode: 'prior-set-at-floor',
        priorSetIndex: 0,
      },
    },
  ],
};

const bodyweightExercise = {
  id: 'pull-up',
  name: 'Pull Up',
  muscleGroup: 'Back',
  tier: 3,
  trackingMode: 'bodyweight',
  sets: 1,
  prescribedSetCount: 1,
  targetReps: 6,
  setRecords: [{
    index: 0,
    targetReps: 6,
    fullReps: 0,
    assistedReps: 3,
    eccentricReps: 0,
    completed: true,
  }],
};

const withTiming = (record, index, count, completed = record.completed) => ({
  ...record,
  completed,
  plannedRestSeconds: index === count - 1 ? null : 60,
  workDurationSeconds: completed ? 0 : null,
  actualRestSeconds: completed && index < count - 1 ? 0 : null,
});

const v3WeightedExercise = {
  ...weightedExercise,
  occurrenceId: 'bench:0',
  setRecords: weightedExercise.setRecords.map((record, index) => (
    withTiming(record, index, weightedExercise.setRecords.length)
  )),
};

const v3BodyweightExercise = {
  ...bodyweightExercise,
  occurrenceId: 'pull-up:1',
  setRecords: bodyweightExercise.setRecords.map((record, index) => (
    withTiming(record, index, bodyweightExercise.setRecords.length)
  )),
};

const v3SimpleExercise = {
  id: 'plank',
  occurrenceId: 'plank:2',
  name: 'Plank',
  muscleGroup: 'Core',
  tier: 4,
  trackingMode: 'simple',
  sets: 2,
  prescribedSetCount: 2,
  setRecords: [
    withTiming({ index: 0, completed: true }, 0, 2),
    withTiming({ index: 1, completed: false }, 1, 2),
  ],
};

const validV3Workout = {
  schemaVersion: 3,
  status: 'completed',
  date: '2026-07-12T12:00:00.000Z',
  actualDurationSeconds: 0,
  exercises: [v3WeightedExercise, v3BodyweightExercise, v3SimpleExercise],
};

describe('workout schema', () => {
  it('defines the three canonical tracking modes and only normalizes an absent mode', () => {
    expect(TRACKING_MODES).toEqual(['simple', 'weighted', 'bodyweight']);
    const original = { id: 'curl', name: 'Curl', muscleGroup: 'Biceps', tier: 1, sets: 3 };
    expect(normalizeCatalogExercise(original)).toEqual({ ...original, trackingMode: 'simple' });
    expect(original).not.toHaveProperty('trackingMode');
    expect(normalizeCatalogExercise({ ...original, trackingMode: 'invalid' }).trackingMode).toBe('invalid');
  });

  it('validates mode-specific catalog configuration without silently downgrading invalid data', () => {
    const common = { id: 'curl', name: 'Curl', muscleGroup: 'Biceps', tier: 1, sets: 3 };
    expect(isValidCatalogExercise(common)).toBe(true);
    expect(isValidCatalogExercise({ ...common, sets: 11 })).toBe(false);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'weighted', startingWeight: 20, targetReps: 8, floorReps: 5, weightStep: 5 })).toBe(true);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'weighted', startingWeight: 20, targetReps: 8, floorReps: 8, weightStep: 5 })).toBe(false);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'weighted', startingWeight: 20, targetReps: 8, floorReps: 5, weightStep: 0 })).toBe(false);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'bodyweight', targetReps: 8 })).toBe(true);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'bodyweight', targetReps: 0 })).toBe(false);
    expect(isValidCatalogExercise({ ...common, trackingMode: 'wat' })).toBe(false);
  });

  it('validates tracked records, including contiguous indexes and numeric unconfirmed actuals', () => {
    expect(isValidV2ExerciseOccurrence(weightedExercise)).toBe(true);
    expect(isValidV2ExerciseOccurrence(bodyweightExercise)).toBe(true);
    expect(isValidV2ExerciseOccurrence({ ...weightedExercise, prescribedSetCount: 1 })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [weightedExercise.setRecords[0], { ...weightedExercise.setRecords[1], index: 2 }],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [weightedExercise.setRecords[0], { ...weightedExercise.setRecords[1], actualWeight: undefined }],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [weightedExercise.setRecords[0], { ...weightedExercise.setRecords[1], targetReps: 9 }],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [{ ...weightedExercise.setRecords[0], completed: false }, { ...weightedExercise.setRecords[1], completed: true }],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...bodyweightExercise,
      setRecords: [{ ...bodyweightExercise.setRecords[0], assistedReps: -1 }],
    })).toBe(false);
  });

  it('validates top-set provenance separately from extensible backoff reasons', () => {
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [{
        ...weightedExercise.setRecords[0],
        targetWeight: 100,
        recommendationReason: {
          decision: 'starting',
          sourceWorkoutId: null,
          sourceWorkoutDate: null,
          sourceAnchorWeight: null,
          appliedWeightStep: 0,
          recommendedWeight: 100,
          reasonCode: 'starting-weight',
        },
      }, weightedExercise.setRecords[1]],
    })).toBe(true);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [{
        ...weightedExercise.setRecords[0],
        recommendationReason: { ...weightedExercise.setRecords[0].recommendationReason, decision: 'starting' },
      }, weightedExercise.setRecords[1]],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [{
        ...weightedExercise.setRecords[0],
        recommendationReason: { ...weightedExercise.setRecords[0].recommendationReason, sourceWorkoutDate: 'not-a-date' },
      }, weightedExercise.setRecords[1]],
    })).toBe(false);
    expect(isValidV2ExerciseOccurrence({
      ...weightedExercise,
      setRecords: [weightedExercise.setRecords[0], {
        ...weightedExercise.setRecords[1],
        recommendationReason: { recommendedWeight: 105, reasonCode: '' },
      }],
    })).toBe(false);
  });

  it('separates envelope validity from occurrence validity and classifies explicit bad versions as malformed', () => {
    const valid = {
      schemaVersion: 2,
      status: 'completed',
      date: '2026-07-12T12:00:00.000Z',
      actualDuration: 42,
      exercises: [weightedExercise],
    };
    expect(isValidV2WorkoutEnvelope(valid)).toBe(true);
    expect(isValidV2WorkoutDocument(valid)).toBe(true);
    expect(classifyWorkoutDocument(valid)).toBe('valid-v2');

    const malformedOccurrence = { ...valid, exercises: [{ ...weightedExercise, sets: 3 }] };
    expect(isValidV2WorkoutEnvelope(malformedOccurrence)).toBe(true);
    expect(isValidV2WorkoutDocument(malformedOccurrence)).toBe(false);
    expect(classifyWorkoutDocument(malformedOccurrence)).toBe('malformed-versioned');

    expect(isLegacyWorkoutDocument({ date: '2020-01-01', exercises: [] })).toBe(true);
    expect(isLegacyWorkoutDocument({ schemaVersion: undefined, exercises: [] })).toBe(false);
    expect(classifyWorkoutDocument({ schemaVersion: 1, exercises: [] })).toBe('malformed-versioned');
    expect(isMalformedV2WorkoutDocument({ schemaVersion: 1, exercises: [] })).toBe(true);
    expect(classifyWorkoutDocument({ schemaVersion: 99, exercises: [] })).toBe('malformed-versioned');
  });

  it('builds an allowlisted, immutable completed v2 document and rejects zero-confirmed work', () => {
    const inputExercise = {
      ...weightedExercise,
      dynamicTier: 4,
      expanded: true,
      setRecords: [{
        ...weightedExercise.setRecords[0],
        recommendationReason: {
          ...weightedExercise.setRecords[0].recommendationReason,
          transientExplanationState: true,
        },
      }, weightedExercise.setRecords[1]],
    };
    const input = {
      date: '2026-07-12T12:00:00.000Z',
      actualDuration: 42,
      exercises: [inputExercise, { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 4, trackingMode: 'simple', sets: 3, completed: false, uiSelected: true }],
      draft: true,
    };
    const built = buildCompletedWorkoutDocument(input);

    expect(built).toMatchObject({ schemaVersion: 2, status: 'completed', date: input.date, actualDuration: 42 });
    expect(built).not.toHaveProperty('draft');
    expect(built.exercises[0]).not.toHaveProperty('dynamicTier');
    expect(built.exercises[0]).not.toHaveProperty('expanded');
    expect(built.exercises[0].setRecords[0].recommendationReason).not.toHaveProperty('transientExplanationState');
    expect(built.exercises[1]).not.toHaveProperty('uiSelected');
    expect(built.exercises[0]).not.toBe(inputExercise);
    expect(inputExercise).toHaveProperty('dynamicTier', 4);
    expect(isValidV2WorkoutDocument(built)).toBe(true);

    expect(() => buildCompletedWorkoutDocument({ ...input, exercises: [{ ...input.exercises[1] }] })).toThrow(/confirmed work/i);
    expect(() => buildCompletedWorkoutDocument({ ...input, exercises: [{ ...weightedExercise, sets: 3 }] })).toThrow(/invalid/i);
  });

  it('allowlists persisted backoff explanation fields and strips unknown nested state', () => {
    const reason = {
      recommendedWeight: 95,
      reasonCode: 'BACKOFF_BELOW_FLOOR',
      sourceActualWeight: 100,
      sourceActualReps: 4,
      floorReps: 5,
      weightStep: 5,
      dropSteps: 1,
      rawWeight: 97.5,
      sessionTopTarget: 105,
      priorTargetCeiling: 100,
      nestedTransient: { debug: true },
      unknown: 'strip me',
    };
    const input = {
      date: '2026-07-12T12:00:00.000Z', actualDuration: 10,
      exercises: [{
        ...weightedExercise,
        setRecords: [weightedExercise.setRecords[0], {
          ...weightedExercise.setRecords[1], targetWeight: 95,
          recommendationReason: reason,
        }],
      }],
    };
    const built = buildCompletedWorkoutDocument(input);
    expect(built.exercises[0].setRecords[1].recommendationReason).toEqual({
      recommendedWeight: 95,
      reasonCode: 'BACKOFF_BELOW_FLOOR',
      sourceActualWeight: 100,
      sourceActualReps: 4,
      floorReps: 5,
      weightStep: 5,
      dropSteps: 1,
      rawWeight: 97.5,
      sessionTopTarget: 105,
      priorTargetCeiling: 100,
    });
    expect(reason).toHaveProperty('unknown', 'strip me');

    const awaiting = {
      ...input,
      exercises: [{
        ...weightedExercise,
        setRecords: [weightedExercise.setRecords[0], {
          ...weightedExercise.setRecords[1],
          recommendationReason: {
            recommendedWeight: 105,
            reasonCode: 'BACKOFF_AWAITING_PRIOR_SET',
            sourceActualReps: 8,
          },
        }],
      }],
    };
    expect(buildCompletedWorkoutDocument(awaiting).exercises[0].setRecords[1].recommendationReason)
      .toEqual({ recommendedWeight: 105, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' });
  });

  it('uses presence only for truly unversioned legacy workouts', () => {
    const occurrence = { id: 'legacy-exercise' };
    expect(wasPerformed({ date: '2025-01-01', exercises: [occurrence] }, occurrence)).toBe(true);
    expect(wasPerformed({ schemaVersion: undefined, exercises: [occurrence] }, occurrence)).toBe(false);
    expect(wasPerformed({ schemaVersion: null, exercises: [occurrence] }, occurrence)).toBe(false);
    expect(wasPerformed({ schemaVersion: 1, exercises: [occurrence] }, occurrence)).toBe(false);
    expect(wasPerformed({ schemaVersion: 99, exercises: [occurrence] }, occurrence)).toBe(false);
  });

  it('recognizes only confirmed work in valid completed v2 occurrences', () => {
    const simple = {
      id: 'plank',
      name: 'Plank',
      muscleGroup: 'Core',
      tier: 4,
      trackingMode: 'simple',
      sets: 3,
      prescribedSetCount: 3,
      completed: true,
    };
    const envelope = {
      schemaVersion: 2,
      status: 'completed',
      date: '2026-07-12T12:00:00.000Z',
      actualDuration: 20,
      exercises: [],
    };

    expect(wasPerformed({ ...envelope, exercises: [simple] }, simple)).toBe(true);
    expect(wasPerformed({ ...envelope, exercises: [{ ...simple, completed: false }] }, { ...simple, completed: false })).toBe(false);
    expect(wasPerformed({ ...envelope, exercises: [weightedExercise] }, weightedExercise)).toBe(true);
    expect(wasPerformed({ ...envelope, exercises: [bodyweightExercise] }, bodyweightExercise)).toBe(true);

    const zeroRepAttempt = {
      ...bodyweightExercise,
      setRecords: [{
        ...bodyweightExercise.setRecords[0],
        fullReps: 0,
        assistedReps: 0,
        eccentricReps: 0,
      }],
    };
    expect(wasPerformed({ ...envelope, exercises: [zeroRepAttempt] }, zeroRepAttempt)).toBe(true);
  });

  it('preserves v2 simple completion while additive set records are transitional', () => {
    expect(hasConfirmedWork([{
      trackingMode: 'simple',
      completed: true,
      setRecords: [{ index: 0, completed: false }],
    }])).toBe(true);
  });

  it('fails malformed v2 closed while preserving valid siblings', () => {
    const valid = weightedExercise;
    const malformed = { ...weightedExercise, sets: 3 };
    const workout = {
      schemaVersion: 2,
      status: 'completed',
      date: '2026-07-12T12:00:00.000Z',
      actualDuration: 20,
      exercises: [malformed, valid],
    };
    expect(wasPerformed(workout, malformed)).toBe(false);
    expect(wasPerformed(workout, valid)).toBe(true);
    expect(wasPerformed({ ...workout, status: 'draft' }, valid)).toBe(false);
  });

  it('classifies valid v3 documents and validates timing for all tracking modes', () => {
    expect(isValidV3WorkoutDocument(validV3Workout)).toBe(true);
    expect(classifyWorkoutDocument(validV3Workout)).toBe('valid-v3');
    expect(validV3Workout.exercises.every(exercise => isValidV3ExerciseOccurrence(exercise))).toBe(true);
    expect(wasPerformed(validV3Workout, v3WeightedExercise)).toBe(true);
    expect(wasPerformed(validV3Workout, v3BodyweightExercise)).toBe(true);
    expect(wasPerformed(validV3Workout, v3SimpleExercise)).toBe(true);
  });

  it('requires unique occurrence identities and rejects malformed v3 as a whole', () => {
    const duplicateId = {
      ...validV3Workout,
      exercises: [v3WeightedExercise, { ...v3BodyweightExercise, occurrenceId: v3WeightedExercise.occurrenceId }],
    };
    const malformedTiming = {
      ...validV3Workout,
      exercises: [v3WeightedExercise, {
        ...v3BodyweightExercise,
        setRecords: [{ ...v3BodyweightExercise.setRecords[0], workDurationSeconds: null }],
      }],
    };

    expect(isValidV3WorkoutDocument(duplicateId)).toBe(false);
    expect(isValidV3WorkoutDocument(malformedTiming)).toBe(false);
    expect(classifyWorkoutDocument(malformedTiming)).toBe('malformed-versioned');
    expect(wasPerformed(malformedTiming, v3WeightedExercise)).toBe(false);
  });

  it('enforces saved timing coherence while admitting a live rest only in active state', () => {
    const liveRest = {
      ...v3WeightedExercise,
      setRecords: [
        { ...v3WeightedExercise.setRecords[0], actualRestSeconds: null },
        v3WeightedExercise.setRecords[1],
      ],
    };

    expect(isValidV3ExerciseOccurrence(liveRest)).toBe(false);
    expect(isValidV3ExerciseOccurrence(liveRest, { allowLiveRest: true })).toBe(true);
    expect(isValidV3ExerciseOccurrence({
      ...liveRest,
      setRecords: [
        { ...liveRest.setRecords[0], completed: false, workDurationSeconds: 0 },
        liveRest.setRecords[1],
      ],
    }, { allowLiveRest: true })).toBe(false);
  });

  it.each([
    ['missing confirmed work duration', exercise => ({
      ...exercise,
      setRecords: [{ ...exercise.setRecords[0], workDurationSeconds: null }, exercise.setRecords[1]],
    })],
    ['work duration on an unconfirmed set', exercise => ({
      ...exercise,
      setRecords: [exercise.setRecords[0], { ...exercise.setRecords[1], workDurationSeconds: 0 }],
    })],
    ['missing actual rest on a confirmed non-final set', exercise => ({
      ...exercise,
      setRecords: [{ ...exercise.setRecords[0], actualRestSeconds: null }, exercise.setRecords[1]],
    })],
    ['actual rest on a final set', exercise => ({
      ...exercise,
      setRecords: [exercise.setRecords[0], { ...exercise.setRecords[1], actualRestSeconds: 0 }],
    })],
    ['planned rest on a final set', exercise => ({
      ...exercise,
      setRecords: [exercise.setRecords[0], { ...exercise.setRecords[1], plannedRestSeconds: 60 }],
    })],
    ['out-of-range planned rest', exercise => ({
      ...exercise,
      setRecords: [{ ...exercise.setRecords[0], plannedRestSeconds: 601 }, exercise.setRecords[1]],
    })],
    ['an occurrence-level simple completion flag', exercise => ({ ...exercise, completed: true })],
  ])('rejects v3 timing incoherence: %s', (_label, mutate) => {
    const malformedSimple = mutate(v3SimpleExercise);
    expect(isValidV3WorkoutDocument({ ...validV3Workout, exercises: [malformedSimple] })).toBe(false);
  });

  it.each([
    ['persists actualDuration instead of seconds', { actualDuration: 2 }],
    ['uses a negative duration', { actualDurationSeconds: -1 }],
    ['uses a fractional duration', { actualDurationSeconds: 1.5 }],
  ])('rejects v3 that %s', (_label, change) => {
    expect(isValidV3WorkoutDocument({ ...validV3Workout, ...change })).toBe(false);
  });

  it('builds an allowlisted immutable v3 document without changing the v2 writer', () => {
    const transientInput = {
      ...validV3Workout,
      draft: true,
      exercises: validV3Workout.exercises.map(exercise => ({
        ...exercise,
        expanded: true,
        activeRestAttemptId: 'transient',
        setRecords: exercise.setRecords.map(record => ({
          ...record,
          workStartedAt: 100,
          restStartedAt: 200,
          inputDirty: true,
        })),
      })),
    };

    const built = buildCompletedV3WorkoutDocument(transientInput);
    expect(built).toMatchObject({
      schemaVersion: 3,
      status: 'completed',
      date: validV3Workout.date,
      actualDurationSeconds: 0,
    });
    expect(built.exercises.map(exercise => exercise.trackingMode))
      .toEqual(['weighted', 'bodyweight', 'simple']);
    expect(isValidV3WorkoutDocument(built)).toBe(true);
    expect(built).not.toBe(transientInput);
    expect(transientInput.exercises[0]).toHaveProperty('expanded', true);
    expect(built.exercises[0]).not.toHaveProperty('expanded');
    expect(built.exercises[0].setRecords[0]).not.toHaveProperty('workStartedAt');
    expect(built.exercises[0].setRecords[0]).not.toHaveProperty('restStartedAt');
    expect(built.exercises[0].setRecords[0]).not.toHaveProperty('inputDirty');
    expect(built.exercises[0].setRecords[1].recommendationReason).not.toHaveProperty('priorSetIndex');
    expect(built).not.toHaveProperty('actualDuration');

    const v2 = buildCompletedWorkoutDocument({
      date: validV3Workout.date,
      actualDuration: 2,
      exercises: [weightedExercise],
    });
    expect(v2).toMatchObject({ schemaVersion: 2, actualDuration: 2 });
    expect(v2).not.toHaveProperty('actualDurationSeconds');
  });

  it('rejects malformed saved v3 timing instead of partially building it', () => {
    const invalid = {
      ...validV3Workout,
      exercises: [{
        ...v3SimpleExercise,
        setRecords: [
          { ...v3SimpleExercise.setRecords[0], plannedRestSeconds: null },
          v3SimpleExercise.setRecords[1],
        ],
      }],
    };
    expect(() => buildCompletedV3WorkoutDocument(invalid)).toThrow(/invalid/i);
    expect(isValidV3WorkoutDocument({
      ...validV3Workout,
      exercises: [{
        ...v3SimpleExercise,
        setRecords: v3SimpleExercise.setRecords.map(record => ({
          ...record,
          completed: false,
          workDurationSeconds: null,
          actualRestSeconds: null,
        })),
      }],
    })).toBe(false);
  });
});
