import { describe, expect, it } from 'vitest';
import { createActiveWorkoutCoordinator as createRawActiveWorkoutCoordinator } from '../utils/activeWorkoutCoordinator';
import { createRecoveryDraft, migrateRecoveryDraftV1ToV2, recoveryStorageKey } from '../utils/activeWorkoutRecovery';
import { buildCanonicalV4WorkoutDocument } from '../utils/workoutFingerprint';
import { createSaveOperationToken, prepareImmutableSave } from '../utils/immutableWorkoutSave';

const identity = { projectId: 'p', uid: 'u' };
const workout = { phase: 'warmup', workoutStartedAt: 1, activeWorkTimer: null, _nextTimerId: 1, phaseLedger: { closedMilliseconds: { warmup: 0, performance: 0, cooldown: 0 }, closedSeconds: { warmup: 0, performance: 0, cooldown: 0 }, openPhase: 'warmup', openedAtEpochMs: 1, lastAcceptedEpochMs: 1 }, phaseCandidate: null, _cooldownUndoTarget: null, exercises: [{ id: 'x', occurrenceId: 'x:0', name: 'X', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: false, setRecords: [{ index: 0, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }] }] };
function memory() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values }; }
function locks() { return { request: async (_name, _options, callback) => callback({ name: 'lock' }) }; }
const createActiveWorkoutCoordinator = options => createRawActiveWorkoutCoordinator({ staleAfterMs: 1_000_000, ...options });
async function reviewDraftWithPendingSave() {
  const review = structuredClone(workout);
  review.phase = 'review'; review.phaseLedger.openPhase = null; review.phaseLedger.openedAtEpochMs = null;
  review.exercises[0].completed = true;
  review.exercises[0].setRecords[0] = { ...review.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
  review.phaseCandidate = { phaseActualSeconds: { warmup: 0, performance: 0, cooldown: 0 }, actualDurationSeconds: 0, finishRequestedAtEpochMs: 1000 };
  const v1 = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: review });
  const v2 = migrateRecoveryDraftV1ToV2(v1, 1000);
  const candidate = buildCanonicalV4WorkoutDocument({ workoutId: '123e4567-e89b-42d3-a456-426614174000', finishRequestedAtEpochMs: 1000, phaseTargets: v2.phaseTargets, phaseActualSeconds: review.phaseCandidate.phaseActualSeconds, exercises: review.exercises });
  v2.pendingSave = { ...(await prepareImmutableSave({ workoutId: candidate.id, candidate })), state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: 1000 };
  return v2;
}

