import { createRecoveryDraft, readRecoveryDraft, recoveryLockName, recoveryStorageKey, validateRecoveryDraft, hydrateRecoveryDraft, isValidRecoveryIdentity } from './activeWorkoutRecovery';

const DEFAULT_TIMEOUT_MS = 8_000;
const validExpected = expected => expected && typeof expected.draftId === 'string' && expected.draftId.length > 0 && Number.isSafeInteger(expected.ownershipGeneration) && expected.ownershipGeneration >= 1;
const matches = (draft, expected) => validExpected(expected) && draft.draftId === expected.draftId && draft.ownershipGeneration === expected.ownershipGeneration;

export function createActiveWorkoutCoordinator({ storage, locks, handoffTransport, onLeaseLost, now = () => Date.now(), createUuid = () => crypto.randomUUID(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, staleAfterMs = 86_400_000, acquisitionTimeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const leases = new Map();
  const lost = new Set();
  const read = identity => readRecoveryDraft({ storage, ...identity, nowEpochMs: now(), staleAfterMs });
  const key = identity => recoveryStorageKey(identity);
  const leaseKey = identity => recoveryLockName(identity);
  function write(identity, draft) {
    if (!validateRecoveryDraft(draft)) return { status: 'invalid-draft' };
    let serialized;
    try { serialized = JSON.stringify(draft); } catch (error) { return { status: 'storage-error', operation: 'serialize', error }; }
    try { storage.setItem(key(identity), serialized); return { status: 'saved', snapshot: draft }; } catch (error) { return { status: 'storage-error', operation: 'write', error }; }
  }
  function withLease(identity, operation, { signal, acquisitionBudgetMs = acquisitionTimeoutMs } = {}) {
    if (!isValidRecoveryIdentity(identity)) return Promise.resolve({ status: 'invalid-identity' });
    const name = leaseKey(identity); if (lost.has(name)) return Promise.resolve({ status: 'lost' }); const existing = leases.get(name);
    if (existing?.active) return Promise.resolve().then(operation);
    if (!locks?.request) return Promise.resolve({ status: 'unsupported' });
    if (signal?.aborted) return Promise.resolve({ status: 'aborted' });
    const controller = new AbortController(); let timedOut = false; let settleReady; let settled = false;
    const ready = new Promise(resolve => { settleReady = value => { if (!settled) { settled = true; resolve(value); } }; });
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeoutFn(() => { timedOut = true; controller.abort(); }, acquisitionBudgetMs);
    let cleaned = false;
    const cleanup = () => { if (!cleaned) { cleaned = true; clearTimeoutFn(timer); signal?.removeEventListener('abort', abort); } };
    const finish = value => { cleanup(); settleReady(value); };
    let request;
    try { request = locks.request(name, { mode: 'exclusive', signal: controller.signal }, async lock => {
      if (!lock) return finish({ status: 'conflict' });
      if (controller.signal.aborted) return finish({ status: timedOut ? 'timeout' : 'aborted' });
      cleanup();
      let release; const released = new Promise(resolve => { release = resolve; });
      const lease = { active: true, released: false, release: () => { if (lease.active) { lease.active = false; lease.released = true; release(); } } };
      leases.set(name, lease);
      let result; try { result = await operation(); } catch (error) { result = { status: 'invalid-draft', error }; }
      finish(result);
      if (!['acquired', 'saved'].includes(result?.status)) lease.release();
      await released;
      leases.delete(name);
      return result;
    }); } catch (error) { finish(controller.signal.aborted ? { status: timedOut ? 'timeout' : 'aborted' } : { status: 'denied', error }); return ready; }
    request.catch(error => { const lease = leases.get(name); if (lease?.active) { lease.active = false; leases.delete(name); lost.add(name); onLeaseLost?.({ status: 'lost', identity, error }); finish({ status: 'lost', error }); } else if (controller.signal.aborted) finish({ status: timedOut ? 'timeout' : 'aborted' }); else finish({ status: 'denied', error }); });
    return ready;
  }
  function release(identity) { const lease = leases.get(leaseKey(identity)); if (!lease?.active) return { status: 'released' }; lease.release(); return { status: 'released' }; }
  return {
    async handoffResume({ projectId, uid, expected, nonce, signal }) {
      if (!validExpected(expected)) return { status: 'invalid-expected' };
      const identity = { projectId, uid }; const startedAt = now();
      const handoff = await this.requestHandoff({ ...identity, draftId: expected.draftId, ownershipGeneration: expected.ownershipGeneration, nonce, timeoutMs: acquisitionTimeoutMs, signal });
      if (handoff.status !== 'handoff-acknowledged') return handoff;
      const remaining = acquisitionTimeoutMs - Math.max(0, now() - startedAt);
      if (remaining <= 0) return { status: 'timeout' };
      // Resume uses only the unused portion of the shared handoff deadline.
      return this.resume({ ...identity, expected, signal, acquisitionBudgetMs: Math.min(acquisitionTimeoutMs, remaining) });
    },
    start({ projectId, uid, phaseTargets, activeWorkout, signal }) {
      const identity = { projectId, uid };
      return withLease(identity, () => {
        const current = read(identity); if (current.status === 'storage-error') return current;
        if (current.status !== 'missing') return { status: current.status === 'resumable' ? 'conflict' : current.status };
        const draft = createRecoveryDraft({ ...identity, draftId: createUuid(), ownershipGeneration: 1, lastMutationAtEpochMs: now(), phaseTargets, activeWorkout });
        const saved = write(identity, draft); if (saved.status === 'saved') leases.get(leaseKey(identity)).snapshot = draft; return saved.status === 'saved' ? { status: 'acquired', snapshot: draft } : saved;
      }, { signal });
    },
    resume({ projectId, uid, expected, signal, acquisitionBudgetMs }) {
      if (!validExpected(expected)) return Promise.resolve({ status: 'invalid-expected' });
      const identity = { projectId, uid };
      if (isValidRecoveryIdentity(identity) && leases.get(leaseKey(identity))?.active) return Promise.resolve({ status: 'conflict' });
      return withLease(identity, () => { const current = read(identity); if (current.status !== 'resumable') return current; if (!matches(current.draft, expected)) return { status: 'stale-generation' }; if (current.draft.ownershipGeneration >= Number.MAX_SAFE_INTEGER) return { status: 'invalid-draft' }; const draft = { ...current.draft, ownershipGeneration: current.draft.ownershipGeneration + 1, lastMutationAtEpochMs: Math.max(current.draft.lastMutationAtEpochMs, now()) }; const saved = write(identity, draft); if (saved.status === 'saved') leases.get(leaseKey(identity)).snapshot = draft; return saved.status === 'saved' ? { status: 'acquired', snapshot: draft, hydrated: hydrateRecoveryDraft(draft) } : saved; }, { signal, acquisitionBudgetMs });
    },
    mutate({ projectId, uid, expected, transform, signal }) {
      if (!validExpected(expected)) return Promise.resolve({ status: 'invalid-expected' });
      const identity = { projectId, uid };
      return withLease(identity, () => { const current = read(identity); if (current.status !== 'resumable') return current; if (!matches(current.draft, expected)) return { status: 'stale-generation' }; let changed; try { changed = transform(structuredClone(current.draft)); } catch (error) { return { status: 'invalid-draft', error }; } try { if (changed.projectId !== projectId || changed.uid !== uid || changed.draftId !== current.draft.draftId || changed.ownershipGeneration !== current.draft.ownershipGeneration) return { status: 'invalid-draft' }; } catch (error) { return { status: 'invalid-draft', error }; } const draft = { ...changed, projectId, uid, draftId: current.draft.draftId, ownershipGeneration: current.draft.ownershipGeneration, lastMutationAtEpochMs: Math.max(current.draft.lastMutationAtEpochMs, now()) }; const saved = write(identity, draft); if (saved.status === 'saved' && leases.get(leaseKey(identity))) leases.get(leaseKey(identity)).snapshot = draft; return saved; }, { signal });
    },
    discard({ projectId, uid, expected, signal }) {
      if (!validExpected(expected)) return Promise.resolve({ status: 'invalid-expected' });
      const identity = { projectId, uid };
      return withLease(identity, () => { const current = read(identity); if (current.status === 'missing') return current; if (!current.draft || !matches(current.draft, expected)) return current.draft ? { status: 'stale-generation' } : current; try { storage.removeItem(key(identity)); release(identity); return { status: 'removed' }; } catch (error) { return { status: 'storage-error', operation: 'remove', error }; } }, { signal });
    },
    release: ({ projectId, uid }) => isValidRecoveryIdentity({ projectId, uid }) ? release({ projectId, uid }) : { status: 'invalid-identity' },
    resetLost({ projectId, uid }) { if (!isValidRecoveryIdentity({ projectId, uid })) return { status: 'invalid-identity' }; lost.delete(leaseKey({ projectId, uid })); return { status: 'released' }; },
    async requestHandoff({ projectId, uid, draftId, ownershipGeneration, nonce, timeoutMs = acquisitionTimeoutMs, signal }) {
      if (!isValidRecoveryIdentity({ projectId, uid })) return { status: 'invalid-identity' };
      if (!handoffTransport?.request || typeof nonce !== 'string' || !nonce) return { status: handoffTransport ? 'invalid-handoff' : 'unsupported' };
      if (signal?.aborted) return { status: 'aborted' };
      const identity = { projectId, uid }; let timerId; let cleaned = false; let abortResolve; const abort = new Promise(resolve => { abortResolve = resolve; }); const onAbort = () => abortResolve({ status: 'aborted' }); signal?.addEventListener('abort', onAbort, { once: true }); const cleanup = () => { if (!cleaned) { cleaned = true; clearTimeoutFn(timerId); signal?.removeEventListener('abort', onAbort); } }; const timer = new Promise(resolve => { timerId = setTimeoutFn(() => resolve({ status: 'timeout' }), timeoutMs); });
      const message = { nonce, draftId, ownershipGeneration };
      let response; try { response = await Promise.race([handoffTransport.request(identity, message), timer, abort]); } catch (error) { cleanup(); return { status: 'denied', error }; } cleanup();
      if (response?.status === 'timeout' || response?.status === 'aborted') return response;
      if (!response || response.status !== 'accepted' || response.nonce !== nonce) return { status: 'conflict' };
      // An acknowledgement only asks the owner to release; it never grants the requester ownership.
      return { status: 'handoff-acknowledged' };
    },
    acceptHandoff({ projectId, uid, nonce, draftId, ownershipGeneration }) {
      const identity = { projectId, uid };
      if (!isValidRecoveryIdentity(identity)) return { status: 'invalid-identity' };
      if (typeof nonce !== 'string' || nonce.length === 0) return { status: 'invalid-handoff' };
      const lease = leases.get(leaseKey(identity));
      if (!lease?.active || !matches(lease.snapshot, { draftId, ownershipGeneration })) return { status: 'conflict' };
      lease.release(); return { status: 'accepted', nonce };
    },
    authCleanup({ priorProjectId, priorUid, expected, signal }) { if (!validExpected(expected)) return Promise.resolve({ status: 'invalid-expected' }); return this.discard({ projectId: priorProjectId, uid: priorUid, expected, signal }); },
  };
}
