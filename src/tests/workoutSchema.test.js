import { describe, expect, it } from 'vitest';

import {
  TRACKING_MODES,
  buildCompletedWorkoutDocument,
  classifyWorkoutDocument,
  isLegacyWorkoutDocument,
  isMalformedV2WorkoutDocument,
  isValidCatalogExercise,
  isValidV2ExerciseOccurrence,
  isValidV2WorkoutDocument,
  isValidV2WorkoutEnvelope,
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
    expect(classifyWorkoutDocument(malformedOccurrence)).toBe('malformed-v2');

    expect(isLegacyWorkoutDocument({ date: '2020-01-01', exercises: [] })).toBe(true);
    expect(isLegacyWorkoutDocument({ schemaVersion: undefined, exercises: [] })).toBe(false);
    expect(classifyWorkoutDocument({ schemaVersion: 1, exercises: [] })).toBe('malformed-v2');
    expect(isMalformedV2WorkoutDocument({ schemaVersion: 1, exercises: [] })).toBe(true);
    expect(classifyWorkoutDocument({ schemaVersion: 99, exercises: [] })).toBe('malformed-v2');
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
});
