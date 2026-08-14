import {
  classifyWorkoutDocument,
  isValidV2ExerciseOccurrence,
  isValidV2WorkoutEnvelope,
} from '../utils/workoutSchema';
import { useEffect, useRef, useState } from 'react';
import ExerciseTrends from './ExerciseTrends';

const localDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'long', day: 'numeric',
});
const utcDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});

function formatWorkoutDate(value) {
  if (typeof value !== 'string') return 'Unknown date';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day) {
      return 'Unknown date';
    }
    return utcDateFormatter.format(parsed);
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? localDateFormatter.format(parsed) : 'Unknown date';
}

function RecommendationReason({ record }) {
  const reason = record.recommendationReason;
  const target = record.targetWeight;
  let text;

  switch (reason.reasonCode) {
    case 'STARTING_NO_ANCHOR':
      text = `Starting recommendation: ${target} lb.`;
      break;
    case 'INCREASE_ALL_SETS_QUALIFIED':
      text = `+${reason.appliedWeightStep} lb from ${reason.sourceAnchorWeight} lb based on the previous workout.`;
      break;
    case 'DECREASE_TOP_BELOW_FLOOR':
      text = `-${reason.appliedWeightStep} lb from ${reason.sourceAnchorWeight} lb: the first set in the previous workout completed fewer than the minimum reps.`;
      break;
    case 'HOLD_TOP_BELOW_TARGET':
      text = `Held at ${target} lb: the first set in the previous workout completed fewer than its target reps.`;
      break;
    case 'HOLD_INCOMPLETE_SETS':
      text = `Held at ${target} lb: the previous workout did not include all sets.`;
      break;
    case 'HOLD_BACKOFF_BELOW_FLOOR':
      text = `Held at ${target} lb: a later set in the previous workout completed fewer than the minimum reps.`;
      break;
    case 'BACKOFF_AWAITING_PRIOR_SET':
      text = 'Complete the previous set first.';
      break;
    case 'BACKOFF_FLOOR_MET':
      text = `Held at ${target} lb: previous set reached the minimum reps.`;
      break;
    case 'BACKOFF_BELOW_FLOOR':
      if (![reason.sourceActualReps, reason.floorReps, reason.rawWeight].every(Number.isFinite)) {
        text = `Recommended ${target} lb based on the saved workout.`;
      } else if (reason.rawWeight === reason.recommendedWeight) {
        if (Number.isInteger(reason.dropSteps)
          && reason.dropSteps >= 0
          && Number.isFinite(reason.weightStep)
          && reason.weightStep > 0) {
          text = `Reduced ${reason.dropSteps * reason.weightStep} lb: previous set completed fewer than the ${reason.floorReps}-rep minimum.`;
        } else {
          text = `Recommended ${target} lb based on the saved workout.`;
        }
      } else {
        text = `Recommended ${reason.recommendedWeight} lb: previous set completed fewer than the ${reason.floorReps}-rep minimum; earlier sets limited this set to ${reason.recommendedWeight} lb.`;
      }
      break;
    default:
      text = `Recommended ${target} lb based on the saved workout.`;
  }

  return <p className="history-recommendation">{text}</p>;
}

