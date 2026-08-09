import { calculateBackoffRecommendation } from './progression';
import {
  calculateElapsedSeconds,
  closePhaseLedger,
  createPhaseLedger,
  getPhaseLedgerSeconds,
  transitionPhaseLedger,
} from './workoutTiming';

const WEIGHTED_FIELDS = new Set(['actualWeight', 'actualReps']);
const BODYWEIGHT_FIELDS = new Set(['fullReps', 'assistedReps', 'eccentricReps']);
const GENERATED_MUTATIONS = new Set([
  'toggleSimpleExercise', 'toggleTrackedSet', 'editWeightedActual', 'editBodyweightActual',
]);
const PERFORMANCE_MUTATIONS = new Set([
  'startSet', 'cancelSet', 'confirmSet', 'undoSet', 'editWeightedActual', 'editBodyweightActual',
]);
const SET_MUTATIONS = new Set([...GENERATED_MUTATIONS, ...PERFORMANCE_MUTATIONS]);

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

function isPhaseTimestamp(value) {
  return Number.isInteger(value);
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
  const occurrenceId = state.exercises[exerciseIndex]?.occurrenceId;
  const superset = state.supersets?.find(group => group.occurrenceIds.includes(occurrenceId));
  if (superset) {
    for (let currentExerciseIndex = 0; currentExerciseIndex < state.exercises.length; currentExerciseIndex += 1) {
      const recordIndex = state.exercises[currentExerciseIndex].setRecords
        ?.findIndex(record => record._activeRest && sameSuperset(record._activeGroupRest, superset));
      if (recordIndex >= 0) return closeRest(state, currentExerciseIndex, recordIndex, timestamp);
    }
  }
  if (setIndex === 0) return state;
  return closeRest(state, exerciseIndex, setIndex - 1, timestamp);
}

function sameSuperset(left, right) {
  return left?.restPlacement === right?.restPlacement
    && left.occurrenceIds?.length === right.occurrenceIds?.length
    && left.occurrenceIds.every((id, index) => id === right.occurrenceIds[index]);
}

function closeRest(state, exerciseIndex, setIndex, timestamp) {
  const previous = state.exercises[exerciseIndex]?.setRecords?.[setIndex];
  if (!previous?._activeRest) return state;
  return replaceRecord(state, exerciseIndex, setIndex, record => {
    const { _activeRest, ...rest } = record;
    return {
      ...rest,
      actualRestSeconds: calculateElapsedSeconds(_activeRest.startedAt, timestamp),
    };
  });
}

function supersetFor(state, exercise) {
  return state.supersets?.find(group => group.occurrenceIds.includes(exercise.occurrenceId));
}

function groupHasWorkRemaining(state, group, exerciseIndex, setIndex) {
  return group.occurrenceIds.some(occurrenceId => {
    const currentExercise = state.exercises.find(item => item.occurrenceId === occurrenceId);
    return currentExercise?.setRecords.some((record, index) => (
      !record.completed && (currentExercise !== state.exercises[exerciseIndex] || index !== setIndex)
    ));
  });
}

