import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-project';
const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_EMULATOR_HUB);
const describeFirestore = hasFirestoreEmulator ? describe : describe.skip;

let testEnv;

describeFirestore('Firestore rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: firestoreRules,
      },
    });
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('denies unauthenticated access to user data', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(db.doc('users/alex').set({ settings: { staleThreshold: 5 } }));
    await assertFails(db.doc('users/alex/workouts/workout-1').set({ status: 'draft' }));
  });

  it.each([
    ['missing', {}],
    ['false', { approved: false }],
    ['string', { approved: 'true' }],
    ['number', { approved: 1 }],
  ])('denies a user with a %s approved claim from their own root and subtree', async (_label, token) => {
    const db = testEnv.authenticatedContext('alex', token).firestore();

    await assertFails(db.doc('users/alex').set({ settings: { staleThreshold: 5 } }));
    await assertFails(db.doc('users/alex/workouts/workout-1').set({ status: 'draft' }));
  });

  it('allows a user with strict approved:true to access their own subtree', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const docRef = db.doc('users/alex/workouts/workout-1');

    await assertSucceeds(docRef.set({ status: 'complete' }));
    const snapshot = await assertSucceeds(docRef.get());

    expect(snapshot.data()).toEqual({ status: 'complete' });
  });

  it('allows a user with strict approved:true to access their own settings document', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();
    const docRef = db.doc('users/alex');

    await assertSucceeds(docRef.set({ settings: { staleThreshold: 5 } }));
    const snapshot = await assertSucceeds(docRef.get());

    expect(snapshot.data()).toEqual({ settings: { staleThreshold: 5 } });
  });

  it('denies a strict approved user access to another user root and subtree', async () => {
    const db = testEnv.authenticatedContext('alex', { approved: true }).firestore();

    await assertFails(db.doc('users/bob').get());
    await assertFails(db.doc('users/bob/workouts/workout-1').get());
  });
});
