import { expect, test } from 'vitest';
import { formatWorkoutClipboard } from '../utils/workoutClipboard';

const record = (overrides = {}) => ({ completed: true, workDurationSeconds: 0, ...overrides });
const simple = (name, occurrenceId, records) => ({ name, occurrenceId, trackingMode: 'simple', setRecords: records });
const weighted = (name, occurrenceId, records) => ({ name, occurrenceId, trackingMode: 'weighted', setRecords: records });
const bodyweight = (name, occurrenceId, records) => ({ name, occurrenceId, trackingMode: 'bodyweight', setRecords: records });

test('formats completed weighted, bodyweight, and timed simple work without targets or metadata', () => {
  const candidate = {
    exercises: [
      weighted('Bench Press', 'bench:0', [record({ actualWeight: 135, actualReps: 8, targetWeight: 100, targetReps: 10, recommendationReason: { reasonCode: 'STARTING_NO_ANCHOR' } }), record({ actualWeight: 130, actualReps: 7, targetWeight: 100, targetReps: 10 })]),
      bodyweight('Pull-up', 'pull:0', [record({ fullReps: 4, assistedReps: 2, eccentricReps: 1, targetReps: 8 })]),
      simple('Plank', 'plank:0', [record({ workDurationSeconds: 0, plannedRestSeconds: 90, actualRestSeconds: 90 })]),
      simple('Skipped', 'skip:0', [record({ completed: false, workDurationSeconds: null })]),
    ],
  };

  expect(formatWorkoutClipboard(candidate)).toBe('Bench Press\n2 sets\n135 lb x 8\n130 lb x 7\n\nPull-up\n1 set\n0 lb x 7\n\nPlank\n1 set\n0:00');
});

test('keeps display order and applies qualifying superset labels by occurrence identity', () => {
  const exercises = [
    simple('Duplicate', 'first', [record({ workDurationSeconds: 1 })]),
      simple('Solo', 'solo', [record({ workDurationSeconds: 2 })]),
      simple('Duplicate', 'second', [record({ workDurationSeconds: 3 })]),
      simple('Pair', 'pair:1', [record({ workDurationSeconds: 4 })]),
      simple('Pair', 'pair:2', [record({ workDurationSeconds: 5 })]),
      simple('Hidden', 'hidden', [record({ completed: false })]),
  ];
  expect(formatWorkoutClipboard({ exercises, supersets: [
    { occurrenceIds: ['pair:2', 'pair:1'], restPlacement: 'BEFORE_ROUND' },
    { occurrenceIds: ['second', 'first', 'hidden'], restPlacement: 'AFTER_ROUND' },
  ] })).toBe('A1. Duplicate\n1 set\n0:01\n\nSolo\n1 set\n0:02\n\nA2. Duplicate\n1 set\n0:03\n\nB1. Pair\n1 set\n0:04\n\nB2. Pair\n1 set\n0:05');
});

test('degrades partial supersets to standalone work and labels groups through Z then AA by first emitted position', () => {
  const exercises = Array.from({ length: 56 }, (_, index) => simple(`Exercise ${index + 1}`, `id:${index}`, [record({ workDurationSeconds: index })]));
  exercises.push(simple('Partial', 'partial:1', [record({ workDurationSeconds: 1 })]), simple('Missing', 'partial:2', [record({ completed: false })]));
  const supersets = Array.from({ length: 28 }, (_, index) => ({ occurrenceIds: [`id:${index * 2}`, `id:${index * 2 + 1}`], restPlacement: 'BEFORE_ROUND' }));
  supersets.push({ occurrenceIds: ['partial:1', 'partial:2'], restPlacement: 'AFTER_ROUND' });
  const output = formatWorkoutClipboard({ exercises, supersets });

  expect(output).toContain('Z1. Exercise 51\n1 set\n0:50');
  expect(output).toContain('AA1. Exercise 53\n1 set\n0:52');
  expect(output).toContain('Partial\n1 set\n0:01');
  expect(output).not.toContain('AB1. Partial');
  expect(output.endsWith('\n')).toBe(false);
});
