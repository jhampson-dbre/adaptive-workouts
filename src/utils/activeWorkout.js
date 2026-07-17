import { calculateBackoffRecommendation } from './progression';
import { calculateElapsedSeconds } from './workoutTiming';

const WEIGHTED_FIELDS = new Set(['actualWeight', 'actualReps']);
const BODYWEIGHT_FIELDS = new Set(['fullReps', 'assistedReps', 'eccentricReps']);

function isValidActual(field, value) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (field !== 'actualWeight' && !Number.isInteger(parsed)) return null;
  return parsed;
}

function canConfirmWeightedSet(record) {
  return isValidActual('actualWeight', record.actualWeight) !== null
    && isValidActual('actualReps', record.actualReps) !== null;
}

function canConfirmBodyweightSet(record) {
  return [...BODYWEIGHT_FIELDS].every(field => isValidActual(field, record[field]) !== null);
}

function confirmedPrefixLength(records) {
  let length = 0;
  while (length < records.length && records[length].completed) length += 1;
  return length;
}

function replaceExercise(state, exerciseIndex, exercise) {
  const exercises = state.exercises.slice();
  exercises[exerciseIndex] = exercise;
  return { ...state, exercises };
}

function replaceRecord(state, exerciseIndex, setIndex, update) {
  const source = state.exercises[exerciseIndex];
  if (!source || !Array.isArray(source.setRecords) || !source.setRecords[setIndex]) return state;
  const setRecords = source.setRecords.slice();
  setRecords[setIndex] = update(setRecords[setIndex]);
  return replaceExercise(state, exerciseIndex, { ...source, setRecords });
}

function isTimestamp(value) {
  return Number.isFinite(value);
}

function timerId(kind, sequence) {
  return `${kind}-${sequence}`;
}

function canConfirmSet(exercise, record) {
  if (exercise.trackingMode === 'simple') return true;
  if (exercise.trackingMode === 'weighted') return canConfirmWeightedSet(record);
  if (exercise.trackingMode === 'bodyweight') return canConfirmBodyweightSet(record);
  return false;
}

function closePriorRest(state, exerciseIndex, setIndex, timestamp) {
  if (setIndex === 0) return state;
  const previous = state.exercises[exerciseIndex]?.setRecords?.[setIndex - 1];
  if (!previous?._activeRest) return state;
  return replaceRecord(state, exerciseIndex, setIndex - 1, record => {
    const { _activeRest, ...rest } = record;
    return {
      ...rest,
      actualRestSeconds: calculateElapsedSeconds(_activeRest.startedAt, timestamp),
    };
  });
}

function stripActiveFields(value) {
  if (Array.isArray(value)) return value.map(stripActiveFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith('_active'))
    .map(([key, nested]) => [key, stripActiveFields(nested)]));
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested);
  }
  return value;
}

function recomputeImmediateNext(exercise, sourceIndex) {
  const nextIndex = sourceIndex + 1;
  if (nextIndex >= exercise.setRecords.length) return exercise;

  const source = exercise.setRecords[sourceIndex];
  const recommendation = calculateBackoffRecommendation({
    actualWeight: source.actualWeight,
    actualReps: source.actualReps,
    floorReps: exercise.floorReps,
    weightStep: exercise.weightStep,
    sessionTopTarget: exercise.setRecords[0].targetWeight,
    priorAssignedTargetWeights: exercise.setRecords.slice(0, nextIndex).map(record => record.targetWeight),
  });
  const current = exercise.setRecords[nextIndex];
  if (current.completed) return exercise;
  const dirty = current._activeDirty || { actualWeight: false, actualReps: false };
  const next = {
    ...current,
    targetWeight: recommendation.recommendedWeight,
    actualWeight: dirty.actualWeight ? current.actualWeight : recommendation.recommendedWeight,
    actualReps: dirty.actualReps ? current.actualReps : current.targetReps,
    recommendationReason: recommendation,
  };
  const setRecords = exercise.setRecords.slice();
  setRecords[nextIndex] = next;
  return { ...exercise, setRecords };
}

function relockImmediateNext(exercise, sourceIndex) {
  const nextIndex = sourceIndex + 1;
  if (nextIndex >= exercise.setRecords.length) return exercise;
  const setRecords = exercise.setRecords.slice();
  const next = setRecords[nextIndex];
  setRecords[nextIndex] = {
    ...next,
    recommendationReason: {
      recommendedWeight: next.targetWeight,
      reasonCode: 'BACKOFF_AWAITING_PRIOR_SET',
    },
  };
  return { ...exercise, setRecords };
}

