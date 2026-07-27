import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import baselineFixture, {
  BASELINE_AUTH_MARKER,
  BASELINE_EMAIL,
  BASELINE_FIXTURE_REVISION,
  BASELINE_PROVIDER_ID,
  BASELINE_PROVIDER_UID,
  BASELINE_USER_ID,
} from '../../scripts/emulator/fixtures/baseline.mjs';

export { BASELINE_AUTH_MARKER, BASELINE_EMAIL, BASELINE_FIXTURE_REVISION, BASELINE_PROVIDER_UID, BASELINE_USER_ID };

export const isBaselineMode = env => env?.DEV === true && env?.MODE === 'baseline';

export const validateBaselineAuthProvenance = fixture => {
  if (fixture?.auth?.contractRevision !== BASELINE_AUTH_MARKER) {
    const error = new Error('Baseline auth provenance mismatch');
    error.code = 'baseline/auth-provenance-mismatch';
    throw error;
  }
  const claims = fixture.auth.users?.[0]?.customClaims;
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)
    || Object.keys(claims).length !== 1 || claims.approved !== true) {
    const error = new Error('Baseline auth claim contract mismatch');
    error.code = 'baseline/auth-claim-contract-mismatch';
    throw error;
  }
};

const mockGoogleCredential = () => JSON.stringify({
  email: BASELINE_EMAIL,
  email_verified: true,
  name: 'Emulator Baseline User',
  sub: BASELINE_PROVIDER_UID,
});

export async function signInToBaseline(auth) {
  const credential = GoogleAuthProvider.credential(mockGoogleCredential());
  return signInWithCredential(auth, credential);
}

const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
};

const catalogSignature = catalog => JSON.stringify(stableValue(
  catalog.map(item => ({ ...item })).sort((left, right) => left.id.localeCompare(right.id)),
));

export function validateBaselineCatalog(snapshot) {
  const actual = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  const expected = baselineFixture.firestore.catalog;
  if (snapshot.size !== expected.length || catalogSignature(actual) !== catalogSignature(expected)) {
    const error = new Error('Baseline catalog mismatch');
    error.code = 'baseline/firestore-unavailable';
    throw error;
  }
}

export const baselineIdentity = user => ({
  uid: user?.uid ?? null,
  providerUid: user?.providerData?.find(provider => provider.providerId === BASELINE_PROVIDER_ID)?.uid ?? null,
});

export const validateBaselineIdentity = user => {
  const observed = baselineIdentity(user);
  if (observed.uid !== BASELINE_USER_ID || observed.providerUid !== BASELINE_PROVIDER_UID) {
    const error = new Error('Baseline account mismatch');
    error.code = 'baseline/identity-mismatch';
    error.observed = observed;
    throw error;
  }
};

export async function verifyBaselineData(db, user) {
  validateBaselineAuthProvenance(baselineFixture);
  validateBaselineIdentity(user);
  const userRef = doc(db, 'users', BASELINE_USER_ID);
  const [userSnapshot, catalogSnapshot] = await Promise.all([
    getDocFromServer(userRef),
    getDocsFromServer(collection(userRef, 'catalog')),
  ]);
  const observedRevision = userSnapshot.data()?.emulatorFixtureRevision ?? null;
  if (observedRevision !== BASELINE_FIXTURE_REVISION) {
    const error = new Error('Baseline data mismatch');
    error.code = 'baseline/revision-mismatch';
    error.observedRevision = observedRevision;
    throw error;
  }
  const settings = userSnapshot.data();
  if (settings?.warmupTime !== 10 || settings?.staleThreshold !== 5 || settings?.legDayOfWeek !== 'None'
    || settings?.defaultRestSeconds !== 90) {
    const error = new Error('Workout data unavailable');
    error.code = 'baseline/firestore-unavailable';
    throw error;
  }
  validateBaselineCatalog(catalogSnapshot);
  return { revision: observedRevision, catalogSize: catalogSnapshot.size };
}