describe('active workout coordinator', () => {
  it('requires an explicit positive safe-integer stale policy', () => {
    expect(() => createRawActiveWorkoutCoordinator({ storage: memory(), locks: locks() })).toThrow(/staleAfterMs/);
    expect(() => createRawActiveWorkoutCoordinator({ storage: memory(), locks: locks(), staleAfterMs: 0 })).toThrow(/staleAfterMs/);
    expect(() => createRawActiveWorkoutCoordinator({ storage: memory(), locks: locks(), staleAfterMs: 1.5 })).toThrow(/staleAfterMs/);
  });
  it('inspects recovery without acquiring a lease', async () => {
    const storage = memory();
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10 });
    expect(await coordinator.inspect(identity)).toEqual({ status: 'missing' });
  });
  it('contains synchronous Web Lock request throws and cleans acquisition resources', async () => {
    let cleared = 0; let removed = 0; const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => { removed += 1; } };
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: { request: () => { throw new Error('denied'); } }, setTimeoutFn: () => 7, clearTimeoutFn: id => { expect(id).toBe(7); cleared += 1; } });
    expect(await coordinator.start({ ...identity, signal, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout })).toMatchObject({ status: 'denied' });
    expect(cleared).toBe(1); expect(removed).toBe(1);
  });

  it('release and handoff acceptance reject invalid identity without throwing', () => {
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: locks() });
    expect(coordinator.release({ projectId: '', uid: 'u' })).toEqual({ status: 'invalid-identity' });
    expect(coordinator.acceptHandoff({ projectId: 'p', uid: '', nonce: 'n', draftId: 'x', ownershipGeneration: 1 })).toEqual({ status: 'invalid-identity' });
  });

  it('does not advance generation when resume is called by the current owner', async () => {
    const storage = memory(); let writes = 0; const originalSet = storage.setItem; storage.setItem = (key, value) => { writes += 1; originalSet(key, value); };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    expect(await coordinator.resume({ ...identity, expected: started.snapshot })).toEqual({ status: 'conflict' });
    expect(JSON.parse(storage.getItem(recoveryStorageKey(identity))).ownershipGeneration).toBe(1); expect(writes).toBe(1);
  });

  it('invalid handoff nonce retains the owned lease', async () => {
    const storage = memory(); let requests = 0; const coordinator = createActiveWorkoutCoordinator({ storage, locks: { request: async (_n, _o, callback) => { requests += 1; return callback({}); } }, now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    expect(coordinator.acceptHandoff({ ...identity, nonce: '', draftId: started.snapshot.draftId, ownershipGeneration: 1 })).toEqual({ status: 'invalid-handoff' });
    expect(await coordinator.mutate({ ...identity, expected: started.snapshot, transform: draft => draft })).toMatchObject({ status: 'saved' }); expect(requests).toBe(1);
  });
  it('requires identity and ownership pair before storage, lock, mutation, or removal', async () => {
    let touched = 0; const storage = { getItem: () => { touched += 1; }, setItem: () => { touched += 1; }, removeItem: () => { touched += 1; } }; const lockApi = { request: () => { touched += 1; } };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: lockApi });
    expect(await coordinator.resume({ ...identity })).toMatchObject({ status: 'invalid-expected' });
    expect(await coordinator.mutate({ ...identity, transform: value => value })).toMatchObject({ status: 'invalid-expected' });
    expect(await coordinator.discard({ ...identity })).toMatchObject({ status: 'invalid-expected' });
    expect(await coordinator.start({ projectId: '', uid: 'u', phaseTargets: {}, activeWorkout: {} })).toMatchObject({ status: 'invalid-identity' });
    expect(touched).toBe(0);
  });

  it('reasserts locked identity and ownership after transforms', async () => {
    const storage = memory(); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const before = storage.getItem(recoveryStorageKey(identity));
    const result = await coordinator.mutate({ ...identity, expected: started.snapshot, transform: draft => ({ ...draft, projectId: 'evil', uid: 'evil', draftId: 'evil', ownershipGeneration: 99 }) });
    expect(result).toMatchObject({ status: 'invalid-draft' }); expect(storage.getItem(recoveryStorageKey(identity))).toBe(before);
  });

  it('contains hostile transforms without losing an existing owned lease', async () => {
    let requests = 0; const storage = memory(); const lockApi = { request: async (_n, _o, callback) => { requests += 1; return callback({}); } }; let lostCalls = 0;
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: lockApi, now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000', onLeaseLost: () => { lostCalls += 1; } });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout }); const before = storage.getItem(recoveryStorageKey(identity));
    expect(await coordinator.mutate({ ...identity, expected: started.snapshot, transform: () => { const cyclic = {}; cyclic.self = cyclic; return cyclic; } })).toMatchObject({ status: 'invalid-draft' });
    expect(storage.getItem(recoveryStorageKey(identity))).toBe(before); expect(lostCalls).toBe(0);
    expect(await coordinator.mutate({ ...identity, expected: started.snapshot, transform: draft => draft })).toMatchObject({ status: 'saved' }); expect(requests).toBe(1);
  });

  it('aborts handoff distinctly and never requests the lock', async () => {
    let requested = 0; const controller = new AbortController(); const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: { request: () => { requested += 1; } }, handoffTransport: { request: (_identity, _message) => new Promise(() => {}) } });
    const pending = coordinator.handoffResume({ ...identity, expected: { draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1 }, nonce: 'n', signal: controller.signal }); controller.abort();
    expect(await pending).toMatchObject({ status: 'aborted' }); expect(requested).toBe(0);
  });
  it('C-02 keeps the Web Lock callback leased until an explicit release', async () => {
    let releaseRequest; let callbackSettled = false;
    const lockApi = { request: (_name, options, callback) => new Promise((resolve, reject) => { releaseRequest = () => callback({ name: 'lock' }).then(value => { callbackSettled = true; resolve(value); }, reject); expect(options.mode).toBe('exclusive'); expect(options).not.toHaveProperty('steal'); }) };
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: lockApi, now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const pending = coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    releaseRequest();
    expect((await pending).status).toBe('acquired');
    expect(callbackSettled).toBe(false);
    expect(coordinator.release(identity)).toEqual({ status: 'released' });
  });

  it('C-03 distinguishes unsupported, denied, and caller-aborted queued acquisition', async () => {
    const input = { ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout };
    expect(await createActiveWorkoutCoordinator({ storage: memory() }).start(input)).toMatchObject({ status: 'unsupported' });
    expect(await createActiveWorkoutCoordinator({ storage: memory(), locks: { request: () => Promise.reject(new Error('denied')) } }).start(input)).toMatchObject({ status: 'denied' });
    const controller = new AbortController();
    const queued = createActiveWorkoutCoordinator({ storage: memory(), locks: { request: (_n, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort')))) } });
    const pending = queued.start({ ...input, signal: controller.signal }); controller.abort();
    expect(await pending).toMatchObject({ status: 'aborted' });
  });

  it('C-03 reports injected acquisition timeout distinctly and clears its timer', async () => {
    let fire; let cleared = 0;
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: { request: (_n, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout')))) }, setTimeoutFn: callback => { fire = callback; return 9; }, clearTimeoutFn: id => { expect(id).toBe(9); cleared += 1; } });
    const pending = coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    fire();
    expect(await pending).toMatchObject({ status: 'timeout' });
    expect(cleared).toBe(1);
  });

  it('C-03 treats a cooperative owner refusal as conflict, not ownership', async () => {
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), handoffTransport: { request: async () => ({ status: 'refused' }) } });
    expect(await coordinator.requestHandoff({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, nonce: 'n' })).toEqual({ status: 'conflict' });
  });

  it('C-02 sends the exact handoff identity and an acknowledgement grants no mutation', async () => {
    let received;
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), handoffTransport: { request: async (_identity, message) => { received = message; return { status: 'accepted', nonce: message.nonce }; } } });
    expect(await coordinator.requestHandoff({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 3, nonce: 'nonce-1' })).toEqual({ status: 'handoff-acknowledged' });
    expect(received).toEqual({ nonce: 'nonce-1', draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 3 });
    expect(await coordinator.mutate({ ...identity, expected: received, transform: value => value })).toMatchObject({ status: 'unsupported' });
  });

  it('C-03 reports normal explicit release as released', async () => {
    const storage = memory(); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    expect(coordinator.release(identity)).toEqual({ status: 'released' });
  });

  it('uses the remaining shared handoff budget and refuses without lock acquisition', async () => {
    let clock = 0; let requested = 0;
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), now: () => clock, handoffTransport: { request: async () => { clock = 3_000; return { status: 'refused' }; } }, locks: { request: async () => { requested += 1; } } });
    expect(await coordinator.handoffResume({ ...identity, expected: { draftId: 'x', ownershipGeneration: 1 }, nonce: 'n' })).toEqual({ status: 'conflict' });
    expect(requested).toBe(0);
  });

  it('uses only remaining budget after an acknowledged handoff and does not acquire before grant', async () => {
    let clock = 0; let scheduledDelay; let queuedSignal;
    const locks = { request: (_name, options) => new Promise(() => { queuedSignal = options.signal; }) };
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks, now: () => clock, setTimeoutFn: (_callback, ms) => { if (ms !== 8_000) scheduledDelay = ms; return 1; }, clearTimeoutFn: () => {}, handoffTransport: { request: async () => { clock = 3_000; return { status: 'accepted', nonce: 'n' }; } } });
    const pending = coordinator.handoffResume({ ...identity, expected: { draftId: 'x', ownershipGeneration: 1 }, nonce: 'n' });
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    expect(scheduledDelay).toBe(5_000); expect(queuedSignal.aborted).toBe(false);
    // No callback grant means acknowledgement alone cannot produce acquired.
    expect(await Promise.race([pending.then(() => 'settled'), Promise.resolve('pending')])).toBe('pending');
  });

  it('times out integrated acquisition when the remaining timer fires', async () => {
    let clock = 0; let fire;
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: { request: (_n, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout')))) }, now: () => clock, setTimeoutFn: (callback, ms) => { if (ms !== 8_000) fire = callback; return 1; }, clearTimeoutFn: () => {}, handoffTransport: { request: async () => { clock = 3_000; return { status: 'accepted', nonce: 'n' }; } } });
    const pending = coordinator.handoffResume({ ...identity, expected: { draftId: 'x', ownershipGeneration: 1 }, nonce: 'n' }); for (let index = 0; index < 10; index += 1) await Promise.resolve(); fire();
    expect(await pending).toMatchObject({ status: 'timeout' });
  });

  it('post-ack grant revalidates and increments ownership once', async () => {
    const storage = memory(); const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout }); storage.setItem(recoveryStorageKey(identity), JSON.stringify(draft));
    let grant; let writes = 0; const originalSet = storage.setItem; storage.setItem = (key, value) => { writes += 1; originalSet(key, value); };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: { request: (_n, _o, callback) => new Promise(resolve => { grant = () => callback({}).then(resolve); }) }, now: () => 1, handoffTransport: { request: async () => ({ status: 'accepted', nonce: 'n' }) } });
    const pending = coordinator.handoffResume({ ...identity, expected: draft, nonce: 'n' }); for (let index = 0; index < 10; index += 1) await Promise.resolve(); grant();
    const result = await pending; expect(result).toMatchObject({ status: 'acquired', snapshot: { ownershipGeneration: 2 } }); expect(result.hydrated._phaseTimingEnabled).toBe(true); expect(writes).toBe(1);
  });

  it('post-ack changed ownership pair returns stale-generation without writing', async () => {
    const storage = memory(); const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout }); const key = recoveryStorageKey(identity); storage.setItem(key, JSON.stringify(draft));
    let grant; let writes = 0; storage.setItem = () => { writes += 1; };
    const coordinator = createActiveWorkoutCoordinator({ storage, now: () => 1, locks: { request: (_n, _o, callback) => new Promise(resolve => { grant = () => callback({}).then(resolve); }) }, handoffTransport: { request: async () => ({ status: 'accepted', nonce: 'n' }) } });
    const pending = coordinator.handoffResume({ ...identity, expected: draft, nonce: 'n' }); for (let index = 0; index < 10; index += 1) await Promise.resolve(); storage.getItem = () => JSON.stringify({ ...draft, ownershipGeneration: 2 }); grant();
    expect(await pending).toMatchObject({ status: 'stale-generation' }); expect(writes).toBe(0);
  });

  it('C-03 marks an unexpectedly rejected held request lost and never reuses that lease', async () => {
    let rejectRequest;
    let calls = 0; const lockApi = { request: (_name, _options, callback) => { calls += 1; if (calls > 1) return Promise.reject(new Error('blocked')); return new Promise((resolve, reject) => { rejectRequest = reject; callback({ name: 'lock' }); }); } };
    const coordinator = createActiveWorkoutCoordinator({ storage: memory(), locks: lockApi, now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    rejectRequest(new Error('lost'));
    await Promise.resolve();
    let transformed = false;
    expect(await coordinator.mutate({ ...identity, expected: started.snapshot, transform: value => { transformed = true; return value; } })).toMatchObject({ status: 'lost' });
    expect(transformed).toBe(false);
  });
  it('creates only post-start drafts, mutates atomically, and requires locks', async () => {
    const storage = memory(); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, createUuid: () => '123e4567-e89b-12d3-a456-426614174000' });
    const started = await coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    expect(started.status).toBe('acquired');
    const mutated = await coordinator.mutate({ ...identity, expected: started.snapshot, transform: draft => ({ ...draft, activeWorkout: { ...draft.activeWorkout, phase: 'performance', phaseLedger: { ...draft.activeWorkout.phaseLedger, openPhase: 'performance' } } }) });
    expect(mutated.status).toBe('saved');
    expect(JSON.parse(storage.getItem(recoveryStorageKey(identity))).activeWorkout.phase).toBe('performance');
    expect(createActiveWorkoutCoordinator({ storage, now: () => 1 }).start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout })).resolves.toMatchObject({ status: 'unsupported' });
  });

  it('rejects stale generation after lock acquisition and exposes storage errors', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity);
    storage.setItem(key, JSON.stringify(createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 2, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout })));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 2 });
    expect(await coordinator.resume({ ...identity, expected: { draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1 } })).toMatchObject({ status: 'stale-generation' });
    expect(await coordinator.resume({ ...identity, expected: { draftId: '123e4567-e89b-12d3-a456-426614174999', ownershipGeneration: 2 } })).toMatchObject({ status: 'stale-generation' });
  });

  it('C-05 keeps prior storage unchanged on read, write, remove, and invalid-transform failures', async () => {
    const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const key = recoveryStorageKey(identity); const failing = { getItem: () => { throw new Error('read'); }, setItem: () => { throw new Error('write'); }, removeItem: () => { throw new Error('remove'); } };
    expect(await createActiveWorkoutCoordinator({ storage: failing, locks: locks(), now: () => 2 }).resume({ ...identity, expected: draft })).toMatchObject({ status: 'storage-error', operation: 'read' });
    const values = new Map([[key, JSON.stringify(draft)]]); const writeFail = { getItem: k => values.get(k), setItem: () => { throw new Error('write'); }, removeItem: () => { throw new Error('remove'); } };
    const coordinator = createActiveWorkoutCoordinator({ storage: writeFail, locks: locks(), now: () => 2 });
    expect(await coordinator.mutate({ ...identity, expected: draft, transform: value => value })).toMatchObject({ status: 'storage-error', operation: 'write' });
    expect(values.get(key)).toBe(JSON.stringify(draft));
    expect(await coordinator.mutate({ ...identity, expected: draft, transform: value => ({ ...value, activeWorkout: { ...value.activeWorkout, phase: 'bad' } }) })).toMatchObject({ status: 'invalid-draft' });
    expect(values.get(key)).toBe(JSON.stringify(draft));
    expect(await coordinator.discard({ ...identity, expected: draft })).toMatchObject({ status: 'storage-error', operation: 'remove' });
    expect(values.get(key)).toBe(JSON.stringify(draft));
  });

  it('retains unsupported drafts but discards only an exact stale identity under lock', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity);
    storage.setItem(key, JSON.stringify({ version: 2 }));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, staleAfterMs: 1 });
    expect(await coordinator.discard({ ...identity, expected: { draftId: 'x', ownershipGeneration: 1 } })).toMatchObject({ status: 'malformed' });
    expect(storage.getItem(key)).not.toBeNull();
    const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    storage.setItem(key, JSON.stringify(draft));
    expect(await coordinator.discard({ ...identity, expected: draft })).toEqual({ status: 'removed' });
    expect(storage.getItem(key)).toBeNull();
  });

  it('propagates and retains malformed and stale read dispositions after grant', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 10, staleAfterMs: 1 });
    storage.setItem(key, '{');
    expect(await coordinator.resume({ ...identity, expected: { draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1 } })).toMatchObject({ status: 'malformed' });
    expect(storage.getItem(key)).toBe('{');
    const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout }); storage.setItem(key, JSON.stringify(draft));
    expect(await coordinator.discard({ ...identity, expected: { ...draft, ownershipGeneration: 2 } })).toMatchObject({ status: 'stale-generation' });
    expect(storage.getItem(key)).not.toBeNull();
  });

  it('retains wrong-project and wrong-user envelopes after locked resume', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity); const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1 });
    const base = { draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout };
    storage.setItem(key, JSON.stringify(createRecoveryDraft({ ...base, projectId: 'other', uid: identity.uid })));
    expect(await coordinator.resume({ ...identity, expected: base })).toMatchObject({ status: 'wrong-project' }); expect(storage.getItem(key)).not.toBeNull();
    storage.setItem(key, JSON.stringify(createRecoveryDraft({ ...base, projectId: identity.projectId, uid: 'other' })));
    expect(await coordinator.resume({ ...identity, expected: base })).toMatchObject({ status: 'wrong-user' }); expect(storage.getItem(key)).not.toBeNull();
  });

  it('C-05 auth cleanup touches only the prior identity slot and retains remove failures', async () => {
    const prior = { projectId: 'prior/p', uid: 'prior:u' }; const key = recoveryStorageKey(prior); const seen = [];
    const draft = createRecoveryDraft({ ...prior, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    const storage = { getItem: k => { seen.push(k); return k === key ? JSON.stringify(draft) : null; }, setItem: () => {}, removeItem: k => { seen.push(k); throw new Error('remove'); } };
    let lockName; const lockApi = { request: async (name, _options, callback) => { lockName = name; return callback({}); } };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: lockApi, now: () => 1 });
    expect(await coordinator.authCleanup({ priorProjectId: prior.projectId, priorUid: prior.uid, expected: draft })).toMatchObject({ status: 'storage-error', operation: 'remove' });
    expect(lockName).toBe('active-workout:prior%2Fp:prior%3Au'); expect(seen).toEqual([key, key, key]);
  });

  it('A6 migrates a locked v1 draft to v2 without changing its ownership generation', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity);
    const draft = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    storage.setItem(key, JSON.stringify(draft));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 2 });
    await expect(coordinator.migrateToV2({ ...identity, expected: draft })).resolves.toMatchObject({ status: 'saved' });
    expect(JSON.parse(storage.getItem(key))).toMatchObject({ version: 2, ownershipGeneration: 1, lastMutationAtEpochMs: 2, pendingSave: null });
  });

  it('atomically combines v1 resume ownership transfer with v2 migration in one write', async () => {
    const storage = memory(); const key = recoveryStorageKey(identity);
    const v1 = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout });
    storage.setItem(key, JSON.stringify(v1));
    const writes = []; const setItem = storage.setItem; storage.setItem = (storageKey, value) => { writes.push(JSON.parse(value)); setItem(storageKey, value); };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 2 });

    const result = await coordinator.resume({ ...identity, expected: v1 });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ version: 2, ownershipGeneration: 2, lastMutationAtEpochMs: 2, pendingSave: null });
    expect(result).toMatchObject({ status: 'acquired', snapshot: { version: 2, ownershipGeneration: 2 }, hydrated: { phase: 'warmup', _phaseTimingEnabled: true } });
    expect(JSON.parse(storage.getItem(key))).toEqual(writes[0]);
  });

  it('rejects v2 pending candidate and coordinated workout tampering with zero storage writes', async () => {
    const review = structuredClone(workout);
    review.phase = 'review'; review.phaseLedger.openPhase = null; review.phaseLedger.openedAtEpochMs = null;
    review.exercises[0].completed = true;
    review.exercises[0].setRecords[0] = { ...review.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
    review.phaseCandidate = { phaseActualSeconds: { warmup: 0, performance: 0, cooldown: 0 }, actualDurationSeconds: 0, finishRequestedAtEpochMs: 1000 };
    const v1 = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: review });
    const v2 = migrateRecoveryDraftV1ToV2(v1, 1000); const workoutId = '123e4567-e89b-42d3-a456-426614174000';
    const candidate = buildCanonicalV4WorkoutDocument({ workoutId, finishRequestedAtEpochMs: 1000, phaseTargets: v2.phaseTargets, phaseActualSeconds: review.phaseCandidate.phaseActualSeconds, exercises: review.exercises });
    v2.pendingSave = await prepareImmutableSave({ workoutId, candidate });
    const storage = memory(); const key = recoveryStorageKey(identity); storage.setItem(key, JSON.stringify(v2));
    let writes = 0; const setItem = storage.setItem; storage.setItem = (...args) => { writes += 1; setItem(...args); };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 });
    await expect(coordinator.mutate({ ...identity, expected: v2, transform: draft => { draft.pendingSave.candidate.exercises[0].name = 'tampered'; return draft; } })).resolves.toMatchObject({ status: 'invalid-draft' });
    expect(writes).toBe(0);
    await expect(createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 }).mutate({ ...identity, expected: v2, transform: draft => { draft.pendingSave.fingerprint.hex = '0'.repeat(64); return draft; } })).resolves.toMatchObject({ status: 'invalid-draft' });
    await expect(createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 }).mutate({ ...identity, expected: v2, transform: draft => { draft.activeWorkout.exercises[0].name = 'tampered'; draft.pendingSave.candidate.exercises[0].name = 'tampered'; return draft; } })).resolves.toMatchObject({ status: 'invalid-draft' });
    expect(writes).toBe(0);
    const digestDenied = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001, subtle: { digest: async () => { throw new Error('denied'); } } });
    await expect(digestDenied.mutate({ ...identity, expected: v2, transform: draft => draft })).resolves.toMatchObject({ status: 'fingerprint-error' });
    expect(writes).toBe(0);
  });

  it('allows only the immutable-save state-machine transition from an empty pending slot', async () => {
    const review = structuredClone(workout);
    review.phase = 'review'; review.phaseLedger.openPhase = null; review.phaseLedger.openedAtEpochMs = null;
    review.exercises[0].completed = true;
    review.exercises[0].setRecords[0] = { ...review.exercises[0].setRecords[0], completed: true, workDurationSeconds: 0 };
    review.phaseCandidate = { phaseActualSeconds: { warmup: 0, performance: 0, cooldown: 0 }, actualDurationSeconds: 0, finishRequestedAtEpochMs: 1000 };
    const v1 = createRecoveryDraft({ ...identity, draftId: '123e4567-e89b-12d3-a456-426614174000', ownershipGeneration: 1, lastMutationAtEpochMs: 1000, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: review });
    const v2 = migrateRecoveryDraftV1ToV2(v1, 1000);
    const candidate = buildCanonicalV4WorkoutDocument({ workoutId: '123e4567-e89b-42d3-a456-426614174000', finishRequestedAtEpochMs: 1000, phaseTargets: v2.phaseTargets, phaseActualSeconds: review.phaseCandidate.phaseActualSeconds, exercises: review.exercises });
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const illegal = { ...prepared, state: 'retryable-absent', attemptCount: 1, lastAttemptAtEpochMs: 1000, lastReconciliationAtEpochMs: 1000 };
    const storage = memory(); storage.setItem(recoveryStorageKey(identity), JSON.stringify(v2));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 });
    await expect(coordinator.persistPendingSave({ ...identity, expected: v2, operationToken: { draftId: v2.draftId, ownershipGeneration: v2.ownershipGeneration, workoutId: prepared.workoutId, fingerprintHex: prepared.fingerprint.hex, attemptCount: 0 }, pendingSave: illegal })).resolves.toMatchObject({ status: 'invalid-draft' });
  });

  it('removes the exact successful immutable-save recovery slot and releases its lease', async () => {
    const v2 = await reviewDraftWithPendingSave();
    const storage = memory(); const key = recoveryStorageKey(identity); storage.setItem(key, JSON.stringify(v2));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 });
    const acquired = await coordinator.resume({ ...identity, expected: v2 });
    const expected = acquired.snapshot;
    const operationToken = createSaveOperationToken({ ...expected, pendingSave: expected.pendingSave });

    await expect(coordinator.mutate({ ...identity, expected, transform: draft => ({ ...draft, pendingSave: null }) })).resolves.toMatchObject({ status: 'invalid-draft' });
    expect(storage.getItem(key)).toBe(JSON.stringify(expected));
    await expect(coordinator.completeSave({ ...identity, expected, operationToken })).resolves.toEqual({ status: 'removed' });
    expect(storage.getItem(key)).toBeNull();
    await expect(coordinator.start({ ...identity, phaseTargets: { warmupSeconds: 0, performanceSeconds: 0, cooldownSeconds: 0 }, activeWorkout: workout })).resolves.toMatchObject({ status: 'acquired' });
  });

  it('retains bytes and the lease when exact cleanup removal fails', async () => {
    const v2 = await reviewDraftWithPendingSave(); const key = recoveryStorageKey(identity); const values = new Map([[key, JSON.stringify(v2)] ]);
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: () => { throw new Error('remove denied'); } };
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 });
    const acquired = await coordinator.resume({ ...identity, expected: v2 }); const expected = acquired.snapshot;
    const result = await coordinator.completeSave({ ...identity, expected, operationToken: createSaveOperationToken({ ...expected, pendingSave: expected.pendingSave }) });

    expect(result).toMatchObject({ status: 'storage-error', operation: 'remove' });
    expect(storage.getItem(key)).toBe(JSON.stringify(expected));
    expect(await coordinator.mutate({ ...identity, expected, transform: draft => draft })).toMatchObject({ status: 'saved' });
  });

  it.each([
    ['generation', 'expected', ({ expected }) => ({ ...expected, ownershipGeneration: expected.ownershipGeneration + 1 }), 'stale-generation'],
    ['draft id', 'expected', ({ expected }) => ({ ...expected, draftId: 'other' }), 'stale-generation'],
    ['operation draft id', 'token', ({ token }) => ({ ...token, draftId: 'other' }), 'stale-operation'],
    ['operation generation', 'token', ({ token }) => ({ ...token, ownershipGeneration: token.ownershipGeneration + 1 }), 'stale-operation'],
    ['workout id', 'token', ({ token }) => ({ ...token, workoutId: '123e4567-e89b-42d3-a456-426614174001' }), 'stale-operation'],
    ['fingerprint', 'token', ({ token }) => ({ ...token, fingerprintHex: '0'.repeat(64) }), 'stale-operation'],
    ['attempt', 'token', ({ token }) => ({ ...token, attemptCount: 2 }), 'stale-operation'],
  ])('does not remove the recovery slot for a %s mismatch', async (_label, target, change, status) => {
    const v2 = await reviewDraftWithPendingSave(); const storage = memory(); const key = recoveryStorageKey(identity); storage.setItem(key, JSON.stringify(v2));
    const coordinator = createActiveWorkoutCoordinator({ storage, locks: locks(), now: () => 1001 }); const acquired = await coordinator.resume({ ...identity, expected: v2 });
    const expected = acquired.snapshot; const token = createSaveOperationToken({ ...expected, pendingSave: expected.pendingSave }); const changed = change({ expected, token });
    const result = await coordinator.completeSave({ ...identity, expected: target === 'expected' ? changed : expected, operationToken: target === 'token' ? changed : token });

    expect(result).toMatchObject({ status });
    expect(storage.getItem(key)).toBe(JSON.stringify(expected));
  });
});
