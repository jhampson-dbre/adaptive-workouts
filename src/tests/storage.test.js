import { describe, it, expect, beforeEach } from 'vitest';
import { getHistory, saveWorkout } from '../utils/storage';

describe('Storage Layer', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    
    it('saves and retrieves workout history', () => {
        const workout = { date: '2026-06-30', actualDuration: 35, exercises: [] };
        saveWorkout(workout);
        const history = getHistory();
        expect(history.length).toBe(1);
        expect(history[0].date).toBe('2026-06-30');
    });
});
