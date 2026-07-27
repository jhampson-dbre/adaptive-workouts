import { isValidV4WorkoutDocument } from './workoutSchema';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactIso = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

function copyOptional(source, target) {
  for (const key of ['linkedTo', 'isActive']) if (hasOwn(source, key)) target[key] = source[key];
}

function copyReason(reason, index) {
  const fields = index === 0
    ? ['decision', 'sourceWorkoutId', 'sourceWorkoutDate', 'sourceAnchorWeight', 'appliedWeightStep', 'recommendedWeight', 'reasonCode']
    : (reason?.reasonCode === 'BACKOFF_AWAITING_PRIOR_SET'
      ? ['recommendedWeight', 'reasonCode']
      : ['recommendedWeight', 'reasonCode', 'sourceActualWeight', 'sourceActualReps', 'floorReps', 'weightStep', 'dropSteps', 'rawWeight', 'sessionTopTarget', 'priorTargetCeiling']);
  const result = {};
  for (const key of fields) result[key] = reason?.[key];
  return result;
}

function copySet(record, mode) {
  const result = {
    index: record.index, completed: record.completed, plannedRestSeconds: record.plannedRestSeconds,
    workDurationSeconds: record.workDurationSeconds, actualRestSeconds: record.actualRestSeconds,
  };
  if (mode === 'weighted') Object.assign(result, {
    targetWeight: record.targetWeight, targetReps: record.targetReps, actualWeight: record.actualWeight,
    actualReps: record.actualReps, recommendationReason: copyReason(record.recommendationReason, record.index),
  });
  if (mode === 'bodyweight') Object.assign(result, {
    targetReps: record.targetReps, fullReps: record.fullReps, assistedReps: record.assistedReps,
    eccentricReps: record.eccentricReps,
  });
  return result;
}

function copyExercise(source) {
  const result = {
    id: source.id, occurrenceId: source.occurrenceId, name: source.name, muscleGroup: source.muscleGroup,
    tier: source.tier,
  };
  copyOptional(source, result);
  Object.assign(result, {
    trackingMode: source.trackingMode, sets: source.sets, prescribedSetCount: source.prescribedSetCount,
  });
  if (source.trackingMode === 'weighted') Object.assign(result, {
    startingWeight: source.startingWeight, targetReps: source.targetReps, floorReps: source.floorReps,
    weightStep: source.weightStep,
  });
  if (source.trackingMode === 'bodyweight') result.targetReps = source.targetReps;
  result.setRecords = Array.isArray(source.setRecords) ? source.setRecords.map(record => copySet(record, source.trackingMode)) : source.setRecords;
  return result;
}

export function buildCanonicalV4WorkoutDocument({ workoutId, finishRequestedAtEpochMs, phaseTargets, phaseActualSeconds, exercises }) {
  if (!UUID_V4.test(workoutId) || !Number.isSafeInteger(finishRequestedAtEpochMs) || !isObject(phaseTargets)
    || !isObject(phaseActualSeconds) || !Array.isArray(exercises)) throw new TypeError('Invalid canonical v4 input');
  const date = new Date(finishRequestedAtEpochMs).toISOString();
  if (!exactIso(date)) throw new TypeError('Invalid finish timestamp');
  const document = {
    id: workoutId, schemaVersion: 4, status: 'completed', date,
    actualDurationSeconds: phaseActualSeconds.warmup + phaseActualSeconds.performance + phaseActualSeconds.cooldown,
    phaseDurations: {
      warmup: { plannedSeconds: phaseTargets.warmupSeconds, actualSeconds: phaseActualSeconds.warmup },
      performance: { plannedSeconds: phaseTargets.performanceSeconds, actualSeconds: phaseActualSeconds.performance },
      cooldown: { plannedSeconds: phaseTargets.cooldownSeconds, actualSeconds: phaseActualSeconds.cooldown },
    },
    exercises: exercises.map(copyExercise),
  };
  if (!isValidV4WorkoutDocument(document)) throw new TypeError('Invalid canonical v4 workout');
  return freeze(document);
}

function orderedCandidate(candidate) {
  return {
    id: candidate.id,
    schemaVersion: candidate.schemaVersion,
    status: candidate.status,
    date: candidate.date,
    actualDurationSeconds: candidate.actualDurationSeconds,
    phaseDurations: {
      warmup: { plannedSeconds: candidate.phaseDurations?.warmup?.plannedSeconds, actualSeconds: candidate.phaseDurations?.warmup?.actualSeconds },
      performance: { plannedSeconds: candidate.phaseDurations?.performance?.plannedSeconds, actualSeconds: candidate.phaseDurations?.performance?.actualSeconds },
      cooldown: { plannedSeconds: candidate.phaseDurations?.cooldown?.plannedSeconds, actualSeconds: candidate.phaseDurations?.cooldown?.actualSeconds },
    },
    exercises: candidate.exercises?.map(copyExercise),
  };
}

export function canonicalizeWorkoutV4(candidate) {
  if (!isValidV4WorkoutDocument(candidate) || !UUID_V4.test(candidate.id) || !exactIso(candidate.date)) {
    throw new TypeError('Invalid canonical v4 candidate');
  }
  const json = JSON.stringify(orderedCandidate(candidate));
  return json;
}

export async function fingerprintWorkoutV4(candidate, { subtle = globalThis.crypto?.subtle, TextEncoderImpl = TextEncoder } = {}) {
  if (!subtle?.digest) throw new Error('SHA-256 capability unavailable');
  const bytes = new TextEncoderImpl().encode(canonicalizeWorkoutV4(candidate));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return { canonicalization: 'workout-v4-json-v1', algorithm: 'SHA-256', hex };
}

export function isCanonicalWorkoutId(value) {
  return UUID_V4.test(value);
}