export function initializeActiveWorkout(exercises) {
  if (!Array.isArray(exercises)) throw new TypeError('Workout exercises must be an array');
  const cloned = structuredClone(exercises);
  for (const exercise of cloned) {
    if (!Object.hasOwn(exercise, 'trackingMode')) exercise.trackingMode = 'simple';
    if (exercise.trackingMode === 'simple' && typeof exercise.completed !== 'boolean') {
      exercise.completed = false;
    }
    if (exercise.trackingMode === 'weighted' && Array.isArray(exercise.setRecords)) {
      exercise.setRecords = exercise.setRecords.map(record => ({
        ...record,
        _activeDirty: { actualWeight: false, actualReps: false },
      }));
    }
  }
  return {
    exercises: cloned,
    workoutStartedAt: null,
    activeWorkTimer: null,
    _nextTimerId: 1,
  };
}

export function activeWorkoutReducer(state, action) {
  if (action.type === 'startWorkout') {
    if (state.workoutStartedAt !== null || !isTimestamp(action.timestamp)) return state;
    return { ...state, workoutStartedAt: action.timestamp };
  }

  const exercise = state.exercises[action.exerciseIndex];
  if (!exercise) return state;

  if (action.type === 'startSet') {
    if (state.workoutStartedAt === null || state.activeWorkTimer || !isTimestamp(action.timestamp)) {
      return state;
    }
    const record = exercise.setRecords?.[action.setIndex];
    if (!record || getSetStatus(exercise, action.setIndex) !== 'ready') return state;
    const withClosedRest = closePriorRest(state, action.exerciseIndex, action.setIndex, action.timestamp);
    const sequence = withClosedRest._nextTimerId;
    return {
      ...withClosedRest,
      activeWorkTimer: {
        id: timerId('work', sequence),
        occurrenceId: exercise.occurrenceId,
        exerciseIndex: action.exerciseIndex,
        setIndex: action.setIndex,
        startedAt: action.timestamp,
      },
      _nextTimerId: sequence + 1,
    };
  }

  if (action.type === 'cancelSet') {
    const timer = state.activeWorkTimer;
    if (!timer || timer.exerciseIndex !== action.exerciseIndex || timer.setIndex !== action.setIndex) {
      return state;
    }
    return { ...state, activeWorkTimer: null };
  }

  if (action.type === 'confirmSet') {
    const timer = state.activeWorkTimer;
    const record = exercise.setRecords?.[action.setIndex];
    if (!isTimestamp(action.timestamp)
      || !timer
      || timer.exerciseIndex !== action.exerciseIndex
      || timer.setIndex !== action.setIndex
      || !record
      || record.completed
      || action.setIndex !== confirmedPrefixLength(exercise.setRecords)
      || !canConfirmSet(exercise, record)) {
      return state;
    }

    const isFinal = action.setIndex === exercise.setRecords.length - 1;
    const sequence = state._nextTimerId;
    let updated = replaceRecord(state, action.exerciseIndex, action.setIndex, current => ({
      ...current,
      completed: true,
      workDurationSeconds: calculateElapsedSeconds(timer.startedAt, action.timestamp),
      actualRestSeconds: null,
      ...(isFinal ? {} : {
        _activeRest: {
          id: timerId('rest', sequence),
          startedAt: action.timestamp,
        },
      }),
    }));
    if (exercise.trackingMode === 'weighted') {
      updated = replaceExercise(
        updated,
        action.exerciseIndex,
        recomputeImmediateNext(updated.exercises[action.exerciseIndex], action.setIndex),
      );
    }
    return {
      ...updated,
      activeWorkTimer: null,
      _nextTimerId: isFinal ? sequence : sequence + 1,
    };
  }

  if (action.type === 'undoSet') {
    const record = exercise.setRecords?.[action.setIndex];
    const prefixLength = Array.isArray(exercise.setRecords)
      ? confirmedPrefixLength(exercise.setRecords)
      : 0;
    if (!record?.completed
      || action.setIndex !== prefixLength - 1
      || record.actualRestSeconds !== null) {
      return state;
    }
    let updated = replaceRecord(state, action.exerciseIndex, action.setIndex, current => {
      const { _activeRest, ...rest } = current;
      return {
        ...rest,
        completed: false,
        workDurationSeconds: null,
        actualRestSeconds: null,
      };
    });
    if (exercise.trackingMode === 'weighted') {
      updated = replaceExercise(
        updated,
        action.exerciseIndex,
        relockImmediateNext(updated.exercises[action.exerciseIndex], action.setIndex),
      );
    }
    return updated;
  }

  if (action.type === 'toggleSimpleExercise') {
    if (state.workoutStartedAt !== null || exercise.trackingMode !== 'simple') return state;
    return replaceExercise(state, action.exerciseIndex, { ...exercise, completed: !exercise.completed });
  }

  if (action.type === 'toggleTrackedSet') {
    if (state.workoutStartedAt !== null
      || (exercise.trackingMode !== 'weighted' && exercise.trackingMode !== 'bodyweight')) return state;
    const prefixLength = confirmedPrefixLength(exercise.setRecords);
    const record = exercise.setRecords[action.setIndex];
    if (!record) return state;
    const canConfirm = !record.completed
      && action.setIndex === prefixLength
      && (exercise.trackingMode === 'weighted'
        ? canConfirmWeightedSet(record)
        : canConfirmBodyweightSet(record));
    const canUnconfirm = record.completed && action.setIndex === prefixLength - 1;
    if (!canConfirm && !canUnconfirm) return state;

    const setRecords = exercise.setRecords.slice();
    setRecords[action.setIndex] = { ...record, completed: canConfirm };
    let updated = { ...exercise, setRecords };
    if (canConfirm && exercise.trackingMode === 'weighted') {
      updated = recomputeImmediateNext(updated, action.setIndex);
    } else if (canUnconfirm && exercise.trackingMode === 'weighted') {
      updated = relockImmediateNext(updated, action.setIndex);
    }
    return replaceExercise(state, action.exerciseIndex, updated);
  }

  if (action.type === 'editWeightedActual') {
    if (exercise.trackingMode !== 'weighted' || !WEIGHTED_FIELDS.has(action.field)) return state;
    const value = action.value === '' ? '' : isValidActual(action.field, action.value);
    if (value === null) return state;
    const record = exercise.setRecords[action.setIndex];
    if (!record || getSetStatus(exercise, action.setIndex) === 'locked') return state;
    let updatedState = replaceRecord(state, action.exerciseIndex, action.setIndex, current => ({
      ...current,
      [action.field]: value,
      _activeDirty: { ...current._activeDirty, [action.field]: true },
    }));
    const updatedExercise = updatedState.exercises[action.exerciseIndex];
    const prefixLength = confirmedPrefixLength(updatedExercise.setRecords);
    if (record.completed && value !== '' && action.setIndex === prefixLength - 1) {
      updatedState = replaceExercise(
        updatedState,
        action.exerciseIndex,
        recomputeImmediateNext(updatedExercise, action.setIndex),
      );
    }
    return updatedState;
  }

  if (action.type === 'editBodyweightActual') {
    if (exercise.trackingMode !== 'bodyweight' || !BODYWEIGHT_FIELDS.has(action.field)) return state;
    const value = action.value === '' ? '' : isValidActual(action.field, action.value);
    if (value === null) return state;
    const record = exercise.setRecords[action.setIndex];
    if (!record || getSetStatus(exercise, action.setIndex) === 'locked') return state;
    return replaceRecord(state, action.exerciseIndex, action.setIndex, current => ({
      ...current,
      [action.field]: value,
    }));
  }

  return state;
}

export function resolveFinishCandidate(state, timestamp) {
  if (state.activeWorkTimer) {
    return {
      status: 'blocked-active-work',
      activeWorkTimer: { ...state.activeWorkTimer },
    };
  }
  if (state.workoutStartedAt === null || !isTimestamp(timestamp)) {
    return { status: 'blocked-not-started' };
  }

  const exercises = state.exercises.map(exercise => ({
    ...exercise,
    setRecords: exercise.setRecords?.map(record => {
      if (!record._activeRest) return record;
      return {
        ...record,
        actualRestSeconds: calculateElapsedSeconds(record._activeRest.startedAt, timestamp),
      };
    }),
  }));
  const candidate = stripActiveFields({
    actualDurationSeconds: calculateElapsedSeconds(state.workoutStartedAt, timestamp),
    exercises,
  });
  return { status: 'ready', candidate: deepFreeze(candidate) };
}

export function getSetStatus(exercise, setIndex) {
  const record = exercise.setRecords[setIndex];
  if (record.completed) return 'completed';
  return setIndex === confirmedPrefixLength(exercise.setRecords) ? 'ready' : 'locked';
}
