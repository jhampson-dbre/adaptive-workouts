export const TRACKING_MODE = Object.freeze({
  SIMPLE: 'simple',
  WEIGHTED: 'weighted',
  BODYWEIGHT: 'bodyweight',
});
export const TRACKING_MODES = Object.freeze(Object.values(TRACKING_MODE));

const TOP_SET_DECISIONS = new Set(['starting', 'increase', 'hold', 'decrease']);
const BACKOFF_REASON_FIELDS = [
  'recommendedWeight', 'reasonCode', 'sourceActualWeight', 'sourceActualReps',
  'floorReps', 'weightStep', 'dropSteps', 'rawWeight', 'sessionTopTarget',
  'priorTargetCeiling',
];
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const isFiniteNonnegative = value => Number.isFinite(value) && value >= 0;
const isNonnegativeInteger = value => Number.isInteger(value) && value >= 0;
const isPositiveInteger = value => Number.isInteger(value) && value > 0;
const isValidPlannedRestSeconds = value => Number.isInteger(value) && value >= 5 && value <= 600;
const isValidPhaseTargetSeconds = value => Number.isInteger(value)
  && value >= 0 && value <= 3600 && value % 60 === 0;

export function normalizeWorkoutSettings(settings) {
  const source = isObject(settings) ? settings : {};
  const warmupSeconds = isValidPhaseTargetSeconds(source.warmupSeconds)
    ? source.warmupSeconds
    : (!hasOwn(source, 'warmupSeconds') && isValidPhaseTargetSeconds(source.warmupTime * 60)
      ? source.warmupTime * 60
      : 600);
  return {
    ...source,
    defaultRestSeconds: isValidPlannedRestSeconds(source.defaultRestSeconds)
      ? source.defaultRestSeconds
      : 60,
    warmupSeconds,
    cooldownSeconds: isValidPhaseTargetSeconds(source.cooldownSeconds)
      ? source.cooldownSeconds
      : 300,
  };
}

export function normalizeCatalogExercise(exercise) {
  if (!isObject(exercise) || hasOwn(exercise, 'trackingMode')) return exercise;
  return { ...exercise, trackingMode: 'simple' };
}

export function isValidWeightedCatalogConfig(exercise) {
  return isFiniteNonnegative(exercise?.startingWeight)
    && isPositiveInteger(exercise?.targetReps)
    && isNonnegativeInteger(exercise?.floorReps)
    && exercise.floorReps < exercise.targetReps
    && Number.isFinite(exercise?.weightStep)
    && exercise.weightStep > 0;
}

export function isValidBodyweightCatalogConfig(exercise) {
  return isPositiveInteger(exercise?.targetReps);
}

function hasValidExerciseIdentity(exercise) {
  return isObject(exercise)
    && isNonEmptyString(exercise.id)
    && isNonEmptyString(exercise.name)
    && isNonEmptyString(exercise.muscleGroup)
    && Number.isInteger(exercise.tier)
    && (!hasOwn(exercise, 'linkedTo') || exercise.linkedTo === null || typeof exercise.linkedTo === 'string')
    && (!hasOwn(exercise, 'isActive') || typeof exercise.isActive === 'boolean');
}

export function isValidCatalogExercise(exercise) {
  const normalized = normalizeCatalogExercise(exercise);
  if (!hasValidExerciseIdentity(normalized)
    || !Number.isInteger(normalized.sets)
    || normalized.sets < 1
    || normalized.sets > 10
    || (hasOwn(normalized, 'restSeconds') && !isValidPlannedRestSeconds(normalized.restSeconds))
    || !TRACKING_MODES.includes(normalized.trackingMode)) {
    return false;
  }

  if (normalized.trackingMode === 'weighted') return isValidWeightedCatalogConfig(normalized);
  if (normalized.trackingMode === 'bodyweight') return isValidBodyweightCatalogConfig(normalized);
  return true;
}

