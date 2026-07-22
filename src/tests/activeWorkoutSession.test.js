import { expect, test, vi } from 'vitest';
import { createActiveWorkoutSession } from '../utils/activeWorkoutSession';
import { createActiveWorkoutCoordinator } from '../utils/activeWorkoutCoordinator';
import { initializeActiveWorkout } from '../utils/activeWorkout';
import { recoveryStorageKey } from '../utils/activeWorkoutRecovery';

const exercise = { id: 'x', occurrenceId: 'x:0', name: 'X', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false };
const targets = { warmupSeconds: 0, performanceSeconds: 60, cooldownSeconds: 0 };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const locks = () => ({ request: async (_name, _options, callback) => callback({ name: 'lock' }) });
const trackedExercise = mode => {
  const base = { id: mode, occurrenceId: `${mode}:0`, name: mode, muscleGroup: 'Core', tier: 1, dynamicTier: 99, trackingMode: mode, sets: 1, prescribedSetCount: 1 };
  if (mode === 'simple') return { ...base, completed: false };
  if (mode === 'bodyweight') return { ...base, targetReps: 8, setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, targetReps: 8, fullReps: 8, assistedReps: 0, eccentricReps: 0 }] };
  return { ...base, startingWeight: 95, targetReps: 8, floorReps: 6, weightStep: 5, setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null, targetWeight: 95, targetReps: 8, actualWeight: 95, actualReps: 8, recommendationReason: { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 95, reasonCode: 'STARTING_NO_ANCHOR' } }] };
};

test('stages locally, then persists exactly the Warmup projection on first Start', async () => {
  const start = vi.fn(async () => ({ status: 'acquired', snapshot: { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1 } }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'missing' }), start }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  expect(session.getState().status).toBe('idle');
  await expect(session.stageGenerated([exercise], targets)).resolves.toBe(true);
  expect(session.getState()).toMatchObject({ status: 'generated', activeWorkout: { phase: 'generated' }, phaseTargets: targets, snapshot: null });
  expect(start).not.toHaveBeenCalled();
  await expect(session.action({ type: 'startWorkout', timestamp: 1234 })).resolves.toBe(true);
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p', uid: 'u', phaseTargets: targets, activeWorkout: expect.objectContaining({ phase: 'warmup', workoutStartedAt: 1234 }) }));
  await expect(session.action({ type: 'startWorkout', timestamp: 1235 })).resolves.toBe(false);
  expect(start).toHaveBeenCalledTimes(1);
  expect(session.getState()).toMatchObject({ status: 'owned', activeWorkout: { phase: 'warmup', workoutStartedAt: 1234 } });
});

test('does not reset a same-UID session when authorization is re-established', async () => {
  const inspect = vi.fn(async () => ({ status: 'missing' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });

  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([exercise], targets);
  await session.bootstrap({ uid: 'u' });

  expect(inspect).toHaveBeenCalledOnce();
  expect(session.getState()).toMatchObject({ status: 'generated', activeWorkout: { phase: 'generated' } });
});

test('reports whether Resume acquired and published the recovered workout', async () => {
  const recovered = { phase: 'performance', exercises: [exercise], workoutStartedAt: 1234 };
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1, phaseTargets: targets, pendingSave: null };
  const resume = vi.fn(async () => ({ status: 'acquired', hydrated: recovered, snapshot }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: recovered, draft: snapshot }), resume }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });

  await expect(session.resume()).resolves.toBe(true);
  expect(session.getState()).toMatchObject({ status: 'owned', activeWorkout: recovered, blocked: false });
});

test.each(['timeout', 'denied', 'unsupported', 'lost'])('reports false and retains recovery when Resume cannot acquire the draft (%s)', async status => {
  const recovered = { phase: 'warmup', exercises: [exercise], workoutStartedAt: 1234 };
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1, phaseTargets: targets, pendingSave: null };
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: recovered, draft: snapshot }), resume: async () => ({ status }) }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });

  await expect(session.resume()).resolves.toBe(false);
  expect(session.getState()).toMatchObject({ status: 'recovery-blocked', activeWorkout: recovered, error: status, blocked: true });
});

test('keeps the local generated plan visible when Start cannot acquire ownership', async () => {
  const start = vi.fn(async () => ({ status: 'unsupported' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'missing' }), start }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([exercise], targets);
  await expect(session.action({ type: 'startWorkout', timestamp: 1234 })).resolves.toBe(false);
  expect(session.getState()).toMatchObject({ status: 'blocked', activeWorkout: { phase: 'generated' }, error: 'unsupported', blocked: true });
});

