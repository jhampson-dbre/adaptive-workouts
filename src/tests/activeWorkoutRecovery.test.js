import { describe, expect, it } from 'vitest';
import { createRecoveryDraft, migrateRecoveryDraftV1ToV2, projectActiveWorkoutForRecovery, readRecoveryDraft, readRecoveryDraftAsync, recoveryStorageKey } from '../utils/activeWorkoutRecovery';
import { buildCanonicalV4WorkoutDocument } from '../utils/workoutFingerprint';
import { prepareImmutableSave } from '../utils/immutableWorkoutSave';
import { PROGRESSION_REASON_CODES } from '../utils/progression';
import { activeWorkoutReducer, initializeActiveWorkout } from '../utils/activeWorkout';

const id = '123e4567-e89b-12d3-a456-426614174000';
const identity = { projectId: 'project/a', uid: 'user:b' };
const workout = {
  phase: 'warmup', workoutStartedAt: 1000, activeWorkTimer: null, _nextTimerId: 1,
  phaseLedger: { closedMilliseconds: { warmup: 0, performance: 0, cooldown: 0 }, closedSeconds: { warmup: 0, performance: 0, cooldown: 0 }, openPhase: 'warmup', openedAtEpochMs: 1000, lastAcceptedEpochMs: 1000 },
  phaseCandidate: null, _cooldownUndoTarget: null,
  exercises: [{ id: 'squat', occurrenceId: 'squat:0', name: 'Squat', muscleGroup: 'Legs', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false, setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }] }],
};
const targets = { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 };
const clone = value => structuredClone(value);
function draftFor(activeWorkout = workout, overrides = {}) {
  return createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: targets, activeWorkout, ...overrides });
}
function disposition(draft) {
  return readRecoveryDraft({ storage: { getItem: () => JSON.stringify(draft) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 }).status;
}
function performanceWorkout(exercise) {
  return {
    ...clone(workout), phase: 'performance',
    phaseLedger: { ...clone(workout.phaseLedger), openPhase: 'performance' },
    exercises: [exercise],
  };
}
function weightedWorkout() {
  const topReason = { decision: 'increase', sourceWorkoutId: 'history-1', sourceWorkoutDate: '2026-07-01T00:00:00.000Z', sourceAnchorWeight: 95, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'INCREASE_ALL_SETS_QUALIFIED' };
  const record = (index, values) => ({ index, completed: false, plannedRestSeconds: index === 2 ? null : 60, workDurationSeconds: null, actualRestSeconds: null, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8, _activeDirty: { actualWeight: false, actualReps: false }, recommendationReason: values });
  return performanceWorkout({ id: 'bench', occurrenceId: 'bench:0', name: 'Bench', muscleGroup: 'Chest', tier: 1, trackingMode: 'weighted', sets: 3, prescribedSetCount: 3, startingWeight: 95, targetReps: 8, floorReps: 6, weightStep: 5, setRecords: [
    record(0, topReason),
    record(1, { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }),
    record(2, { recommendedWeight: 100, reasonCode: 'BACKOFF_FLOOR_MET', sourceActualWeight: 100, sourceActualReps: 8, floorReps: 6, weightStep: 5, dropSteps: 0, rawWeight: 100, sessionTopTarget: 100, priorTargetCeiling: 100 }),
  ] });
}
function topOnlyWorkout(reason, targetWeight = reason.recommendedWeight, startingWeight = 95) {
  const state = weightedWorkout(); const exercise = state.exercises[0];
  exercise.sets = 1; exercise.prescribedSetCount = 1; exercise.startingWeight = startingWeight;
  exercise.setRecords = [{ ...exercise.setRecords[0], plannedRestSeconds: null, targetWeight, recommendationReason: reason }];
  return state;
}
function reviewWorkout() {
  return { ...clone(workout), phase: 'review', phaseLedger: { ...clone(workout.phaseLedger), openPhase: null, openedAtEpochMs: null }, phaseCandidate: { phaseActualSeconds: { warmup: 0, performance: 0, cooldown: 0 }, actualDurationSeconds: 0, finishRequestedAtEpochMs: 1000 } };
}

describe('active workout recovery', () => {
  it('A6 reads strict v2/null state asynchronously and migrates v1 in the same slot', async () => {
    const v1 = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const v2 = migrateRecoveryDraftV1ToV2(v1, 1200);
    expect(v2).toMatchObject({ version: 2, pendingSave: null, lastMutationAtEpochMs: 1200 });
    await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(v2) }, ...identity, nowEpochMs: 1200, staleAfterMs: 1 })).resolves.toMatchObject({ status: 'resumable', draft: { version: 2 } });
  });

  it('A6 rejects a v2 candidate or digest tamper before hydration', async () => {
    const state = reviewWorkout();
    state.exercises[0].completed = true;
    state.exercises[0].setRecords[0] = { ...state.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
    state._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0 };
    const v1 = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: state });
    const v2 = migrateRecoveryDraftV1ToV2(v1, 1000);
    const workoutId = '123e4567-e89b-42d3-a456-426614174000';
    const candidate = buildCanonicalV4WorkoutDocument({ workoutId, finishRequestedAtEpochMs: 1000, phaseTargets: v2.phaseTargets, phaseActualSeconds: state.phaseCandidate.phaseActualSeconds, exercises: state.exercises });
    v2.pendingSave = await prepareImmutableSave({ workoutId, candidate });
    await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(v2) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toMatchObject({ status: 'resumable', draft: { version: 2 } });
    const candidateTamper = structuredClone(v2); candidateTamper.pendingSave.candidate.exercises[0].name = 'Tampered';
    await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(candidateTamper) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toEqual({ status: 'malformed' });
    const digestTamper = structuredClone(v2); digestTamper.pendingSave.fingerprint.hex = '0'.repeat(64);
    await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(digestTamper) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toEqual({ status: 'malformed' });
    await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(v2) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1, subtle: null })).resolves.toEqual({ status: 'fingerprint-error' });
    for (const value of [-1, 1.5, '1', undefined]) {
      const badAttempt = structuredClone(v2); Object.assign(badAttempt.pendingSave, { state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: value, lastReconciliationAtEpochMs: null });
      await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(badAttempt) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toEqual({ status: 'malformed' });
      const badWriteReconciliation = structuredClone(v2); Object.assign(badWriteReconciliation.pendingSave, { state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: 1, lastReconciliationAtEpochMs: value });
      await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(badWriteReconciliation) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toEqual({ status: 'malformed' });
      for (const stateName of ['retryable-absent', 'reconcile-indeterminate', 'blocked-conflict']) {
        const badRequiredReconciliation = structuredClone(v2); Object.assign(badRequiredReconciliation.pendingSave, { state: stateName, attemptCount: 1, lastAttemptAtEpochMs: 1, lastReconciliationAtEpochMs: value });
        await expect(readRecoveryDraftAsync({ storage: { getItem: () => JSON.stringify(badRequiredReconciliation) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 })).resolves.toEqual({ status: 'malformed' });
      }
    }
  });

  it('rejects invalid caller identity before storage access', () => {
    let accessed = false;
    expect(readRecoveryDraft({ storage: { getItem: () => { accessed = true; } }, projectId: '', uid: 'u', nowEpochMs: 1, staleAfterMs: 1 })).toEqual({ status: 'invalid-identity' });
    expect(accessed).toBe(false);
    expect(() => recoveryStorageKey({ projectId: '', uid: 'u' })).toThrow(TypeError);
  });
  it('serializes an allowlisted identity-keyed v1 DTO and deep-freezes a resumable hydrate', () => {
    expect(recoveryStorageKey(identity)).toBe('adaptive-workouts:active-workout:v1:project%2Fa:user%3Ab');
    const draft = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 600, cooldownSeconds: 0 }, activeWorkout: workout });
    const storage = { getItem: () => JSON.stringify(draft) };
    const result = readRecoveryDraft({ storage, ...identity, nowEpochMs: 2000, staleAfterMs: 2000 });
    expect(result.status).toBe('resumable');
    expect(result.draft).not.toHaveProperty('_phaseTimingEnabled');
    expect(result.hydrated._phaseTimingEnabled).toBe(true);
    expect(Object.isFrozen(result.hydrated)).toBe(true);
  });

  it('classifies versions, identity, malformed data, and staleness without partial hydration', () => {
    const base = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const storage = { getItem: () => JSON.stringify(base) };
    expect(readRecoveryDraft({ storage, ...identity, nowEpochMs: 3001, staleAfterMs: 2000 }).status).toBe('stale');
    expect(readRecoveryDraft({ storage: { getItem: () => '{' }, ...identity, nowEpochMs: 1, staleAfterMs: 1 }).status).toBe('malformed');
    expect(readRecoveryDraft({ storage: { getItem: () => JSON.stringify({ ...base, version: 2 }) }, ...identity, nowEpochMs: 1, staleAfterMs: 1 }).status).toBe('unsupported-version');
    expect(readRecoveryDraft({ storage: { getItem: () => JSON.stringify({ ...base, uid: 'other' }) }, ...identity, nowEpochMs: 1, staleAfterMs: 1 }).status).toBe('wrong-user');
  });

  it('C-05 rejects a persisted pre-Start Generated draft', () => {
    const generated = {
      ...clone(workout), phase: 'generated', workoutStartedAt: null, phaseLedger: null,
    };
    expect(disposition(draftFor(generated))).toBe('malformed');
  });

  it('never serializes unknown or sensitive reducer fields', () => {
    const draft = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: { ...workout, secret: 'nope', exercises: [{ ...workout.exercises[0], providerData: 'nope', setRecords: [{ ...workout.exercises[0].setRecords[0], _activeBogus: true }] }] } });
    expect(JSON.stringify(draft)).not.toContain('nope');
    expect(JSON.stringify(draft)).not.toContain('_activeBogus');
  });

  it('exports the same strict runtime-to-recovery projection used for draft creation', () => {
    const runtime = { ...weightedWorkout(), runtimeOnly: 'nope', exercises: [{ ...weightedWorkout().exercises[0], dynamicTier: 99, setRecords: [{ ...weightedWorkout().exercises[0].setRecords[0], providerData: 'nope' }] }] };
    expect(projectActiveWorkoutForRecovery(runtime)).toEqual(draftFor(runtime).activeWorkout);
    expect(projectActiveWorkoutForRecovery(runtime).exercises[0]).not.toHaveProperty('dynamicTier');
    expect(JSON.stringify(projectActiveWorkoutForRecovery(runtime))).not.toContain('nope');
  });

  it('projects a runtime performance work timer into a valid recovery draft', () => {
    const started = activeWorkoutReducer(initializeActiveWorkout([{ ...workout.exercises[0], dynamicTier: 99 }], { phaseTimingEnabled: true }), { type: 'startWorkout', timestamp: 1000 });
    const performance = activeWorkoutReducer(started, { type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
    expect(disposition(draftFor(performance))).toBe('resumable');
  });

  it('C-04 rejects whole-envelope phase, candidate, and timer violations without hydrating', () => {
    const draft = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const check = activeWorkout => readRecoveryDraft({ storage: { getItem: () => JSON.stringify({ ...draft, activeWorkout }) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 }).status;
    expect(check({ ...draft.activeWorkout, phase: 'warmup', activeWorkTimer: { id: 'work-1', occurrenceId: 'squat:0', exerciseIndex: 0, setIndex: 0, startedAtEpochMs: 1000 } })).toBe('malformed');
    expect(check({ ...draft.activeWorkout, phase: 'review', phaseLedger: { ...draft.activeWorkout.phaseLedger, openPhase: null, openedAtEpochMs: null }, phaseCandidate: { phaseActualSeconds: { warmup: 0, performance: 0, cooldown: 0 }, actualDurationSeconds: 1, finishRequestedAtEpochMs: 1000 } })).toBe('malformed');
  });

  it('rejects a Performance projection carrying a Cooldown/Review-only undo target', () => {
    const performance = clone(workout); performance.phase = 'performance'; performance.phaseLedger.openPhase = 'performance'; performance._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0 };
    expect(disposition(draftFor(performance))).toBe('malformed');
  });

  it('resumes v1 Review with a valid retained final-set undo target and rejects invalid Review targets', () => {
    const review = reviewWorkout(); review.exercises[0].completed = true;
    review.exercises[0].setRecords[0] = { ...review.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
    review._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0 };
    expect(disposition(draftFor(review))).toBe('resumable');
    for (const target of [{ exerciseIndex: 1, setIndex: 0 }, { exerciseIndex: 0, setIndex: 1 }, { exerciseIndex: 0, setIndex: 0, extra: true }]) {
      expect(disposition(draftFor({ ...review, _cooldownUndoTarget: target }))).toBe('malformed');
    }
    const incomplete = clone(review); incomplete.exercises[0].completed = false; incomplete.exercises[0].setRecords[0] = { ...incomplete.exercises[0].setRecords[0], completed: false, workDurationSeconds: null };
    expect(disposition(draftFor(incomplete))).toBe('malformed');
  });

  it('resumes v1 Cooldown with a valid final-set undo target and rejects a completed non-final target', () => {
    const cooldown = clone(workout); cooldown.phase = 'cooldown'; cooldown.phaseLedger.openPhase = 'cooldown'; cooldown.exercises[0].completed = true;
    cooldown.exercises[0].setRecords[0] = { ...cooldown.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
    cooldown._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0 };
    expect(disposition(draftFor(cooldown))).toBe('resumable');

    const nonFinal = clone(cooldown); nonFinal.exercises[0].sets = 2; nonFinal.exercises[0].prescribedSetCount = 2;
    nonFinal.exercises[0].setRecords = [
      { index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 0, actualRestSeconds: 0 },
      { index: 1, completed: true, plannedRestSeconds: null, workDurationSeconds: 0, actualRestSeconds: null },
    ];
    nonFinal._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0 };
    expect(disposition(draftFor(nonFinal))).toBe('malformed');
  });

  it('validates weighted top recommendation source rules and target equality', () => {
    const weighted = { ...workout, exercises: [{ id: 'bench', occurrenceId: 'bench:0', name: 'Bench', muscleGroup: 'Chest', tier: 1, trackingMode: 'weighted', sets: 1, prescribedSetCount: 1, startingWeight: 100, targetReps: 8, floorReps: 6, weightStep: 5, setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, targetWeight: 100, targetReps: 8, actualWeight: 100, actualReps: 8, _activeDirty: { actualWeight: false, actualReps: false }, recommendationReason: { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: PROGRESSION_REASON_CODES.STARTING_NO_ANCHOR } }] }] };
    const draft = createRecoveryDraft({ ...identity, draftId: id, ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: weighted });
    const check = value => readRecoveryDraft({ storage: { getItem: () => JSON.stringify(value) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 }).status;
    expect(check(draft)).toBe('resumable');
    expect(check({ ...draft, activeWorkout: { ...draft.activeWorkout, exercises: [{ ...draft.activeWorkout.exercises[0], setRecords: [{ ...draft.activeWorkout.exercises[0].setRecords[0], recommendationReason: { ...draft.activeWorkout.exercises[0].setRecords[0].recommendationReason, recommendedWeight: 99 } }] }] } })).toBe('malformed');
  });

  it.each([
    ['starting', { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 95, reasonCode: 'STARTING_NO_ANCHOR' }, 95, 95],
    ['increase', { decision: 'increase', sourceWorkoutId: 'history-1', sourceWorkoutDate: '2026-07-01T00:00:00.000Z', sourceAnchorWeight: 95, appliedWeightStep: 5, recommendedWeight: 100, reasonCode: 'INCREASE_ALL_SETS_QUALIFIED' }, 100, 95],
    ['hold', { decision: 'hold', sourceWorkoutId: 'history-1', sourceWorkoutDate: '2026-07-01T00:00:00.000Z', sourceAnchorWeight: 95, appliedWeightStep: 0, recommendedWeight: 95, reasonCode: 'HOLD_TOP_BELOW_TARGET' }, 95, 95],
    ['decrease', { decision: 'decrease', sourceWorkoutId: 'history-1', sourceWorkoutDate: '2026-07-01T00:00:00.000Z', sourceAnchorWeight: 95, appliedWeightStep: 5, recommendedWeight: 90, reasonCode: 'DECREASE_TOP_BELOW_FLOOR' }, 90, 95],
  ])('C-01 resumes the valid weighted top-set %s recommendation', (_name, reason, targetWeight, startingWeight) => {
    expect(disposition(draftFor(topOnlyWorkout(reason, targetWeight, startingWeight)))).toBe('resumable');
  });

  it.each([
    ['unknown reason', reason => { reason.reasonCode = 'NOPE'; }],
    ['decision/reason mismatch', reason => { reason.reasonCode = 'DECREASE_TOP_BELOW_FLOOR'; }],
    ['starting source', reason => { Object.assign(reason, { decision: 'starting', reasonCode: 'STARTING_NO_ANCHOR', sourceWorkoutId: 'history', sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 95 }); }],
    ['non-start empty source ID', reason => { reason.sourceWorkoutId = ''; }],
    ['non-start invalid source date', reason => { reason.sourceWorkoutDate = 'not-a-date'; }],
    ['non-start invalid source anchor', reason => { reason.sourceAnchorWeight = -1; }],
    ['wrong applied step', reason => { reason.appliedWeightStep = 0; }],
    ['target mismatch', reason => { reason.recommendedWeight = 101; }],
    ['unknown recommendation key', reason => { reason.unexpected = true; }],
  ])('C-04 rejects weighted top-set %s', (_name, mutate) => {
    const state = weightedWorkout(); mutate(state.exercises[0].setRecords[0].recommendationReason);
    expect(disposition(draftFor(state))).toBe('malformed');
  });

  it.each([
    ['awaiting prior set', state => { state.exercises[0].setRecords[2].recommendationReason = { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' }; }],
    ['computed floor met', () => {}],
    ['computed below floor', state => { const record = state.exercises[0].setRecords[1]; record.actualReps = 4; const reason = state.exercises[0].setRecords[2].recommendationReason; Object.assign(reason, { reasonCode: 'BACKOFF_BELOW_FLOOR', sourceActualReps: 4, dropSteps: 2, rawWeight: 90, recommendedWeight: 90 }); state.exercises[0].setRecords[2].targetWeight = 90; }],
  ])('C-01 resumes valid weighted later-set %s', (_name, mutate) => {
    const state = weightedWorkout(); mutate(state); expect(disposition(draftFor(state))).toBe('resumable');
  });

  it.each([
    ['wrong reason literal', reason => { reason.reasonCode = 'BACKOFF_BELOW_FLOOR'; }],
    ['floor mismatch', reason => { reason.floorReps = 7; }],
    ['step mismatch', reason => { reason.weightStep = 4; }],
    ['session top mismatch', reason => { reason.sessionTopTarget = 99; }],
    ['prior ceiling mismatch', reason => { reason.priorTargetCeiling = 99; }],
    ['drop mismatch', reason => { reason.dropSteps = 1; }],
    ['raw arithmetic mismatch', reason => { reason.rawWeight = 99; }],
    ['recommended arithmetic mismatch', reason => { reason.recommendedWeight = 99; }],
  ])('C-04 rejects computed backoff %s', (_name, mutate) => {
    const state = weightedWorkout(); mutate(state.exercises[0].setRecords[2].recommendationReason);
    expect(disposition(draftFor(state))).toBe('malformed');
  });

  it('C-04 rejects a computed backoff whose source does not equal its preceding completed-detail values', () => {
    const draft = draftFor(weightedWorkout());
    expect(disposition(draft)).toBe('resumable');
    const corrupted = clone(draft);
    corrupted.activeWorkout.exercises[0].setRecords[2].recommendationReason.sourceActualReps = 6;
    expect(disposition(corrupted)).toBe('malformed');
  });

  it('keeps a preserved computed backoff resumable after preceding completed actuals become blank', () => {
    const state = weightedWorkout(); const preceding = state.exercises[0].setRecords[1]; Object.assign(preceding, { completed: true, workDurationSeconds: 1, actualRestSeconds: 1, actualWeight: '', actualReps: '' }); state.exercises[0].setRecords[0].completed = true; state.exercises[0].setRecords[0].workDurationSeconds = 1; state.exercises[0].setRecords[0].actualRestSeconds = 1;
    expect(disposition(draftFor(state))).toBe('resumable');
  });

  it('accepts decimal weighted actualWeight but rejects fractional actualReps', () => {
    const draft = draftFor(weightedWorkout()); draft.activeWorkout.exercises[0].setRecords[0].actualWeight = 95.5;
    expect(disposition(draft)).toBe('resumable');
    draft.activeWorkout.exercises[0].setRecords[0].actualReps = 7.5;
    expect(disposition(draft)).toBe('malformed');
  });

  it('C-01 roundtrips active rest, dirty weighted fields, blank completed actuals, and the frozen Review finish timestamp', () => {
    const state = weightedWorkout(); const first = state.exercises[0].setRecords[0];
    Object.assign(first, { completed: true, workDurationSeconds: 10, actualRestSeconds: 7, actualWeight: '', actualReps: '', _activeDirty: { actualWeight: true, actualReps: true } });
    const second = state.exercises[0].setRecords[1]; Object.assign(second, { completed: true, workDurationSeconds: 10, actualRestSeconds: null, _activeRest: { id: 'rest-1', startedAt: 1010 } }); state._nextTimerId = 2;
    const persisted = draftFor(state); const result = readRecoveryDraft({ storage: { getItem: () => JSON.stringify(persisted) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 });
    expect(result.status).toBe('resumable');
    expect(persisted.activeWorkout.exercises[0].setRecords[0].inputDirty).toEqual({ actualWeight: true, actualReps: true });
    expect(persisted.activeWorkout.exercises[0].setRecords[1].activeRest).toEqual({ id: 'rest-1', startedAtEpochMs: 1010 });
    expect(result.hydrated.exercises[0].setRecords[0]).toMatchObject({ actualWeight: '', actualReps: '', _activeDirty: { actualWeight: true, actualReps: true } });
    expect(result.hydrated.exercises[0].setRecords[1]._activeRest).toEqual({ id: 'rest-1', startedAt: 1010 });
    const review = readRecoveryDraft({ storage: { getItem: () => JSON.stringify(draftFor(reviewWorkout())) }, ...identity, nowEpochMs: 1000, staleAfterMs: 1 });
    expect(review.hydrated.phaseCandidate.finishRequestedAtEpochMs).toBe(1000);
  });

  it('C-01 keeps blank completed bodyweight details resumable', () => {
    const bodyweight = performanceWorkout({ id: 'pullup', occurrenceId: 'pullup:0', name: 'Pull-up', muscleGroup: 'Back', tier: 1, trackingMode: 'bodyweight', sets: 1, prescribedSetCount: 1, targetReps: 8, setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 10, actualRestSeconds: null, targetReps: 8, fullReps: '', assistedReps: '', eccentricReps: '' }] });
    expect(disposition(draftFor(bodyweight))).toBe('resumable');
  });

  it.each([
    ['work timer wrong occurrence', state => { state.activeWorkTimer = { id: 'work-1', occurrenceId: 'other', exerciseIndex: 0, setIndex: 0, startedAtEpochMs: 1000 }; state._nextTimerId = 2; }],
    ['work timer string index', state => { state.activeWorkTimer = { id: 'work-1', occurrenceId: 'squat:0', exerciseIndex: '0', setIndex: 0, startedAtEpochMs: 1000 }; state._nextTimerId = 2; }],
    ['work timer completed record', state => { state.phase = 'performance'; state.phaseLedger.openPhase = 'performance'; state.exercises[0].setRecords[0] = { ...state.exercises[0].setRecords[0], completed: true, workDurationSeconds: 1 }; state.activeWorkTimer = { id: 'work-1', occurrenceId: 'squat:0', exerciseIndex: 0, setIndex: 0, startedAtEpochMs: 1000 }; state._nextTimerId = 2; }],
    ['duplicate timer IDs', state => { state.phase = 'performance'; state.phaseLedger.openPhase = 'performance'; state.exercises[0].sets = 2; state.exercises[0].prescribedSetCount = 2; state.exercises[0].setRecords = [{ ...state.exercises[0].setRecords[0], plannedRestSeconds: 60, completed: true, workDurationSeconds: 1, actualRestSeconds: null, activeRest: { id: 'rest-1', startedAtEpochMs: 1000 } }, { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, activeRest: null }]; state.activeWorkTimer = { id: 'rest-1', occurrenceId: 'squat:0', exerciseIndex: 0, setIndex: 1, startedAtEpochMs: 1000 }; state.nextTimerId = 2; }],
    ['timer suffix at next timer', state => { state.phase = 'performance'; state.phaseLedger.openPhase = 'performance'; state.activeWorkTimer = { id: 'work-1', occurrenceId: 'squat:0', exerciseIndex: 0, setIndex: 0, startedAtEpochMs: 1000 }; state.nextTimerId = 1; }],
  ])('C-04 rejects referential timer violation: %s', (_name, mutate) => {
    const state = clone(workout); mutate(state); expect(disposition(draftFor(state))).toBe('malformed');
  });

  it.each([
    ['unknown envelope key', draft => { draft.extra = true; }],
    ['missing envelope key', draft => { delete draft.pendingSave; }],
    ['noncanonical warmup target', draft => { draft.phaseTargets.warmupSeconds = 61; }],
    ['non-null pending save', draft => { draft.pendingSave = {}; }],
    ['invalid UUID', draft => { draft.draftId = 'not-a-uuid'; }],
    ['zero generation', draft => { draft.ownershipGeneration = 0; }],
    ['unknown record key', draft => { draft.activeWorkout.exercises[0].setRecords[0].extra = true; }],
    ['simple completion mismatch', draft => { draft.activeWorkout.exercises[0].completed = true; }],
  ])('C-04 rejects exact v1 projection violation: %s', (_name, mutate) => {
    const draft = draftFor(); mutate(draft); expect(disposition(draft)).toBe('malformed');
  });

  it('C-05 rejects a non-final confirmed record with neither resolved nor active rest and an invalid cooldown undo target', () => {
    const state = clone(workout); state.phase = 'performance'; state.phaseLedger.openPhase = 'performance'; state.exercises[0].sets = 2; state.exercises[0].prescribedSetCount = 2; state.exercises[0].setRecords = [{ index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 1, actualRestSeconds: null, activeRest: null }, { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, activeRest: null }];
    expect(disposition(draftFor(state))).toBe('malformed');
    const cooldown = clone(workout); cooldown.phase = 'cooldown'; cooldown.phaseLedger.openPhase = 'cooldown'; cooldown.exercises[0].setRecords[0] = { ...cooldown.exercises[0].setRecords[0], completed: true, workDurationSeconds: 1 }; cooldown.exercises[0].completed = true; cooldown._cooldownUndoTarget = { exerciseIndex: 0, setIndex: 0, extra: true };
    expect(disposition(draftFor(cooldown))).toBe('malformed');
  });

  it('C-04 rejects duplicate rest IDs, a rest that is not latest confirmed, and missing exact record keys', () => {
    const records = [
      { index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 1, actualRestSeconds: null, _activeRest: { id: 'rest-1', startedAt: 1000 } },
      { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null },
    ];
    const first = { id: 'a', occurrenceId: 'a:0', name: 'A', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 2, prescribedSetCount: 2, completed: true, setRecords: records };
    const second = { ...clone(first), id: 'b', occurrenceId: 'b:0' };
    const duplicate = performanceWorkout(first); duplicate.exercises.push(second); duplicate._nextTimerId = 2;
    expect(disposition(draftFor(duplicate))).toBe('malformed');
    const late = clone(first); late.sets = 3; late.prescribedSetCount = 3; late.setRecords = [records[0], { index: 1, completed: true, plannedRestSeconds: 60, workDurationSeconds: 1, actualRestSeconds: 1 }, { index: 2, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }];
    expect(disposition(draftFor(performanceWorkout(late)))).toBe('malformed');
    const missing = draftFor(); delete missing.activeWorkout.exercises[0].setRecords[0].activeRest;
    expect(disposition(missing)).toBe('malformed');
  });
});