function isValidReasonCode(value) {
  return isNonEmptyString(value);
}

function isValidTopSetRecommendationReason(reason) {
  if (!isObject(reason)
    || !TOP_SET_DECISIONS.has(reason.decision)
    || !isFiniteNonnegative(reason.appliedWeightStep)
    || !isFiniteNonnegative(reason.recommendedWeight)
    || !isValidReasonCode(reason.reasonCode)) {
    return false;
  }

  if (reason.decision === 'starting') {
    return reason.sourceWorkoutId === null
      && reason.sourceWorkoutDate === null
      && reason.sourceAnchorWeight === null;
  }

  return isNonEmptyString(reason.sourceWorkoutId)
    && isNonEmptyString(reason.sourceWorkoutDate)
    && Number.isFinite(Date.parse(reason.sourceWorkoutDate))
    && isFiniteNonnegative(reason.sourceAnchorWeight);
}

function isValidBackoffRecommendationReason(reason) {
  return isObject(reason)
    && isFiniteNonnegative(reason.recommendedWeight)
    && isValidReasonCode(reason.reasonCode);
}

export function isValidWeightedSetRecord(record, expectedIndex) {
  return isObject(record)
    && record.index === expectedIndex
    && isFiniteNonnegative(record.targetWeight)
    && isPositiveInteger(record.targetReps)
    && isFiniteNonnegative(record.actualWeight)
    && isNonnegativeInteger(record.actualReps)
    && typeof record.completed === 'boolean'
    && record.recommendationReason?.recommendedWeight === record.targetWeight
    && (expectedIndex === 0
      ? isValidTopSetRecommendationReason(record.recommendationReason)
      : isValidBackoffRecommendationReason(record.recommendationReason));
}

export function isValidBodyweightSetRecord(record, expectedIndex) {
  return isObject(record)
    && record.index === expectedIndex
    && isPositiveInteger(record.targetReps)
    && isNonnegativeInteger(record.fullReps)
    && isNonnegativeInteger(record.assistedReps)
    && isNonnegativeInteger(record.eccentricReps)
    && typeof record.completed === 'boolean';
}

function hasContiguousConfirmedPrefix(records) {
  let foundUnconfirmed = false;
  for (const record of records) {
    if (!record.completed) foundUnconfirmed = true;
    else if (foundUnconfirmed) return false;
  }
  return true;
}

export function isValidV2ExerciseOccurrence(exercise) {
  if (!hasValidExerciseIdentity(exercise)
    || !TRACKING_MODES.includes(exercise.trackingMode)
    || !Number.isInteger(exercise.sets)
    || exercise.sets < 1
    || exercise.sets > 10
    || exercise.prescribedSetCount !== exercise.sets) {
    return false;
  }

  if (exercise.trackingMode === 'simple') return typeof exercise.completed === 'boolean';
  if (!Array.isArray(exercise.setRecords)
    || exercise.setRecords.length !== exercise.prescribedSetCount
    || !hasContiguousConfirmedPrefix(exercise.setRecords)) {
    return false;
  }

  if (exercise.trackingMode === 'weighted') {
    return isValidWeightedCatalogConfig(exercise)
      && exercise.setRecords.every((record, index) => (
        record.targetReps === exercise.targetReps
        && isValidWeightedSetRecord(record, index)
      ));
  }

  return isValidBodyweightCatalogConfig(exercise)
    && exercise.setRecords.every((record, index) => (
      record.targetReps === exercise.targetReps
      && isValidBodyweightSetRecord(record, index)
    ));
}