test('cancelling a generated plan clears it without attempting a persisted discard', async () => {
  const discard = vi.fn();
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'missing' }), discard }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' }); await session.stageGenerated([exercise], targets); await session.discard();
  expect(session.getState()).toMatchObject({ status: 'idle', activeWorkout: null });
  expect(discard).not.toHaveBeenCalled();
});

test('cooperative handoff releases only the matching owned draft before acknowledging', async () => {
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 3, phaseTargets: targets, pendingSave: null };
  let receive;
  const acceptHandoff = vi.fn(() => ({ status: 'accepted', nonce: 'n' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' }, draft: snapshot }), resume: async () => ({ status: 'acquired', snapshot, hydrated: { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' } }), acceptHandoff }, projectId: 'p', subscribeHandoff: (_identity, handler) => { receive = handler; return () => {}; }, saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' }); await session.resume();
  await expect(receive({ nonce: 'n', draftId: snapshot.draftId, ownershipGeneration: 3 })).resolves.toEqual({ status: 'accepted', nonce: 'n' });
  expect(acceptHandoff).toHaveBeenCalledWith({ projectId: 'p', uid: 'u', nonce: 'n', draftId: snapshot.draftId, ownershipGeneration: 3 });
  expect(session.getState()).toMatchObject({ status: 'recovery-blocked', error: 'handoff-released', blocked: true });
});

test('handoff listener stays silent for stale generation and same-generation non-owner responses', async () => {
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 3, phaseTargets: targets, pendingSave: null };
  let receive; const acceptHandoff = vi.fn(() => ({ status: 'conflict' }));
  const recovered = { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' };
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: recovered, draft: snapshot }), resume: async () => ({ status: 'acquired', hydrated: recovered, snapshot }), acceptHandoff }, projectId: 'p', subscribeHandoff: (_identity, handler) => { receive = handler; return () => {}; }, saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' }); await session.resume();
  await expect(receive({ nonce: 'stale', draftId: snapshot.draftId, ownershipGeneration: 2 })).resolves.toBeUndefined();
  expect(acceptHandoff).not.toHaveBeenCalled();
  await expect(receive({ nonce: 'non-owner', draftId: snapshot.draftId, ownershipGeneration: 3 })).resolves.toBeUndefined();
  expect(acceptHandoff).toHaveBeenCalledOnce();
  expect(session.getState()).toMatchObject({ status: 'owned', blocked: false, error: null });
});

test('requestHandoff publishes acquired ownership after a timeout recovery and retires the blocker', async () => {
  const recovered = { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' };
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1, phaseTargets: targets, pendingSave: null };
  const handoffResume = vi.fn(async () => ({ status: 'acquired', hydrated: recovered, snapshot }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: recovered, draft: snapshot }), handoffResume }, projectId: 'p', createUuid: () => 'nonce', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' }); await session.requestHandoff();
  expect(handoffResume).toHaveBeenCalledWith(expect.objectContaining({ expected: { draftId: snapshot.draftId, ownershipGeneration: 1 }, nonce: 'nonce' }));
  expect(session.getState()).toMatchObject({ status: 'owned', blocked: false, error: null });
});

test.each([
  ['Cancel', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'cancelSet', exerciseIndex: 0, setIndex: 0 }]],
  ['Confirm', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }]],
  ['Undo', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'undoSet', exerciseIndex: 0, setIndex: 0, timestamp: 1003 }]],
  ['Edit', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'editWeightedActual', exerciseIndex: 0, setIndex: 0, field: 'actualReps', value: 7 }]],
  ['phase transition', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'resumeWorkout', timestamp: 1003 }]],
  ['Finish', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'finishWorkout', timestamp: 1003 }]],
  ['Back', [{ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 }, { type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }, { type: 'finishWorkout', timestamp: 1003 }, { type: 'reviewBack', timestamp: 1004 }]],
])('returns true only after each accepted owned %s mutation is persisted', async (_label, actions) => {
  const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: locks(), staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([_label === 'Edit' ? trackedExercise('weighted') : exercise], targets);
  await expect(session.action({ type: 'startWorkout', timestamp: 1000 })).resolves.toBe(true);
  for (const action of actions) await expect(session.action(action)).resolves.toBe(true);
});

test('returns false for no-op and failed coordinator mutations without publishing an optimistic state', async () => {
  const recovered = { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance', workoutStartedAt: 1234 };
  const snapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1, phaseTargets: targets, pendingSave: null };
  const mutate = vi.fn(async () => ({ status: 'denied' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'resumable', hydrated: recovered, draft: snapshot }), resume: async () => ({ status: 'acquired', hydrated: recovered, snapshot }), mutate }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.resume();

  await expect(session.action({ type: 'startWorkout', timestamp: 1235 })).resolves.toBe(false);
  await expect(session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1236 })).resolves.toBe(false);
  expect(mutate).toHaveBeenCalledOnce();
  expect(session.getState()).toMatchObject({ status: 'blocked', activeWorkout: recovered, error: 'denied', blocked: true });
});