const formatDuration = totalSeconds => `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

function SetTiming({ record }) {
  const work = record.completed ? formatDuration(record.workDurationSeconds) : 'Not confirmed';
  const plannedRest = record.plannedRestSeconds === null ? 'None' : formatDuration(record.plannedRestSeconds);
  const actualRest = record.actualRestSeconds === null ? 'None' : formatDuration(record.actualRestSeconds);
  let comparison = '';
  if (record.actualRestSeconds !== null) {
    const difference = record.actualRestSeconds - record.plannedRestSeconds;
    comparison = difference > 0
      ? ` · Overtime: ${formatDuration(difference)}`
      : difference < 0
        ? ` · Under target: ${formatDuration(-difference)}`
        : ' · On target';
  }
  return <p className="history-set-timing">Work: {work} · Planned rest: {plannedRest} · Actual rest: {actualRest}{comparison}</p>;
}

function WeightedHistory({ exercise, includeTiming = false }) {
  return (
    <ol className="history-set-list">
      {exercise.setRecords.map(record => (
        <li className="history-set-row" key={record.index}>
          <strong>Set {record.index + 1}</strong>
          <p className="history-set-performance">
            {record.completed
              ? `Target: ${record.targetWeight} lb × ${record.targetReps} reps · Actual: ${record.actualWeight} lb × ${record.actualReps} reps · Confirmed`
              : `Target: ${record.targetWeight} lb × ${record.targetReps} reps · Not confirmed`}
          </p>
          <RecommendationReason record={record} />
          {includeTiming && <SetTiming record={record} />}
        </li>
      ))}
    </ol>
  );
}

function BodyweightHistory({ exercise, includeTiming = false }) {
  return (
    <ol className="history-set-list">
      {exercise.setRecords.map(record => {
        const total = record.fullReps + record.assistedReps + record.eccentricReps;
        return (
          <li className="history-set-row" key={record.index}>
            <strong>Set {record.index + 1}</strong>
            <p className="history-set-performance">
              {record.completed
                ? `Target: ${record.targetReps} reps · Full: ${record.fullReps} · Assisted: ${record.assistedReps} · Eccentric: ${record.eccentricReps} · Total: ${total} · Confirmed`
                : `Target: ${record.targetReps} reps · Not confirmed`}
            </p>
            {includeTiming && <SetTiming record={record} />}
          </li>
        );
      })}
    </ol>
  );
}

function confirmedSets(exercise) {
  if (Array.isArray(exercise.setRecords)) return exercise.setRecords.filter(record => record.completed).length;
  return exercise.completed ? 1 : 0;
}

function WorkoutWorkSummary({ exercises }) {
  if (exercises.length === 0) return null;
  const recordedExercises = exercises.filter(exercise => Array.isArray(exercise.setRecords));
  const simpleExercises = exercises.filter(exercise => exercise.trackingMode === 'simple' && !Array.isArray(exercise.setRecords));
  const plannedSets = recordedExercises.reduce((total, exercise) => total + exercise.setRecords.length, 0);
  const confirmedSetCount = recordedExercises.reduce((total, exercise) => total + confirmedSets(exercise), 0);
  const confirmedSimpleCount = simpleExercises.filter(exercise => exercise.completed).length;
  const facts = [];
  if (recordedExercises.length) facts.push(`${confirmedSetCount} of ${plannedSets} ${plannedSets === 1 ? 'set' : 'sets'} confirmed`);
  if (simpleExercises.length) facts.push(`${confirmedSimpleCount} of ${simpleExercises.length} simple ${simpleExercises.length === 1 ? 'exercise' : 'exercises'} confirmed`);
  const complete = confirmedSetCount === plannedSets && confirmedSimpleCount === simpleExercises.length;
  const summary = `Confirmed work: ${facts.join('; ')}. ${complete ? 'All planned work confirmed.' : 'Partial work.'}`;
  return <p className="history-work-summary">{summary}</p>;
}

function ExerciseDetails({ exercise, children }) {
  const planned = exercise.prescribedSetCount;
  const confirmed = confirmedSets(exercise);
  return <li className="history-exercise"><details>
    <summary>{exercise.name}: {Array.isArray(exercise.setRecords) ? `${confirmed} of ${planned} ${planned === 1 ? 'set' : 'sets'} confirmed` : exercise.completed ? 'confirmed' : 'not confirmed'}</summary>
    <div className="history-exercise-details"><p className="history-exercise-summary">{exercise.prescribedSetCount} {exercise.prescribedSetCount === 1 ? 'set' : 'sets'} · {exercise.trackingMode}</p>{children}</div>
  </details></li>;
}

function V2Exercise({ exercise }) {
  return (
    <ExerciseDetails exercise={exercise}>
      {exercise.trackingMode === 'simple' && (
        <p className="history-simple-status">{exercise.completed ? 'Confirmed' : 'Not confirmed'}</p>
      )}
      {exercise.trackingMode === 'weighted' && <WeightedHistory exercise={exercise} />}
      {exercise.trackingMode === 'bodyweight' && <BodyweightHistory exercise={exercise} />}
    </ExerciseDetails>
  );
}

function V3Exercise({ exercise }) {
  return (
    <ExerciseDetails exercise={exercise}>
      {exercise.trackingMode === 'simple' && (
        <ol className="history-set-list">
          {exercise.setRecords.map(record => (
            <li className="history-set-row" key={record.index}>
              <strong>Set {record.index + 1}</strong>
              <p className="history-set-performance">{record.completed ? 'Confirmed' : 'Not confirmed'}</p>
              <SetTiming record={record} />
            </li>
          ))}
        </ol>
      )}
      {exercise.trackingMode === 'weighted' && <WeightedHistory exercise={exercise} includeTiming />}
      {exercise.trackingMode === 'bodyweight' && <BodyweightHistory exercise={exercise} includeTiming />}
    </ExerciseDetails>
  );
}

function WorkoutHeading({ entry, headingRef, focusable, onFocusLeave }) {
  return (
    <header className="history-card-heading">
      <h4 ref={headingRef} tabIndex={focusable ? '-1' : undefined} onBlur={focusable ? onFocusLeave : undefined}>{formatWorkoutDate(entry?.date)}</h4>
      {Number.isFinite(entry?.actualDuration) && entry.actualDuration >= 0 && <p>Duration: {entry.actualDuration} mins</p>}
    </header>
  );
}

function LegacyWorkout({ entry, ...headingProps }) {
  const exercises = Array.isArray(entry.exercises)
    ? entry.exercises.filter(exercise => exercise && typeof exercise === 'object' && !Array.isArray(exercise))
    : [];
  return (
    <article className="history-card history-card-legacy">
      <WorkoutHeading entry={entry} {...headingProps} />
      {exercises.length > 0 ? (
        <ul className="history-legacy-list">
          {exercises.map((exercise, index) => (
            <li key={`${exercise.name || 'exercise'}-${index}`}>
              {typeof exercise.name === 'string' && exercise.name.trim() ? exercise.name : 'Exercise'}
              {Number.isFinite(exercise.sets) ? `: ${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'}` : ''}
            </li>
          ))}
        </ul>
      ) : <p>Saved workout details are unavailable.</p>}
    </article>
  );
}

