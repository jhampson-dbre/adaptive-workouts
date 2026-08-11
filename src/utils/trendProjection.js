import { isValidV2WorkoutDocument, isValidV3WorkoutDocument, isValidV4WorkoutDocument, isValidV5WorkoutDocument } from './workoutSchema';
import { visibleCalendarDate } from './historyDate';

const isEligibleWorkout = workout => isValidV2WorkoutDocument(workout)
  || isValidV3WorkoutDocument(workout) || isValidV4WorkoutDocument(workout) || isValidV5WorkoutDocument(workout);

const bodyweightValue = records => records.reduce((total, record) => ({
  fullReps: total.fullReps + record.fullReps,
  assistedReps: total.assistedReps + record.assistedReps,
  eccentricReps: total.eccentricReps + record.eccentricReps,
}), { fullReps: 0, assistedReps: 0, eccentricReps: 0 });

const bodyweightChange = (current, previous) => ({
  fullReps: current.fullReps - previous.fullReps,
  assistedReps: current.assistedReps - previous.assistedReps,
  eccentricReps: current.eccentricReps - previous.eccentricReps,
});

export function projectExerciseTrends(workouts) {
  const trends = new Map();
  for (const workout of [...(workouts ?? [])].filter(isEligibleWorkout).sort((a, b) => visibleCalendarDate(a.date).localeCompare(visibleCalendarDate(b.date)) || String(a.id).localeCompare(String(b.id)))) {
    for (const occurrence of workout.exercises) {
      if (occurrence.trackingMode !== 'weighted' && occurrence.trackingMode !== 'bodyweight') continue;
      const confirmedSets = occurrence.setRecords.filter(record => record.completed);
      if (!confirmedSets.length) continue;
      const key = `${occurrence.id}\u0000${occurrence.trackingMode}`;
      const trend = trends.get(key) ?? { id: occurrence.id, trackingMode: occurrence.trackingMode, name: occurrence.name, points: [], summary: null };
      const point = trend.points.at(-1)?.workoutId === workout.id ? trend.points.at(-1) : { workoutId: workout.id, date: workout.date, confirmedSets: [] };
      if (point !== trend.points.at(-1)) { trend.points.push(point); trend.name = occurrence.name; }
      if (occurrence.trackingMode === 'weighted') {
        const evidence = confirmedSets.map(({ actualWeight, actualReps }) => ({ actualWeight, actualReps }));
        point.confirmedSets.push(...evidence); point.value = (point.value ?? 0) + evidence.reduce((total, set) => total + set.actualWeight * set.actualReps, 0);
      } else {
        point.confirmedSets.push(...confirmedSets.map(({ fullReps, assistedReps, eccentricReps }) => ({ fullReps, assistedReps, eccentricReps })));
        Object.assign(point, bodyweightValue(point.confirmedSets));
      }
      trends.set(key, trend);
    }
  }
  return [...trends.values()].map(trend => {
    const { points } = trend; const latest = points.at(-1); const previous = points.at(-2);
    if (trend.trackingMode === 'weighted') trend.summary = { latest: latest.value, change: previous ? latest.value - previous.value : null, high: Math.max(...points.map(point => point.value)), sessionCount: points.length };
    else trend.summary = {
      latest: bodyweightValue(latest.confirmedSets),
      change: previous ? bodyweightChange(bodyweightValue(latest.confirmedSets), bodyweightValue(previous.confirmedSets)) : null,
      high: ['fullReps', 'assistedReps', 'eccentricReps'].reduce((high, key) => ({ ...high, [key]: Math.max(...points.map(point => point[key])) }), {}),
      sessionCount: points.length,
    };
    return trend;
  });
}