test.each(['simple', 'weighted', 'bodyweight'])('persists the strict recovery projection for a %s Start-set mutation', async mode => {
  const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: locks(), staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([trackedExercise(mode)], targets);
  await session.action({ type: 'startWorkout', timestamp: 1000 });
  await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
  expect(session.getState()).toMatchObject({ status: 'owned', error: null, blocked: false, activeWorkout: { phase: 'performance' } });
  expect(session.getState().snapshot.activeWorkout.exercises[0]).not.toHaveProperty('dynamicTier');
});

test('persists cancel, confirm, undo, Review, and Review-back transitions through the shared projection', async () => {
  const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: locks(), staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([{ ...trackedExercise('simple'), dynamicTier: 99 }], targets);
  await session.action({ type: 'startWorkout', timestamp: 1000 });
  await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
  await session.action({ type: 'cancelSet', exerciseIndex: 0, setIndex: 0 });
  await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 });
  await session.action({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1003 });
  expect(session.getState().activeWorkout.phase).toBe('cooldown');
  await session.action({ type: 'undoSet', exerciseIndex: 0, setIndex: 0, timestamp: 1004 });
  await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1005 });
  await session.action({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1006 });
  await session.action({ type: 'finishWorkout', timestamp: 1007 });
  expect(session.getState()).toMatchObject({ status: 'review', activeWorkout: { phase: 'review' }, blocked: false });
  await session.action({ type: 'reviewBack', timestamp: 1008 });
  expect(session.getState()).toMatchObject({ status: 'owned', activeWorkout: { phase: 'cooldown' }, blocked: false, error: null });
});

test('Exit retires a recovery blocker without discarding storage and a later failed Start reopens it', async () => {
  const start = vi.fn(async () => ({ status: 'unsupported' }));
  const discard = vi.fn(async () => ({ status: 'removed' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'missing' }), start, discard }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.stageGenerated([exercise], targets);
  await session.action({ type: 'startWorkout', timestamp: 1234 });
  await session.exit();
  expect(discard).not.toHaveBeenCalled();
  expect(session.getState()).toMatchObject({ status: 'generated', activeWorkout: { phase: 'generated' }, blocked: false, error: null });
  await session.action({ type: 'startWorkout', timestamp: 1235 });
  expect(session.getState()).toMatchObject({ status: 'blocked', activeWorkout: { phase: 'generated' }, error: 'unsupported', blocked: true });
});

test('stale recovery retains its exact identity for Discard without hydration', async () => {
  const draft = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 7 };
  const discard = vi.fn(async () => ({ status: 'removed' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'stale', draft }), discard }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  expect(session.getState()).toMatchObject({ status: 'recovery-blocked', activeWorkout: null, snapshot: draft, error: 'stale', blocked: true });
  await session.discard();
  expect(discard).toHaveBeenCalledWith({ projectId: 'p', uid: 'u', expected: { draftId: draft.draftId, ownershipGeneration: draft.ownershipGeneration } });
});

test('a stale Discard mismatch remains recovery-blocked with its exact identity', async () => {
  const draft = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 7 };
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status: 'stale', draft }), discard: async () => ({ status: 'stale-generation' }) }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.discard();
  expect(session.getState()).toMatchObject({ status: 'recovery-blocked', snapshot: draft, error: 'stale-generation', blocked: true });
});