function V2Workout({ entry, ...headingProps }) {
  const hasCanonicalExercises = entry.exercises.every(isValidV2ExerciseOccurrence);
  return (
    <article className="history-card history-card-v2">
      <WorkoutHeading entry={entry} {...headingProps} />
      {hasCanonicalExercises && <WorkoutWorkSummary exercises={entry.exercises} />}
      <ul className="history-exercise-list">
        {entry.exercises.map((exercise, index) => (
          isValidV2ExerciseOccurrence(exercise)
            ? <V2Exercise exercise={exercise} key={`${exercise.id}-${index}`} />
            : <li className="history-exercise-unavailable" key={`unavailable-${index}`}>Exercise details unavailable.</li>
        ))}
      </ul>
    </article>
  );
}

function V3Workout({ entry, headingRef, focusable, onFocusLeave }) {
  return (
    <article className="history-card history-card-v3">
      <header className="history-card-heading">
        <h4 ref={headingRef} tabIndex={focusable ? '-1' : undefined} onBlur={focusable ? onFocusLeave : undefined}>{formatWorkoutDate(entry.date)}</h4>
        <p>Duration: {formatDuration(entry.actualDurationSeconds)}</p>
      </header>
      <WorkoutWorkSummary exercises={entry.exercises} />
      <ul className="history-exercise-list">
        {entry.exercises.map(exercise => (
          <V3Exercise exercise={exercise} key={exercise.occurrenceId} />
        ))}
      </ul>
    </article>
  );
}

function V4Workout({ entry, headingRef, focusable, onFocusLeave }) {
  return (
    <article className="history-card history-card-v3">
      <header className="history-card-heading">
        <h4 ref={headingRef} tabIndex={focusable ? '-1' : undefined} onBlur={focusable ? onFocusLeave : undefined}>{formatWorkoutDate(entry.date)}</h4>
        <p>Duration: {formatDuration(entry.actualDurationSeconds)}</p>
      </header>
      <WorkoutWorkSummary exercises={entry.exercises} />
      <section className="history-phase-durations" aria-label="Phase durations">
        <p>Warmup: Planned {formatDuration(entry.phaseDurations.warmup.plannedSeconds)} · Actual {formatDuration(entry.phaseDurations.warmup.actualSeconds)}</p>
        <p>Main workout: Planned {formatDuration(entry.phaseDurations.performance.plannedSeconds)} · Actual {formatDuration(entry.phaseDurations.performance.actualSeconds)}</p>
        <p>Cooldown: Planned {formatDuration(entry.phaseDurations.cooldown.plannedSeconds)} · Actual {formatDuration(entry.phaseDurations.cooldown.actualSeconds)}</p>
      </section>
      <ul className="history-exercise-list">
        {entry.exercises.map(exercise => <V3Exercise exercise={exercise} key={exercise.occurrenceId} />)}
      </ul>
    </article>
  );
}

