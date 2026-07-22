import {
  activeWorkoutReducer,
  getPhaseElapsedSeconds,
  initializeActiveWorkout,
} from './activeWorkout';

const PHASE_LABELS = { warmup: 'Warmup', performance: 'Performance', cooldown: 'Cooldown', review: 'Review', cancelled: 'Workout cancelled' };
const RECOVERY_MESSAGES = {
  resumable: 'A saved workout is ready to resume.', conflict: 'Another tab owns this workout.',
  unsupported: 'This browser cannot safely start a recoverable workout.', denied: 'Workout ownership was denied.',
  timeout: 'Workout ownership timed out. Try again or exit.', lost: 'Workout ownership was lost. Recovery is available.',
  'storage-error': 'Local recovery storage is unavailable.', malformed: 'The saved workout cannot be recovered.',
  'unsupported-version': 'The saved workout uses an unsupported version.', stale: 'The saved workout is stale.',
  'wrong-user': 'The saved workout belongs to a different account.', 'wrong-project': 'The saved workout belongs to a different project.',
  'reconcile-indeterminate': 'Save outcome is still unknown. Check again before retrying.',
  'retryable-absent': 'The save was not found. Retry the same workout.',
  'blocked-conflict': 'A different saved workout conflicts with this save.', saved: 'Workout saved successfully.',
};
const RECOVERY_ACTION_ACKNOWLEDGEMENTS = Object.freeze({
  'Keep pending': { message: 'Save conflict remains pending.', retain: true },
  'Request handoff': { message: 'Handoff requested. Waiting for ownership.', retain: true },
  'Retry acquisition': { message: 'Ownership retry requested.', retain: true },
  'Recover workout': { message: 'Recovery requested. Waiting for ownership.', retain: true },
  'Retry local recovery': { message: 'Local recovery retry requested.', retain: true },
  'Retry exact save': { message: 'Exact save retry requested.', retain: true },
  'Check again': { message: 'Save reconciliation check requested.', retain: true },
  'Resume workout': { message: 'Workout resumed.', retain: false },
  Discard: { message: 'Recovery draft discarded.', retain: false },
  Exit: { message: 'Recovery view exited.', retain: false },
  Continue: { message: 'Saved workout complete.', retain: false },
});

const formatDuration = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function phaseTiming(state, targets, now) {
  if (!['warmup', 'cooldown'].includes(state.phase)) return null;
  const elapsedSeconds = getPhaseElapsedSeconds(state, state.phase, now);
  const plannedSeconds = targets[`${state.phase}Seconds`];
  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  return {
    plannedSeconds, elapsedSeconds, remainingSeconds,
    overtimeSeconds: Math.max(0, elapsedSeconds - plannedSeconds),
    state: elapsedSeconds > plannedSeconds ? 'overtime' : remainingSeconds === 0 ? 'zero' : 'countdown',
  };
}

function completedWork(exercises) {
  return exercises.flatMap(exercise => exercise.setRecords ?? []).filter(record => record.completed).length;
}

export function createTimingPresentationController({ exercises = [], phaseTargets, now = () => Date.now() } = {}) {
  if (!phaseTargets) throw new TypeError('phaseTargets are required');
  let state = initializeActiveWorkout(exercises, { phaseTimingEnabled: true });
  let recovery = null;
  let saveState = 'prepared';
  let announcement = '';
  let acceptedDisplayEpochMs = null;
  const listeners = new Set();
  const publish = () => listeners.forEach(listener => listener());
  const timestamped = action => {
    const rawTimestamp = action.timestamp ?? now();
    if (!Number.isFinite(rawTimestamp)) return action;
    acceptedDisplayEpochMs = Math.max(acceptedDisplayEpochMs ?? rawTimestamp, rawTimestamp);
    return { ...action, timestamp: acceptedDisplayEpochMs };
  };

  function dispatch(action) {
    const before = state.phase;
    const timedAction = timestamped(action);
    state = activeWorkoutReducer(state, timedAction);
    if (state.phase !== before) announcement = `Entered ${PHASE_LABELS[state.phase] ?? state.phase}.`;
    else if (action.type === 'tick') announcement = '';
    publish();
    return state;
  }

  return {
    dispatch,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setRecovery(status) { recovery = status; announcement = RECOVERY_MESSAGES[status] ?? ''; publish(); },
    performRecoveryAction(action) {
      const result = RECOVERY_ACTION_ACKNOWLEDGEMENTS[action];
      if (!result) return false;
      if (!result.retain) recovery = null;
      announcement = result.message;
      publish();
      return true;
    },
    setSaveState(status) { saveState = status; announcement = RECOVERY_MESSAGES[status] ?? ''; publish(); },
    getState: () => state,
    getViewModel() {
      const timestamp = acceptedDisplayEpochMs ?? now();
      const globalElapsedSeconds = state.phaseLedger
        ? ['warmup', 'performance', 'cooldown'].reduce((total, phase) => total + getPhaseElapsedSeconds(state, phase, timestamp), 0)
        : 0;
      const timing = phaseTiming(state, phaseTargets, timestamp);
      const candidate = state.phaseCandidate;
      return {
        phase: state.phase,
        phaseLabel: PHASE_LABELS[state.phase] ?? 'Workout',
        globalElapsedSeconds,
        globalElapsedLabel: formatDuration(globalElapsedSeconds),
        phaseTiming: timing,
        exercises: state.exercises,
        activeWorkTimer: state.activeWorkTimer,
        completedWork: completedWork(state.exercises),
        totalWork: state.exercises.flatMap(exercise => exercise.setRecords ?? []).length,
        review: candidate && { phaseActualSeconds: candidate.phaseActualSeconds, actualDurationSeconds: candidate.actualDurationSeconds, saveState },
        recovery,
        recoveryMessage: recovery && RECOVERY_MESSAGES[recovery],
        announcement,
      };
    },
  };
}

export { formatDuration, RECOVERY_MESSAGES };
