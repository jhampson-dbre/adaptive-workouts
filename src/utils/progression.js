import {
  isValidV2ExerciseOccurrence,
  isValidV2WorkoutEnvelope,
  isValidWeightedCatalogConfig,
} from './workoutSchema';

export const PROGRESSION_REASON_CODES = Object.freeze({
  STARTING_NO_ANCHOR: 'STARTING_NO_ANCHOR',
  INCREASE_ALL_SETS_QUALIFIED: 'INCREASE_ALL_SETS_QUALIFIED',
  DECREASE_TOP_BELOW_FLOOR: 'DECREASE_TOP_BELOW_FLOOR',
  HOLD_TOP_BELOW_TARGET: 'HOLD_TOP_BELOW_TARGET',
  HOLD_INCOMPLETE_SETS: 'HOLD_INCOMPLETE_SETS',
  HOLD_BACKOFF_BELOW_FLOOR: 'HOLD_BACKOFF_BELOW_FLOOR',
});

export const BACKOFF_REASON_CODES = Object.freeze({
  FLOOR_MET: 'BACKOFF_FLOOR_MET',
  BELOW_FLOOR: 'BACKOFF_BELOW_FLOOR',
});

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const isFiniteNonnegative = value => Number.isFinite(value) && value >= 0;
const isNonnegativeInteger = value => Number.isInteger(value) && value >= 0;

function validateCurrentExercise(exercise) {
  if (!exercise
    || exercise.trackingMode !== 'weighted'
    || !isNonEmptyString(exercise.id)
    || !isValidWeightedCatalogConfig(exercise)) {
    throw new TypeError('Invalid current weighted exercise configuration');
  }
}

function findNewestAnchor(exerciseId, history) {
  const candidates = history
    .filter(entry => isValidV2WorkoutEnvelope(entry) && isNonEmptyString(entry.id))
    .slice()
    .sort((left, right) => {
      const dateDifference = Date.parse(right.date) - Date.parse(left.date);
      if (dateDifference) return dateDifference;
      if (left.id < right.id) return -1;
      return left.id > right.id ? 1 : 0;
    });

  for (const workout of candidates) {
    const occurrence = workout.exercises.find(candidate => (
      candidate?.id === exerciseId
      && candidate.trackingMode === 'weighted'
      && isValidV2ExerciseOccurrence(candidate)
      && candidate.setRecords[0].completed === true
    ));
    if (occurrence) return { workout, occurrence };
  }

  return null;
}

function evaluateSourceOccurrence(occurrence) {
  const topSet = occurrence.setRecords[0];
  if (topSet.actualReps < occurrence.floorReps) {
    return {
      decision: 'decrease',
      reasonCode: PROGRESSION_REASON_CODES.DECREASE_TOP_BELOW_FLOOR,
    };
  }
  if (topSet.actualReps < occurrence.targetReps) {
    return {
      decision: 'hold',
      reasonCode: PROGRESSION_REASON_CODES.HOLD_TOP_BELOW_TARGET,
    };
  }
  if (!occurrence.setRecords.every(record => record.completed)) {
    return {
      decision: 'hold',
      reasonCode: PROGRESSION_REASON_CODES.HOLD_INCOMPLETE_SETS,
    };
  }
  if (!occurrence.setRecords.slice(1).every(record => record.actualReps >= occurrence.floorReps)) {
    return {
      decision: 'hold',
      reasonCode: PROGRESSION_REASON_CODES.HOLD_BACKOFF_BELOW_FLOOR,
    };
  }
  return {
    decision: 'increase',
    reasonCode: PROGRESSION_REASON_CODES.INCREASE_ALL_SETS_QUALIFIED,
  };
}

export function getNextSessionRecommendation(currentExercise, history) {
  if (!Array.isArray(history)) throw new TypeError('Workout history must be an array');
  validateCurrentExercise(currentExercise);

  const anchor = findNewestAnchor(currentExercise.id, history);
  if (!anchor) {
    return {
      decision: 'starting',
      sourceWorkoutId: null,
      sourceWorkoutDate: null,
      sourceAnchorWeight: null,
      appliedWeightStep: 0,
      recommendedWeight: currentExercise.startingWeight,
      reasonCode: PROGRESSION_REASON_CODES.STARTING_NO_ANCHOR,
    };
  }

  const { workout, occurrence } = anchor;
  const sourceAnchorWeight = occurrence.setRecords[0].actualWeight;
  const evaluation = evaluateSourceOccurrence(occurrence);
  const appliedWeightStep = evaluation.decision === 'increase' || evaluation.decision === 'decrease'
    ? currentExercise.weightStep
    : 0;
  const direction = evaluation.decision === 'increase' ? 1 : evaluation.decision === 'decrease' ? -1 : 0;
  const recommendedWeight = Math.max(0, sourceAnchorWeight + (direction * currentExercise.weightStep));

  return {
    decision: evaluation.decision,
    sourceWorkoutId: workout.id,
    sourceWorkoutDate: workout.date,
    sourceAnchorWeight,
    appliedWeightStep,
    recommendedWeight,
    reasonCode: evaluation.reasonCode,
  };
}

function validateBackoffInput(input) {
  if (!input
    || !isFiniteNonnegative(input.actualWeight)
    || !isNonnegativeInteger(input.actualReps)
    || !isNonnegativeInteger(input.floorReps)
    || !Number.isFinite(input.weightStep)
    || input.weightStep <= 0
    || !isFiniteNonnegative(input.sessionTopTarget)
    || !Array.isArray(input.priorAssignedTargetWeights)
    || input.priorAssignedTargetWeights.length === 0
    || !input.priorAssignedTargetWeights.every(isFiniteNonnegative)) {
    throw new TypeError('Invalid backoff recommendation input');
  }
}

export function calculateBackoffRecommendation(input) {
  validateBackoffInput(input);
  const {
    actualWeight,
    actualReps,
    floorReps,
    weightStep,
    sessionTopTarget,
    priorAssignedTargetWeights,
  } = input;
  const dropSteps = actualReps >= floorReps ? 0 : Math.min(floorReps - actualReps, 3);
  const rawWeight = Math.max(0, actualWeight - (weightStep * dropSteps));
  const priorTargetCeiling = Math.min(...priorAssignedTargetWeights);
  const recommendedWeight = Math.min(rawWeight, sessionTopTarget, priorTargetCeiling);

  return {
    recommendedWeight,
    reasonCode: dropSteps === 0 ? BACKOFF_REASON_CODES.FLOOR_MET : BACKOFF_REASON_CODES.BELOW_FLOOR,
    sourceActualWeight: actualWeight,
    sourceActualReps: actualReps,
    floorReps,
    weightStep,
    dropSteps,
    rawWeight,
    sessionTopTarget,
    priorTargetCeiling,
  };
}
