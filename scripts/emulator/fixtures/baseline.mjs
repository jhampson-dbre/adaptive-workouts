export const BASELINE_PROJECT_ID = 'demo-project';
export const BASELINE_FIXTURE_REVISION = 'emulator-baseline-v1';
export const BASELINE_AUTH_MARKER = 'emulator-baseline-auth-v2';
export const BASELINE_PROFILE = 'canonical';
export const BASELINE_USER_ID = 'emulator-baseline-user';
export const BASELINE_EMAIL = 'peach.otter.880@example.com';
export const BASELINE_PROVIDER_ID = 'google.com';
export const BASELINE_PROVIDER_UID = 'google-peach-otter-880';

const weighted = (id, name, muscleGroup, tier, sets, {
  startingWeight, targetReps, floorReps, weightStep, restSeconds, linkedTo,
}) => ({
  id,
  name,
  muscleGroup,
  tier,
  trackingMode: 'weighted',
  sets,
  isActive: true,
  startingWeight,
  targetReps,
  floorReps,
  weightStep,
  ...(restSeconds === undefined ? {} : { restSeconds }),
  ...(linkedTo === undefined ? {} : { linkedTo }),
});

const simple = (id, name, muscleGroup, tier, sets, restSeconds) => ({
  id,
  name,
  muscleGroup,
  tier,
  trackingMode: 'simple',
  sets,
  isActive: true,
  ...(restSeconds === undefined ? {} : { restSeconds }),
});

const bodyweight = (id, name, muscleGroup, tier, sets, targetReps, restSeconds) => ({
  id,
  name,
  muscleGroup,
  tier,
  trackingMode: 'bodyweight',
  sets,
  isActive: true,
  targetReps,
  ...(restSeconds === undefined ? {} : { restSeconds }),
});

const baselineFixture = {
  projectId: BASELINE_PROJECT_ID,
  revision: BASELINE_FIXTURE_REVISION,
  profile: BASELINE_PROFILE,
  auth: {
    contractRevision: BASELINE_AUTH_MARKER,
    users: [{
      localId: BASELINE_USER_ID,
      email: BASELINE_EMAIL,
      displayName: 'Emulator Baseline User',
      emailVerified: true,
      customClaims: { approved: true },
      providerUserInfo: [{
        providerId: BASELINE_PROVIDER_ID,
        rawId: BASELINE_PROVIDER_UID,
        email: BASELINE_EMAIL,
        displayName: 'Emulator Baseline User',
      }],
    }],
  },
  firestore: {
    user: {
      warmupTime: 10,
      staleThreshold: 5,
      legDayOfWeek: 'None',
      defaultRestSeconds: 90,
      emulatorFixtureRevision: BASELINE_FIXTURE_REVISION,
      emulatorProfile: BASELINE_PROFILE,
    },
    catalog: [
      weighted('barbell-curl', 'Barbell Curl', 'Biceps', 1, 3, { startingWeight: 45, targetReps: 10, floorReps: 6, weightStep: 5 }),
      simple('hammer-curl', 'Hammer Curl', 'Biceps', 1, 3),
      weighted('overhead-press', 'Overhead Press', 'Shoulders', 1, 3, { startingWeight: 65, targetReps: 8, floorReps: 5, weightStep: 5, restSeconds: 120 }),
      simple('lateral-raise', 'Lateral Raise', 'Shoulders', 1, 3, 60),
      weighted('bench-press', 'Bench Press', 'Chest', 3, 3, { startingWeight: 95, targetReps: 10, floorReps: 6, weightStep: 5, restSeconds: 120 }),
      bodyweight('push-up', 'Push-Up', 'Chest', 3, 3, 15, 60),
      bodyweight('pull-up', 'Pull-Up', 'Back', 3, 3, 8, 90),
      weighted('cable-row', 'Cable Row', 'Back', 3, 3, { startingWeight: 80, targetReps: 10, floorReps: 6, weightStep: 5, restSeconds: 90 }),
      weighted('triceps-pushdown', 'Triceps Pushdown', 'Triceps', 3, 3, { startingWeight: 40, targetReps: 12, floorReps: 8, weightStep: 5, restSeconds: 75 }),
      simple('plank', 'Plank', 'Core', 3, 3, 60),
      weighted('back-squat', 'Back Squat', 'Legs', 3, 4, { startingWeight: 135, targetReps: 8, floorReps: 5, weightStep: 10, restSeconds: 180 }),
      weighted('romanian-deadlift', 'Romanian Deadlift', 'Legs', 3, 3, { startingWeight: 115, targetReps: 8, floorReps: 5, weightStep: 10, restSeconds: 150 }),
      weighted('leg-extension', 'Leg Extension', 'Legs', 4, 3, { startingWeight: 60, targetReps: 12, floorReps: 8, weightStep: 5, restSeconds: 75, linkedTo: 'leg-curl' }),
      weighted('leg-curl', 'Leg Curl', 'Legs', 4, 3, { startingWeight: 50, targetReps: 12, floorReps: 8, weightStep: 5, restSeconds: 75 }),
      bodyweight('standing-calf-raise', 'Standing Calf Raise', 'Legs', 4, 3, 15, 60),
    ],
    history: [],
  },
};

export default baselineFixture;
