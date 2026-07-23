import { canonicalizeWorkoutV4, fingerprintWorkoutV4, isCanonicalWorkoutId } from './workoutFingerprint';

const FINGERPRINT = Object.freeze({ canonicalization: 'workout-v4-json-v1', algorithm: 'SHA-256' });

const sameFingerprint = (left, right) => left?.canonicalization === FINGERPRINT.canonicalization
  && left?.algorithm === FINGERPRINT.algorithm && left?.hex === right?.hex;
const PENDING_KEYS = ['state', 'workoutId', 'fingerprint', 'candidate', 'attemptCount', 'lastAttemptAtEpochMs', 'lastReconciliationAtEpochMs'];
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export function createImmutableWorkoutId(createUuid = () => crypto.randomUUID()) {
  const workoutId = createUuid();
  if (!isCanonicalWorkoutId(workoutId)) throw new TypeError('Save identity must be a lowercase UUIDv4');
  return workoutId;
}

export function createSaveOperationToken({ draftId, ownershipGeneration, pendingSave }) {
  return Object.freeze({ draftId, ownershipGeneration, workoutId: pendingSave?.workoutId,
    fingerprintHex: pendingSave?.fingerprint?.hex, attemptCount: pendingSave?.attemptCount });
}

function isValidOperationToken(token, pendingSave) {
  return exact(token, ['draftId', 'ownershipGeneration', 'workoutId', 'fingerprintHex', 'attemptCount'])
    && typeof token.draftId === 'string' && token.draftId.length > 0
    && Number.isSafeInteger(token.ownershipGeneration) && token.ownershipGeneration >= 1
    && token.workoutId === pendingSave?.workoutId && token.fingerprintHex === pendingSave?.fingerprint?.hex
    && token.attemptCount === pendingSave?.attemptCount;
}

export function isValidPendingSave(pending) {
  if (!exact(pending, PENDING_KEYS) || !isCanonicalWorkoutId(pending.workoutId)
    || !exact(pending.fingerprint, ['canonicalization', 'algorithm', 'hex'])
    || pending.candidate?.id !== pending.workoutId || !sameFingerprint(pending.fingerprint, pending.fingerprint)
    || !/^[0-9a-f]{64}$/.test(pending.fingerprint?.hex)
    || !Number.isSafeInteger(pending.attemptCount) || pending.attemptCount < 0) return false;
  try { canonicalizeWorkoutV4(pending.candidate); } catch { return false; }
  if (!['prepared', 'write-pending', 'retryable-absent', 'reconcile-indeterminate', 'blocked-conflict'].includes(pending.state)) return false;
  if (pending.state === 'prepared') return pending.attemptCount === 0
    && pending.lastAttemptAtEpochMs === null && pending.lastReconciliationAtEpochMs === null;
  return pending.attemptCount >= 1 && Number.isSafeInteger(pending.lastAttemptAtEpochMs) && pending.lastAttemptAtEpochMs >= 0
    && (pending.state === 'write-pending'
      ? (pending.lastReconciliationAtEpochMs === null || (Number.isSafeInteger(pending.lastReconciliationAtEpochMs) && pending.lastReconciliationAtEpochMs >= 0))
      : (Number.isSafeInteger(pending.lastReconciliationAtEpochMs) && pending.lastReconciliationAtEpochMs >= 0));
}

export async function prepareImmutableSave({ workoutId, candidate }) {
  if (!isCanonicalWorkoutId(workoutId) || candidate?.id !== workoutId) throw new TypeError('Invalid immutable workout identity');
  const fingerprint = await fingerprintWorkoutV4(candidate);
  return freeze({ state: 'prepared', workoutId, fingerprint, candidate, attemptCount: 0, lastAttemptAtEpochMs: null, lastReconciliationAtEpochMs: null });
}

export async function reconcileImmutableSave({ pendingSave, getDocFromServer, now = () => Date.now(), subtle }) {
  if (!isValidPendingSave(pendingSave)) return { status: 'invalid-pending-save' };
  try {
    const fingerprint = await fingerprintWorkoutV4(pendingSave.candidate, { subtle });
    if (!sameFingerprint(fingerprint, pendingSave.fingerprint)) return { status: 'invalid-pending-save' };
  } catch (error) { return { status: 'fingerprint-error', pendingSave, error }; }
  const reconciledAt = Math.max(pendingSave.lastReconciliationAtEpochMs ?? 0, now());
  try {
    const snapshot = await getDocFromServer();
    if (!snapshot.exists()) return { status: 'absent', pendingSave: { ...pendingSave, state: 'retryable-absent', lastReconciliationAtEpochMs: reconciledAt } };
    const server = snapshot.data();
    let serverBytes;
    try { serverBytes = canonicalizeWorkoutV4(server); } catch { return { status: 'conflict', pendingSave: { ...pendingSave, state: 'blocked-conflict', lastReconciliationAtEpochMs: reconciledAt } }; }
    if (serverBytes === canonicalizeWorkoutV4(pendingSave.candidate)) return { status: 'matching' };
    return { status: 'conflict', pendingSave: { ...pendingSave, state: 'blocked-conflict', lastReconciliationAtEpochMs: reconciledAt } };
  } catch (error) {
    return { status: 'indeterminate', pendingSave: { ...pendingSave, state: 'reconcile-indeterminate', lastReconciliationAtEpochMs: reconciledAt }, error };
  }
}

