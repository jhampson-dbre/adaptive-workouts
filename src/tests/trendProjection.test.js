import { describe, expect, it } from 'vitest';
import { projectExerciseTrends } from '../utils/trendProjection';

const weighted = ({ id, date, name = 'Bench', records = [{ completed: true, actualWeight: 100, actualReps: 5 }] }) => ({
  id,
  schemaVersion: 3,
  status: 'completed',
  date,
  actualDurationSeconds: 0,
  exercises: [{
    id: 'bench', occurrenceId: `${id}:bench`, name, muscleGroup: 'Chest', tier: 1,
    trackingMode: 'weighted', sets: records.length, prescribedSetCount: records.length,
    startingWeight: 100, targetReps: 5, floorReps: 3, weightStep: 5,
    setRecords: records.map((record, index) => ({ index, targetWeight: 100, targetReps: 5, workDurationSeconds: record.completed ? 0 : null, plannedRestSeconds: index === records.length - 1 ? null : 60, actualRestSeconds: record.completed && index < records.length - 1 ? 0 : null, recommendationReason: index === 0 ? { decision: 'starting', sourceWorkoutId: null, sourceWorkoutDate: null, sourceAnchorWeight: null, appliedWeightStep: 0, recommendedWeight: 100, reasonCode: 'STARTING_NO_ANCHOR' } : { recommendedWeight: 100, reasonCode: 'BACKOFF' }, ...record })),
  }],
});

const bodyweight = ({ id, date, name = 'Pull up', records = [{ completed: true, fullReps: 3, assistedReps: 2, eccentricReps: 1 }] }) => ({
  id,
  schemaVersion: 3,
  status: 'completed',
  date,
  actualDurationSeconds: 0,
  exercises: [{
    id: 'pull-up', occurrenceId: `${id}:pull-up`, name, muscleGroup: 'Back', tier: 1,
    trackingMode: 'bodyweight', sets: records.length, prescribedSetCount: records.length, targetReps: 5,
    setRecords: records.map((record, index) => ({ index, targetReps: 5, workDurationSeconds: record.completed ? 0 : null, plannedRestSeconds: index === records.length - 1 ? null : 60, actualRestSeconds: record.completed && index < records.length - 1 ? 0 : null, ...record })),
  }],
});

