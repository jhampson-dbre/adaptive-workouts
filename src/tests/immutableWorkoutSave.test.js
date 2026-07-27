import { describe, expect, it, vi } from 'vitest';
import { createImmutableWorkoutId, createSaveOperationToken, executeImmutableSave as executeImmutableWorkoutSave, isValidPendingSave, prepareImmutableSave } from '../utils/immutableWorkoutSave';
import { buildCanonicalV4WorkoutDocument } from '../utils/workoutFingerprint';

const candidate = buildCanonicalV4WorkoutDocument({
  workoutId: '123e4567-e89b-42d3-a456-426614174000', finishRequestedAtEpochMs: Date.parse('2026-07-22T12:00:00.000Z'),
  phaseTargets: { warmupSeconds: 0, performanceSeconds: 60, cooldownSeconds: 0 },
  phaseActualSeconds: { warmup: 0, performance: 1, cooldown: 0 },
  exercises: [{ id: 'x', occurrenceId: 'x:0', name: 'X', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 1, actualRestSeconds: null }] }],
});
const executeImmutableSave = args => {
  const operationToken = args.operationToken ?? createSaveOperationToken({ draftId: 'default-draft', ownershipGeneration: 1, pendingSave: args.pendingSave });
  return executeImmutableWorkoutSave({ ...args, operationToken, isCurrent: args.isCurrent ?? (() => true) });
};

