import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, inMemoryPersistence, setPersistence, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, initializeFirestore, memoryLocalCache, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BASELINE_EMAIL, BASELINE_PROVIDER_UID, BASELINE_USER_ID } from '../../scripts/emulator/fixtures/baseline.mjs';
import { createSaveOperationToken, executeImmutableSave as executeImmutableWorkoutSave, prepareImmutableSave } from '../utils/immutableWorkoutSave';
import { buildCanonicalV4WorkoutDocument } from '../utils/workoutFingerprint';

const enabled = process.env.EMULATOR_BASELINE_INTEGRATION === '1';
const suite = enabled ? describe : describe.skip;
let app; let firestore;
const candidateFor = (id, seconds = 1) => buildCanonicalV4WorkoutDocument({
  workoutId: id, finishRequestedAtEpochMs: Date.parse('2026-07-22T12:00:00.000Z'),
  phaseTargets: { warmupSeconds: 0, performanceSeconds: 60, cooldownSeconds: 0 },
  phaseActualSeconds: { warmup: 0, performance: seconds, cooldown: 0 },
  exercises: [{ id: 'x', occurrenceId: 'x:0', name: 'X', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, setRecords: [{ index: 0, completed: true, plannedRestSeconds: null, workDurationSeconds: 1, actualRestSeconds: null }] }],
});
const executeImmutableSave = args => executeImmutableWorkoutSave({ ...args,
  operationToken: createSaveOperationToken({ draftId: 'integration-draft', ownershipGeneration: 1, pendingSave: args.pendingSave }),
  isCurrent: () => true,
});

suite('immutable save emulator integration', () => {
  beforeAll(async () => {
    const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(':');
    const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    app = initializeApp({ apiKey: 'demo-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo-project', appId: 'immutable-save-integration' }, `immutable-save-${crypto.randomUUID()}`);
    const auth = getAuth(app); await setPersistence(auth, inMemoryPersistence); connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
    firestore = initializeFirestore(app, { localCache: memoryLocalCache() }); connectFirestoreEmulator(firestore, firestoreHost, Number(firestorePort));
    await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: BASELINE_PROVIDER_UID, email: BASELINE_EMAIL, email_verified: true })));
  });
  afterAll(async () => { if (app) await deleteApp(app); });

  it('performs owner create, server read, exact replay, and rejects divergent write/delete', async () => {
    const candidate = candidateFor('123e4567-e89b-42d3-a456-426614174000');
    const ref = doc(firestore, 'users', BASELINE_USER_ID, 'history', candidate.id);
    await expect(setDoc(ref, candidate)).resolves.toBeUndefined();
    await expect(getDocFromServer(ref)).resolves.toMatchObject({ exists: expect.any(Function) });
    await expect(setDoc(ref, candidate)).resolves.toBeUndefined();
    await expect(setDoc(ref, candidateFor(candidate.id, 2))).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it('reconciles real authoritative matching, absent, and conflict states', async () => {
    const matching = candidateFor('123e4567-e89b-42d3-a456-426614174001');
    const matchingRef = doc(firestore, 'users', BASELINE_USER_ID, 'history', matching.id); await setDoc(matchingRef, matching);
    const pending = await prepareImmutableSave({ workoutId: matching.id, candidate: matching });
    await expect(executeImmutableSave({ pendingSave: pending, persist: async () => {}, clear: async () => {}, setDoc: async () => { throw new Error('ambiguous'); }, getDocFromServer: () => getDocFromServer(matchingRef) })).resolves.toMatchObject({ status: 'saved', reconciled: true });
    const absent = candidateFor('123e4567-e89b-42d3-a456-426614174002'); const absentRef = doc(firestore, 'users', BASELINE_USER_ID, 'history', absent.id);
    await expect(executeImmutableSave({ pendingSave: await prepareImmutableSave({ workoutId: absent.id, candidate: absent }), persist: async () => {}, clear: async () => {}, setDoc: async () => { throw new Error('ambiguous'); }, getDocFromServer: () => getDocFromServer(absentRef) })).resolves.toMatchObject({ status: 'absent' });
    const conflict = candidateFor('123e4567-e89b-42d3-a456-426614174003'); const conflictRef = doc(firestore, 'users', BASELINE_USER_ID, 'history', conflict.id); await setDoc(conflictRef, candidateFor(conflict.id, 3));
    await expect(executeImmutableSave({ pendingSave: await prepareImmutableSave({ workoutId: conflict.id, candidate: conflict }), persist: async () => {}, clear: async () => {}, setDoc: async () => { throw new Error('denied'); }, getDocFromServer: () => getDocFromServer(conflictRef) })).resolves.toMatchObject({ status: 'conflict' });
  });
});