describe('projectExerciseTrends', () => {
  it('projects only confirmed v2-v5 weighted and bodyweight work into factual points and summaries', () => {
    const first = weighted({ id: 'first', date: '2026-06-01T12:00:00.000Z', records: [{ completed: true, actualWeight: 100, actualReps: 5 }, { completed: false, actualWeight: 200, actualReps: 9 }] });
    const latest = weighted({ id: 'latest', date: '2026-06-20T12:00:00.000Z', name: 'Barbell Bench', records: [{ completed: true, actualWeight: 110, actualReps: 5 }] });
    const duplicateOccurrence = weighted({ id: 'latest-second', date: latest.date, name: latest.exercises[0].name, records: [{ completed: true, actualWeight: 90, actualReps: 4 }] }).exercises[0];
    latest.exercises.push({ ...duplicateOccurrence, occurrenceId: 'latest:bench:1' });
    const earlyPulls = bodyweight({ id: 'early-pulls', date: '2026-06-05T12:00:00.000Z', records: [{ completed: true, fullReps: 2, assistedReps: 3, eccentricReps: 0 }] });
    const pulls = bodyweight({ id: 'pulls', date: '2026-06-11T12:00:00.000Z' });
    const [bench, pullUp] = projectExerciseTrends([latest, { ...first, schemaVersion: 2, actualDuration: 0, actualDurationSeconds: undefined, exercises: first.exercises.map(exercise => { const { occurrenceId: _occurrenceId, ...v2 } = exercise; return v2; }) }, pulls, earlyPulls, { date: '2026-06-25T12:00:00.000Z', exercises: [first.exercises[0]] }]);

    expect(bench).toMatchObject({ id: 'bench', trackingMode: 'weighted', name: 'Barbell Bench', points: [
      { date: '2026-06-01T12:00:00.000Z', value: 500, confirmedSets: [{ actualWeight: 100, actualReps: 5 }] },
      { date: '2026-06-20T12:00:00.000Z', value: 910, confirmedSets: [{ actualWeight: 110, actualReps: 5 }, { actualWeight: 90, actualReps: 4 }] },
    ], summary: { latest: 910, change: 410, high: 910, sessionCount: 2 } });
    expect(pullUp).toMatchObject({ id: 'pull-up', trackingMode: 'bodyweight', name: 'Pull up', points: [{ date: '2026-06-05T12:00:00.000Z', fullReps: 2, assistedReps: 3, eccentricReps: 0 }, { date: '2026-06-11T12:00:00.000Z', fullReps: 3, assistedReps: 2, eccentricReps: 1 }], summary: { latest: { fullReps: 3, assistedReps: 2, eccentricReps: 1 }, change: { fullReps: 1, assistedReps: -1, eccentricReps: 1 }, high: { fullReps: 3, assistedReps: 3, eccentricReps: 1 }, sessionCount: 2 } });
  });

  it('keeps modes separate, has no invented dates or zeroes, and accepts valid v4 and v5 records', () => {
    const v4 = { ...weighted({ id: 'v4', date: '2026-07-01T12:00:00.000Z' }), schemaVersion: 4, phaseDurations: { warmup: { plannedSeconds: 0, actualSeconds: 0 }, performance: { plannedSeconds: 0, actualSeconds: 0 }, cooldown: { plannedSeconds: 0, actualSeconds: 0 } } };
    const v5 = {
      id: 'v5', schemaVersion: 5, status: 'completed', date: '2026-07-03T12:00:00.000Z', actualDurationSeconds: 0,
      phaseDurations: { warmup: { plannedSeconds: 0, actualSeconds: 0 }, performance: { plannedSeconds: 0, actualSeconds: 0 }, cooldown: { plannedSeconds: 0, actualSeconds: 0 } },
      exercises: [
        { id: 'plank', occurrenceId: 'v5:plank', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 2, prescribedSetCount: 2, setRecords: [{ index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 0, actualRestSeconds: null }, { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }] },
        { id: 'side-plank', occurrenceId: 'v5:side-plank', name: 'Side plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 2, prescribedSetCount: 2, setRecords: [{ index: 0, completed: true, plannedRestSeconds: 60, workDurationSeconds: 0, actualRestSeconds: 0 }, { index: 1, completed: false, plannedRestSeconds: null, workDurationSeconds: null, actualRestSeconds: null }] },
        bodyweight({ id: 'v5-body', date: '2026-07-03T12:00:00.000Z', name: 'Row' }).exercises[0],
      ],
      supersets: [{ occurrenceIds: ['v5:plank', 'v5:side-plank'], restPlacement: 'AFTER_ROUND' }],
    };
    const trends = projectExerciseTrends([v5, v4]);

    expect(trends.map(({ id, trackingMode, points }) => ({ id, trackingMode, dates: points.map(point => point.date) }))).toEqual([
      { id: 'bench', trackingMode: 'weighted', dates: ['2026-07-01T12:00:00.000Z'] },
      { id: 'pull-up', trackingMode: 'bodyweight', dates: ['2026-07-03T12:00:00.000Z'] },
    ]);
  });

  it('orders mixed literal and ISO dates by the viewer-visible calendar date before choosing the latest point', () => {
    const localJulyTenth = weighted({ id: 'literal', date: '2026-07-10', records: [{ completed: true, actualWeight: 100, actualReps: 6 }] });
    const priorLocalDay = weighted({ id: 'iso', date: '2026-07-10T01:00:00.000Z', records: [{ completed: true, actualWeight: 100, actualReps: 5 }] });

    const [trend] = projectExerciseTrends([localJulyTenth, priorLocalDay]);

    expect(trend.points.map(point => point.workoutId)).toEqual(['iso', 'literal']);
    expect(trend.summary.latest).toBe(600);
  });

  it('excludes a valid v2 simple occurrence without set records while preserving eligible trends', () => {
    const eligible = weighted({ id: 'eligible', date: '2026-07-10T12:00:00.000Z' });
    const simple = {
      id: 'mixed-v2', schemaVersion: 2, status: 'completed', date: '2026-07-11T12:00:00.000Z', actualDuration: 0,
      exercises: [{ id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 1, trackingMode: 'simple', sets: 1, prescribedSetCount: 1, completed: true }, ...eligible.exercises.map(({ occurrenceId: _occurrenceId, ...occurrence }) => occurrence)],
    };

    expect(projectExerciseTrends([simple])).toMatchObject([{ id: 'bench', trackingMode: 'weighted', summary: { latest: 500, sessionCount: 1 } }]);
  });
});