function hasValidV3Timing(record, index, recordCount, { allowLiveRest }) {
  if (!isObject(record)
    || record.index !== index
    || typeof record.completed !== 'boolean'
    || (record.completed
      ? !isNonnegativeInteger(record.workDurationSeconds)
      : record.workDurationSeconds !== null)) {
    return false;
  }

  const isFinalSet = index === recordCount - 1;
  if (isFinalSet) {
    return record.plannedRestSeconds === null && record.actualRestSeconds === null;
  }
  if (!isValidPlannedRestSeconds(record.plannedRestSeconds)) return false;
  if (!record.completed) return record.actualRestSeconds === null;
  return isNonnegativeInteger(record.actualRestSeconds)
    || (allowLiveRest && record.actualRestSeconds === null);
}

export function isValidV3ExerciseOccurrence(exercise, { allowLiveRest = false } = {}) {
  if (!hasValidExerciseIdentity(exercise)
    || !isNonEmptyString(exercise.occurrenceId)
    || !TRACKING_MODES.includes(exercise.trackingMode)
    || !Number.isInteger(exercise.sets)
    || exercise.sets < 1
    || exercise.sets > 10
    || exercise.prescribedSetCount !== exercise.sets
    || !Array.isArray(exercise.setRecords)
    || exercise.setRecords.length !== exercise.prescribedSetCount
    || !hasContiguousConfirmedPrefix(exercise.setRecords)
    || exercise.setRecords.some((record, index) => (
      !hasValidV3Timing(record, index, exercise.setRecords.length, { allowLiveRest })
    ))) {
    return false;
  }

  if (allowLiveRest) {
    const liveRestIndexes = exercise.setRecords
      .map((record, index) => (record.completed && record.actualRestSeconds === null
        && index < exercise.setRecords.length - 1 ? index : -1))
      .filter(index => index >= 0);
    const lastCompletedIndex = exercise.setRecords.reduce((lastIndex, record, index) => (
      record.completed ? index : lastIndex
    ), -1);
    if (liveRestIndexes.length > 1
      || (liveRestIndexes.length === 1 && liveRestIndexes[0] !== lastCompletedIndex)) {
      return false;
    }
  }

  if (exercise.trackingMode === 'simple') return !hasOwn(exercise, 'completed');
  if (exercise.trackingMode === 'weighted') {
    return isValidWeightedCatalogConfig(exercise)
      && exercise.setRecords.every((record, index) => (
        record.targetReps === exercise.targetReps
        && isValidWeightedSetRecord(record, index)
      ));
  }
  return isValidBodyweightCatalogConfig(exercise)
    && exercise.setRecords.every((record, index) => (
      record.targetReps === exercise.targetReps
      && isValidBodyweightSetRecord(record, index)
    ));
}

export function isLegacyWorkoutDocument(workout) {
  return isObject(workout) && !hasOwn(workout, 'schemaVersion');
}

export function isValidV2WorkoutEnvelope(workout) {
  return isObject(workout)
    && workout.schemaVersion === 2
    && workout.status === 'completed'
    && isNonEmptyString(workout.date)
    && Number.isFinite(Date.parse(workout.date))
    && isFiniteNonnegative(workout.actualDuration)
    && Array.isArray(workout.exercises);
}

export function isValidV2WorkoutDocument(workout) {
  return isValidV2WorkoutEnvelope(workout)
    && workout.exercises.every(isValidV2ExerciseOccurrence);
}

export function isValidV3WorkoutEnvelope(workout) {
  return isObject(workout)
    && workout.schemaVersion === 3
    && workout.status === 'completed'
    && isNonEmptyString(workout.date)
    && Number.isFinite(Date.parse(workout.date))
    && isNonnegativeInteger(workout.actualDurationSeconds)
    && !hasOwn(workout, 'actualDuration')
    && Array.isArray(workout.exercises);
}

export function isValidV3WorkoutDocument(workout) {
  if (!isValidV3WorkoutEnvelope(workout)
    || !workout.exercises.every(exercise => isValidV3ExerciseOccurrence(exercise))
    || !hasConfirmedWork(workout.exercises)) {
    return false;
  }
  const occurrenceIds = workout.exercises.map(exercise => exercise.occurrenceId);
  return new Set(occurrenceIds).size === occurrenceIds.length;
}