function configuredGroupRestSeconds(state, group) {
  const configuredFinal = state.exercises.find(exercise => exercise.occurrenceId === group.occurrenceIds.at(-1));
  return configuredFinal?.setRecords.find(record => record.plannedRestSeconds !== null)?.plannedRestSeconds ?? 60;
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

function hasCompletedWork(exercises) {
  return exercises.some(exercise => exercise.setRecords?.some(record => record.completed));
}

function allSetsCompleted(exercises) {
  const records = exercises.flatMap(exercise => exercise.setRecords ?? []);
  return records.length > 0 && records.every(record => record.completed);
}

function isFinalOutstandingSet(exercises, exerciseIndex, setIndex) {
  return exercises.every((exercise, currentExerciseIndex) => exercise.setRecords?.every((record, currentSetIndex) => (
    record.completed || (currentExerciseIndex === exerciseIndex && currentSetIndex === setIndex)
  )));
}

function resolveActiveTiming(state, timestamp) {
  return {
    ...state,
    activeWorkTimer: null,
    exercises: state.exercises.map(exercise => ({
      ...exercise,
      setRecords: exercise.setRecords?.map(record => {
        if (!record._activeRest) return record;
        const { _activeRest, ...rest } = record;
        return {
          ...rest,
          actualRestSeconds: calculateElapsedSeconds(_activeRest.startedAt, timestamp),
        };
      }),
    })),
  };
}

function phaseTransition(state, phase, timestamp) {
  const phaseLedger = transitionPhaseLedger(state.phaseLedger, phase, timestamp);
  if (phaseLedger === state.phaseLedger) return state;
  return { ...state, phase, phaseLedger };
}

function canMutateInPhase(state, action) {
  if (!state._phaseTimingEnabled) return true;
  if (!SET_MUTATIONS.has(action.type)) return true;
  if (state.phase === 'generated') return GENERATED_MUTATIONS.has(action.type);
  if (state.phase === 'warmup') return action.type === 'startSet';
  if (state.phase === 'performance') return PERFORMANCE_MUTATIONS.has(action.type);
  if (state.phase !== 'cooldown' || action.type !== 'undoSet' || !isPhaseTimestamp(action.timestamp)) {
    return false;
  }
  return state._cooldownUndoTarget?.exerciseIndex === action.exerciseIndex
    && state._cooldownUndoTarget?.setIndex === action.setIndex;
}

function freezePhaseCandidate(ledger, finishRequestedAtEpochMs) {
  const phaseActualSeconds = { ...ledger.closedSeconds };
  return deepFreeze({
    phaseActualSeconds,
    actualDurationSeconds: Object.values(phaseActualSeconds).reduce((total, seconds) => total + seconds, 0),
    finishRequestedAtEpochMs,
  });
}

function recomputeFollowingSets(exercise, sourceIndex) {
  let updated = exercise;
  for (let index = sourceIndex; index < updated.setRecords.length - 1; index += 1) {
    const source = updated.setRecords[index];
    if (!canConfirmWeightedSet(source)) break;
    const nextIndex = index + 1;
    const recommendation = calculateBackoffRecommendation({
      actualWeight: source.actualWeight,
      actualReps: source.actualReps,
      floorReps: updated.floorReps,
      weightStep: updated.weightStep,
      sessionTopTarget: updated.setRecords[0].targetWeight,
      priorAssignedTargetWeights: updated.setRecords.slice(0, nextIndex).map(record => record.targetWeight),
    });
    const current = updated.setRecords[nextIndex];
    const dirty = current._activeDirty || { actualWeight: false, actualReps: false };
    const setRecords = updated.setRecords.slice();
    setRecords[nextIndex] = {
      ...current,
      targetWeight: recommendation.recommendedWeight,
      actualWeight: current.completed || dirty.actualWeight ? current.actualWeight : recommendation.recommendedWeight,
      actualReps: current.completed || dirty.actualReps ? current.actualReps : current.targetReps,
      recommendationReason: recommendation,
    };
    updated = { ...updated, setRecords };
    if (!current.completed) break;
  }
  return updated;
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

export function initializeActiveWorkout(exercises, { phaseTimingEnabled = false } = {}) {
  if (!Array.isArray(exercises)) throw new TypeError('Workout exercises must be an array');
  const cloned = structuredClone(exercises);
  const supersets = Array.isArray(exercises.supersets) ? structuredClone(exercises.supersets) : [];
  for (const exercise of cloned) {
    if (!Object.hasOwn(exercise, 'trackingMode')) exercise.trackingMode = 'simple';
    if (exercise.trackingMode === 'simple') {
      if (typeof exercise.completed !== 'boolean') exercise.completed = false;
      if (!Array.isArray(exercise.setRecords)) {
        const count = Number.isInteger(exercise.prescribedSetCount)
          ? exercise.prescribedSetCount
          : exercise.sets;
        const setCount = Math.max(1, count || 1);
        exercise.setRecords = Array.from({ length: setCount }, (_, index) => ({
          index,
          completed: exercise.completed && index === 0,
          plannedRestSeconds: index === setCount - 1 ? null : 60,
          workDurationSeconds: null,
          actualRestSeconds: null,
        }));
      }
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
    phase: 'generated',
    phaseLedger: null,
    phaseCandidate: null,
    _cooldownUndoTarget: null,
    supersets,
    _phaseTimingEnabled: phaseTimingEnabled,
  };
}

export function activeWorkoutReducer(state, action) {
  if (action.type === 'moveGeneratedBlock') {
    if (state.phase !== 'generated' || state.workoutStartedAt !== null || !['earlier', 'later'].includes(action.direction)) return state;
    const blockFor = occurrenceId => {
      const index = state.exercises.findIndex(exercise => exercise.occurrenceId === occurrenceId);
      if (index < 0) return null;
      const ids = supersetFor(state, state.exercises[index])?.occurrenceIds ?? [occurrenceId];
      const first = state.exercises.findIndex(exercise => exercise.occurrenceId === ids[0]);
      if (first < 0 || !ids.every((id, offset) => state.exercises[first + offset]?.occurrenceId === id)) return null;
      return { first, last: first + ids.length - 1 };
    };
    const source = blockFor(action.occurrenceId);
    if (!source) return state;
    const targetIndex = action.direction === 'earlier' ? source.first - 1 : source.last + 1;
    const target = targetIndex < 0 || targetIndex >= state.exercises.length ? null : blockFor(state.exercises[targetIndex].occurrenceId);
    if (!target) return state;
    const sourceBlock = state.exercises.slice(source.first, source.last + 1);
    const targetBlock = state.exercises.slice(target.first, target.last + 1);
    const exercises = action.direction === 'earlier'
      ? [...state.exercises.slice(0, target.first), ...sourceBlock, ...targetBlock, ...state.exercises.slice(source.last + 1)]
      : [...state.exercises.slice(0, source.first), ...targetBlock, ...sourceBlock, ...state.exercises.slice(target.last + 1)];
    return { ...state, exercises };
  }
  if (action.type === 'startWorkout') {
    if (!state._phaseTimingEnabled) {
      if (state.workoutStartedAt !== null || !isTimestamp(action.timestamp)) return state;
      return { ...state, workoutStartedAt: action.timestamp };
    }
    if (state.phase !== 'generated' || state.workoutStartedAt !== null || !isPhaseTimestamp(action.timestamp)) {
      return state;
    }
    return {
      ...state,
      workoutStartedAt: action.timestamp,
      phase: 'warmup',
      phaseLedger: createPhaseLedger('warmup', action.timestamp),
    };
  }

  if (action.type === 'confirmEarlyFinish') {
    if (state.phase !== 'performance' || state.activeWorkTimer || !isPhaseTimestamp(action.timestamp)) return state;
    if (!hasCompletedWork(state.exercises)) {
      return {
        ...state,
        workoutStartedAt: null,
        phase: 'cancelled',
        phaseLedger: null,
        phaseCandidate: null,
        activeWorkTimer: null,
        _cooldownUndoTarget: null,
      };
    }
    const acceptedAt = Math.max(state.phaseLedger.lastAcceptedEpochMs, action.timestamp);
    return {
      ...phaseTransition(resolveActiveTiming(state, acceptedAt), 'cooldown', action.timestamp),
      _cooldownUndoTarget: null,
    };
  }

  if (action.type === 'resumeWorkout') {
    return state.phase === 'cooldown' && isPhaseTimestamp(action.timestamp)
      ? { ...phaseTransition(state, 'performance', action.timestamp), _cooldownUndoTarget: null }
      : state;
  }

  if (action.type === 'finishWorkout') {
    if (state.phase !== 'cooldown' || !state.phaseLedger || !isPhaseTimestamp(action.timestamp)) return state;
    const phaseLedger = closePhaseLedger(state.phaseLedger, action.timestamp);
    return {
      ...state,
      phase: 'review',
      phaseLedger,
      phaseCandidate: freezePhaseCandidate(phaseLedger, action.timestamp),
    };
  }

  if (action.type === 'reviewBack') {
    if (state.phase !== 'review' || !state.phaseLedger || !isPhaseTimestamp(action.timestamp)) return state;
    const acceptedAt = Math.max(state.phaseLedger.lastAcceptedEpochMs, action.timestamp);
    const phaseLedger = {
      ...state.phaseLedger,
      openPhase: 'cooldown',
      openedAtEpochMs: acceptedAt,
      lastAcceptedEpochMs: acceptedAt,
    };
    return { ...state, phase: 'cooldown', phaseLedger, phaseCandidate: null };
  }

  if (!canMutateInPhase(state, action)) return state;

  const exercise = state.exercises[action.exerciseIndex];
  if (!exercise) return state;

  if (action.type === 'startSet') {
    if (state.workoutStartedAt === null
      || state.activeWorkTimer
      || !isTimestamp(action.timestamp)
      || (state._phaseTimingEnabled && state.phase === 'warmup' && !isPhaseTimestamp(action.timestamp))) {
      return state;
    }
    const record = exercise.setRecords?.[action.setIndex];
    if (!record || getSetStatus(exercise, action.setIndex) !== 'ready') return state;
    const withClosedRest = closePriorRest(state, action.exerciseIndex, action.setIndex, action.timestamp);
    const sequence = withClosedRest._nextTimerId;
    const updated = {
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
    return updated.phase === 'warmup'
      ? phaseTransition(updated, 'performance', action.timestamp)
      : updated;
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
      || !canConfirmSet(exercise, record)
      || (state._phaseTimingEnabled
        && isFinalOutstandingSet(state.exercises, action.exerciseIndex, action.setIndex)
        && !isPhaseTimestamp(action.timestamp))) {
      return state;
    }

    const isFinal = action.setIndex === exercise.setRecords.length - 1;
    const superset = supersetFor(state, exercise);
    const groupHasWork = superset && groupHasWorkRemaining(state, superset, action.exerciseIndex, action.setIndex);
    const isGroupOwner = superset?.restPlacement === 'BETWEEN_EXERCISES'
      || (superset?.restPlacement === 'AFTER_ROUND'
        && superset.occurrenceIds.every(occurrenceId => occurrenceId === exercise.occurrenceId
          || state.exercises.find(item => item.occurrenceId === occurrenceId)
            ?.setRecords[action.setIndex]?.completed));
    const startsGroupRest = isGroupOwner && groupHasWork;
    const finishesGroup = isGroupOwner && !groupHasWork;
    const sequence = state._nextTimerId;
    let updated = replaceRecord(state, action.exerciseIndex, action.setIndex, current => ({
      ...current,
      completed: true,
      workDurationSeconds: calculateElapsedSeconds(timer.startedAt, action.timestamp),
      plannedRestSeconds: (startsGroupRest || finishesGroup) && superset?.restPlacement === 'AFTER_ROUND'
        ? configuredGroupRestSeconds(state, superset)
        : (startsGroupRest || finishesGroup) && current.plannedRestSeconds === null
          ? exercise.setRecords.find(record => record.plannedRestSeconds !== null)?.plannedRestSeconds ?? 60
          : current.plannedRestSeconds,
      actualRestSeconds: finishesGroup ? 0 : null,
      ...(startsGroupRest || (!superset && !isFinal) ? {
        _activeRest: {
          id: timerId('rest', sequence),
          startedAt: action.timestamp,
        },
        ...(superset ? { _activeGroupRest: superset } : {}),
      } : (finishesGroup ? { _activeGroupRest: superset } : {})),
    }));
    if (exercise.trackingMode === 'weighted') {
      updated = replaceExercise(
        updated,
        action.exerciseIndex,
        recomputeFollowingSets(updated.exercises[action.exerciseIndex], action.setIndex),
      );
    }
    if (exercise.trackingMode === 'simple') {
      updated = replaceExercise(updated, action.exerciseIndex, {
        ...updated.exercises[action.exerciseIndex],
        completed: true,
      });
    }
    const result = {
      ...updated,
      activeWorkTimer: null,
      _nextTimerId: startsGroupRest || (!superset && !isFinal) ? sequence + 1 : sequence,
    };
    if (!result._phaseTimingEnabled
      || result.phase !== 'performance'
      || !allSetsCompleted(result.exercises)) return result;
    return {
      ...phaseTransition(result, 'cooldown', action.timestamp),
      _cooldownUndoTarget: { exerciseIndex: action.exerciseIndex, setIndex: action.setIndex },
    };
  }

  if (action.type === 'undoSet') {
    const record = exercise.setRecords?.[action.setIndex];
    const prefixLength = Array.isArray(exercise.setRecords)
      ? confirmedPrefixLength(exercise.setRecords)
      : 0;
    if (!record?.completed
      || action.setIndex !== prefixLength - 1
      || (record.actualRestSeconds !== null && !record._activeGroupRest)) {
      return state;
    }
    let updated = replaceRecord(state, action.exerciseIndex, action.setIndex, current => {
      const { _activeRest, _activeGroupRest, ...rest } = current;
      return {
        ...rest,
        completed: false,
        workDurationSeconds: null,
        actualRestSeconds: null,
      };
    });
    const superset = supersetFor(state, exercise);
    if (superset) {
      updated = {
        ...updated,
        exercises: updated.exercises.map(currentExercise => ({
          ...currentExercise,
          setRecords: currentExercise.setRecords.map(current => (
            sameSuperset(current._activeGroupRest, superset) && groupHasWorkRemaining(updated, superset, -1, -1)
              ? (() => { const { _activeRest, _activeGroupRest, ...rest } = current; return { ...rest, actualRestSeconds: null }; })()
              : current
          )),
        })),
      };
    }
    if (exercise.trackingMode === 'weighted') {
      updated = replaceExercise(
        updated,
        action.exerciseIndex,
        relockImmediateNext(updated.exercises[action.exerciseIndex], action.setIndex),
      );
    }
    if (exercise.trackingMode === 'simple') {
      updated = replaceExercise(updated, action.exerciseIndex, {
        ...updated.exercises[action.exerciseIndex],
        completed: updated.exercises[action.exerciseIndex].setRecords.some(item => item.completed),
      });
    }
    return updated.phase === 'cooldown'
      ? { ...phaseTransition(updated, 'performance', action.timestamp), _cooldownUndoTarget: null }
      : updated;
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
      updated = recomputeFollowingSets(updated, action.setIndex);
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
    if (record.completed && value !== '') {
      updatedState = replaceExercise(
        updatedState,
        action.exerciseIndex,
        recomputeFollowingSets(updatedExercise, action.setIndex),
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

export function getPhaseElapsedSeconds(state, phase, timestamp) {
  return getPhaseLedgerSeconds(state.phaseLedger, phase, timestamp);
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
