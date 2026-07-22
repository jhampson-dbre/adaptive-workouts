import { describe, expect, it } from 'vitest';

import {
  buildCanonicalV4WorkoutDocument,
  canonicalizeWorkoutV4,
  fingerprintWorkoutV4,
} from '../utils/workoutFingerprint';

const workoutId = '123e4567-e89b-42d3-a456-426614174000';
const input = {
  workoutId,
  finishRequestedAtEpochMs: Date.parse('2026-07-22T12:00:00.000Z'),
  phaseTargets: { warmupSeconds: 600, performanceSeconds: 1200, cooldownSeconds: 300 },
  phaseActualSeconds: { warmup: 60, performance: 120, cooldown: 30 },
  exercises: [{
    id: 'plank', occurrenceId: 'plank:0', name: 'Plank', muscleGroup: 'Core', tier: 1,
    trackingMode: 'simple', sets: 1, prescribedSetCount: 1,
    setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 30, actualRestSeconds: null }],
  }],
};

describe('canonical v4 workout fingerprint', () => {
  it('builds an exact ordered candidate and canonical JSON', () => {
    const candidate = buildCanonicalV4WorkoutDocument(input);
    expect(candidate).toEqual({
      id: workoutId, schemaVersion: 4, status: 'completed', date: '2026-07-22T12:00:00.000Z',
      actualDurationSeconds: 210,
      phaseDurations: {
        warmup: { plannedSeconds: 600, actualSeconds: 60 },
        performance: { plannedSeconds: 1200, actualSeconds: 120 },
        cooldown: { plannedSeconds: 300, actualSeconds: 30 },
      },
      exercises: input.exercises,
    });
    expect(canonicalizeWorkoutV4(candidate)).toBe('{"id":"123e4567-e89b-42d3-a456-426614174000","schemaVersion":4,"status":"completed","date":"2026-07-22T12:00:00.000Z","actualDurationSeconds":210,"phaseDurations":{"warmup":{"plannedSeconds":600,"actualSeconds":60},"performance":{"plannedSeconds":1200,"actualSeconds":120},"cooldown":{"plannedSeconds":300,"actualSeconds":30}},"exercises":[{"id":"plank","occurrenceId":"plank:0","name":"Plank","muscleGroup":"Core","tier":1,"trackingMode":"simple","sets":1,"prescribedSetCount":1,"setRecords":[{"index":0,"completed":true,"plannedRestSeconds":null,"workDurationSeconds":30,"actualRestSeconds":null}]}]}');
  });

  it('pins SHA-256 to canonical UTF-8 bytes and includes the stable ID', async () => {
    const candidate = buildCanonicalV4WorkoutDocument(input);
    await expect(fingerprintWorkoutV4(candidate)).resolves.toEqual({
      canonicalization: 'workout-v4-json-v1', algorithm: 'SHA-256',
      hex: 'd3f12d3b36be0dcc156c373e1d25964bb16d89ccf987a4adb363fb26f1848311',
    });
    const changedId = { ...candidate, id: '123e4567-e89b-42d3-a456-426614174001' };
    expect(canonicalizeWorkoutV4(changedId)).toBe('{"id":"123e4567-e89b-42d3-a456-426614174001","schemaVersion":4,"status":"completed","date":"2026-07-22T12:00:00.000Z","actualDurationSeconds":210,"phaseDurations":{"warmup":{"plannedSeconds":600,"actualSeconds":60},"performance":{"plannedSeconds":1200,"actualSeconds":120},"cooldown":{"plannedSeconds":300,"actualSeconds":30}},"exercises":[{"id":"plank","occurrenceId":"plank:0","name":"Plank","muscleGroup":"Core","tier":1,"trackingMode":"simple","sets":1,"prescribedSetCount":1,"setRecords":[{"index":0,"completed":true,"plannedRestSeconds":null,"workDurationSeconds":30,"actualRestSeconds":null}]}]}');
    await expect(fingerprintWorkoutV4(changedId)).resolves.toEqual({ canonicalization: 'workout-v4-json-v1', algorithm: 'SHA-256', hex: 'af5182b57fa2800a468ced8610a76cc7029e6163a46574a5a2dfc4eb97354404' });
  });

  it('rejects noncanonical IDs, dates, unknown fields, and blanks before hashing', () => {
    expect(() => buildCanonicalV4WorkoutDocument({ ...input, workoutId: 'not-a-uuid' })).toThrow();
    expect(() => canonicalizeWorkoutV4({ ...buildCanonicalV4WorkoutDocument(input), date: '2026-07-22' })).toThrow();
    expect(() => canonicalizeWorkoutV4({ ...buildCanonicalV4WorkoutDocument(input), extra: true })).toThrow();
  });

  it('accepts literal text containing undefined and pins its digest', async () => {
    const literal = buildCanonicalV4WorkoutDocument({ ...input, exercises: [{ ...input.exercises[0], name: 'undefined' }] });
    expect(canonicalizeWorkoutV4(literal)).toContain('"name":"undefined"');
    await expect(fingerprintWorkoutV4(literal)).resolves.toMatchObject({ hex: 'ae1c09f4c59420971cbc89e563c7af4e8d248477d63d23affce22de6eaba0cad' });
  });

  it('pins complete weighted Unicode/backoff canonical bytes and digest as literals', async () => {
    const common = { workoutId: '123e4567-e89b-42d3-a456-426614174004', finishRequestedAtEpochMs: Date.parse('2026-07-22T12:00:00.000Z'), phaseTargets: { warmupSeconds: 0, performanceSeconds: 60, cooldownSeconds: 0 }, phaseActualSeconds: { warmup: 0, performance: 1, cooldown: 0 } };
    const weighted = buildCanonicalV4WorkoutDocument({ ...common, exercises: [{ id: 'bench', occurrenceId: 'bench:0', name: 'Bênch "\\', muscleGroup: 'Chest', tier: 1, linkedTo: null, isActive: true, trackingMode: 'weighted', sets: 3, prescribedSetCount: 3, startingWeight: 100, targetReps: 8, floorReps: 5, weightStep: 5, setRecords: [
      { index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 1, actualRestSeconds: 0, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8, recommendationReason: { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' } },
      { index: 1, completed: true, plannedRestSeconds: 60, workDurationSeconds: 0, actualRestSeconds: 0, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8, recommendationReason: { recommendedWeight: 100, reasonCode: 'BACKOFF_FLOOR_MET', sourceActualWeight: 100, sourceActualReps: 8, floorReps: 5, weightStep: 5, dropSteps: 0, rawWeight: 100, sessionTopTarget: 100, priorTargetCeiling: 100 } },
      { index: 2, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8, recommendationReason: { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' } },
    ] }] });
    const bodyweight = buildCanonicalV4WorkoutDocument({ ...common, workoutId: '123e4567-e89b-42d3-a456-426614174005', exercises: [{ id: 'pullup', occurrenceId: 'pullup:0', name: 'Pull Up', muscleGroup: 'Back', tier: 1, trackingMode: 'bodyweight', sets: 1, prescribedSetCount: 1, targetReps: 8, setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 1, actualRestSeconds: null, targetReps: 8, fullReps: 8, assistedReps: 0, eccentricReps: 0 }] }] });
    expect(canonicalizeWorkoutV4(weighted)).toBe(String.raw`{"id":"123e4567-e89b-42d3-a456-426614174004","schemaVersion":4,"status":"completed","date":"2026-07-22T12:00:00.000Z","actualDurationSeconds":1,"phaseDurations":{"warmup":{"plannedSeconds":0,"actualSeconds":0},"performance":{"plannedSeconds":60,"actualSeconds":1},"cooldown":{"plannedSeconds":0,"actualSeconds":0}},"exercises":[{"id":"bench","occurrenceId":"bench:0","name":"Bênch \"\\","muscleGroup":"Chest","tier":1,"linkedTo":null,"isActive":true,"trackingMode":"weighted","sets":3,"prescribedSetCount":3,"startingWeight":100,"targetReps":8,"floorReps":5,"weightStep":5,"setRecords":[{"index":0,"completed":true,"plannedRestSeconds":60,"workDurationSeconds":1,"actualRestSeconds":0,"targetWeight":100,"targetReps":8,"actualWeight":100,"actualReps":8,"recommendationReason":{"decision":"starting","sourceWorkoutId":null,"sourceWorkoutDate":null,"sourceAnchorWeight":null,"appliedWeightStep":0,"recommendedWeight":100,"reasonCode":"STARTING_NO_ANCHOR"}},{"index":1,"completed":true,"plannedRestSeconds":60,"workDurationSeconds":0,"actualRestSeconds":0,"targetWeight":100,"targetReps":8,"actualWeight":100,"actualReps":8,"recommendationReason":{"recommendedWeight":100,"reasonCode":"BACKOFF_FLOOR_MET","sourceActualWeight":100,"sourceActualReps":8,"floorReps":5,"weightStep":5,"dropSteps":0,"rawWeight":100,"sessionTopTarget":100,"priorTargetCeiling":100}},{"index":2,"completed":false,"plannedRestSeconds":null,"workDurationSeconds":null,"actualRestSeconds":null,"targetWeight":100,"targetReps":8,"actualWeight":100,"actualReps":8,"recommendationReason":{"recommendedWeight":100,"reasonCode":"BACKOFF_AWAITING_PRIOR_SET"}}]}]}`);
    await expect(fingerprintWorkoutV4(weighted)).resolves.toMatchObject({ hex: '1ce502a40dda1b78c5cbc0b22db2b9f069db66b71eb396cab938226199fcce6d' });
    expect(canonicalizeWorkoutV4(bodyweight)).toBe('{"id":"123e4567-e89b-42d3-a456-426614174005","schemaVersion":4,"status":"completed","date":"2026-07-22T12:00:00.000Z","actualDurationSeconds":1,"phaseDurations":{"warmup":{"plannedSeconds":0,"actualSeconds":0},"performance":{"plannedSeconds":60,"actualSeconds":1},"cooldown":{"plannedSeconds":0,"actualSeconds":0}},"exercises":[{"id":"pullup","occurrenceId":"pullup:0","name":"Pull Up","muscleGroup":"Back","tier":1,"trackingMode":"bodyweight","sets":1,"prescribedSetCount":1,"targetReps":8,"setRecords":[{"index":0,"completed":true,"plannedRestSeconds":null,"workDurationSeconds":1,"actualRestSeconds":null,"targetReps":8,"fullReps":8,"assistedReps":0,"eccentricReps":0}]}]}');
    await expect(fingerprintWorkoutV4(bodyweight)).resolves.toMatchObject({ hex: '4a1b42d63cdbc5262031287597f2f4e0195d8b8dcf2b804a6d46fe575a565bf0' });
  });
});
