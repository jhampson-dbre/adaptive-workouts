// src/tests/engine.test.js
import { describe, it, expect } from 'vitest';
import { generateWorkout } from '../utils/engine';

describe('Generator Engine', () => {
    it('respects time budget and excludes unrecovered groups', () => {
        const workout = generateWorkout(10, ['Biceps']); // 10 mins
        const totalEstimatedTime = workout.reduce((total, ex) => total + (ex.sets * 1.75), 0);
        expect(totalEstimatedTime).toBeLessThanOrEqual(10);
        expect(workout.some(ex => ex.muscleGroup === 'Biceps')).toBe(false);
    });
});
