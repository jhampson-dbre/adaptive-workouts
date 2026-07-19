import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import baselineFixture, {
  BASELINE_FIXTURE_REVISION,
  BASELINE_PROJECT_ID,
  BASELINE_PROVIDER_ID,
  BASELINE_PROVIDER_UID,
  BASELINE_USER_ID,
} from './fixtures/baseline.mjs';
import { assertValidBaselineFixture } from './validate-fixture.mjs';

const request = async (url, options) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${options?.method ?? 'GET'} ${url} failed with ${response.status}: ${await response.text()}`);
  return response;
};

export const withAdminEmulators = async ({ projectId = BASELINE_PROJECT_ID, hosts }, callback) => {
  const previousAuthHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const previousFirestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
  process.env.FIRESTORE_EMULATOR_HOST = hosts.firestore;
  const app = initializeApp({ projectId }, `emulator-baseline-${process.pid}-${crypto.randomUUID()}`);
  try {
    return await callback({ auth: getAuth(app), firestore: getFirestore(app) });
  } finally {
    await deleteApp(app);
    if (previousAuthHost === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previousAuthHost;
    if (previousFirestoreHost === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previousFirestoreHost;
  }
};

export async function clearEmulators({ projectId = BASELINE_PROJECT_ID, hosts }) {
  await request(`http://${hosts.auth}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
  await request(`http://${hosts.firestore}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
}

const runtimeFixture = profile => {
  const fixture = structuredClone(baselineFixture);
  fixture.profile = profile;
  fixture.firestore.user.emulatorProfile = profile;
  assertValidBaselineFixture(fixture, { expectedProfile: profile });
  return fixture;
};

export async function seedBaseline({ projectId = BASELINE_PROJECT_ID, hosts, profile = 'canonical' }) {
  const fixture = runtimeFixture(profile);
  await withAdminEmulators({ projectId, hosts }, async ({ auth, firestore }) => {
    const [sourceUser] = fixture.auth.users;
    const imported = await auth.importUsers([{
      uid: sourceUser.localId,
      email: sourceUser.email,
      displayName: sourceUser.displayName,
      emailVerified: sourceUser.emailVerified,
      customClaims: sourceUser.customClaims,
      providerData: sourceUser.providerUserInfo.map(provider => ({
        uid: provider.rawId,
        providerId: provider.providerId,
        email: provider.email,
        displayName: provider.displayName,
      })),
    }]);
    if (imported.failureCount !== 0 || imported.successCount !== 1) {
      throw new Error(`Canonical Auth import failed: ${imported.errors.map(item => item.error.message).join('; ')}`);
    }

    const batch = firestore.batch();
    const userRef = firestore.doc(`users/${BASELINE_USER_ID}`);
    batch.set(userRef, fixture.firestore.user);
    for (const exercise of fixture.firestore.catalog) {
      const { id, ...data } = exercise;
      batch.set(userRef.collection('catalog').doc(id), data);
    }
    await batch.commit();
  });
}

const assertExactFields = (actual, expected, label) => {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) {
      throw new Error(`${label}.${key} mismatch: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual?.[key])}`);
    }
  }
};

export async function verifyBaseline({
  projectId = BASELINE_PROJECT_ID,
  hosts,
  profile = 'canonical',
  allowMutable = false,
}) {
  const fixture = runtimeFixture(profile);
  await withAdminEmulators({ projectId, hosts }, async ({ auth, firestore }) => {
    const user = await auth.getUser(BASELINE_USER_ID);
    const [expectedAuthUser] = fixture.auth.users;
    assertExactFields(user, {
      email: expectedAuthUser.email,
      displayName: expectedAuthUser.displayName,
      emailVerified: expectedAuthUser.emailVerified,
    }, `Auth user ${BASELINE_USER_ID}`);
    if (JSON.stringify(user.customClaims) !== JSON.stringify(expectedAuthUser.customClaims)) {
      throw new Error(`Auth user ${BASELINE_USER_ID}.customClaims mismatch: expected ${JSON.stringify(expectedAuthUser.customClaims)}, received ${JSON.stringify(user.customClaims)}`);
    }
    if (user.providerData.length !== 1) throw new Error(`Auth user must contain exactly one provider; received ${user.providerData.length}`);
    const provider = user.providerData.find(item => item.providerId === BASELINE_PROVIDER_ID);
    if (!provider || provider.uid !== BASELINE_PROVIDER_UID
      || provider.email !== expectedAuthUser.email
      || provider.displayName !== expectedAuthUser.displayName) {
      throw new Error('Auth provider identity mismatch');
    }
    const providerLookup = await auth.getUsers([{
      providerId: BASELINE_PROVIDER_ID,
      providerUid: BASELINE_PROVIDER_UID,
    }]);
    if (providerLookup.users.length !== 1 || providerLookup.users[0].uid !== BASELINE_USER_ID) {
      throw new Error('Auth provider UID did not resolve the canonical Firebase UID');
    }
    const users = await auth.listUsers(2);
    if (users.users.length !== 1 || users.pageToken) throw new Error(`Auth must contain exactly one user; received at least ${users.users.length}`);

    const userSnapshot = await firestore.doc(`users/${BASELINE_USER_ID}`).get();
    if (!userSnapshot.exists) throw new Error('Canonical Firestore user is missing');
    const expectedUser = allowMutable
      ? { emulatorFixtureRevision: BASELINE_FIXTURE_REVISION, emulatorProfile: profile }
      : fixture.firestore.user;
    assertExactFields(userSnapshot.data(), expectedUser, `users/${BASELINE_USER_ID}`);

    const [catalog, history] = await Promise.all([
      userSnapshot.ref.collection('catalog').get(),
      userSnapshot.ref.collection('history').get(),
    ]);
    if (!allowMutable && catalog.size !== fixture.firestore.catalog.length) {
      throw new Error(`Catalog cardinality mismatch: expected ${fixture.firestore.catalog.length}, received ${catalog.size}`);
    }
    if (!allowMutable && history.size !== 0) throw new Error(`Canonical history must be empty; received ${history.size}`);
  });
}

export async function resetAndSeedBaseline(options) {
  const fixture = runtimeFixture(options.profile ?? 'canonical');
  await clearEmulators(options);
  await seedBaseline({ ...options, profile: fixture.profile });
  await verifyBaseline({ ...options, profile: fixture.profile });
}
