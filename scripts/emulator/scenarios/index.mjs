import baselineFixture, { BASELINE_FIXTURE_REVISION, BASELINE_USER_ID } from '../fixtures/baseline.mjs';
import { isValidV3WorkoutDocument } from '../../../src/utils/workoutSchema.js';

export const SCENARIO_REVISION = 'emulator-history-scenarios-v1';
export const MAX_SCENARIO_DOCUMENTS = 450;
const scenarioCommand = 'npm run emulators:scenario -- <stable-scenario> --reference-date YYYY-MM-DD';

const catalog = new Map(baselineFixture.firestore.catalog.map(exercise => [exercise.id, exercise]));
const required = id => {
  const exercise = catalog.get(id);
  if (!exercise) throw new Error(`Baseline catalog is missing ${id}`);
  return exercise;
};

const localNoonIso = (referenceDate, offsetDays) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error('reference date must be YYYY-MM-DD');
  const [year, month, day] = referenceDate.split('-').map(Number);
  const base = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(base.getTime()) || base.getFullYear() !== year || base.getMonth() !== month - 1 || base.getDate() !== day) {
    throw new Error('reference date must be a valid calendar date');
  }
  const result = new Date(base);
  result.setDate(result.getDate() + offsetDays);
  return result.toISOString();
};

