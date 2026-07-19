import { describe, expect, it } from 'vitest';

import { calculateElapsedSeconds } from '../utils/workoutTiming';

describe('workout timing', () => {
  it.each([
    ['rounds down below half a second', 1_000, 1_499, 0],
    ['rounds up at half a second', 1_000, 1_500, 1],
    ['returns zero for equal timestamps', 1_000, 1_000, 0],
    ['clamps clock rollback to zero', 2_000, 1_000, 0],
    ['derives a finish duration from absolute timestamps', 10_000, 73_600, 64],
  ])('%s', (_label, startedAt, endedAt, expected) => {
    expect(calculateElapsedSeconds(startedAt, endedAt)).toBe(expected);
  });
});
