import {
  classifyWorkoutDocument,
  isValidV2ExerciseOccurrence,
  isValidV2WorkoutEnvelope,
} from '../utils/workoutSchema';

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
      text = `+${reason.appliedWeightStep} lb from ${reason.sourceAnchorWeight} lb: prior workout qualified for an increase.`;
      break;
    case 'DECREASE_TOP_BELOW_FLOOR':
      text = `-${reason.appliedWeightStep} lb from ${reason.sourceAnchorWeight} lb: prior top set fell below its floor.`;
      break;
    case 'HOLD_TOP_BELOW_TARGET':
      text = `Held at ${target} lb: prior top set was below its target.`;
      break;
    case 'HOLD_INCOMPLETE_SETS':
      text = `Held at ${target} lb: prior workout had incomplete sets.`;
      break;
    case 'HOLD_BACKOFF_BELOW_FLOOR':
      text = `Held at ${target} lb: a prior backoff set fell below its floor.`;
      break;
    case 'BACKOFF_AWAITING_PRIOR_SET':
      text = 'Awaiting prior set.';
      break;
    case 'BACKOFF_FLOOR_MET':
      text = `Held at ${target} lb: prior set met the floor.`;
      break;
    case 'BACKOFF_BELOW_FLOOR':
      if (![reason.sourceActualReps, reason.floorReps, reason.rawWeight].every(Number.isFinite)) {
        text = `Recommended ${target} lb from the saved workout.`;
      } else if (reason.rawWeight === reason.recommendedWeight) {
        if (Number.isInteger(reason.dropSteps)
          && reason.dropSteps >= 0
          && Number.isFinite(reason.weightStep)
          && reason.weightStep > 0) {
          text = `-${reason.dropSteps * reason.weightStep} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}.`;
        } else {
          text = `Recommended ${target} lb from the saved workout.`;
        }
      } else {
        text = `Recommended ${reason.recommendedWeight} lb: ${reason.sourceActualReps} reps, floor ${reason.floorReps}; capped by the saved workout target.`;
      }
      break;
    default:
      text = `Recommended ${target} lb from the saved workout.`;
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

function ExerciseHeading({ exercise }) {
  return <>
    <h4>{exercise.name}</h4>
    <p className="history-exercise-summary">{exercise.prescribedSetCount} {exercise.prescribedSetCount === 1 ? 'set' : 'sets'} · {exercise.trackingMode}</p>
  </>;
}

function V2Exercise({ exercise }) {
  return (
    <li className="history-exercise">
      <ExerciseHeading exercise={exercise} />
      {exercise.trackingMode === 'simple' && (
        <p className="history-simple-status">{exercise.completed ? 'Confirmed' : 'Not confirmed'}</p>
      )}
      {exercise.trackingMode === 'weighted' && <WeightedHistory exercise={exercise} />}
      {exercise.trackingMode === 'bodyweight' && <BodyweightHistory exercise={exercise} />}
    </li>
  );
}

function V3Exercise({ exercise }) {
  return (
    <li className="history-exercise">
      <ExerciseHeading exercise={exercise} />
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
    </li>
  );
}

function WorkoutHeading({ entry }) {
  return (
    <header className="history-card-heading">
      <h3>{formatWorkoutDate(entry?.date)}</h3>
      {Number.isFinite(entry?.actualDuration) && entry.actualDuration >= 0 && <p>Duration: {entry.actualDuration} mins</p>}
    </header>
  );
}

function LegacyWorkout({ entry }) {
  const exercises = Array.isArray(entry.exercises)
    ? entry.exercises.filter(exercise => exercise && typeof exercise === 'object' && !Array.isArray(exercise))
    : [];
  return (
    <article className="history-card history-card-legacy">
      <WorkoutHeading entry={entry} />
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

function V2Workout({ entry }) {
  return (
    <article className="history-card history-card-v2">
      <WorkoutHeading entry={entry} />
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

function V3Workout({ entry }) {
  return (
    <article className="history-card history-card-v3">
      <header className="history-card-heading">
        <h3>{formatWorkoutDate(entry.date)}</h3>
        <p>Duration: {formatDuration(entry.actualDurationSeconds)}</p>
      </header>
      <ul className="history-exercise-list">
        {entry.exercises.map(exercise => (
          <V3Exercise exercise={exercise} key={exercise.occurrenceId} />
        ))}
      </ul>
    </article>
  );
}

function MalformedWorkout({ entry }) {
  return (
    <article className="history-card history-card-unavailable">
      <WorkoutHeading entry={entry} />
      <p>Saved workout details are unavailable.</p>
    </article>
  );
}

function HistoryEntry({ entry }) {
  const classification = classifyWorkoutDocument(entry);
  if (classification === 'legacy') return <LegacyWorkout entry={entry} />;
  if (classification === 'valid-v2' || isValidV2WorkoutEnvelope(entry)) return <V2Workout entry={entry} />;
  if (classification === 'valid-v3') return <V3Workout entry={entry} />;
  return <MalformedWorkout entry={entry} />;
}

export default function WorkoutHistory({ history = [], loading = false, error = null }) {
  const entries = Array.isArray(history) ? history : [];
  return (
    <section className="workout-history-section" aria-labelledby="workout-history-heading">
      <h2 id="workout-history-heading">Workout History</h2>
      {loading ? <p>Loading history...</p> : error ? (
        <p className="error-message" role="alert">{error}</p>
      ) : entries.length === 0 ? <p>No workouts logged yet.</p> : (
        <div className="history-list">
          {entries.map((entry, index) => <HistoryEntry entry={entry} key={entry?.id || index} />)}
        </div>
      )}
    </section>
  );
}
