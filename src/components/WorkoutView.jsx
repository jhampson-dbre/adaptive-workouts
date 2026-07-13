import { useState, useEffect, useContext, useReducer, useRef } from 'react';
import { saveWorkout, getHistory } from '../utils/storage';
import { AuthContext } from '../context/AuthContext';
import { activeWorkoutReducer, getSetStatus, initializeActiveWorkout } from '../utils/activeWorkout';
import { buildCompletedWorkoutDocument, hasConfirmedWork } from '../utils/workoutSchema';
import WorkoutHistory from './WorkoutHistory';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function workoutCounts(exercises) {
  return exercises.reduce((totals, exercise) => {
    if (exercise.trackingMode === 'simple') {
      totals.planned += 1;
      totals.confirmed += exercise.completed ? 1 : 0;
    } else {
      const records = Array.isArray(exercise.setRecords) ? exercise.setRecords : [];
      totals.planned += records.length;
      totals.confirmed += records.filter(record => record.completed).length;
    }
    return totals;
  }, { confirmed: 0, planned: 0 });
}

function WorkoutSummary({ candidate, isSaving, saveError, onBack, onSave, summaryRef }) {
  const counts = workoutCounts(candidate.exercises);
  const hasWork = hasConfirmedWork(candidate.exercises);
  return (
    <section className="workout-summary" role="region" aria-label="Workout summary" tabIndex="-1" ref={summaryRef}>
      <h2>Review workout</h2>
      <p className="summary-total">{counts.confirmed} of {counts.planned} items confirmed</p>
      <p>Duration: {candidate.actualDuration} min</p>
      <ul>
        {candidate.exercises.map((exercise, index) => {
          const records = Array.isArray(exercise.setRecords) ? exercise.setRecords : null;
          const status = records
            ? `${records.filter(record => record.completed).length} of ${records.length} sets confirmed`
            : exercise.completed ? 'confirmed' : 'not confirmed';
          return <li key={`${exercise.id}-${index}`}>{exercise.name}: {status}</li>;
        })}
      </ul>
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
  if (record.index > 0) {
    if (reason.reasonCode === 'BACKOFF_AWAITING_PRIOR_SET') return 'Awaiting prior set';
    if (reason.reasonCode === 'BACKOFF_BELOW_FLOOR') {
      if (reason.rawWeight !== reason.recommendedWeight) {
        return `Recommended ${reason.recommendedWeight} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}; capped by the current workout target.`;
      }
      return `-${reason.dropSteps * exercise.weightStep} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}.`;
    }
    return `Held at ${record.targetWeight} lb: prior set met the floor.`;
  }
  if (reason.decision === 'starting') return `Starting recommendation: ${record.targetWeight} lb.`;
  if (reason.decision === 'increase') return `Increased to ${record.targetWeight} lb from prior performance.`;
  if (reason.decision === 'decrease') return `Decreased to ${record.targetWeight} lb from prior performance.`;
  return `Held at ${record.targetWeight} lb from prior performance.`;
}

function SetStatus({ exercise, exerciseIndex, setIndex }) {
  const status = getSetStatus(exercise, setIndex);
  const label = `${exercise.name} exercise ${exerciseIndex + 1} Set ${setIndex + 1}`;
  return <span className={`set-status ${status}`}>{label}: {status[0].toUpperCase() + status.slice(1)}</span>;
}

function ConfirmControl({ exercise, exerciseIndex, setIndex, started, dispatch }) {
  const record = exercise.setRecords[setIndex];
  const status = getSetStatus(exercise, setIndex);
  const hasConfirmedDependent = exercise.setRecords.slice(setIndex + 1).some(candidate => candidate.completed);
  const label = `${exercise.name} exercise ${exerciseIndex + 1} set ${setIndex + 1} confirm`;
  return (
    <label className="set-confirm">
      <input
        type="checkbox"
        aria-label={label}
        checked={record.completed}
        disabled={!started || status === 'locked' || (record.completed && hasConfirmedDependent)}
        onChange={() => dispatch({ type: 'toggleTrackedSet', exerciseIndex, setIndex })}
      />
      Confirm attempt
    </label>
  );
}

function NumberInput({ label, value, disabled, onChange, step = '1' }) {
  return (
    <label className="set-input">
      <span>{label.split(' ').slice(-2).join(' ')}</span>
      <input type="number" min="0" step={step} aria-label={label} value={value} disabled={disabled} onChange={onChange} />
    </label>
  );
}

function WeightedSets({ exercise, exerciseIndex, started, dispatch }) {
  return (
    <div className="set-list">
      {exercise.setRecords.map((record, setIndex) => {
        const status = getSetStatus(exercise, setIndex);
        const prefix = `${exercise.name} exercise ${exerciseIndex + 1} set ${setIndex + 1}`;
        const disabled = !started || status === 'locked';
        return (
          <section className={`set-row ${status}`} key={record.index} aria-label={prefix}>
            <div className="set-row-heading">
              <SetStatus exercise={exercise} exerciseIndex={exerciseIndex} setIndex={setIndex} />
              <span>Target: {record.targetWeight} lb × {record.targetReps}</span>
            </div>
            <div className="set-inputs">
              <NumberInput
                label={`${prefix} actual weight`}
                value={record.actualWeight}
                disabled={disabled}
                step="any"
                onChange={event => dispatch({ type: 'editWeightedActual', exerciseIndex, setIndex, field: 'actualWeight', value: event.target.value })}
              />
              <NumberInput
                label={`${prefix} actual reps`}
                value={record.actualReps}
                disabled={disabled}
                onChange={event => dispatch({ type: 'editWeightedActual', exerciseIndex, setIndex, field: 'actualReps', value: event.target.value })}
              />
              <ConfirmControl {...{ exercise, exerciseIndex, setIndex, started, dispatch }} />
            </div>
            <p className="recommendation-reason" aria-label={`${prefix} recommendation reason`} aria-live="polite">
              {recommendationText(exercise, record)}
            </p>
          </section>
        );
      })}
    </div>
  );
}

function BodyweightSets({ exercise, exerciseIndex, started, dispatch }) {
  return (
    <div className="set-list">
      {exercise.setRecords.map((record, setIndex) => {
        const status = getSetStatus(exercise, setIndex);
        const prefix = `${exercise.name} exercise ${exerciseIndex + 1} set ${setIndex + 1}`;
        const disabled = !started || status === 'locked';
        const total = record.fullReps + record.assistedReps + record.eccentricReps;
        return (
          <section className={`set-row ${status}`} key={record.index} aria-label={prefix}>
            <div className="set-row-heading">
              <SetStatus exercise={exercise} exerciseIndex={exerciseIndex} setIndex={setIndex} />
              <span>Target: {record.targetReps} reps</span>
            </div>
            <div className="set-inputs">
              {['fullReps', 'assistedReps', 'eccentricReps'].map(field => (
                <NumberInput
                  key={field}
                  label={`${prefix} ${field.replace('Reps', ' reps')}`}
                  value={record[field]}
                  disabled={disabled}
                  onChange={event => dispatch({ type: 'editBodyweightActual', exerciseIndex, setIndex, field, value: event.target.value })}
                />
              ))}
              <ConfirmControl {...{ exercise, exerciseIndex, setIndex, started, dispatch }} />
            </div>
            <p className="bodyweight-total" aria-label={`${prefix} total reps`} aria-live="polite">Total: {total}</p>
          </section>
        );
      })}
    </div>
  );
}

export default function WorkoutView({ workout, onFinish }) {
  const user = useContext(AuthContext);
  const [activeWorkout, dispatch] = useReducer(activeWorkoutReducer, workout, initializeActiveWorkout);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [finishCandidate, setFinishCandidate] = useState(null);
  const summaryRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const savedDocumentRef = useRef(null);
  const saveCompletedRef = useRef(false);
  const activeOwnerUidRef = useRef(user?.uid ?? null);
  const finishOwnerUidRef = useRef(null);

  useEffect(() => {
    if (!startedAt) return undefined;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    let isMounted = true;
    if (!user?.uid) {
      setHistory([]);
      setLoadingHistory(false);
      return undefined;
    }
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        setHistoryError(null);
        const data = await getHistory(user.uid);
        if (isMounted) setHistory(data);
      } catch (fetchError) {
        console.error('Failed to fetch history:', fetchError);
        if (isMounted) setHistoryError('Failed to load workout history.');
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (finishCandidate) summaryRef.current?.focus();
  }, [finishCandidate]);

  const handleFinish = () => {
    const finishRequestedAt = Date.now();
    const diff = Math.max(1, Math.round((finishRequestedAt - startedAt) / 60000));
    const candidate = deepFreeze({
      finishRequestedAt,
      date: new Date(finishRequestedAt).toISOString(),
      actualDuration: diff,
      exercises: structuredClone(activeWorkout.exercises),
    });
    finishOwnerUidRef.current = activeOwnerUidRef.current;
    savedDocumentRef.current = null;
    saveCompletedRef.current = false;
    setSaveError(null);
    setFinishCandidate(candidate);
  };

  const handleBack = () => {
    if (saveInFlightRef.current) return;
    savedDocumentRef.current = null;
    finishOwnerUidRef.current = null;
    setSaveError(null);
    setFinishCandidate(null);
  };

  const handleSave = async () => {
    if (saveInFlightRef.current || saveCompletedRef.current || !finishCandidate) return;
    saveInFlightRef.current = true;
    setSaveError(null);

    const finishOwnerUid = finishOwnerUidRef.current;
    if (!finishOwnerUid) {
      setSaveError('Sign in before saving this workout.');
      saveInFlightRef.current = false;
      return;
    }
    if (user?.uid !== finishOwnerUid) {
      setSaveError('Your signed-in account changed. Switch back to the account that started this summary or return to the workout.');
      saveInFlightRef.current = false;
      return;
    }

    if (!savedDocumentRef.current) {
      try {
        savedDocumentRef.current = deepFreeze(buildCompletedWorkoutDocument(finishCandidate));
      } catch (buildError) {
        console.error('Failed to prepare workout:', buildError);
        setSaveError('Could not prepare this workout to save. Review the workout data and try again.');
        saveInFlightRef.current = false;
        return;
      }
    }

    setIsSaving(true);
    try {
      await saveWorkout(finishOwnerUid, savedDocumentRef.current);
    } catch (persistError) {
      console.error('Failed to save workout:', persistError);
      setSaveError('Failed to save workout. Your summary is still here; try again.');
      return;
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
    saveCompletedRef.current = true;
    if (onFinish) onFinish();
  };

  const formatTime = totalSeconds => `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="workout-view">
      {finishCandidate ? (
        <WorkoutSummary
          candidate={finishCandidate}
          isSaving={isSaving}
          saveError={saveError}
          onBack={handleBack}
          onSave={handleSave}
          summaryRef={summaryRef}
        />
      ) : <>
        <div className="workout-header">
          <h2>{startedAt ? 'Active Workout' : 'Ready to sweat?'}</h2>
          {startedAt && <div className="timer">{formatTime(elapsed)}</div>}
        </div>
        {!startedAt && <button className="start-btn" onClick={() => setStartedAt(Date.now())} style={{ marginBottom: '1rem' }}>Start Workout</button>}

        <ul className="workout-checklist">
        {activeWorkout.exercises.map((exercise, exerciseIndex) => (
          <li key={`${exercise.id}-${exerciseIndex}`} className={exercise.trackingMode === 'simple' && exercise.completed ? 'completed' : ''}>
            <div className="exercise-details"><strong>{exercise.name}</strong> ({exercise.muscleGroup}) - {exercise.sets} sets</div>
            {exercise.trackingMode === 'simple' && (
              <label className="checklist-label">
                <input
                  type="checkbox"
                  aria-label={`${exercise.name} exercise ${exerciseIndex + 1} confirm`}
                  checked={exercise.completed}
                  onChange={() => dispatch({ type: 'toggleSimpleExercise', exerciseIndex })}
                  disabled={!startedAt}
                />
                Confirm exercise
              </label>
            )}
            {exercise.trackingMode === 'weighted' && <WeightedSets exercise={exercise} exerciseIndex={exerciseIndex} started={Boolean(startedAt)} dispatch={dispatch} />}
            {exercise.trackingMode === 'bodyweight' && <BodyweightSets exercise={exercise} exerciseIndex={exerciseIndex} started={Boolean(startedAt)} dispatch={dispatch} />}
          </li>
        ))}
        </ul>
        {startedAt && <button className="finish-btn" onClick={handleFinish}>Finish Workout</button>}
      </>}

      <WorkoutHistory history={history} loading={loadingHistory} error={historyError} />
    </div>
  );
}
