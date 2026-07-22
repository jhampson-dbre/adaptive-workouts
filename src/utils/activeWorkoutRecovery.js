const PHASES = ['warmup', 'performance', 'cooldown'];
const ACTIVE_PHASES = [...PHASES, 'review'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const nonempty = value => typeof value === 'string' && value.length > 0;
const integer = value => Number.isSafeInteger(value);
const nonnegative = value => integer(value) && value >= 0;
const clone = value => structuredClone(value);
const finiteNonnegative = value => Number.isFinite(value) && value >= 0;
export const isValidRecoveryIdentity = ({ projectId, uid } = {}) => nonempty(projectId) && nonempty(uid);
function freeze(value) { Object.freeze(value); Object.values(value).forEach(item => { if (item && typeof item === 'object' && !Object.isFrozen(item)) freeze(item); }); return value; }

export function recoveryStorageKey({ projectId, uid }) {
  if (!isValidRecoveryIdentity({ projectId, uid })) throw new TypeError('Recovery identity must contain nonempty strings');
  return `adaptive-workouts:active-workout:v1:${encodeURIComponent(projectId)}:${encodeURIComponent(uid)}`;
}
export function recoveryLockName(identity) {
  if (!isValidRecoveryIdentity(identity)) throw new TypeError('Recovery identity must contain nonempty strings');
  return `active-workout:${encodeURIComponent(identity.projectId)}:${encodeURIComponent(identity.uid)}`;
}

function persistedRecord(record) {
  const common = ['index', 'completed', 'plannedRestSeconds', 'workDurationSeconds', 'actualRestSeconds'];
  const result = Object.fromEntries(common.map(key => [key, record[key]]));
  result.activeRest = record._activeRest ? { id: record._activeRest.id, startedAtEpochMs: record._activeRest.startedAt } : null;
  if (Object.hasOwn(record, 'targetWeight')) Object.assign(result, { targetWeight: record.targetWeight, targetReps: record.targetReps, actualWeight: record.actualWeight, actualReps: record.actualReps, recommendationReason: clone(record.recommendationReason), inputDirty: clone(record._activeDirty) });
  else if (Object.hasOwn(record, 'fullReps')) Object.assign(result, { targetReps: record.targetReps, fullReps: record.fullReps, assistedReps: record.assistedReps, eccentricReps: record.eccentricReps });
  return result;
}
function persistedExercise(exercise) {
  const common = ['id', 'occurrenceId', 'name', 'muscleGroup', 'tier', 'trackingMode', 'sets', 'prescribedSetCount'];
  const result = Object.fromEntries(common.map(key => [key, exercise[key]]));
  if (Object.hasOwn(exercise, 'linkedTo')) result.linkedTo = exercise.linkedTo;
  if (Object.hasOwn(exercise, 'isActive')) result.isActive = exercise.isActive;
  if (exercise.trackingMode === 'simple') result.completed = exercise.completed;
  if (exercise.trackingMode === 'weighted') Object.assign(result, { startingWeight: exercise.startingWeight, targetReps: exercise.targetReps, floorReps: exercise.floorReps, weightStep: exercise.weightStep });
  if (exercise.trackingMode === 'bodyweight') result.targetReps = exercise.targetReps;
  result.setRecords = exercise.setRecords.map(persistedRecord);
  return result;
}
function persistedWorkout(state) {
  return {
    phase: state.phase,
    workoutStartedAtEpochMs: state.workoutStartedAt,
    activeWorkTimer: state.activeWorkTimer && { ...state.activeWorkTimer, startedAtEpochMs: state.activeWorkTimer.startedAt },
    nextTimerId: state._nextTimerId,
    phaseLedger: clone(state.phaseLedger), phaseCandidate: state.phaseCandidate && clone(state.phaseCandidate),
    cooldownUndoTarget: state._cooldownUndoTarget && clone(state._cooldownUndoTarget),
    exercises: state.exercises.map(persistedExercise),
  };
}
export function createRecoveryDraft({ projectId, uid, draftId, ownershipGeneration, lastMutationAtEpochMs, phaseTargets, activeWorkout }) {
  if (!isValidRecoveryIdentity({ projectId, uid })) throw new TypeError('Recovery identity must contain nonempty strings');
  return { version: 1, projectId, uid, draftId, ownershipGeneration, lastMutationAtEpochMs, phaseTargets: clone(phaseTargets), activeWorkout: persistedWorkout(activeWorkout), pendingSave: null };
}

function validLedger(ledger, phase) {
  if (!exact(ledger, ['closedMilliseconds', 'closedSeconds', 'openPhase', 'openedAtEpochMs', 'lastAcceptedEpochMs']) || !integer(ledger.lastAcceptedEpochMs)) return false;
  for (const key of ['closedMilliseconds', 'closedSeconds']) {
    if (!exact(ledger[key], PHASES) || !PHASES.every(p => nonnegative(ledger[key][p]))) return false;
    if (key === 'closedSeconds' && PHASES.some(p => ledger[key][p] !== Math.round(ledger.closedMilliseconds[p] / 1000))) return false;
  }
  return phase === 'review'
    ? ledger.openPhase === null && ledger.openedAtEpochMs === null
    : ledger.openPhase === phase && integer(ledger.openedAtEpochMs) && ledger.openedAtEpochMs <= ledger.lastAcceptedEpochMs;
}
function validRecord(record, exercise, index, nextTimerId) {
  const common = ['index', 'completed', 'plannedRestSeconds', 'workDurationSeconds', 'actualRestSeconds', 'activeRest'];
  const mode = exercise.trackingMode;
  const additional = mode === 'weighted' ? ['targetWeight', 'targetReps', 'actualWeight', 'actualReps', 'recommendationReason', 'inputDirty'] : mode === 'bodyweight' ? ['targetReps', 'fullReps', 'assistedReps', 'eccentricReps'] : [];
  if (!exact(record, [...common, ...additional]) || record.index !== index || typeof record.completed !== 'boolean') return false;
  if ((index === exercise.sets - 1) !== (record.plannedRestSeconds === null) || (record.plannedRestSeconds !== null && (!integer(record.plannedRestSeconds) || record.plannedRestSeconds < 5 || record.plannedRestSeconds > 600))) return false;
  if ((!record.completed && (record.workDurationSeconds !== null || record.actualRestSeconds !== null)) || (record.completed && !nonnegative(record.workDurationSeconds))) return false;
  if (record.activeRest !== null && (!exact(record.activeRest, ['id', 'startedAtEpochMs']) || !/^rest-[1-9]\d*$/.test(record.activeRest.id) || !integer(record.activeRest.startedAtEpochMs) || Number(record.activeRest.id.slice(5)) >= nextTimerId)) return false;
  if (record.activeRest !== null && (record.actualRestSeconds !== null || !record.completed || index === exercise.sets - 1)) return false;
  if (record.actualRestSeconds !== null && !nonnegative(record.actualRestSeconds)) return false;
  if (record.completed && index !== exercise.sets - 1 && !((record.actualRestSeconds !== null && record.activeRest === null) || (record.actualRestSeconds === null && record.activeRest !== null))) return false;
  const actualCount = value => value === '' || nonnegative(value);
  if (mode === 'weighted') {
    if (!finiteNonnegative(record.targetWeight) || !integer(record.targetReps) || record.targetReps < 1 || !(record.actualWeight === '' || finiteNonnegative(record.actualWeight)) || !actualCount(record.actualReps) || !exact(record.inputDirty, ['actualWeight', 'actualReps']) || !Object.values(record.inputDirty).every(v => typeof v === 'boolean')) return false;
    const reason = record.recommendationReason;
    if (index === 0) {
      if (!exact(reason, ['decision', 'sourceWorkoutId', 'sourceWorkoutDate', 'sourceAnchorWeight', 'appliedWeightStep', 'recommendedWeight', 'reasonCode']) || !['starting', 'increase', 'hold', 'decrease'].includes(reason.decision) || !finiteNonnegative(reason.appliedWeightStep) || reason.recommendedWeight !== record.targetWeight) return false;
      const codes = { starting: ['STARTING_NO_ANCHOR'], increase: ['INCREASE_ALL_SETS_QUALIFIED'], decrease: ['DECREASE_TOP_BELOW_FLOOR'], hold: ['HOLD_TOP_BELOW_TARGET', 'HOLD_INCOMPLETE_SETS', 'HOLD_BACKOFF_BELOW_FLOOR'] };
      if (!codes[reason.decision].includes(reason.reasonCode)) return false;
      if (reason.decision === 'starting') return reason.sourceWorkoutId === null && reason.sourceWorkoutDate === null && reason.sourceAnchorWeight === null && reason.appliedWeightStep === 0 && reason.recommendedWeight === exercise.startingWeight;
      if (!nonempty(reason.sourceWorkoutId) || typeof reason.sourceWorkoutDate !== 'string' || !Number.isFinite(Date.parse(reason.sourceWorkoutDate)) || !finiteNonnegative(reason.sourceAnchorWeight)) return false;
      const direction = reason.decision === 'increase' ? 1 : reason.decision === 'decrease' ? -1 : 0;
      return reason.appliedWeightStep === (direction ? exercise.weightStep : 0) && reason.recommendedWeight === Math.max(0, reason.sourceAnchorWeight + direction * exercise.weightStep);
    }
    if (exact(reason, ['recommendedWeight', 'reasonCode'])) return reason.reasonCode === 'BACKOFF_AWAITING_PRIOR_SET' && reason.recommendedWeight === record.targetWeight;
    const keys = ['recommendedWeight', 'reasonCode', 'sourceActualWeight', 'sourceActualReps', 'floorReps', 'weightStep', 'dropSteps', 'rawWeight', 'sessionTopTarget', 'priorTargetCeiling'];
    if (!exact(reason, keys) || !['BACKOFF_FLOOR_MET', 'BACKOFF_BELOW_FLOOR'].includes(reason.reasonCode) || ![reason.recommendedWeight, reason.sourceActualWeight, reason.weightStep, reason.rawWeight, reason.sessionTopTarget, reason.priorTargetCeiling].every(finiteNonnegative) || ![reason.sourceActualReps, reason.floorReps, reason.dropSteps].every(nonnegative) || reason.floorReps !== exercise.floorReps || reason.weightStep !== exercise.weightStep || reason.sessionTopTarget !== exercise.setRecords[0].targetWeight || reason.recommendedWeight !== record.targetWeight) return false;
    const prior = exercise.setRecords.slice(0, index).map(item => item.targetWeight); const expectedDrops = reason.sourceActualReps >= reason.floorReps ? 0 : Math.min(reason.floorReps - reason.sourceActualReps, 3);
    const preceding = exercise.setRecords[index - 1];
    const sourceMatches = (preceding.actualWeight === '' || reason.sourceActualWeight === preceding.actualWeight)
      && (preceding.actualReps === '' || reason.sourceActualReps === preceding.actualReps);
    return sourceMatches && reason.priorTargetCeiling === Math.min(...prior) && reason.dropSteps === expectedDrops && reason.reasonCode === (expectedDrops === 0 ? 'BACKOFF_FLOOR_MET' : 'BACKOFF_BELOW_FLOOR') && reason.rawWeight === Math.max(0, reason.sourceActualWeight - reason.weightStep * reason.dropSteps) && reason.recommendedWeight === Math.min(reason.rawWeight, reason.sessionTopTarget, reason.priorTargetCeiling);
  }
  if (mode === 'bodyweight') return integer(record.targetReps) && record.targetReps > 0 && ['fullReps', 'assistedReps', 'eccentricReps'].every(key => actualCount(record[key]));
  return true;
}
function validExercise(exercise, nextTimerId) {
  const common = ['id', 'occurrenceId', 'name', 'muscleGroup', 'tier', 'trackingMode', 'sets', 'prescribedSetCount', 'setRecords'];
  const extra = exercise.trackingMode === 'simple' ? ['completed'] : exercise.trackingMode === 'weighted' ? ['startingWeight', 'targetReps', 'floorReps', 'weightStep'] : exercise.trackingMode === 'bodyweight' ? ['targetReps'] : [];
  const optional = ['linkedTo', 'isActive'].filter(key => Object.hasOwn(exercise, key));
  if (!exact(exercise, [...common, ...extra, ...optional]) || !['simple', 'weighted', 'bodyweight'].includes(exercise.trackingMode) || ![exercise.id, exercise.occurrenceId, exercise.name, exercise.muscleGroup].every(nonempty) || !integer(exercise.tier) || !integer(exercise.sets) || exercise.sets < 1 || exercise.sets > 10 || exercise.prescribedSetCount !== exercise.sets || !Array.isArray(exercise.setRecords) || exercise.setRecords.length !== exercise.sets) return false;
  if (Object.hasOwn(exercise, 'linkedTo') && exercise.linkedTo !== null && typeof exercise.linkedTo !== 'string') return false;
  if (Object.hasOwn(exercise, 'isActive') && typeof exercise.isActive !== 'boolean') return false;
  if (exercise.trackingMode === 'weighted' && (!Number.isFinite(exercise.startingWeight) || exercise.startingWeight < 0 || !integer(exercise.targetReps) || exercise.targetReps < 1 || !integer(exercise.floorReps) || exercise.floorReps < 0 || exercise.floorReps >= exercise.targetReps || !Number.isFinite(exercise.weightStep) || exercise.weightStep <= 0)) return false;
  if (exercise.trackingMode === 'bodyweight' && (!integer(exercise.targetReps) || exercise.targetReps < 1)) return false;
  let seenOpen = false;
  if (!exercise.setRecords.every((record, index) => { if (seenOpen && record.completed) return false; if (!record.completed) seenOpen = true; return validRecord(record, exercise, index, nextTimerId) && (exercise.trackingMode === 'simple' || record.targetReps === exercise.targetReps); })) return false;
  if (exercise.trackingMode === 'simple' && exercise.completed !== exercise.setRecords.some(record => record.completed)) return false;
  const rests = exercise.setRecords.map((record, index) => ({ record, index })).filter(item => item.record.activeRest);
  return rests.length <= 1 && (!rests.length || rests[0].index === exercise.setRecords.filter(record => record.completed).length - 1);
}
function validWorkout(workout) {
  if (!exact(workout, ['phase', 'workoutStartedAtEpochMs', 'activeWorkTimer', 'nextTimerId', 'phaseLedger', 'phaseCandidate', 'cooldownUndoTarget', 'exercises']) || !ACTIVE_PHASES.includes(workout.phase) || !integer(workout.workoutStartedAtEpochMs) || !integer(workout.nextTimerId) || workout.nextTimerId < 1 || !validLedger(workout.phaseLedger, workout.phase) || !Array.isArray(workout.exercises) || !workout.exercises.length || new Set(workout.exercises.map(x => x.occurrenceId)).size !== workout.exercises.length || !workout.exercises.every(exercise => validExercise(exercise, workout.nextTimerId))) return false;
  if (workout.activeWorkTimer !== null && (!exact(workout.activeWorkTimer, ['id', 'occurrenceId', 'exerciseIndex', 'setIndex', 'startedAtEpochMs']) || !/^work-[1-9]\d*$/.test(workout.activeWorkTimer.id) || Number(workout.activeWorkTimer.id.slice(5)) >= workout.nextTimerId || !integer(workout.activeWorkTimer.startedAtEpochMs) || !nonnegative(workout.activeWorkTimer.exerciseIndex) || !nonnegative(workout.activeWorkTimer.setIndex))) return false;
  const records = workout.exercises.flatMap(exercise => exercise.setRecords);
  const timerIds = records.filter(record => record.activeRest).map(record => record.activeRest.id);
  if (workout.activeWorkTimer) timerIds.push(workout.activeWorkTimer.id);
  if (new Set(timerIds).size !== timerIds.length) return false;
  if (workout.activeWorkTimer) {
    const timer = workout.activeWorkTimer;
    const record = workout.exercises[timer.exerciseIndex]?.setRecords?.[timer.setIndex];
    const exercise = workout.exercises[timer.exerciseIndex];
    if (!record || exercise.occurrenceId !== timer.occurrenceId || record.completed || exercise.setRecords.slice(0, timer.setIndex).some(item => !item.completed)) return false;
  }
  const hasRest = records.some(record => record.activeRest !== null);
  const completed = records.filter(record => record.completed);
  if (workout.phase === 'warmup') return workout.activeWorkTimer === null && !completed.length && !hasRest && workout.phaseCandidate === null && workout.cooldownUndoTarget === null;
  if (workout.phase === 'performance') return workout.phaseCandidate === null;
  if (workout.phase === 'cooldown') {
    if (workout.activeWorkTimer !== null || hasRest || workout.phaseCandidate !== null) return false;
    if (workout.cooldownUndoTarget === null) return true;
    if (!exact(workout.cooldownUndoTarget, ['exerciseIndex', 'setIndex']) || !nonnegative(workout.cooldownUndoTarget.exerciseIndex) || !nonnegative(workout.cooldownUndoTarget.setIndex) || !workout.exercises.every(exercise => exercise.setRecords.every(record => record.completed))) return false;
    const exercise = workout.exercises[workout.cooldownUndoTarget.exerciseIndex];
    const target = exercise?.setRecords?.[workout.cooldownUndoTarget.setIndex];
    return target?.completed === true && workout.cooldownUndoTarget.setIndex === exercise.setRecords.length - 1;
  }
  if (workout.activeWorkTimer !== null || hasRest || workout.cooldownUndoTarget !== null || !exact(workout.phaseCandidate, ['phaseActualSeconds', 'actualDurationSeconds', 'finishRequestedAtEpochMs'])) return false;
  const candidate = workout.phaseCandidate;
  return exact(candidate.phaseActualSeconds, PHASES) && PHASES.every(phase => nonnegative(candidate.phaseActualSeconds[phase]) && candidate.phaseActualSeconds[phase] === workout.phaseLedger.closedSeconds[phase])
    && candidate.actualDurationSeconds === PHASES.reduce((sum, phase) => sum + candidate.phaseActualSeconds[phase], 0)
    && integer(candidate.finishRequestedAtEpochMs) && Number.isFinite(new Date(candidate.finishRequestedAtEpochMs).getTime());
}
function validateRecoveryDraftUnsafe(draft) {
  if (!exact(draft, ['version', 'projectId', 'uid', 'draftId', 'ownershipGeneration', 'lastMutationAtEpochMs', 'phaseTargets', 'activeWorkout', 'pendingSave'])) return false;
  return draft.version === 1 && nonempty(draft.projectId) && nonempty(draft.uid) && UUID.test(draft.draftId) && integer(draft.ownershipGeneration) && draft.ownershipGeneration >= 1 && integer(draft.lastMutationAtEpochMs) && exact(draft.phaseTargets, ['warmupSeconds', 'performanceSeconds', 'cooldownSeconds']) && integer(draft.phaseTargets.warmupSeconds) && draft.phaseTargets.warmupSeconds >= 0 && draft.phaseTargets.warmupSeconds <= 3600 && draft.phaseTargets.warmupSeconds % 60 === 0 && nonnegative(draft.phaseTargets.performanceSeconds) && integer(draft.phaseTargets.cooldownSeconds) && draft.phaseTargets.cooldownSeconds >= 0 && draft.phaseTargets.cooldownSeconds <= 3600 && draft.phaseTargets.cooldownSeconds % 60 === 0 && draft.pendingSave === null && validWorkout(draft.activeWorkout);
}
export function validateRecoveryDraft(draft) { try { return validateRecoveryDraftUnsafe(draft); } catch { return false; } }
export function hydrateRecoveryDraft(draft) {
  const workout = clone(draft.activeWorkout);
  workout.workoutStartedAt = workout.workoutStartedAtEpochMs; delete workout.workoutStartedAtEpochMs;
  workout._nextTimerId = workout.nextTimerId; delete workout.nextTimerId;
  workout._cooldownUndoTarget = workout.cooldownUndoTarget; delete workout.cooldownUndoTarget;
  if (workout.activeWorkTimer) { workout.activeWorkTimer.startedAt = workout.activeWorkTimer.startedAtEpochMs; delete workout.activeWorkTimer.startedAtEpochMs; }
  workout.exercises.forEach(exercise => exercise.setRecords.forEach(record => { record._activeRest = record.activeRest && { id: record.activeRest.id, startedAt: record.activeRest.startedAtEpochMs }; delete record.activeRest; if (record.inputDirty) { record._activeDirty = record.inputDirty; delete record.inputDirty; } }));
  workout._phaseTimingEnabled = true;
  return freeze(workout);
}
export function readRecoveryDraft({ storage, projectId, uid, nowEpochMs, staleAfterMs }) {
  if (!isValidRecoveryIdentity({ projectId, uid })) return { status: 'invalid-identity' };
  let raw; try { raw = storage.getItem(recoveryStorageKey({ projectId, uid })); } catch (error) { return { status: 'storage-error', operation: 'read', error }; }
  if (raw === null) return { status: 'missing' };
  let draft; try { draft = JSON.parse(raw); } catch { return { status: 'malformed' }; }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) || !Object.hasOwn(draft, 'version')) return { status: 'malformed' };
  if (draft.version !== 1) return { status: 'unsupported-version' };
  if (!nonempty(draft.projectId) || !nonempty(draft.uid)) return { status: 'malformed' };
  if (draft.projectId !== projectId) return { status: 'wrong-project' };
  if (draft.uid !== uid) return { status: 'wrong-user' };
  if (!validateRecoveryDraft(draft)) return { status: 'malformed' };
  if (!integer(nowEpochMs) || !integer(staleAfterMs) || staleAfterMs <= 0) throw new TypeError('Recovery clock policy must use safe integers');
  if (nowEpochMs - draft.lastMutationAtEpochMs > staleAfterMs) return { status: 'stale', draft: freeze(clone(draft)) };
  const clean = freeze(clone(draft)); return { status: 'resumable', draft: clean, hydrated: hydrateRecoveryDraft(clean) };
}