describe('immutable save protocol', () => {
  it('persists write-pending before direct exact write and clears on success', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const persist = vi.fn().mockResolvedValue(); const clear = vi.fn().mockResolvedValue(); const setDoc = vi.fn().mockResolvedValue();
    await expect(executeImmutableSave({ pendingSave: pending, persist, clear, setDoc, getDocFromServer: vi.fn(), now: () => 10 })).resolves.toEqual({ status: 'saved' });
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: 10 }), expect.objectContaining({ attemptCount: 0, draftId: 'default-draft' }));
    expect(setDoc).toHaveBeenCalledWith(candidate);
    expect(clear).toHaveBeenCalledOnce();
  });

  it('uses server-only canonical bytes to distinguish matching, absent, and conflicts', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const failedWrite = vi.fn().mockRejectedValue(new Error('offline'));
    const matching = await executeImmutableSave({ pendingSave: pending, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockResolvedValue(), setDoc: failedWrite, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => true, data: () => candidate }), now: () => 10 });
    expect(matching).toMatchObject({ status: 'saved', reconciled: true });
    const absent = await executeImmutableSave({ pendingSave: pending, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockResolvedValue(), setDoc: failedWrite, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => false }), now: () => 10 });
    expect(absent).toMatchObject({ status: 'absent', pendingSave: { state: 'retryable-absent' } });
    const conflict = await executeImmutableSave({ pendingSave: pending, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockResolvedValue(), setDoc: failedWrite, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ ...candidate, id: '123e4567-e89b-42d3-a456-426614174001' }) }), now: () => 10 });
    expect(conflict).toMatchObject({ status: 'conflict', pendingSave: { state: 'blocked-conflict' } });
  });

  it('treats a server payload missing id as conflict and never clears or retries the write', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const serverPayload = { ...candidate }; delete serverPayload.id;
    const setDoc = vi.fn().mockRejectedValue(new Error('denied'));
    const clear = vi.fn(); const persist = vi.fn().mockResolvedValue();
    await expect(executeImmutableSave({ pendingSave: pending, persist, clear, setDoc, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => true, data: () => serverPayload }), now: () => 10 })).resolves.toMatchObject({ status: 'conflict', pendingSave: { state: 'blocked-conflict' } });
    expect(setDoc).toHaveBeenCalledOnce(); expect(clear).not.toHaveBeenCalled();
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'blocked-conflict' }), expect.objectContaining({ attemptCount: 1 }));
  });

  it('keeps stable UUID creation and suppresses late network results', async () => {
    expect(createImmutableWorkoutId(() => candidate.id)).toBe(candidate.id);
    expect(() => createImmutableWorkoutId(() => 'UPPERCASE')).toThrow(/UUIDv4/);
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const token = createSaveOperationToken({ draftId: 'draft', ownershipGeneration: 1, pendingSave: pending });
    let current = true; let resolveWrite;
    const writes = []; const operation = executeImmutableSave({
      pendingSave: pending, operationToken: token, isCurrent: () => current,
      persist: async value => { writes.push(value); }, clear: vi.fn(),
      setDoc: () => new Promise(resolve => { resolveWrite = resolve; }), getDocFromServer: vi.fn(), now: () => 10,
    });
    while (!resolveWrite) await new Promise(resolve => setTimeout(resolve, 0));
    current = false; resolveWrite();
    await expect(operation).resolves.toEqual({ status: 'stale-operation' });
    expect(writes).toHaveLength(1);
  });

  it('keeps indeterminate reconciliation pending instead of treating it as absent', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const persist = vi.fn().mockResolvedValue();
    await expect(executeImmutableSave({ pendingSave: pending, persist, clear: vi.fn(), setDoc: vi.fn().mockRejectedValue(new Error('offline')), getDocFromServer: vi.fn().mockRejectedValue(new Error('offline')), now: () => 10 })).resolves.toMatchObject({ status: 'indeterminate', pendingSave: { state: 'reconcile-indeterminate', lastReconciliationAtEpochMs: 10 } });
  });

  it('validates every exact pending state and rejects unknown, malformed, and bad timestamps', async () => {
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const attempted = { ...prepared, attemptCount: 1, lastAttemptAtEpochMs: 0 };
    expect(isValidPendingSave(prepared)).toBe(true);
    expect(isValidPendingSave({ ...attempted, state: 'write-pending', lastReconciliationAtEpochMs: null })).toBe(true);
    for (const state of ['retryable-absent', 'reconcile-indeterminate', 'blocked-conflict']) {
      expect(isValidPendingSave({ ...attempted, state, lastReconciliationAtEpochMs: 1 })).toBe(true);
    }
    expect(isValidPendingSave({ ...prepared, extra: true })).toBe(false);
    expect(isValidPendingSave({ ...attempted, state: 'retryable-absent', lastReconciliationAtEpochMs: null })).toBe(false);
    expect(isValidPendingSave({ ...attempted, state: 'write-pending', lastAttemptAtEpochMs: -1, lastReconciliationAtEpochMs: null })).toBe(false);
    expect(isValidPendingSave({ ...prepared, candidate: { ...candidate, unknown: true } })).toBe(false);
    expect(isValidPendingSave({ ...prepared, fingerprint: { ...prepared.fingerprint, extra: true } })).toBe(false);
    const missingFingerprintKey = { ...prepared.fingerprint }; delete missingFingerprintKey.algorithm;
    expect(isValidPendingSave({ ...prepared, fingerprint: missingFingerprintKey })).toBe(false);
  });

  it('retains write-pending evidence when cleanup fails after direct or reconciled success', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const cleanupError = new Error('quota');
    const directSet = vi.fn().mockResolvedValue();
    await expect(executeImmutableSave({ pendingSave: pending, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockRejectedValue(cleanupError), setDoc: directSet, getDocFromServer: vi.fn(), now: () => 10 })).resolves.toMatchObject({ status: 'cleanup-error', pendingSave: { state: 'write-pending', attemptCount: 1 }, error: cleanupError });
    expect(directSet).toHaveBeenCalledOnce();
    const ambiguousSet = vi.fn().mockRejectedValue(new Error('ambiguous'));
    await expect(executeImmutableSave({ pendingSave: pending, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockRejectedValue(cleanupError), setDoc: ambiguousSet, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => true, data: () => candidate }), now: () => 10 })).resolves.toMatchObject({ status: 'cleanup-error', pendingSave: { state: 'write-pending', attemptCount: 1 }, error: cleanupError });
    expect(ambiguousSet).toHaveBeenCalledOnce();
  });

  it('rejects attempt overflow and local persistence failure before network I/O', async () => {
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const overflow = { ...prepared, state: 'write-pending', attemptCount: Number.MAX_SAFE_INTEGER, lastAttemptAtEpochMs: 1 };
    const setDoc = vi.fn(); const persist = vi.fn();
    await expect(executeImmutableSave({ pendingSave: overflow, persist, clear: vi.fn(), setDoc, getDocFromServer: vi.fn().mockResolvedValue({ exists: () => false }) })).resolves.toEqual({ status: 'invalid-pending-save' });
    expect(persist).not.toHaveBeenCalled(); expect(setDoc).not.toHaveBeenCalled();
    await expect(executeImmutableSave({ pendingSave: prepared, persist: vi.fn().mockRejectedValue(new Error('quota')), clear: vi.fn(), setDoc, getDocFromServer: vi.fn() })).resolves.toMatchObject({ status: 'storage-error', operation: 'persist', pendingSave: prepared, error: expect.objectContaining({ message: 'quota' }) });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('verifies digest before matching-server reconciliation and performs no local/server mutation on tamper', async () => {
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const pending = { ...prepared, state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: 1 };
    const tampered = { ...pending, fingerprint: { ...pending.fingerprint, hex: '0'.repeat(64) } };
    const getDocFromServer = vi.fn().mockResolvedValue({ exists: () => true, data: () => candidate });
    const persist = vi.fn(); const clear = vi.fn();
    await expect(executeImmutableSave({ pendingSave: tampered, persist, clear, setDoc: vi.fn(), getDocFromServer })).resolves.toEqual({ status: 'invalid-pending-save' });
    expect(getDocFromServer).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });

  it('passes and advances full expected tokens to atomic persist and clear adapters', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const initial = createSaveOperationToken({ draftId: 'draft', ownershipGeneration: 1, pendingSave: pending });
    let currentToken = initial; const seen = [];
    const persist = vi.fn(async (next, expected) => { seen.push(['persist', expected]); currentToken = Object.freeze({ ...expected, attemptCount: next.attemptCount }); });
    const clear = vi.fn(async expected => { seen.push(['clear', expected]); });
    await expect(executeImmutableSave({ pendingSave: pending, operationToken: initial, isCurrent: expected => JSON.stringify(expected) === JSON.stringify(currentToken), persist, clear, setDoc: vi.fn().mockResolvedValue(), getDocFromServer: vi.fn(), now: () => 10 })).resolves.toEqual({ status: 'saved' });
    expect(seen[0]).toEqual(['persist', initial]);
    expect(seen[1][1]).toEqual({ ...initial, attemptCount: 1 });
  });

  it('honors adapter stale results when identity retires during awaited persist or clear', async () => {
    const pending = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const initial = createSaveOperationToken({ draftId: 'draft', ownershipGeneration: 1, pendingSave: pending });
    let currentToken = initial; let releasePersist;
    const setDoc = vi.fn(); const clear = vi.fn();
    const persistence = executeImmutableSave({ pendingSave: pending, operationToken: initial, isCurrent: expected => JSON.stringify(expected) === JSON.stringify(currentToken), persist: async (_next, expected) => { await new Promise(resolve => { releasePersist = resolve; }); return JSON.stringify(expected) === JSON.stringify(currentToken) ? undefined : { status: 'stale-operation' }; }, clear, setDoc, getDocFromServer: vi.fn() });
    while (!releasePersist) await new Promise(resolve => setTimeout(resolve, 0));
    currentToken = { ...initial, ownershipGeneration: 2 }; releasePersist();
    await expect(persistence).resolves.toEqual({ status: 'stale-operation' });
    expect(setDoc).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();

    currentToken = initial; let releaseClear;
    const clearing = executeImmutableSave({ pendingSave: pending, operationToken: initial, isCurrent: expected => JSON.stringify(expected) === JSON.stringify(currentToken), persist: async (next, expected) => { currentToken = { ...expected, attemptCount: next.attemptCount }; }, clear: async expected => { await new Promise(resolve => { releaseClear = resolve; }); return JSON.stringify(expected) === JSON.stringify(currentToken) ? undefined : { status: 'stale-operation' }; }, setDoc: vi.fn().mockResolvedValue(), getDocFromServer: vi.fn() });
    while (!releaseClear) await new Promise(resolve => setTimeout(resolve, 0));
    currentToken = { ...currentToken, draftId: 'retired-auth' }; releaseClear();
    await expect(clearing).resolves.toEqual({ status: 'stale-operation' });
  });

  it('retains write-pending as fingerprint-error when reconciliation digest capability rejects', async () => {
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const pendingSave = { ...prepared, state: 'write-pending', attemptCount: 1, lastAttemptAtEpochMs: 1 };
    const getDocFromServer = vi.fn(); const persist = vi.fn(); const clear = vi.fn(); const setDoc = vi.fn();
    await expect(executeImmutableSave({ pendingSave, subtle: { digest: vi.fn().mockRejectedValue(new Error('digest denied')) }, getDocFromServer, persist, clear, setDoc })).resolves.toMatchObject({ status: 'fingerprint-error', pendingSave });
    expect(getDocFromServer).not.toHaveBeenCalled(); expect(setDoc).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });

  it.each(['prepared', 'retryable-absent'])('retains %s as fingerprint-error when digest capability is unavailable', async state => {
    const prepared = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const pendingSave = state === 'prepared' ? prepared : { ...prepared, state, attemptCount: 1, lastAttemptAtEpochMs: 1, lastReconciliationAtEpochMs: 1 };
    const getDocFromServer = vi.fn(); const persist = vi.fn(); const clear = vi.fn(); const setDoc = vi.fn();
    await expect(executeImmutableSave({ pendingSave, subtle: null, getDocFromServer, persist, clear, setDoc })).resolves.toMatchObject({ status: 'fingerprint-error', pendingSave });
    expect(getDocFromServer).not.toHaveBeenCalled(); expect(setDoc).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });

  it('returns stale-operation when ownership retires during rejected prepared digest', async () => {
    const pendingSave = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const operationToken = createSaveOperationToken({ draftId: 'draft', ownershipGeneration: 1, pendingSave });
    let current = true; let rejectDigest;
    const getDocFromServer = vi.fn(); const persist = vi.fn(); const clear = vi.fn(); const setDoc = vi.fn();
    const operation = executeImmutableSave({ pendingSave, operationToken, isCurrent: () => current, subtle: { digest: () => new Promise((_resolve, reject) => { rejectDigest = reject; }) }, getDocFromServer, persist, clear, setDoc });
    while (!rejectDigest) await new Promise(resolve => setTimeout(resolve, 0));
    current = false; rejectDigest(new Error('digest denied'));
    await expect(operation).resolves.toEqual({ status: 'stale-operation' });
    expect(getDocFromServer).not.toHaveBeenCalled(); expect(setDoc).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled();
  });

  it('returns stale-operation when ownership retires during rejected cleanup', async () => {
    const pendingSave = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const operationToken = createSaveOperationToken({ draftId: 'draft', ownershipGeneration: 1, pendingSave });
    let current = true; let rejectClear;
    const operation = executeImmutableSave({ pendingSave, operationToken, isCurrent: () => current, persist: vi.fn().mockResolvedValue(), setDoc: vi.fn().mockResolvedValue(), getDocFromServer: vi.fn(), clear: () => new Promise((_resolve, reject) => { rejectClear = reject; }) });
    while (!rejectClear) await new Promise(resolve => setTimeout(resolve, 0));
    current = false; rejectClear(new Error('cleanup denied'));
    await expect(operation).resolves.toEqual({ status: 'stale-operation' });
  });

  it('does not treat non-throwing adapter failures as persisted or cleared', async () => {
    const pendingSave = await prepareImmutableSave({ workoutId: candidate.id, candidate });
    const setDoc = vi.fn();
    await expect(executeImmutableSave({ pendingSave, persist: vi.fn().mockResolvedValue({ status: 'storage-error', operation: 'write', error: new Error('quota') }), clear: vi.fn(), setDoc, getDocFromServer: vi.fn() })).resolves.toMatchObject({ status: 'storage-error', pendingSave });
    expect(setDoc).not.toHaveBeenCalled();
    await expect(executeImmutableSave({ pendingSave, persist: vi.fn().mockResolvedValue(), clear: vi.fn().mockResolvedValue({ status: 'storage-error', error: new Error('remove denied') }), setDoc: vi.fn().mockResolvedValue(), getDocFromServer: vi.fn() })).resolves.toMatchObject({ status: 'cleanup-error', pendingSave: { state: 'write-pending', attemptCount: 1 } });
  });
});
