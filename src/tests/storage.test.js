import { describe, it, expect, beforeEach } from 'vitest';
import { getHistory, saveWorkout, getSettings, getCatalog } from '../utils/storage';

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

    it('returns default settings when none exist', () => {
        const settings = getSettings();
        expect(settings).toEqual({"warmupTime": 10, "staleThreshold": 5, "legDayOfWeek": "None"});
    });

    it('returns default catalog when none exists', () => {
        const catalog = getCatalog();
        expect(catalog.length).toBeGreaterThan(0);
        expect(catalog[0]).toHaveProperty('id');
        expect(catalog[0]).toHaveProperty('name');
        expect(catalog[0]).toHaveProperty('muscleGroup');
        expect(catalog[0]).toHaveProperty('tier');
        expect(catalog[0]).toHaveProperty('sets');
    });

    it('handles corrupted JSON gracefully', () => {
        localStorage.setItem('adaptive-history', 'invalid-json');
        const history = getHistory();
        expect(history).toEqual([]);
    });
});
