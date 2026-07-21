import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithCredential,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getDocsFromServer,
  initializeFirestore,
  memoryLocalCache,
  setDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASELINE_EMAIL,
  BASELINE_FIXTURE_REVISION,
  BASELINE_PROVIDER_UID,
  BASELINE_USER_ID,
} from '../../scripts/emulator/fixtures/baseline.mjs';
import { resetAndSeedBaseline } from '../../scripts/emulator/seed-baseline.mjs';

const enabled = process.env.EMULATOR_BASELINE_INTEGRATION === '1';
const describeIntegration = enabled ? describe : describe.skip;
const projectId = 'demo-project';
let app;
let auth;
let firestore;

describeIntegration('deterministic emulator baseline integration', () => {
  beforeAll(async () => {
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
    if (!authHost || !firestoreHost) throw new Error('Integration emulator hosts are required');
    const [authHostname, authPort] = authHost.split(':');
    const [firestoreHostname, firestorePort] = firestoreHost.split(':');

    app = initializeApp({
      apiKey: 'demo-key',
      authDomain: 'demo.firebaseapp.com',
      projectId,
      appId: 'emulator-baseline-integration',
    }, `emulator-baseline-client-${crypto.randomUUID()}`);
    auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    connectAuthEmulator(auth, `http://${authHostname}:${authPort}`, { disableWarnings: true });
    firestore = initializeFirestore(app, { localCache: memoryLocalCache() });
    connectFirestoreEmulator(firestore, firestoreHostname, Number(firestorePort));
  });

  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  it('maps the mock Google identity to the fixed UID and reads rules-backed fixture data', async () => {
    const mockGoogleIdToken = JSON.stringify({
      sub: BASELINE_PROVIDER_UID,
      email: BASELINE_EMAIL,
      email_verified: true,
      name: 'Emulator Baseline User',
    });
    const result = await signInWithCredential(auth, GoogleAuthProvider.credential(mockGoogleIdToken));
    expect(result.user.uid).toBe(BASELINE_USER_ID);
    expect(result.user.providerData).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'google.com', uid: BASELINE_PROVIDER_UID }),
    ]));
    const token = await result.user.getIdTokenResult();
    expect(token.claims.approved).toBe(true);

    const userRef = doc(firestore, 'users', BASELINE_USER_ID);
    const [user, catalog, history] = await Promise.all([
      getDocFromServer(userRef),
      getDocsFromServer(collection(userRef, 'catalog')),
      getDocsFromServer(collection(userRef, 'history')),
    ]);
    expect(user.data()).toEqual(expect.objectContaining({
      emulatorFixtureRevision: BASELINE_FIXTURE_REVISION,
      emulatorProfile: 'test',
      warmupTime: 10,
      staleThreshold: 5,
      legDayOfWeek: 'None',
      defaultRestSeconds: 90,
    }));
    expect(catalog.size).toBe(15);
    expect(history.empty).toBe(true);
  });

  it('resets canonical mutations back to the same empty baseline', async () => {
    const historyRef = collection(firestore, 'users', BASELINE_USER_ID, 'history');
    await setDoc(doc(historyRef, 'integration-mutation'), { date: '2026-07-18' });
    expect((await getDocsFromServer(historyRef)).size).toBe(1);

    await resetAndSeedBaseline({
      projectId,
      hosts: {
        auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
        firestore: process.env.FIRESTORE_EMULATOR_HOST,
      },
      profile: 'test',
    });

    const [user, catalog, history] = await Promise.all([
      getDocFromServer(doc(firestore, 'users', BASELINE_USER_ID)),
      getDocsFromServer(collection(firestore, 'users', BASELINE_USER_ID, 'catalog')),
      getDocsFromServer(historyRef),
    ]);
    expect(user.data()?.emulatorFixtureRevision).toBe(BASELINE_FIXTURE_REVISION);
    expect(catalog.size).toBe(15);
    expect(history.empty).toBe(true);
  });
});