const timing = (index, count) => ({
  index, completed: true, plannedRestSeconds: index === count - 1 ? null : 90,
  workDurationSeconds: 30, actualRestSeconds: index === count - 1 ? null : 90,
});
const completedOccurrence = (id, { reps, weight, name, fullReps, assistedReps, eccentricReps } = {}) => {
  const exercise = required(id);
  const base = { id: exercise.id, occurrenceId: `${id}:seed`, name: name ?? exercise.name, muscleGroup: exercise.muscleGroup,
    tier: exercise.tier, trackingMode: exercise.trackingMode, sets: exercise.sets, prescribedSetCount: exercise.sets };
  if (exercise.trackingMode === 'simple') return { ...base, setRecords: Array.from({ length: exercise.sets }, (_, index) => timing(index, exercise.sets)) };
  if (exercise.trackingMode === 'bodyweight') return { ...base, targetReps: exercise.targetReps,
    setRecords: Array.from({ length: exercise.sets }, (_, index) => ({ ...timing(index, exercise.sets), targetReps: exercise.targetReps, fullReps: fullReps ?? reps ?? exercise.targetReps, assistedReps: assistedReps ?? 0, eccentricReps: eccentricReps ?? 0 })) };
  const actualWeight = weight ?? exercise.startingWeight;
  return { ...base, startingWeight: exercise.startingWeight, targetReps: exercise.targetReps, floorReps: exercise.floorReps, weightStep: exercise.weightStep,
    setRecords: Array.from({ length: exercise.sets }, (_, index) => ({ ...timing(index, exercise.sets), targetWeight: actualWeight, targetReps: exercise.targetReps, actualWeight, actualReps: reps ?? exercise.targetReps,
      recommendationReason: index === 0 ? { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: actualWeight, reasonCode: 'STARTING_NO_ANCHOR' } : { recommendedWeight: actualWeight, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' } })) };
};
const document = (id, offsetDays, exercises) => ({ id, schemaVersion: 3, status: 'completed', dateOffsetDays: offsetDays, actualDurationSeconds: 600, exercises });

export const scenarioDefinitions = Object.freeze({
  'weighted-progression': { name: 'Weighted increase, hold, and decrease', documents: [
    document('scenario-weighted-increase', -10, [completedOccurrence('barbell-curl', { reps: 10, weight: 45 })]),
    document('scenario-weighted-hold', -9, [completedOccurrence('overhead-press', { reps: 6, weight: 65 })]),
    document('scenario-weighted-decrease', -8, [completedOccurrence('bench-press', { reps: 4, weight: 95 })]),
  ], expected: { progression: { 'barbell-curl': 'increase', 'overhead-press': 'hold', 'bench-press': 'decrease' } } },
  'pivot-rotation-staleness': { name: 'Pivot rotation and stale candidates', documents: [
    document('scenario-pivot-biceps', -1, [completedOccurrence('barbell-curl')]),
    document('scenario-stale-chest', -8, [completedOccurrence('bench-press')]),
  ], expected: { pivot: 'Shoulders', stale: ['bench-press'] } },
  'recent-primary-leg-suppresses-tier4': { name: 'Recent primary legs suppresses supplemental legs', documents: [
    document('scenario-recent-primary-legs', 0, [completedOccurrence('back-squat')]),
  ], expected: { suppressed: ['leg-extension', 'leg-curl', 'standing-calf-raise'] } },
  'tier4-quota-closed-open': { name: 'Tier-4 quota closed then reopened', documents: [
    document('scenario-quota-back-before-reset', -5, [completedOccurrence('cable-row')]),
    document('scenario-quota-reset', -4, [completedOccurrence('standing-calf-raise')]),
    document('scenario-quota-credit-chest', -3, [completedOccurrence('bench-press')]),
    document('scenario-quota-open', -2, [completedOccurrence('cable-row')]),
  ], expected: { quota: { closedSlice: ['scenario-quota-back-before-reset', 'scenario-quota-reset', 'scenario-quota-credit-chest'], openSlice: 'all', closedOutput: ['cable-row'], openOutput: ['standing-calf-raise'] } } },
  'workout-trends': { name: 'Workout trend evidence across ranges', documents: [
    document('scenario-trends-weighted-earliest', -75, [completedOccurrence('bench-press', { reps: 8, weight: 95 })]),
    document('scenario-trends-bodyweight-earliest', -70, [completedOccurrence('pull-up', { fullReps: 3, assistedReps: 2, eccentricReps: 1 })]),
    document('scenario-trends-long-name', -50, [completedOccurrence('triceps-pushdown', { name: 'Triceps Pushdown with a deliberately long saved exercise name for narrow layouts', reps: 12, weight: 40 }), completedOccurrence('plank')]),
    document('scenario-trends-weighted-middle', -34, [completedOccurrence('bench-press', { reps: 9, weight: 100 })]),
    document('scenario-trends-bodyweight-middle', -25, [completedOccurrence('pull-up', { fullReps: 5, assistedReps: 1, eccentricReps: 2 })]),
    document('scenario-trends-bodyweight-latest', -7, [completedOccurrence('pull-up', { fullReps: 6, assistedReps: 2, eccentricReps: 1 })]),
    document('scenario-trends-weighted-latest', -4, [completedOccurrence('bench-press', { reps: 10, weight: 105 })]),
  ], expected: { weighted: { id: 'bench-press', dates: [-75, -34, -4], volumes: [2280, 2700, 3150] }, bodyweight: { id: 'pull-up', dates: [-70, -25, -7], totals: [{ full: 9, assisted: 6, eccentric: 3 }, { full: 15, assisted: 3, eccentric: 6 }, { full: 18, assisted: 6, eccentric: 3 }] }, oneRecord: { id: 'triceps-pushdown', date: -50 }, excluded: ['plank'] } },
});

export function buildScenario(name, referenceDate) {
  const definition = scenarioDefinitions[name];
  if (!definition) throw new Error(`Unknown scenario "${name}". Available: ${Object.keys(scenarioDefinitions).join(', ')}`);
  const documents = definition.documents.map(source => {
    const { dateOffsetDays, ...documentData } = structuredClone(source);
    return { ...documentData, date: localNoonIso(referenceDate, dateOffsetDays) };
  });
  for (const item of documents) {
    if (!isValidV3WorkoutDocument(item)) throw new Error(`Scenario ${name} contains invalid schema-v3 document ${item.id}`);
  }
  return { name, revision: SCENARIO_REVISION, profile: 'scratch', fixtureRevision: BASELINE_FIXTURE_REVISION, userId: BASELINE_USER_ID,
    referenceDate, documents, expected: structuredClone(definition.expected) };
}

export const scenarioManifest = Object.freeze({
  revision: SCENARIO_REVISION, command: scenarioCommand,
  fixtureRevision: BASELINE_FIXTURE_REVISION, referenceClock: 'system-local calendar noon; output ISO', profile: 'scratch',
  scenarios: Object.fromEntries(Object.entries(scenarioDefinitions).map(([id, definition]) => [id, { name: definition.name, expected: definition.expected,
    id, command: scenarioCommand, fixtureRevision: BASELINE_FIXTURE_REVISION,
    referenceDateInput: '--reference-date YYYY-MM-DD' }])),
});