function MalformedWorkout({ entry, ...headingProps }) {
  return (
    <article className="history-card history-card-unavailable">
      <WorkoutHeading entry={entry} {...headingProps} />
      <p>Saved workout details are unavailable.</p>
    </article>
  );
}

function HistoryEntry({ entry, ...headingProps }) {
  const classification = classifyWorkoutDocument(entry);
  if (classification === 'legacy') return <LegacyWorkout entry={entry} {...headingProps} />;
  if (classification === 'valid-v2' || isValidV2WorkoutEnvelope(entry)) return <V2Workout entry={entry} {...headingProps} />;
  if (classification === 'valid-v3') return <V3Workout entry={entry} {...headingProps} />;
  if (classification === 'valid-v4' || classification === 'valid-v5') return <V4Workout entry={entry} {...headingProps} />;
  return <MalformedWorkout entry={entry} {...headingProps} />;
}

const pageMessage = (count, older = false) => `${count} ${older ? 'older ' : ''}workout${count === 1 ? '' : 's'} loaded.`;

export default function WorkoutHistory({ history, historyKey, loading = false, error = null, loadPage, loadRange, refreshKey, onPlan }) {
  const staticHistory = Array.isArray(history);
  const [entries, setEntries] = useState(() => staticHistory ? history : []);
  const [phase, setPhase] = useState(staticHistory ? 'loaded' : 'idle');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [focusIndex, setFocusIndex] = useState(null);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [retryingOlder, setRetryingOlder] = useState(false);
  const [view, setView] = useState('workouts');
  const workoutsHeadingRef = useRef(null);
  const requestId = useRef(0);
  const inFlightRef = useRef(false);
  const headingRef = useRef(null);
  const endRef = useRef(null);
  const retryRef = useRef(null);
  const refreshKeyRef = useRef(refreshKey);
  const fetchPageRef = useRef(null);

  useEffect(() => {
    if (staticHistory) return;
    requestId.current += 1;
    inFlightRef.current = false;
    setEntries([]);
    setPhase('idle');
    setCursor(null);
    setHasMore(false);
    setFeedback(null);
    setFocusIndex(null);
    setIsRequestPending(false);
    setRetryingOlder(false);
  }, [historyKey, staticHistory]);

  useEffect(() => {
    if (staticHistory) setEntries(history);
  }, [history, staticHistory]);

  useEffect(() => {
    if (focusIndex === null) return;
    const target = headingRef.current ?? endRef.current;
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [focusIndex]);

  useEffect(() => {
    if (phase === 'olderError') retryRef.current?.focus();
  }, [phase]);

  const fetchPage = async (older = false) => {
    if (!loadPage || inFlightRef.current) return;
    inFlightRef.current = true;
    const expectedCursor = older ? cursor : null;
    const token = ++requestId.current;
    const isOlderRetry = older && phase === 'olderError';
    setRetryingOlder(isOlderRetry);
    setIsRequestPending(true);
    setPhase(older ? 'loadingOlder' : 'loadingInitial');
    setFeedback('Loading workout history…');
    try {
      const result = await loadPage({ cursor: expectedCursor, pageSize: 20 });
      if (requestId.current !== token) return;
      const received = Array.isArray(result?.items) ? result.items : [];
      const appended = older
        ? received.filter(item => !entries.some(existing => existing?.id === item?.id))
        : received;
      setEntries(current => older
        ? [...current, ...appended.filter(item => !current.some(existing => existing?.id === item?.id))]
        : appended);
      setCursor(result?.nextCursor ?? null);
      setHasMore(Boolean(result?.hasMore));
      setPhase(received.length || older ? 'loaded' : 'empty');
      if (older && (appended.length > 0 || !result?.hasMore)) setFocusIndex(entries.length);
      setFeedback(older
        ? result?.hasMore && appended.length > 0 ? pageMessage(appended.length, true) : null
        : result?.hasMore && appended.length > 0 ? pageMessage(appended.length) : null);
    } catch {
      if (requestId.current !== token) return;
      setPhase(older ? 'olderError' : 'initialError');
      setFeedback(null);
    } finally {
      if (requestId.current === token) {
        setIsRequestPending(false);
        setRetryingOlder(false);
        inFlightRef.current = false;
      }
    }
  };
  fetchPageRef.current = fetchPage;

  useEffect(() => {
    const changed = refreshKeyRef.current !== refreshKey;
    refreshKeyRef.current = refreshKey;
    if (!changed || staticHistory) return;
    requestId.current += 1;
    inFlightRef.current = false;
    setEntries([]);
    setPhase('idle');
    setCursor(null);
    setHasMore(false);
    setFeedback(null);
    setFocusIndex(null);
    setIsRequestPending(false);
    setRetryingOlder(false);
    fetchPageRef.current();
  }, [refreshKey, staticHistory]);

  useEffect(() => {
    if (!staticHistory && phase === 'idle') fetchPageRef.current?.();
  }, [phase, staticHistory]);

  const initialError = !staticHistory && phase === 'initialError'
    ? "Couldn’t load workout history."
    : error;
  const hasOlderError = !staticHistory && (phase === 'olderError' || retryingOlder);
  const isLoading = staticHistory ? loading : phase === 'loadingInitial';
  return (
    <section className={`workout-history-section${view === 'exercises' ? ' workout-history-exercises' : ''}`} aria-labelledby="history-heading">
      <h2 id="history-heading" tabIndex="-1">History</h2>
      <div className="history-views"><button type="button" aria-pressed={view === 'workouts'} onClick={() => { setView('workouts'); setTimeout(() => workoutsHeadingRef.current?.focus()); }}>Workouts</button><button type="button" aria-pressed={view === 'exercises'} onClick={() => setView('exercises')}>Exercises</button></div>
      {view === 'exercises' ? <ExerciseTrends loadRange={loadRange} onPlan={onPlan} /> : <>
      <h3 ref={workoutsHeadingRef} tabIndex="-1">Workouts</h3>
      {isLoading ? <p aria-live="polite">Loading workout history…</p> : initialError ? (
            <div className="error-message" role="alert">
              <p>{initialError}</p>
              {!staticHistory && <button className="history-action" type="button" onClick={() => fetchPage()} disabled={isRequestPending} aria-busy={isRequestPending}>
                Retry
              </button>}
            </div>
          ) : (
            <>
              {entries.length === 0 ? <div className="history-empty"><p>Complete and save a workout to see it here.</p>{onPlan && <button className="history-action" type="button" onClick={onPlan}>Plan a workout</button>}</div> : (
                <div className="history-list">
                  {entries.map((entry, index) => <HistoryEntry entry={entry} key={entry?.id || index} focusable={index === focusIndex} headingRef={index === focusIndex ? headingRef : undefined} onFocusLeave={() => setFocusIndex(null)} />)}
                </div>
              )}
              {hasOlderError && (
                <div className={retryingOlder ? undefined : 'error-message'} role={retryingOlder ? undefined : 'alert'}>
                  {!retryingOlder && <p>Couldn’t load older workouts.</p>}
                  <button className="history-action" ref={phase === 'olderError' ? retryRef : undefined} type="button" onClick={() => fetchPage(true)} disabled={isRequestPending} aria-busy={isRequestPending}>
                    {retryingOlder ? 'Retrying older workouts…' : 'Retry older workouts'}
                  </button>
                </div>
              )}
              {!staticHistory && !hasOlderError && entries.length > 0 && (hasMore ? (
                <button className="history-action" type="button" onClick={() => fetchPage(true)} disabled={isRequestPending} aria-busy={isRequestPending}>
                  {isRequestPending ? 'Loading older workouts…' : 'Load older'}
                </button>
              ) : <p ref={endRef} tabIndex={focusIndex === entries.length ? '-1' : undefined} onBlur={focusIndex === entries.length ? () => setFocusIndex(null) : undefined} aria-live="polite">All available workouts are shown.</p>)}
              {feedback && <p aria-live="polite">{feedback}</p>}
            </>
      )}</>}
    </section>
  );
}