export function isMalformedV2WorkoutDocument(workout) {
  return isObject(workout)
    && hasOwn(workout, 'schemaVersion')
    && !isValidV2WorkoutDocument(workout);
}

export function classifyWorkoutDocument(workout) {
  if (isLegacyWorkoutDocument(workout)) return 'legacy';
  if (isValidV2WorkoutDocument(workout)) return 'valid-v2';
  if (isValidV3WorkoutDocument(workout)) return 'valid-v3';
  return 'malformed-versioned';
}

export function hasConfirmedWork(exercises) {
  return Array.isArray(exercises) && exercises.some(exercise => {
    if (exercise.trackingMode === 'simple' && exercise.completed === true) return true;
    if (Array.isArray(exercise.setRecords)) {
      return exercise.setRecords.some(record => record.completed === true);
    }
    return false;
  });
}

export function wasPerformed(workout, occurrence) {
  if (isLegacyWorkoutDocument(workout)) {
    return occurrence !== null && typeof occurrence === 'object' && !Array.isArray(occurrence);
  }
  if (workout?.schemaVersion === 3) {
    return isValidV3WorkoutDocument(workout)
      && isValidV3ExerciseOccurrence(occurrence)
      && occurrence.setRecords.some(record => record.completed === true);
  }
  if (!isValidV2WorkoutEnvelope(workout) || !isValidV2ExerciseOccurrence(occurrence)) return false;
  if (occurrence.trackingMode === 'simple') return occurrence.completed === true;
  return occurrence.setRecords.some(record => record.completed === true);
}

function copyOptionalExerciseFields(source, target) {
  for (const key of ['linkedTo', 'isActive']) {
    if (hasOwn(source, key)) target[key] = source[key];
  }
}

function snapshotRecommendationReason(reason, index) {
  if (index === 0) {
    return {
      decision: reason.decision,
      sourceWorkoutId: reason.sourceWorkoutId,
      sourceWorkoutDate: reason.sourceWorkoutDate,
      sourceAnchorWeight: reason.sourceAnchorWeight,
      appliedWeightStep: reason.appliedWeightStep,
      recommendedWeight: reason.recommendedWeight,
      reasonCode: reason.reasonCode,
    };
  }
  const snapshot = {};
  const fields = reason.reasonCode === 'BACKOFF_AWAITING_PRIOR_SET'
    ? ['recommendedWeight', 'reasonCode']
    : BACKOFF_REASON_FIELDS;
  for (const key of fields) {
    if (hasOwn(reason, key)) snapshot[key] = reason[key];
  }
  return snapshot;
}

function snapshotOccurrence(source) {
  if (!isObject(source)) throw new TypeError('Invalid exercise occurrence');

  const trackingMode = hasOwn(source, 'trackingMode') ? source.trackingMode : 'simple';
  const snapshot = {
    id: source.id,
    name: source.name,
    muscleGroup: source.muscleGroup,
    tier: source.tier,
    trackingMode,
    sets: source.sets,
    prescribedSetCount: hasOwn(source, 'prescribedSetCount') ? source.prescribedSetCount : source.sets,
  };
  copyOptionalExerciseFields(source, snapshot);

  if (trackingMode === 'simple') {
    snapshot.completed = source.completed;
    return snapshot;
  }

  if (trackingMode === 'weighted') {
    Object.assign(snapshot, {
      startingWeight: source.startingWeight,
      targetReps: source.targetReps,
      floorReps: source.floorReps,
      weightStep: source.weightStep,
      setRecords: Array.isArray(source.setRecords) ? source.setRecords.map(record => ({
        index: record.index,
        targetWeight: record.targetWeight,
        targetReps: record.targetReps,
        actualWeight: record.actualWeight,
        actualReps: record.actualReps,
        completed: record.completed,
        recommendationReason: snapshotRecommendationReason(record.recommendationReason, record.index),
      })) : source.setRecords,
    });
    return snapshot;
  }

  if (trackingMode === 'bodyweight') {
    Object.assign(snapshot, {
      targetReps: source.targetReps,
      setRecords: Array.isArray(source.setRecords) ? source.setRecords.map(record => ({
        index: record.index,
        targetReps: record.targetReps,
        fullReps: record.fullReps,
        assistedReps: record.assistedReps,
        eccentricReps: record.eccentricReps,
        completed: record.completed,
      })) : source.setRecords,
    });
  }

  return snapshot;
}

