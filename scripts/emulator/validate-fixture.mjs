import {
  isValidCatalogExercise,
} from '../../src/utils/workoutSchema.js';
import {
  BASELINE_AUTH_MARKER,
  BASELINE_EMAIL,
  BASELINE_FIXTURE_REVISION,
  BASELINE_PROFILE,
  BASELINE_PROJECT_ID,
  BASELINE_PROVIDER_ID,
  BASELINE_PROVIDER_UID,
  BASELINE_USER_ID,
} from './fixtures/baseline.mjs';

const CANONICAL_SETTINGS = {
  warmupTime: 10,
  staleThreshold: 5,
  legDayOfWeek: 'None',
  defaultRestSeconds: 90,
};
const SUPPORTED_PROFILES = new Set(['canonical', 'scratch', 'test']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasExactApprovedClaim = claims => isObject(claims)
  && Object.keys(claims).length === 1
  && claims.approved === true;

const addExactError = (errors, value, expected, path) => {
  if (value !== expected) errors.push(`${path} must be ${JSON.stringify(expected)}; received ${JSON.stringify(value)}`);
};

export function validateBaselineFixture(fixture, { expectedProfile = BASELINE_PROFILE } = {}) {
  const errors = [];
  if (!isObject(fixture)) return ['fixture must be an object'];

  addExactError(errors, fixture.projectId, BASELINE_PROJECT_ID, 'projectId');
  addExactError(errors, fixture.revision, BASELINE_FIXTURE_REVISION, 'revision');
  if (!SUPPORTED_PROFILES.has(fixture.profile)) {
    errors.push(`profile must be one of ${[...SUPPORTED_PROFILES].join(', ')}; received ${JSON.stringify(fixture.profile)}`);
  }
  addExactError(errors, fixture.profile, expectedProfile, 'profile');
  addExactError(errors, fixture.auth?.contractRevision, BASELINE_AUTH_MARKER, 'auth.contractRevision');

  const users = fixture.auth?.users;
  if (!Array.isArray(users) || users.length !== 1) {
    errors.push(`auth.users must contain exactly one user; received ${Array.isArray(users) ? users.length : typeof users}`);
  } else {
    const [user] = users;
    addExactError(errors, user?.localId, BASELINE_USER_ID, 'auth.users[0].localId');
    addExactError(errors, user?.email, BASELINE_EMAIL, 'auth.users[0].email');
    addExactError(errors, user?.displayName, 'Emulator Baseline User', 'auth.users[0].displayName');
    addExactError(errors, user?.emailVerified, true, 'auth.users[0].emailVerified');
    if (!hasExactApprovedClaim(user?.customClaims)) {
      errors.push(`auth.users[0].customClaims must equal { approved: true }; received ${JSON.stringify(user?.customClaims)}`);
    }
    const providers = user?.providerUserInfo;
    if (!Array.isArray(providers) || providers.length !== 1) {
      errors.push(`auth.users[0].providerUserInfo must contain exactly one provider; received ${Array.isArray(providers) ? providers.length : typeof providers}`);
    } else {
      addExactError(errors, providers[0]?.providerId, BASELINE_PROVIDER_ID, 'auth.users[0].providerUserInfo[0].providerId');
      addExactError(errors, providers[0]?.rawId, BASELINE_PROVIDER_UID, 'auth.users[0].providerUserInfo[0].rawId');
      addExactError(errors, providers[0]?.email, BASELINE_EMAIL, 'auth.users[0].providerUserInfo[0].email');
    }
  }

  const user = fixture.firestore?.user;
  if (!isObject(user)) {
    errors.push('firestore.user must be an object');
  } else {
    for (const [key, value] of Object.entries(CANONICAL_SETTINGS)) {
      addExactError(errors, user[key], value, `firestore.user.${key}`);
    }
    addExactError(errors, user.emulatorFixtureRevision, BASELINE_FIXTURE_REVISION, 'firestore.user.emulatorFixtureRevision');
    addExactError(errors, user.emulatorProfile, expectedProfile, 'firestore.user.emulatorProfile');
  }

  const catalog = fixture.firestore?.catalog;
  if (!Array.isArray(catalog)) {
    errors.push('firestore.catalog must be an array');
    return errors;
  }
  if (catalog.length !== 15) errors.push(`firestore.catalog must contain exactly 15 exercises; received ${catalog.length}`);

  const ids = new Set();
  catalog.forEach((exercise, index) => {
    const path = `firestore.catalog[${index}]`;
    if (!isValidCatalogExercise(exercise)) {
      errors.push(`${path} must satisfy the production catalog schema`);
    }
    if (ids.has(exercise?.id)) errors.push(`${path}.id duplicates ${JSON.stringify(exercise?.id)}`);
    ids.add(exercise?.id);
  });
  catalog.forEach((exercise, index) => {
    if (exercise?.linkedTo === undefined || exercise.linkedTo === null) return;
    const path = `firestore.catalog[${index}].linkedTo`;
    if (!ids.has(exercise.linkedTo)) {
      errors.push(`${path} must target an existing catalog exercise; received ${JSON.stringify(exercise.linkedTo)}`);
    }
    if (exercise.id !== 'leg-extension' || exercise.linkedTo !== 'leg-curl') {
      errors.push(`${path} is not allowed; the only canonical link is leg-extension -> leg-curl`);
    }
  });

  const tierOne = catalog.filter(exercise => exercise?.tier === 1);
  const tierOneGroups = new Map();
  tierOne.forEach(exercise => tierOneGroups.set(exercise.muscleGroup, (tierOneGroups.get(exercise.muscleGroup) ?? 0) + 1));
  if (tierOne.length !== 4
    || tierOneGroups.size !== 2
    || tierOneGroups.get('Biceps') !== 2
    || tierOneGroups.get('Shoulders') !== 2) {
    errors.push('firestore.catalog.tier-1 must contain exactly two Biceps and two Shoulders exercises');
  }

  const tierThreeLegs = catalog.filter(exercise => exercise?.muscleGroup === 'Legs' && exercise?.tier === 3);
  if (tierThreeLegs.length !== 2) errors.push('firestore.catalog.tier-3-legs must contain exactly two primary Legs exercises');
  const tierFourLegs = catalog.filter(exercise => exercise?.muscleGroup === 'Legs' && exercise?.tier === 4);
  if (tierFourLegs.length !== 3) errors.push('firestore.catalog.tier-4-legs must contain exactly three supplemental Legs exercises');

  const extension = catalog.find(exercise => exercise?.id === 'leg-extension');
  const curl = catalog.find(exercise => exercise?.id === 'leg-curl');
  if (extension?.linkedTo !== 'leg-curl') {
    errors.push('firestore.catalog leg-extension.linkedTo must target leg-curl');
  }
  if (!curl) errors.push('firestore.catalog leg-extension.linkedTo target leg-curl must exist');
  if (curl?.linkedTo) errors.push('firestore.catalog leg-curl must not have a reciprocal link');

  const history = fixture.firestore?.history;
  if (!Array.isArray(history) || history.length !== 0) {
    errors.push(`firestore.history must be empty; received ${Array.isArray(history) ? history.length : typeof history}`);
  }
  return errors;
}

export function assertValidBaselineFixture(fixture, options) {
  const errors = validateBaselineFixture(fixture, options);
  if (errors.length) throw new Error(`Invalid emulator baseline fixture:\n- ${errors.join('\n- ')}`);
}
