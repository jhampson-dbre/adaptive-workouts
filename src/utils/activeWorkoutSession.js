import { activeWorkoutReducer, initializeActiveWorkout } from './activeWorkout';
import { projectActiveWorkoutForRecovery } from './activeWorkoutRecovery';
import { buildCanonicalV4WorkoutDocument } from './workoutFingerprint';
import { createImmutableWorkoutId, createSaveOperationToken, executeImmutableSave, prepareImmutableSave } from './immutableWorkoutSave';

const empty = Object.freeze({ status: 'idle', activeWorkout: null, phaseTargets: null, snapshot: null, pendingSave: null, error: null, blocked: false });
const okay = status => ['saved', 'acquired', 'removed', 'missing'].includes(status);
const validExpected = snapshot => typeof snapshot?.draftId === 'string' && snapshot.draftId.length > 0
  && Number.isSafeInteger(snapshot.ownershipGeneration) && snapshot.ownershipGeneration >= 1;

/**
 * App-owned durable state machine.  React only observes this object; every mutation
 * is committed to the recovery coordinator before subscribers see it.
 */
export function createActiveWorkoutSession({ coordinator, projectId, saveImmutableWorkout, readImmutableWorkoutFromServer, createUuid = () => crypto.randomUUID(), now = () => Date.now(), subscribeHandoff }) {
  let identity = null; let state = empty; let epoch = 0; let tail = Promise.resolve(); let unsubscribeHandoff; const listeners = new Set();
  const publish = next => { state = Object.freeze(next); listeners.forEach(listener => listener(state)); };
  const current = value => value === epoch;
  const enqueue = task => { tail = tail.then(task, task); return tail; };
  const expected = () => state.snapshot && { draftId: state.snapshot.draftId, ownershipGeneration: state.snapshot.ownershipGeneration };
  const fail = (error, status = 'blocked') => publish({ ...state, status, error, blocked: true });
  return {
    getState: () => state,
    isIdentity: uid => identity?.uid === uid,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    bootstrap(nextIdentity) { return enqueue(async () => {
      if (nextIdentity?.uid && identity?.uid === nextIdentity.uid) return;
      const token = ++epoch; unsubscribeHandoff?.(); unsubscribeHandoff = undefined; identity = nextIdentity;
      if (!identity?.uid || !projectId) return publish(empty);
      if (subscribeHandoff) unsubscribeHandoff = subscribeHandoff({ projectId, uid: identity.uid }, message => enqueue(async () => {
        if (message?.draftId !== state.snapshot?.draftId || message?.ownershipGeneration !== state.snapshot?.ownershipGeneration) return undefined;
        const accepted = coordinator.acceptHandoff({ projectId, uid: identity.uid, nonce: message.nonce, draftId: message.draftId, ownershipGeneration: message.ownershipGeneration });
        if (accepted.status !== 'accepted') return undefined;
        publish({ ...state, status: 'recovery-blocked', error: 'handoff-released', blocked: true });
        return accepted;
      }));
      const result = await coordinator.inspect({ projectId, uid: identity.uid });
      if (!current(token)) return;
      if (result.status === 'missing') return publish({ ...empty, status: 'idle' });
      if (result.status === 'resumable') return publish({ status: 'recovery-available', activeWorkout: result.hydrated, phaseTargets: result.draft.phaseTargets, snapshot: result.draft, pendingSave: result.draft.pendingSave, error: null, blocked: true });
      publish({ ...empty, status: 'recovery-blocked', snapshot: result.status === 'stale' ? result.draft : null, error: result.status, blocked: true });
    }); },
    stageGenerated(exercises, phaseTargets) { return enqueue(async () => {
      if (!identity?.uid) { fail('Sign in before starting a workout.'); return false; }
      const activeWorkout = initializeActiveWorkout(exercises, { phaseTimingEnabled: true });
      publish({ status: 'generated', activeWorkout, phaseTargets: Object.freeze(structuredClone(phaseTargets)), snapshot: null, pendingSave: null, error: null, blocked: false });
      return true;
    }); },
    resume() { return enqueue(async () => {
      if (!identity?.uid || !expected()) return false;
      const token = epoch; const result = await coordinator.resume({ projectId, uid: identity.uid, expected: expected() });
      if (!current(token)) return false;
      if (result.status !== 'acquired') { fail(result.status, 'recovery-blocked'); return false; }
      publish({ status: 'owned', activeWorkout: result.hydrated, phaseTargets: result.snapshot.phaseTargets, snapshot: result.snapshot, pendingSave: result.snapshot.pendingSave, error: null, blocked: false });
      return true;
    }); },
    requestHandoff() { return enqueue(async () => {
      if (!identity?.uid || !expected() || !coordinator.handoffResume) return false;
      const token = epoch; const result = await coordinator.handoffResume({ projectId, uid: identity.uid, expected: expected(), nonce: createUuid() });
      if (!current(token)) return false;
      if (result.status !== 'acquired') { fail(result.status, 'recovery-blocked'); return false; }
      publish({ status: 'owned', activeWorkout: result.hydrated, phaseTargets: result.snapshot.phaseTargets, snapshot: result.snapshot, pendingSave: result.snapshot.pendingSave, error: null, blocked: false });
      return true;
    }); },
    discard() { return enqueue(async () => {
      if (state.status === 'generated') return publish(empty);
      if (!identity?.uid || !expected()) return;
      const token = epoch; const result = await coordinator.discard({ projectId, uid: identity.uid, expected: expected() });
      if (!current(token)) return;
      if (!okay(result.status)) return fail(result.status, 'recovery-blocked');
      publish(empty);
    }); },
    exit() { return enqueue(async () => {
      if ((state.blocked && state.snapshot) || state.status === 'recovery-blocked') return publish(empty);
      if (!state.activeWorkout) return publish(empty);
      const status = state.activeWorkout.phase === 'generated' ? 'generated' : state.activeWorkout.phase === 'review' ? 'review' : 'owned';
      publish({ ...state, status, error: null, blocked: false });
    }); },
    action(action) { return enqueue(async () => {
      if (!identity?.uid || !state.activeWorkout) return false;
      const next = activeWorkoutReducer(state.activeWorkout, action);
      if (next === state.activeWorkout) return false;
      const token = epoch;
      if (state.status === 'generated') {
        if (action.type !== 'startWorkout') return false;
        const result = await coordinator.start({ projectId, uid: identity.uid, phaseTargets: state.phaseTargets, activeWorkout: next });
        if (!current(token)) return false;
        if (result.status !== 'acquired') {
          if (['conflict', 'timeout'].includes(result.status) && coordinator.inspect) {
            const retained = await coordinator.inspect({ projectId, uid: identity.uid });
            if (!current(token)) return false;
            if (retained.status === 'resumable' && validExpected(retained.draft)) {
              publish({ status: 'recovery-blocked', activeWorkout: retained.hydrated, phaseTargets: retained.draft.phaseTargets, snapshot: retained.draft, pendingSave: retained.draft.pendingSave, error: result.status, blocked: true });
              return false;
            }
          }
          fail(result.status); return false;
        }
        publish({ status: 'owned', activeWorkout: next, phaseTargets: state.phaseTargets, snapshot: result.snapshot, pendingSave: null, error: null, blocked: false });
        return true;
      }
      if (state.blocked || !expected()) return false;
      const result = await coordinator.mutate({ projectId, uid: identity.uid, expected: expected(), transform: draft => ({ ...draft, activeWorkout: projectActiveWorkoutForRecovery(next) }) });
      if (!current(token)) return false;
      if (result.status !== 'saved') { fail(result.status); return false; }
      let snapshot = result.snapshot;
      if (next.phase === 'review' && snapshot.version === 1) {
        const migrated = await coordinator.migrateToV2({ projectId, uid: identity.uid, expected: snapshot });
        if (!current(token)) return false;
        if (migrated.status !== 'saved') { fail(migrated.status); return false; }
        snapshot = migrated.snapshot;
      }
      publish({ ...state, status: next.phase === 'review' ? 'review' : 'owned', activeWorkout: next, snapshot, pendingSave: snapshot.pendingSave, error: null });
      return true;
    }); },
    save() { return enqueue(async () => {
      if (state.blocked || state.activeWorkout?.phase !== 'review' || !identity?.uid || !expected()) return;
      const token = epoch; let pending = state.pendingSave;
      try {
        if (!pending) {
          const workoutId = createImmutableWorkoutId(createUuid);
          const candidate = buildCanonicalV4WorkoutDocument({ workoutId, finishRequestedAtEpochMs: state.activeWorkout.phaseCandidate.finishRequestedAtEpochMs, phaseTargets: state.phaseTargets, phaseActualSeconds: state.activeWorkout.phaseCandidate.phaseActualSeconds, exercises: state.activeWorkout.exercises });
          pending = await prepareImmutableSave({ workoutId, candidate });
          const operationToken = createSaveOperationToken({ ...expected(), pendingSave: pending });
          const persisted = await coordinator.persistPendingSave({ projectId, uid: identity.uid, expected: expected(), operationToken, pendingSave: pending });
          if (!current(token) || persisted.status !== 'saved') return !current(token) ? undefined : fail(persisted.status);
          publish({ ...state, status: 'save-pending', snapshot: persisted.snapshot, pendingSave: pending, error: null });
        }
        const operationToken = createSaveOperationToken({ ...expected(), pendingSave: pending });
        const result = await executeImmutableSave({ pendingSave: pending, operationToken,
          persist: (next, operation) => coordinator.persistPendingSave({ projectId, uid: identity.uid, expected: expected(), operationToken: operation, pendingSave: next }),
          clear: operation => coordinator.completeSave({ projectId, uid: identity.uid, expected: expected(), operationToken: operation }),
          setDoc: document => saveImmutableWorkout(identity.uid, document.id, document),
          getDocFromServer: () => readImmutableWorkoutFromServer(identity.uid, pending.workoutId), now,
          isCurrent: () => current(token),
        });
        if (!current(token)) return;
        if (result.status === 'saved') return publish({ ...empty, status: 'saved' });
        const nextPending = result.pendingSave ?? pending;
        publish({ ...state, status: 'review', error: result.status, pendingSave: nextPending, blocked: nextPending?.state === 'blocked-conflict' });
      } catch (error) { if (current(token)) fail(error?.message ?? 'save failed', 'review'); }
    }); },
    retireIdentity() { return enqueue(async () => {
      const prior = identity; const priorExpected = expected();
      ++epoch; unsubscribeHandoff?.(); unsubscribeHandoff = undefined; identity = null; publish(empty);
      if (prior?.uid && priorExpected) await coordinator.authCleanup({ priorProjectId: projectId, priorUid: prior.uid, expected: priorExpected });
    }); },
  };
}