function snapshotV3Timing(record) {
  return {
    index: record.index,
    completed: record.completed,
    plannedRestSeconds: record.plannedRestSeconds,
    workDurationSeconds: record.workDurationSeconds,
    actualRestSeconds: record.actualRestSeconds,
  };
}

function snapshotV3Occurrence(source) {
  if (!isObject(source)) throw new TypeError('Invalid exercise occurrence');

  const snapshot = {
    id: source.id,
    occurrenceId: source.occurrenceId,
    name: source.name,
    muscleGroup: source.muscleGroup,
    tier: source.tier,
    trackingMode: source.trackingMode,
    sets: source.sets,
    prescribedSetCount: source.prescribedSetCount,
  };
  copyOptionalExerciseFields(source, snapshot);

  if (source.trackingMode === 'simple') {
    snapshot.setRecords = Array.isArray(source.setRecords)
      ? source.setRecords.map(snapshotV3Timing)
      : source.setRecords;
    return snapshot;
  }

  if (source.trackingMode === 'weighted') {
    Object.assign(snapshot, {
      startingWeight: source.startingWeight,
      targetReps: source.targetReps,
      floorReps: source.floorReps,
      weightStep: source.weightStep,
      setRecords: Array.isArray(source.setRecords) ? source.setRecords.map(record => ({
        ...snapshotV3Timing(record),
        targetWeight: record.targetWeight,
        targetReps: record.targetReps,
        actualWeight: record.actualWeight,
        actualReps: record.actualReps,
        recommendationReason: snapshotRecommendationReason(record.recommendationReason, record.index),
      })) : source.setRecords,
    });
    return snapshot;
  }

  if (source.trackingMode === 'bodyweight') {
    Object.assign(snapshot, {
      targetReps: source.targetReps,
      setRecords: Array.isArray(source.setRecords) ? source.setRecords.map(record => ({
        ...snapshotV3Timing(record),
        targetReps: record.targetReps,
        fullReps: record.fullReps,
        assistedReps: record.assistedReps,
        eccentricReps: record.eccentricReps,
      })) : source.setRecords,
    });
  }
  return snapshot;
}

export function buildCompletedWorkoutDocument(workout) {
  if (!isObject(workout) || !Array.isArray(workout.exercises)) {
    throw new TypeError('Invalid completed workout input');
  }

  const document = {
    schemaVersion: 2,
    status: 'completed',
    date: workout.date,
    actualDuration: workout.actualDuration,
    exercises: workout.exercises.map(snapshotOccurrence),
  };

  if (!isValidV2WorkoutDocument(document)) throw new TypeError('Invalid completed workout data');
  if (!hasConfirmedWork(document.exercises)) throw new TypeError('A workout must contain confirmed work');
  return document;
}

export function buildCompletedV3WorkoutDocument(workout) {
  if (!isObject(workout) || !Array.isArray(workout.exercises)) {
    throw new TypeError('Invalid completed workout input');
  }

  const document = {
    schemaVersion: 3,
    status: 'completed',
    date: workout.date,
    actualDurationSeconds: workout.actualDurationSeconds,
    exercises: workout.exercises.map(snapshotV3Occurrence),
  };

  if (!isValidV3WorkoutDocument(document)) throw new TypeError('Invalid completed workout data');
  return document;
}
