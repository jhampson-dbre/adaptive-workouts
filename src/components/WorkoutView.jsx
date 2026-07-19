import { useState, useEffect, useContext, useReducer, useRef } from 'react';
import { saveWorkout, getHistory } from '../utils/storage';
import { AuthContext } from '../context/AuthContext';
import {
  activeWorkoutReducer, getSetStatus, initializeActiveWorkout, resolveFinishCandidate,
} from '../utils/activeWorkout';
import { calculateElapsedSeconds } from '../utils/workoutTiming';
import { buildCompletedV3WorkoutDocument, hasConfirmedWork } from '../utils/workoutSchema';
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

function WorkoutSummary({ candidate, isSaving, saveError, onBack, onSave, summaryRef }) {
  const counts = workoutCounts(candidate.exercises);
  const hasWork = hasConfirmedWork(candidate.exercises);
  return (
    <section className="workout-summary" role="region" aria-label="Workout summary" tabIndex="-1" ref={summaryRef}>
      <h2>Review workout</h2>
      <p className="summary-total">{counts.confirmed} of {counts.planned} items confirmed</p>
      <p>Duration: {formatTime(candidate.actualDurationSeconds)}</p>
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
      <p className="refresh-warning">Refreshing or closing this page will lose this unsaved workout summary.</p>
      <div className="summary-actions">
        <button type="button" onClick={onBack} disabled={isSaving}>Back to workout</button>
        <button type="button" className="finish-btn" onClick={onSave} disabled={!hasWork || isSaving} aria-busy={isSaving}>
          {isSaving ? 'Saving...' : 'Save workout'}
        </button>
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
        : status === 'ready' ? <>{setIndex > 0 && <RestReadout record={exercise.setRecords[setIndex - 1]} now={now} />}<button type="button" ref={startRef} aria-label={`${prefix} start`} disabled={!started} aria-describedby={error ? errorId : (!started ? 'workout-start-help' : undefined)} onClick={start}>Start set</button></>
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

export default function WorkoutView({ workout, onFinish }) {
  const user = useContext(AuthContext);
  const [activeWorkout, dispatch] = useReducer(activeWorkoutReducer, workout, initializeActiveWorkout);
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(() => {
    const firstIncomplete = workout.findIndex(exercise => !Array.isArray(exercise.setRecords)
      || exercise.setRecords.some(record => !record.completed));
    return firstIncomplete >= 0 ? { [firstIncomplete]: true } : {};
  });
  const [restAnnouncement, setRestAnnouncement] = useState('');
  const [exerciseErrors, setExerciseErrors] = useState({});
  const [finishError, setFinishError] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [finishCandidate, setFinishCandidate] = useState(null);
  const summaryRef = useRef(null);
  const finishRef = useRef(null);
  const headerRefs = useRef([]);
  const startRefs = useRef({});
  const alertedRestsRef = useRef(new Set());
  const restAnnouncementsRef = useRef(new Map());
  const saveInFlightRef = useRef(false);
  const savedDocumentRef = useRef(null);
  const saveCompletedRef = useRef(false);
  const activeOwnerUidRef = useRef(user?.uid ?? null);
  const finishOwnerUidRef = useRef(null);
  const started = activeWorkout.workoutStartedAt !== null;

  useEffect(() => {
    if (!started) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [started]);

  useEffect(() => {
    const markHiddenOverdue = () => {
      if (document.visibilityState !== 'visible') return;
      const timestamp = Date.now();
      activeWorkout.exercises.forEach(exercise => exercise.setRecords.forEach(record => {
        if (record._activeRest && calculateElapsedSeconds(record._activeRest.startedAt, timestamp) >= record.plannedRestSeconds) alertedRestsRef.current.add(record._activeRest.id);
      }));
      setNow(timestamp);
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
      setRestAnnouncement(current => refreshRepeatedLiveMessage(current, message));
    }
  }, [activeWorkout.exercises, now]);

  useEffect(() => {
    let mounted = true;
    if (!user?.uid) { setHistory([]); setLoadingHistory(false); return undefined; }
    (async () => {
      try { setLoadingHistory(true); setHistoryError(null); const data = await getHistory(user.uid); if (mounted) setHistory(data); }
      catch (error) { console.error('Failed to fetch history:', error); if (mounted) setHistoryError('Failed to load workout history.'); }
      finally { if (mounted) setLoadingHistory(false); }
    })();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => { if (finishCandidate) summaryRef.current?.focus(); }, [finishCandidate]);

  const focusNext = (nextIndex, readySetIndex) => setTimeout(() => {
    if (nextIndex >= 0) (startRefs.current[`${nextIndex}-${readySetIndex}`] || headerRefs.current[nextIndex])?.focus();
    else finishRef.current?.focus();
  }, 0);

  const clearExerciseError = exerciseIndex => {
    setExerciseErrors(current => ({ ...current, [exerciseIndex]: '' }));
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
    dispatch({ type: 'startSet', exerciseIndex, setIndex, timestamp: Date.now() });
  };

  const handleConfirmSet = (exerciseIndex, setIndex) => {
    const exercise = activeWorkout.exercises[exerciseIndex];
    const before = exercise.setRecords[setIndex];
    dispatch({ type: 'confirmSet', exerciseIndex, setIndex, timestamp: Date.now() });
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
    if (setIndex === exercise.setRecords.length - 1) {
      const nextIndex = findNextIncompleteExercise(activeWorkout.exercises, exerciseIndex);
      const readySetIndex = nextIndex >= 0
        ? activeWorkout.exercises[nextIndex].setRecords.findIndex(record => !record.completed)
        : -1;
      setExpanded(current => ({ ...current, [exerciseIndex]: false, ...(nextIndex >= 0 ? { [nextIndex]: true } : {}) }));
      focusNext(nextIndex, readySetIndex);
    }
  };

  const handleUndo = (exerciseIndex, setIndex) => {
    dispatch({ type: 'undoSet', exerciseIndex, setIndex });
    clearExerciseError(exerciseIndex);
    setFinishError('');
    if (setIndex === activeWorkout.exercises[exerciseIndex].setRecords.length - 1) setExpanded(current => ({ ...current, [exerciseIndex]: true }));
  };

  const handleFinish = () => {
    const timestamp = Date.now();
    const result = resolveFinishCandidate(activeWorkout, timestamp);
    if (result.status === 'blocked-active-work') {
      const owner = activeWorkout.exercises[result.activeWorkTimer.exerciseIndex];
      setFinishError(`Finish or cancel ${owner.name} set ${result.activeWorkTimer.setIndex + 1} before finishing the workout.`);
      return;
    }
    if (result.status !== 'ready') return;
    setFinishError('');
    const candidate = deepFreeze({
      ...result.candidate,
      finishRequestedAt: timestamp,
      date: new Date(timestamp).toISOString(),
    });
    finishOwnerUidRef.current = activeOwnerUidRef.current;
    savedDocumentRef.current = null; saveCompletedRef.current = false; setSaveError(null); setFinishCandidate(candidate);
  };

  const handleBack = () => { if (!saveInFlightRef.current) { savedDocumentRef.current = null; finishOwnerUidRef.current = null; setSaveError(null); setFinishCandidate(null); setNow(Date.now()); } };

  const handleSave = async () => {
    if (saveInFlightRef.current || saveCompletedRef.current || !finishCandidate) return;
    saveInFlightRef.current = true; setSaveError(null);
    const owner = finishOwnerUidRef.current;
    if (!owner) { setSaveError('Sign in before saving this workout.'); saveInFlightRef.current = false; return; }
    if (user?.uid !== owner) { setSaveError('Your signed-in account changed. Switch back to the account that started this summary or return to the workout.'); saveInFlightRef.current = false; return; }
    if (!savedDocumentRef.current) {
      try { savedDocumentRef.current = deepFreeze(buildCompletedV3WorkoutDocument(finishCandidate)); }
      catch (error) { console.error('Failed to prepare workout:', error); setSaveError('Could not prepare this workout to save. Review the workout data and try again.'); saveInFlightRef.current = false; return; }
    }
    setIsSaving(true);
    try { await saveWorkout(owner, savedDocumentRef.current); }
    catch (error) { console.error('Failed to save workout:', error); setSaveError('Failed to save workout. Your summary is still here; try again.'); return; }
    finally { saveInFlightRef.current = false; setIsSaving(false); }
    saveCompletedRef.current = true; onFinish?.();
  };

  return <div className="workout-view">
    {finishCandidate ? <WorkoutSummary candidate={finishCandidate} isSaving={isSaving} saveError={saveError} onBack={handleBack} onSave={handleSave} summaryRef={summaryRef} /> : <>
      <div className="workout-header"><h2>{started ? 'Active Workout' : 'Ready to sweat?'}</h2>{started && <div className="timer" aria-label={`Total elapsed ${formatTime(calculateElapsedSeconds(activeWorkout.workoutStartedAt, now))}`}>{formatTime(calculateElapsedSeconds(activeWorkout.workoutStartedAt, now))}</div>}</div>
      <p id="workout-start-help" className="workout-help">{started ? 'Start a ready set. Only one work timer can run at a time.' : 'Start the workout to enable set timers.'}</p>
      {!started && <button className="start-btn" onClick={() => { const timestamp = Date.now(); setNow(timestamp); dispatch({ type: 'startWorkout', timestamp }); }}>Start Workout</button>}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{restAnnouncement}</div>
      <ul className="workout-checklist">{activeWorkout.exercises.map((exercise, exerciseIndex) => {
        const confirmed = exercise.setRecords.filter(record => record.completed).length;
        const timing = exerciseTimingStatus(exercise, exerciseIndex, activeWorkout.activeWorkTimer, now);
        const isExpanded = Boolean(expanded[exerciseIndex]);
        return <li key={exercise.occurrenceId || `${exercise.id}-${exerciseIndex}`} className={confirmed === exercise.setRecords.length ? 'completed' : ''}>
          <button type="button" className="exercise-toggle" ref={element => { headerRefs.current[exerciseIndex] = element; }} aria-expanded={isExpanded} aria-controls={`exercise-${exerciseIndex}-sets`} aria-label={`${exercise.name}, ${confirmed} of ${exercise.setRecords.length} confirmed, ${timing}, ${isExpanded ? 'collapse' : 'expand'}`} onClick={() => setExpanded(current => ({ ...current, [exerciseIndex]: !isExpanded }))}>
            <span><strong>{exercise.name}</strong> <small>{exercise.muscleGroup}</small></span><span>{confirmed}/{exercise.setRecords.length} · {timing} · {isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
          {isExpanded && <div id={`exercise-${exerciseIndex}-sets`} className="set-list">{exercise.setRecords.map((record, setIndex) => <SetRow key={record.index} exercise={exercise} exerciseIndex={exerciseIndex} setIndex={setIndex} started={started} activeTimer={activeWorkout.activeWorkTimer} activeOwnerName={activeWorkout.activeWorkTimer ? activeWorkout.exercises[activeWorkout.activeWorkTimer.exerciseIndex].name : ''} now={now} dispatch={action => action.type === 'undoSet' ? handleUndo(action.exerciseIndex, action.setIndex) : dispatch(action)} error={exerciseErrors[exerciseIndex]?.setIndex === setIndex ? exerciseErrors[exerciseIndex].message : ''} onError={(message, blockedBy) => { setExerciseErrors(current => ({ ...current, [exerciseIndex]: { setIndex, message, blockedBy } })); setExpanded(current => ({ ...current, [exerciseIndex]: true })); }} onClearError={() => clearExerciseError(exerciseIndex)} onStart={handleStartSet} onConfirm={handleConfirmSet} onCancel={(index, set) => { dispatch({ type: 'cancelSet', exerciseIndex: index, setIndex: set }); clearExerciseError(index); clearErrorsBlockedBy(index, set); setFinishError(''); }} startRef={element => { startRefs.current[`${exerciseIndex}-${setIndex}`] = element; }} />)}</div>}
        </li>;
      })}</ul>
      {started && <><button ref={finishRef} className="finish-btn" aria-describedby={finishError ? 'finish-feedback' : undefined} onClick={handleFinish}>Finish Workout</button>{finishError && <p id="finish-feedback" className="error-message" role="alert">{finishError}</p>}</>}
    </>}
    <WorkoutHistory history={history} loading={loadingHistory} error={historyError} />
  </div>;
}
