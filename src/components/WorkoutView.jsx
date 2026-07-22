import { useState, useEffect, useContext, useRef } from 'react';
import { getHistoryPage } from '../utils/storage';
import { AuthContext } from '../context/AuthContext';
import { getSetStatus } from '../utils/activeWorkout';
import { calculateElapsedSeconds } from '../utils/workoutTiming';
import { getPhaseElapsedSeconds } from '../utils/activeWorkout';
import { hasConfirmedWork } from '../utils/workoutSchema';
import { RECOVERY_MESSAGES } from '../utils/timingPresentationController';
import WorkoutHistory from './WorkoutHistory';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const formatTime = totalSeconds => `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

const refreshRepeatedLiveMessage = (current, message) => (
  current === message ? `${message}\u2060` : message
);

const normalizeLiveMessage = message => message.replace(/\u2060+$/u, '');

const joinRestAnnouncements = announcements => [...announcements.values()].join(' ');

const EMPTY_ACTIVE_WORKOUT = deepFreeze({
  exercises: [], workoutStartedAt: null, phase: 'generated', phaseCandidate: null,
  _phaseTimingEnabled: true, activeWorkTimer: null,
});

function playRestCue() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener?.('ended', () => context.close?.());
  } catch { /* supplementary alert */ }
}

function workoutCounts(exercises) {
  return exercises.reduce((totals, exercise) => {
    const records = Array.isArray(exercise.setRecords) ? exercise.setRecords : [];
    totals.planned += records.length || 1;
    totals.confirmed += records.length
      ? records.filter(record => record.completed).length
      : exercise.completed ? 1 : 0;
    return totals;
  }, { confirmed: 0, planned: 0 });
}

function findNextIncompleteExercise(exercises, currentIndex) {
  for (let offset = 1; offset < exercises.length; offset += 1) {
    const index = (currentIndex + offset) % exercises.length;
    if (exercises[index].setRecords.some(record => !record.completed)) return index;
  }
  return -1;
}

function phaseReadout(label, planned, actual, live = false) {
  if (!live) return `${label}: ${formatTime(actual)} actual / ${formatTime(planned)} planned`;
  const remaining = planned - actual;
  return `${label}: ${formatTime(planned)} planned / ${remaining > 0 ? `${formatTime(remaining)} remaining` : remaining === 0 ? '0:00 remaining' : `+${formatTime(Math.abs(remaining))} overtime`}`;
}

function publicStatusMessage(status, pendingState) {
  if (pendingState && RECOVERY_MESSAGES[pendingState]) return RECOVERY_MESSAGES[pendingState];
  if (RECOVERY_MESSAGES[status]) return RECOVERY_MESSAGES[status];
  if (status === 'handoff-released') return 'This tab released workout ownership to another tab.';
  if (typeof status === 'string' && /sign in/i.test(status)) return 'Sign in before saving this workout.';
  if (typeof status === 'string' && /account changed/i.test(status)) return 'Your signed-in account changed. Return to the account that started this workout before saving.';
  if (typeof status === 'string' && /offline/i.test(status)) return 'Could not save while offline. Try again when connected.';
  if (typeof status === 'string' && /could not prepare/i.test(status)) return 'Could not prepare this workout to save. Review the workout and try again.';
  if (['absent', 'cleanup-error'].includes(status)) return 'The exact save needs another check before retrying.';
  if (['indeterminate', 'fingerprint-error'].includes(status)) return 'The save outcome is still unknown. Check again before retrying.';
  if (typeof status === 'string' && (status.startsWith('invalid-') || status === 'conflict')) return 'This workout cannot continue safely. Exit and try again.';
  return status ? 'This workout cannot continue safely.' : null;
}

function hasRecoveryIdentity(snapshot) {
  return typeof snapshot?.draftId === 'string' && snapshot.draftId.length > 0
    && Number.isSafeInteger(snapshot.ownershipGeneration) && snapshot.ownershipGeneration >= 1;
}

function WorkoutSummary({ candidate, phaseTargets, isSaving, saveError, saveStatus, blockedConflict, onBack, onSave, onKeepPending, onExit, summaryRef }) {
  const counts = workoutCounts(candidate.exercises);
  const hasWork = hasConfirmedWork(candidate.exercises);
  return (
    <section className="workout-summary" role="region" aria-label="Workout summary">
      <h1 tabIndex="-1" ref={summaryRef}>Review</h1>
      <p className="summary-total">{counts.confirmed} of {counts.planned} items confirmed</p>
      <p>Duration: {formatTime(candidate.actualDurationSeconds)}</p>
      <ul aria-label="Frozen phase timing">
        {['warmup', 'performance', 'cooldown'].map(phase => <li key={phase}>{phaseReadout(phase[0].toUpperCase() + phase.slice(1), phaseTargets?.[`${phase}Seconds`] ?? 0, candidate.phaseActualSeconds?.[phase] ?? 0)}</li>)}
      </ul>
      <ul>{candidate.exercises.map((exercise, index) => {
        const records = Array.isArray(exercise.setRecords) ? exercise.setRecords : null;
        const status = records
          ? `${records.filter(record => record.completed).length} of ${records.length} sets confirmed`
          : exercise.completed ? 'confirmed' : 'not confirmed';
        return <li key={`${exercise.id}-${index}`}>{exercise.name}: {status}</li>;
      })}</ul>
      {!hasWork && <p className="error-message" role="alert">Confirm at least one exercise or set before saving.</p>}
      {hasWork && counts.confirmed < counts.planned && <p>Some planned work remains unconfirmed. Saving will preserve those unconfirmed records.</p>}
      {saveError && <p className="error-message" role="alert">{saveError}</p>}
      <div className="summary-actions">
        {blockedConflict ? <><button type="button" onClick={onKeepPending}>Keep pending</button><button type="button" onClick={onExit}>Exit</button></> : <>
          <button type="button" onClick={onBack} disabled={isSaving}>Back to workout</button>
          <button type="button" className="finish-btn" onClick={onSave} disabled={!hasWork || isSaving} aria-busy={isSaving}>
            {isSaving ? 'Saving...' : ['write-pending', 'reconcile-indeterminate'].includes(saveStatus) ? 'Check again' : saveStatus === 'retryable-absent' ? 'Retry exact save' : 'Save workout'}
          </button>
        </>}
      </div>
    </section>
  );
}

function recommendationText(exercise, record) {
  const reason = record.recommendationReason;
  if (!reason) return '';
  if (record.index > 0) {
    if (reason.reasonCode === 'BACKOFF_AWAITING_PRIOR_SET') return 'Awaiting prior set';
    if (reason.reasonCode === 'BACKOFF_BELOW_FLOOR') {
      if (reason.rawWeight !== reason.recommendedWeight) return `Recommended ${reason.recommendedWeight} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}; capped by the current workout target.`;
      return `-${reason.dropSteps * exercise.weightStep} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}.`;
    }
    return `Held at ${record.targetWeight} lb: prior set met the floor.`;
  }
  if (reason.decision === 'starting') return `Starting recommendation: ${record.targetWeight} lb.`;
  if (reason.decision === 'increase') return `Increased to ${record.targetWeight} lb from prior performance.`;
  if (reason.decision === 'decrease') return `Decreased to ${record.targetWeight} lb from prior performance.`;
  return `Held at ${record.targetWeight} lb from prior performance.`;
}

function NumberInput({ label, value, disabled, onChange, step = '1' }) {
  return <label className="set-input"><span>{label.split(' ').slice(-2).join(' ')}</span><input type="number" min="0" step={step} aria-label={label} value={value} disabled={disabled} onChange={onChange} /></label>;
}

function RestReadout({ record, now, showLive = true }) {
  if (record.plannedRestSeconds === null) return <span>No rest after final set</span>;
  if (record.actualRestSeconds !== null) return <span>Rest: {formatTime(record.actualRestSeconds)} actual / {formatTime(record.plannedRestSeconds)} planned</span>;
  if (!record._activeRest || !showLive) return <span>Rest planned: {formatTime(record.plannedRestSeconds)}</span>;
  const elapsed = calculateElapsedSeconds(record._activeRest.startedAt, now);
  const remaining = record.plannedRestSeconds - elapsed;
  return remaining > 0
    ? <span>Rest: {formatTime(remaining)} remaining / {formatTime(record.plannedRestSeconds)} planned</span>
    : <span className="timer-overtime">Rest overtime: +{formatTime(Math.abs(remaining))}</span>;
}

function PerformanceInputs({ exercise, exerciseIndex, setIndex, disabled, dispatch }) {
  const record = exercise.setRecords[setIndex];
  const prefix = `${exercise.name} exercise ${exerciseIndex + 1} set ${setIndex + 1}`;
  if (exercise.trackingMode === 'weighted') return <>
    <NumberInput label={`${prefix} actual weight`} value={record.actualWeight} disabled={disabled} step="any" onChange={event => dispatch({ type: 'editWeightedActual', exerciseIndex, setIndex, field: 'actualWeight', value: event.target.value })} />
    <NumberInput label={`${prefix} actual reps`} value={record.actualReps} disabled={disabled} onChange={event => dispatch({ type: 'editWeightedActual', exerciseIndex, setIndex, field: 'actualReps', value: event.target.value })} />
  </>;
  if (exercise.trackingMode === 'bodyweight') return <>
    {['fullReps', 'assistedReps', 'eccentricReps'].map(field => <NumberInput key={field} label={`${prefix} ${field.replace('Reps', ' reps')}`} value={record[field]} disabled={disabled} onChange={event => dispatch({ type: 'editBodyweightActual', exerciseIndex, setIndex, field, value: event.target.value })} />)}
    <span className="bodyweight-total" aria-label={`${prefix} total reps`}>Total: {['fullReps', 'assistedReps', 'eccentricReps'].reduce((sum, field) => sum + (Number.isInteger(record[field]) ? record[field] : 0), 0)}</span>
  </>;
  return null;
}

function SetRow({ exercise, exerciseIndex, setIndex, started, activeTimer, activeOwnerName, now, dispatch, error, onError, onClearError, onStart, onConfirm, onCancel, startRef }) {
  const record = exercise.setRecords[setIndex];
  const status = getSetStatus(exercise, setIndex);
  const prefix = `${exercise.name} exercise ${exerciseIndex + 1} set ${setIndex + 1}`;
  const errorId = `exercise-${exerciseIndex}-feedback`;
  const isActive = activeTimer?.exerciseIndex === exerciseIndex && activeTimer?.setIndex === setIndex;
  const [showDetails, setShowDetails] = useState(false);
  const inputDisabled = !started || status === 'locked';
  useEffect(() => {
    if (!record.completed) setShowDetails(false);
  }, [record.completed]);
  const start = () => {
    if (activeTimer && !isActive) {
      const owner = activeTimer;
      onError(`Only one work timer can run. Finish or cancel ${activeOwnerName} set ${owner.setIndex + 1}.`, owner);
      return;
    }
    onStart(exerciseIndex, setIndex);
  };
  return <section className={`set-row ${status}${isActive ? ' active-work' : ''}`} aria-label={prefix}>
    <div className="set-row-heading"><strong>Set {setIndex + 1}: {status}</strong>{exercise.trackingMode === 'weighted' && <span>Target: {record.targetWeight} lb × {record.targetReps}</span>}{exercise.trackingMode === 'bodyweight' && <span>Target: {record.targetReps} reps</span>}</div>
    {(!record.completed || showDetails) && <><div className="set-inputs"><PerformanceInputs {...{ exercise, exerciseIndex, setIndex, disabled: inputDisabled, dispatch: action => { onClearError(); dispatch(action); } }} /></div>
      {exercise.trackingMode === 'weighted' && <p className="recommendation-reason" aria-label={`${prefix} recommendation reason`}>{recommendationText(exercise, record)}</p>}</>}
    {error && <p id={errorId} className="error-message" role="alert">{error}</p>}
    <div className="set-timing">
      {isActive ? <><span className="work-timer">Work: {formatTime(calculateElapsedSeconds(activeTimer.startedAt, now))}</span><button type="button" aria-label={`${prefix} confirm`} aria-describedby={error ? errorId : undefined} onClick={() => onConfirm(exerciseIndex, setIndex)}>Confirm attempt</button><button type="button" aria-label={`${prefix} cancel`} onClick={() => onCancel(exerciseIndex, setIndex)}>Cancel timer</button></>
        : status === 'ready' ? <>{setIndex > 0 && exercise.setRecords[setIndex - 1]._activeRest && <RestReadout record={exercise.setRecords[setIndex - 1]} now={now} />}<button type="button" ref={startRef} aria-label={`${prefix} start`} disabled={!started} aria-describedby={error ? errorId : (!started ? 'workout-start-help' : undefined)} onClick={start}>Start set</button></>
          : record.completed ? <><button type="button" aria-expanded={showDetails} onClick={() => setShowDetails(current => !current)}>{showDetails ? `Hide details for ${exercise.name} set ${setIndex + 1}` : `Show details for ${exercise.name} set ${setIndex + 1}`}</button>{showDetails && <div className="completed-set-details"><span>Work: {formatTime(record.workDurationSeconds ?? 0)}</span><RestReadout record={record} now={now} showLive={false} /><button type="button" className="secondary-action" disabled={record.actualRestSeconds !== null || exercise.setRecords.slice(setIndex + 1).some(item => item.completed)} onClick={() => dispatch({ type: 'undoSet', exerciseIndex, setIndex })}>Undo set {setIndex + 1}</button></div>}</>
            : <span>Complete the prior set first.</span>}
    </div>
  </section>;
}

function exerciseTimingStatus(exercise, exerciseIndex, activeTimer, now) {
  if (activeTimer?.exerciseIndex === exerciseIndex) return `work timer ${formatTime(calculateElapsedSeconds(activeTimer.startedAt, now))}`;
  const live = exercise.setRecords.find(record => record._activeRest);
  if (live) {
    const remaining = live.plannedRestSeconds - calculateElapsedSeconds(live._activeRest.startedAt, now);
    return remaining > 0 ? `rest ${formatTime(remaining)} remaining` : `rest overtime ${formatTime(Math.abs(remaining))}`;
  }
  const remaining = exercise.setRecords.filter(record => !record.completed).length;
  return `${remaining} ${remaining === 1 ? 'set' : 'sets'} remaining`;
}

export default function WorkoutView({ session, sessionState, onFinish, onResume }) {
  const user = useContext(AuthContext);
  const activeWorkout = sessionState?.activeWorkout ?? EMPTY_ACTIVE_WORKOUT;
  const initialDisplayEpochMs = Date.now();
  const [now, setNow] = useState(initialDisplayEpochMs);
  const [expanded, setExpanded] = useState(() => {
    const firstIncomplete = (activeWorkout.exercises ?? []).findIndex(exercise => !Array.isArray(exercise.setRecords)
      || exercise.setRecords.some(record => !record.completed));
    return firstIncomplete >= 0 ? { [firstIncomplete]: true } : {};
  });
  const [restAnnouncement, setRestAnnouncement] = useState('');
  const [recoveryAcknowledgement, setRecoveryAcknowledgement] = useState('');
  const dispatch = action => { void (async () => { if (await session.action(action)) setRecoveryAcknowledgement(''); })(); };
  const [exerciseErrors, setExerciseErrors] = useState({});
  const [finishError, setFinishError] = useState('');
  const [earlyFinishPrompt, setEarlyFinishPrompt] = useState(null);
  const saveStatus = sessionState?.pendingSave?.state ?? sessionState?.error;
  const blockedSaveConflict = sessionState?.blocked && sessionState?.pendingSave?.state === 'blocked-conflict' && activeWorkout.phase === 'review';
  const saveError = publicStatusMessage(sessionState?.error, sessionState?.pendingSave?.state);
  const isSaving = sessionState?.status === 'save-pending';
  const [finishCandidate, setFinishCandidate] = useState(null);
  const summaryRef = useRef(null);
  const phaseHeadingRef = useRef(null);
  const recoveryHeadingRef = useRef(null);
  const promptHeadingRef = useRef(null);
  const finishRef = useRef(null);
  const headerRefs = useRef([]);
  const startRefs = useRef({});
  const alertedRestsRef = useRef(new Set());
  const restAnnouncementsRef = useRef(new Map());
  const saveInFlightRef = useRef(false);
  const acceptedDisplayEpochMsRef = useRef(initialDisplayEpochMs);
  const backPendingRef = useRef(false);
  const started = activeWorkout.workoutStartedAt !== null;
  const showingRecovery = (sessionState?.blocked && !blockedSaveConflict) || !sessionState?.activeWorkout;
  const recoveryPresentation = showingRecovery
    ? `${sessionState?.status ?? ''}:${sessionState?.error ?? ''}:${sessionState?.snapshot?.draftId ?? ''}:${sessionState?.snapshot?.ownershipGeneration ?? ''}`
    : null;
  const phasePresentation = showingRecovery ? null : activeWorkout.phase;
  const displayedElapsedSeconds = activeWorkout.phaseLedger
    ? ['warmup', 'performance', 'cooldown'].reduce((total, phase) => total + getPhaseElapsedSeconds(activeWorkout, phase, now), 0)
    : calculateElapsedSeconds(activeWorkout.workoutStartedAt, now);
  const acceptDisplayTime = timestamp => {
    const accepted = Math.max(acceptedDisplayEpochMsRef.current ?? timestamp, timestamp);
    acceptedDisplayEpochMsRef.current = accepted;
    setNow(accepted);
    return accepted;
  };

  useEffect(() => {
    if (activeWorkout.phase !== 'review' || !activeWorkout.phaseCandidate || finishCandidate || backPendingRef.current) return;
    const candidate = deepFreeze({
      actualDurationSeconds: activeWorkout.phaseCandidate.actualDurationSeconds,
      phaseActualSeconds: activeWorkout.phaseCandidate.phaseActualSeconds,
      finishRequestedAt: activeWorkout.phaseCandidate.finishRequestedAtEpochMs,
      date: new Date(activeWorkout.phaseCandidate.finishRequestedAtEpochMs).toISOString(),
      exercises: activeWorkout.exercises,
    });
    setFinishCandidate(candidate);
  }, [activeWorkout.exercises, activeWorkout.phase, activeWorkout.phaseCandidate, finishCandidate]);

  useEffect(() => {
    if (activeWorkout.phase !== 'review') backPendingRef.current = false;
  }, [activeWorkout.phase]);

  useEffect(() => {
    if (!started) return undefined;
    const interval = setInterval(() => acceptDisplayTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [started]);

  useEffect(() => {
    const markHiddenOverdue = () => {
      if (document.visibilityState !== 'visible') return;
      const timestamp = acceptDisplayTime(Date.now());
      activeWorkout.exercises.forEach(exercise => exercise.setRecords.forEach(record => {
        if (record._activeRest && calculateElapsedSeconds(record._activeRest.startedAt, timestamp) >= record.plannedRestSeconds) alertedRestsRef.current.add(record._activeRest.id);
      }));
    };
    document.addEventListener('visibilitychange', markHiddenOverdue);
    return () => document.removeEventListener('visibilitychange', markHiddenOverdue);
  }, [activeWorkout.exercises]);

  useEffect(() => {
    if (document.visibilityState !== 'visible') return;
    const activeRestIds = new Set();
    const completedRestAnnouncements = new Map();
    activeWorkout.exercises.forEach(exercise => exercise.setRecords.forEach((record, setIndex) => {
      if (record._activeRest) activeRestIds.add(record._activeRest.id);
      if (!record._activeRest || alertedRestsRef.current.has(record._activeRest.id)) return;
      if (calculateElapsedSeconds(record._activeRest.startedAt, now) < record.plannedRestSeconds) return;
      alertedRestsRef.current.add(record._activeRest.id);
      completedRestAnnouncements.set(
        record._activeRest.id,
        `${exercise.name} set ${setIndex + 1} rest is complete. Overtime has started.`,
      );
      try { navigator.vibrate?.(200); } catch { /* supplementary alert */ }
      playRestCue();
    }));
    restAnnouncementsRef.current.forEach((_, restId) => {
      if (!activeRestIds.has(restId)) restAnnouncementsRef.current.delete(restId);
    });
    if (completedRestAnnouncements.size) {
      restAnnouncementsRef.current = completedRestAnnouncements;
      const message = joinRestAnnouncements(completedRestAnnouncements);
      setRecoveryAcknowledgement('');
      setRestAnnouncement(current => refreshRepeatedLiveMessage(current, message));
    }
  }, [activeWorkout.exercises, now]);

  useEffect(() => { if (finishCandidate) summaryRef.current?.focus(); }, [finishCandidate, blockedSaveConflict]);
  useEffect(() => { if (phasePresentation) phaseHeadingRef.current?.focus(); }, [phasePresentation]);
  useEffect(() => { if (recoveryPresentation) recoveryHeadingRef.current?.focus(); }, [recoveryPresentation]);
  useEffect(() => { if (earlyFinishPrompt) promptHeadingRef.current?.focus(); }, [earlyFinishPrompt]);

  const focusNext = (nextIndex, readySetIndex) => setTimeout(() => {
    if (nextIndex >= 0) (startRefs.current[`${nextIndex}-${readySetIndex}`] || headerRefs.current[nextIndex])?.focus();
    else finishRef.current?.focus();
  }, 0);

  const clearExerciseError = exerciseIndex => {
    setExerciseErrors(current => ({ ...current, [exerciseIndex]: '' }));
  };

  const clearSetError = (exerciseIndex, setIndex) => {
    setExerciseErrors(current => (
      current[exerciseIndex]?.setIndex === setIndex ? { ...current, [exerciseIndex]: '' } : current
    ));
  };

  const clearErrorsBlockedBy = (exerciseIndex, setIndex) => {
    setExerciseErrors(current => Object.fromEntries(Object.entries(current).map(([index, error]) => [
      index,
      error?.blockedBy?.exerciseIndex === exerciseIndex && error.blockedBy.setIndex === setIndex ? '' : error,
    ])));
  };

  const handleStartSet = (exerciseIndex, setIndex) => {
    const priorRestId = activeWorkout.exercises[exerciseIndex]?.setRecords[setIndex - 1]?._activeRest?.id;
    if (priorRestId && restAnnouncementsRef.current.has(priorRestId)) {
      const currentRestMessage = joinRestAnnouncements(restAnnouncementsRef.current);
      restAnnouncementsRef.current.delete(priorRestId);
      const remainingRestMessage = joinRestAnnouncements(restAnnouncementsRef.current);
      setRestAnnouncement(current => (
        normalizeLiveMessage(current) === currentRestMessage ? remainingRestMessage : current
      ));
    }
    clearExerciseError(exerciseIndex);
    setExpanded(current => ({ ...current, [exerciseIndex]: true }));
    dispatch({ type: 'startSet', exerciseIndex, setIndex, timestamp: acceptDisplayTime(Date.now()) });
  };

  const handleConfirmSet = (exerciseIndex, setIndex) => {
    const exercise = activeWorkout.exercises[exerciseIndex];
    const before = exercise.setRecords[setIndex];
    dispatch({ type: 'confirmSet', exerciseIndex, setIndex, timestamp: acceptDisplayTime(Date.now()) });
    const invalidWeighted = exercise.trackingMode === 'weighted'
      && (!Number.isFinite(before.actualWeight) || before.actualWeight < 0
        || !Number.isInteger(before.actualReps) || before.actualReps < 0);
    const invalidBodyweight = exercise.trackingMode === 'bodyweight'
      && !['fullReps', 'assistedReps', 'eccentricReps']
        .every(field => Number.isInteger(before[field]) && before[field] >= 0);
    if (invalidWeighted || invalidBodyweight) { setExerciseErrors(current => ({ ...current, [exerciseIndex]: { setIndex, message: `Enter valid performance values before confirming ${exercise.name} set ${setIndex + 1}.` } })); return; }
    clearErrorsBlockedBy(exerciseIndex, setIndex);
    clearExerciseError(exerciseIndex);
    setFinishError('');
    setEarlyFinishPrompt(null);
    if (setIndex === exercise.setRecords.length - 1) {
      const nextIndex = findNextIncompleteExercise(activeWorkout.exercises, exerciseIndex);
      const readySetIndex = nextIndex >= 0
        ? activeWorkout.exercises[nextIndex].setRecords.findIndex(record => !record.completed)
        : -1;
      setExpanded(current => ({ ...current, [exerciseIndex]: false, ...(nextIndex >= 0 ? { [nextIndex]: true } : {}) }));
      if (nextIndex >= 0) focusNext(nextIndex, readySetIndex);
    }
  };

  const handleUndo = (exerciseIndex, setIndex) => {
    dispatch({ type: 'undoSet', exerciseIndex, setIndex, timestamp: acceptDisplayTime(Date.now()) });
    clearExerciseError(exerciseIndex);
    setFinishError('');
    setEarlyFinishPrompt(null);
    if (setIndex === activeWorkout.exercises[exerciseIndex].setRecords.length - 1) setExpanded(current => ({ ...current, [exerciseIndex]: true }));
  };

  const handleFinish = () => {
    const timestamp = acceptDisplayTime(Date.now());
    if (activeWorkout._phaseTimingEnabled) {
      if (activeWorkout.phase === 'performance') {
        const activeTimer = activeWorkout.activeWorkTimer;
        if (activeTimer) {
          const owner = activeWorkout.exercises[activeTimer.exerciseIndex];
          setFinishError(`Finish or cancel ${owner.name} set ${activeTimer.setIndex + 1} before finishing.`);
          return;
        }
        setFinishError('');
        setEarlyFinishPrompt(hasConfirmedWork(activeWorkout.exercises) ? 'partial' : 'zero');
        return;
      }
      if (activeWorkout.phase === 'cooldown') {
        dispatch({ type: 'finishWorkout', timestamp });
        return;
      }
      return;
    }
  };

  const confirmEarlyFinish = () => {
    setEarlyFinishPrompt(null);
    dispatch({ type: 'confirmEarlyFinish', timestamp: acceptDisplayTime(Date.now()) });
  };

  const cancelWorkout = async () => {
    setEarlyFinishPrompt(null);
    await session.discard();
    onFinish?.();
  };

  const dismissEarlyFinish = () => {
    setEarlyFinishPrompt(null);
    setTimeout(() => finishRef.current?.focus(), 0);
  };

  const handleBack = async () => {
    if (saveInFlightRef.current || !finishCandidate) return;
    const candidate = finishCandidate;
    const timestamp = acceptDisplayTime(Date.now());
    backPendingRef.current = true;
    setFinishCandidate(null);
    try {
      if (await session.action({ type: 'reviewBack', timestamp })) return;
    } catch { /* Restore the frozen review candidate after a rejected durable action. */ }
    backPendingRef.current = false;
    setFinishCandidate(candidate);
  };

  const handleSave = async () => {
    if (saveInFlightRef.current || sessionState?.status === 'saved' || !finishCandidate) return;
    saveInFlightRef.current = true;
    await session.save();
    saveInFlightRef.current = false;
  };

  useEffect(() => { if (sessionState?.status === 'saved') onFinish?.(); }, [sessionState?.status, onFinish]);

  if (showingRecovery) {
    const recovery = sessionState?.status;
    const resumable = recovery === 'recovery-available';
    const checking = recovery === 'checking';
    const discardable = resumable || sessionState?.error === 'stale';
    const canAcquireRetainedDraft = hasRecoveryIdentity(sessionState?.snapshot);
    return <div className="workout-view">
      <h1 ref={recoveryHeadingRef} tabIndex="-1">{checking ? 'Checking active workout' : resumable ? 'Resume workout?' : 'Workout recovery'}</h1>
      <p role={checking ? 'status' : 'alert'}>{checking ? 'Checking for a saved workout draft.' : resumable ? RECOVERY_MESSAGES.resumable : publicStatusMessage(sessionState?.error)}</p>
      {!checking && resumable && <button type="button" onClick={async () => { if (await session.resume()) { setRecoveryAcknowledgement('Workout resumed.'); onResume?.(); } }}>Resume</button>}
      {!checking && canAcquireRetainedDraft && ['timeout', 'conflict'].includes(sessionState?.error) && <><button type="button" onClick={async () => { if (await session.requestHandoff?.()) { setRecoveryAcknowledgement('Workout resumed.'); onResume?.(); } }}>Request handoff</button><button type="button" onClick={async () => { if (await session.resume?.()) { setRecoveryAcknowledgement('Workout resumed.'); onResume?.(); } }}>Retry acquisition</button></>}
      {!checking && <button type="button" onClick={async () => { if (discardable) await session.discard(); else { await session.exit(); onFinish?.(); } }}>{discardable ? 'Discard' : 'Exit'}</button>}
    </div>;
  }
  return <div className="workout-view">
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{restAnnouncement || recoveryAcknowledgement}</div>
    {finishCandidate ? <WorkoutSummary candidate={finishCandidate} phaseTargets={sessionState?.phaseTargets} isSaving={isSaving} saveError={saveError} saveStatus={saveStatus} blockedConflict={blockedSaveConflict} onBack={handleBack} onSave={handleSave} onKeepPending={() => setRecoveryAcknowledgement('Save conflict remains pending.')} onExit={async () => { await session.exit(); onFinish?.(); }} summaryRef={summaryRef} /> : <>
      <div className="workout-header"><h1 ref={phaseHeadingRef} tabIndex="-1">{{ generated: 'Generated workout', warmup: 'Warmup', performance: 'Performance', cooldown: 'Cooldown', review: 'Review', cancelled: 'Workout cancelled' }[activeWorkout.phase] ?? 'Workout'}</h1><h2>{started ? 'Active Workout' : 'Ready to sweat?'}</h2>{started && <div className="timer" aria-label={`Total elapsed ${formatTime(displayedElapsedSeconds)}`}>{formatTime(displayedElapsedSeconds)}</div>}</div>
      <p id="workout-start-help" className="workout-help">{['warmup', 'cooldown'].includes(activeWorkout.phase) && activeWorkout.phaseLedger ? phaseReadout(activeWorkout.phase === 'warmup' ? 'Warmup' : 'Cooldown', sessionState?.phaseTargets?.[`${activeWorkout.phase}Seconds`] ?? 0, getPhaseElapsedSeconds(activeWorkout, activeWorkout.phase, now), true) : started ? 'Start a ready set. Only one work timer can run at a time.' : 'Start the workout to enable set timers.'}</p>
      {!started && activeWorkout.phase !== 'cancelled' && <button className="start-btn" onClick={() => { const timestamp = acceptDisplayTime(Date.now()); dispatch({ type: 'startWorkout', timestamp }); }}>Start Workout</button>}
      <ul className="workout-checklist">{activeWorkout.exercises.map((exercise, exerciseIndex) => {
        const confirmed = exercise.setRecords.filter(record => record.completed).length;
        const timing = exerciseTimingStatus(exercise, exerciseIndex, activeWorkout.activeWorkTimer, now);
        const isExpanded = Boolean(expanded[exerciseIndex]);
        return <li key={exercise.occurrenceId || `${exercise.id}-${exerciseIndex}`} className={confirmed === exercise.setRecords.length ? 'completed' : ''}>
          <button type="button" className="exercise-toggle" ref={element => { headerRefs.current[exerciseIndex] = element; }} aria-expanded={isExpanded} aria-controls={`exercise-${exerciseIndex}-sets`} aria-label={`${exercise.name}, ${confirmed} of ${exercise.setRecords.length} confirmed, ${timing}, ${isExpanded ? 'collapse' : 'expand'}`} onClick={() => setExpanded(current => ({ ...current, [exerciseIndex]: !isExpanded }))}>
            <span><strong>{exercise.name}</strong> <small>{exercise.muscleGroup}</small></span><span>{confirmed}/{exercise.setRecords.length} · {timing} · {isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
          {isExpanded && <div id={`exercise-${exerciseIndex}-sets`} className="set-list">{exercise.setRecords.map((record, setIndex) => <SetRow key={record.index} exercise={exercise} exerciseIndex={exerciseIndex} setIndex={setIndex} started={started} activeTimer={activeWorkout.activeWorkTimer} activeOwnerName={activeWorkout.activeWorkTimer ? activeWorkout.exercises[activeWorkout.activeWorkTimer.exerciseIndex].name : ''} now={now} dispatch={action => action.type === 'undoSet' ? handleUndo(action.exerciseIndex, action.setIndex) : dispatch(action)} error={exerciseErrors[exerciseIndex]?.setIndex === setIndex ? exerciseErrors[exerciseIndex].message : ''} onError={(message, blockedBy) => { setExerciseErrors(current => ({ ...current, [exerciseIndex]: { setIndex, message, blockedBy } })); setExpanded(current => ({ ...current, [exerciseIndex]: true })); }} onClearError={() => clearSetError(exerciseIndex, setIndex)} onStart={handleStartSet} onConfirm={handleConfirmSet} onCancel={(index, set) => { dispatch({ type: 'cancelSet', exerciseIndex: index, setIndex: set }); clearExerciseError(index); clearErrorsBlockedBy(index, set); setFinishError(''); }} startRef={element => { startRefs.current[`${exerciseIndex}-${setIndex}`] = element; }} />)}</div>}
        </li>;
      })}</ul>
      {activeWorkout.phase === 'cooldown' && <div className="summary-actions"><button type="button" onClick={() => dispatch({ type: 'resumeWorkout', timestamp: acceptDisplayTime(Date.now()) })}>Resume Workout</button><button ref={finishRef} className="finish-btn" aria-describedby={finishError ? 'finish-feedback' : undefined} onClick={handleFinish}>Finish Workout</button>{finishError && <p id="finish-feedback" className="error-message" role="alert">{finishError}</p>}</div>}
      {(activeWorkout.phase === 'performance' || (!activeWorkout._phaseTimingEnabled && started)) && <div className="summary-actions"><button ref={finishRef} className="finish-btn" aria-describedby={finishError ? 'finish-feedback' : undefined} onClick={handleFinish}>Finish Workout</button>{finishError && <p id="finish-feedback" className="error-message" role="alert">{finishError}</p>}{earlyFinishPrompt === 'partial' && <section className="early-finish-confirmation" role="region" aria-label="Finish workout early"><h2 ref={promptHeadingRef} tabIndex="-1">Finish workout early?</h2><p>Some work remains unconfirmed. Continue to cooldown?</p><button type="button" onClick={confirmEarlyFinish}>Continue to Cooldown</button><button type="button" onClick={dismissEarlyFinish}>Keep working</button></section>}{earlyFinishPrompt === 'zero' && <section className="early-finish-confirmation" role="region" aria-label="Cancel workout"><h2 ref={promptHeadingRef} tabIndex="-1">Cancel workout?</h2><p>No work has been confirmed. Cancel this workout?</p><button type="button" onClick={() => void cancelWorkout()}>Cancel workout</button><button type="button" onClick={dismissEarlyFinish}>Keep working</button></section>}</div>}
    </>}
    <WorkoutHistory key={user?.uid ?? null} historyKey={user?.uid ?? null} loadPage={({ cursor, pageSize }) => getHistoryPage(user?.uid, { cursor, pageSize })} />
  </div>;
}