/** Runs only against injected storage/network adapters; production wiring is A8. */
export async function executeImmutableSave({ pendingSave, persist, clear, setDoc, getDocFromServer, now = () => Date.now(), operationToken, isCurrent = () => true, subtle }) {
  if (!isValidOperationToken(operationToken, pendingSave)) return { status: 'invalid-operation-token' };
  let token = operationToken;
  let durablePending = pendingSave;
  const current = () => !token || isCurrent(token);
  const guardedPersist = async nextPending => {
    if (!current()) return { status: 'stale-operation' };
    let result;
    try { result = await persist(nextPending, token); }
    catch (error) { return current() ? { status: 'storage-error', operation: 'persist', pendingSave: durablePending, error } : { status: 'stale-operation' }; }
    if (result === undefined || ['saved', 'persisted'].includes(result?.status)) { durablePending = nextPending; return { status: 'persisted' }; }
    if (result?.status === 'stale-operation') return result;
    return { status: result?.status ?? 'storage-error', operation: result?.operation ?? 'persist', pendingSave: durablePending, error: result?.error };
  };
  const guardedClear = async pending => {
    if (!current()) return { status: 'stale-operation' };
    try {
      const result = await clear(token);
      if (!current()) return { status: 'stale-operation' };
      if (result === undefined || ['saved', 'removed', 'cleared'].includes(result?.status)) return { status: 'cleared' };
      if (result?.status === 'stale-operation') return result;
      return { status: 'cleanup-error', pendingSave: pending, error: result?.error ?? result };
    } catch (error) { return current() ? { status: 'cleanup-error', pendingSave: pending, error } : { status: 'stale-operation' }; }
  };
  if (!current()) return { status: 'stale-operation' };
  if (!isValidPendingSave(pendingSave)) return { status: 'invalid-pending-save' };
  if (pendingSave.state === 'blocked-conflict') return { status: 'blocked-conflict', pendingSave };
  if (pendingSave.state === 'write-pending' || pendingSave.state === 'reconcile-indeterminate') {
    const reconciliation = await reconcileImmutableSave({ pendingSave, getDocFromServer, now, subtle });
    if (!current()) return { status: 'stale-operation' };
    if (reconciliation.status === 'matching') {
      const cleared = await guardedClear(pendingSave); if (cleared.status !== 'cleared') return cleared;
      return current() ? { status: 'saved' } : { status: 'stale-operation' };
    }
    if (reconciliation.status === 'invalid-pending-save' || reconciliation.status === 'fingerprint-error') return reconciliation;
    if (reconciliation.status !== 'absent') { const persisted = await guardedPersist(reconciliation.pendingSave); if (persisted.status !== 'persisted') return persisted; return current() ? reconciliation : { status: 'stale-operation' }; }
    pendingSave = reconciliation.pendingSave;
  }
  let fingerprint;
  try { fingerprint = await fingerprintWorkoutV4(pendingSave.candidate, { subtle }); }
  catch (error) { return current() ? { status: 'fingerprint-error', pendingSave, error } : { status: 'stale-operation' }; }
  if (!current()) return { status: 'stale-operation' };
  if (!sameFingerprint(fingerprint, pendingSave.fingerprint)) return { status: 'invalid-pending-save' };
  if (pendingSave.attemptCount >= Number.MAX_SAFE_INTEGER) return { status: 'invalid-pending-save' };
  const attempt = {
    ...pendingSave, state: 'write-pending', attemptCount: pendingSave.attemptCount + 1,
    lastAttemptAtEpochMs: Math.max(pendingSave.lastAttemptAtEpochMs ?? 0, now()),
  };
  const persistedAttempt = await guardedPersist(attempt);
  if (persistedAttempt.status !== 'persisted') return persistedAttempt;
  if (token) token = Object.freeze({ ...token, attemptCount: attempt.attemptCount });
  if (!current()) return { status: 'stale-operation' };
  try {
    await setDoc(attempt.candidate);
  } catch {
    const reconciliation = await reconcileImmutableSave({ pendingSave: attempt, getDocFromServer, now, subtle });
    if (!current()) return { status: 'stale-operation' };
    if (reconciliation.status === 'matching') {
      const cleared = await guardedClear(attempt); if (cleared.status !== 'cleared') return cleared;
      return current() ? { status: 'saved', reconciled: true } : { status: 'stale-operation' };
    }
    if (reconciliation.status === 'invalid-pending-save' || reconciliation.status === 'fingerprint-error') return reconciliation;
    const persisted = await guardedPersist(reconciliation.pendingSave); if (persisted.status !== 'persisted') return persisted;
    return current() ? reconciliation : { status: 'stale-operation' };
  }
  if (!current()) return { status: 'stale-operation' };
  const cleared = await guardedClear(attempt); if (cleared.status !== 'cleared') return cleared;
  return current() ? { status: 'saved' } : { status: 'stale-operation' };
}