test.each(['malformed', 'unsupported-version', 'wrong-project', 'wrong-user', 'fingerprint-error'])('Exit leaves %s recovery bytes untouched', async status => {
  const discard = vi.fn(async () => ({ status: 'removed' }));
  const session = createActiveWorkoutSession({ coordinator: { inspect: async () => ({ status }), discard }, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' });
  await session.exit();
  expect(discard).not.toHaveBeenCalled();
  expect(session.getState()).toMatchObject({ status: 'idle', activeWorkout: null, blocked: false });
});

test.each(['timeout', 'conflict', 'handoff-released'])('Exit retires hydrated blocked %s recovery only in memory', async error => {
  const coordinator = { inspect: vi.fn(async () => ({ status: 'resumable', hydrated: { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' }, draft: { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 1, phaseTargets: targets, pendingSave: null } })), resume: vi.fn(async () => ({ status: error })) };
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'u' }); await session.resume(); const callsBeforeExit = { inspect: coordinator.inspect.mock.calls.length, resume: coordinator.resume.mock.calls.length }; await session.exit();
  expect(session.getState()).toMatchObject({ status: 'idle', activeWorkout: null, snapshot: null, blocked: false });
  expect(coordinator.inspect).toHaveBeenCalledTimes(callsBeforeExit.inspect); expect(coordinator.resume).toHaveBeenCalledTimes(callsBeforeExit.resume);
});

test.each(['removed', 'stale-generation'])('retireIdentity clears prior UI state and exact-cleans the prior UID before queued bootstrap (%s)', async cleanupStatus => {
  const firstSnapshot = { draftId: '123e4567-e89b-42d3-a456-426614174000', ownershipGeneration: 4, phaseTargets: targets, pendingSave: null };
  const order = [];
  const coordinator = {
    inspect: vi.fn(async ({ uid }) => { order.push(`inspect:${uid}`); return uid === 'old' ? { status: 'resumable', hydrated: { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' }, draft: firstSnapshot } : { status: 'missing' }; }),
    resume: vi.fn(async () => ({ status: 'acquired', hydrated: { ...initializeActiveWorkout([exercise], { phaseTimingEnabled: true }), phase: 'performance' }, snapshot: firstSnapshot })),
    authCleanup: vi.fn(async input => { order.push('cleanup'); expect(input).toEqual({ priorProjectId: 'p', priorUid: 'old', expected: { draftId: firstSnapshot.draftId, ownershipGeneration: 4 } }); expect(session.getState()).toMatchObject({ status: 'idle', activeWorkout: null }); return { status: cleanupStatus }; }),
  };
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }) });
  await session.bootstrap({ uid: 'old' }); await session.resume();
  const retiring = session.retireIdentity(); const switching = session.bootstrap({ uid: 'new' }); await Promise.all([retiring, switching]);
  expect(order.slice(-2)).toEqual(['cleanup', 'inspect:new']);
  expect(session.getState()).toMatchObject({ status: 'idle', activeWorkout: null, snapshot: null });
});

test('publishes saved only after the real coordinator removes the successful immutable-save recovery slot', async () => {
  const storage = memory(); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async () => {}, readImmutableWorkoutFromServer: async () => ({ exists: () => false }), createUuid: () => '123e4567-e89b-42d3-a456-426614174001', now: () => 1000 });
  await session.bootstrap({ uid: 'u' }); await session.stageGenerated([exercise], targets);
  await session.action({ type: 'startWorkout', timestamp: 1000 }); await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
  await session.action({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }); await session.action({ type: 'finishWorkout', timestamp: 1003 });

  await session.save();

  expect(session.getState()).toMatchObject({ status: 'saved', activeWorkout: null, pendingSave: null });
  expect(storage.getItem(recoveryStorageKey({ projectId: 'p', uid: 'u' }))).toBeNull();
});

test('keeps the Review recovery pending when cleanup fails, then removes it on the matching retry', async () => {
  const values = new Map(); let failRemove = true;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => { if (failRemove) throw new Error('remove denied'); values.delete(key); } };
  const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), staleAfterMs: 1_000_000, now: () => 1000, createUuid: () => '123e4567-e89b-42d3-a456-426614174000' });
  let savedDocument;
  const session = createActiveWorkoutSession({ coordinator, projectId: 'p', saveImmutableWorkout: async (_uid, _id, document) => { savedDocument = document; }, readImmutableWorkoutFromServer: async () => ({ exists: () => true, data: () => savedDocument }), createUuid: () => '123e4567-e89b-42d3-a456-426614174001', now: () => 1000 });
  await session.bootstrap({ uid: 'u' }); await session.stageGenerated([exercise], targets);
  await session.action({ type: 'startWorkout', timestamp: 1000 }); await session.action({ type: 'startSet', exerciseIndex: 0, setIndex: 0, timestamp: 1001 });
  await session.action({ type: 'confirmSet', exerciseIndex: 0, setIndex: 0, timestamp: 1002 }); await session.action({ type: 'finishWorkout', timestamp: 1003 });

  await session.save();
  expect(session.getState()).toMatchObject({ status: 'review', error: 'cleanup-error', pendingSave: { state: 'write-pending', attemptCount: 1 } });
  expect(storage.getItem(recoveryStorageKey({ projectId: 'p', uid: 'u' }))).not.toBeNull();
  failRemove = false;
  await session.save();

  expect(session.getState()).toMatchObject({ status: 'saved', activeWorkout: null, pendingSave: null });
  expect(storage.getItem(recoveryStorageKey({ projectId: 'p', uid: 'u' }))).toBeNull();
});
