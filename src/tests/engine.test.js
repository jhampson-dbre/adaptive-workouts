import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWorkout } from '../utils/engine';
import * as storage from '../utils/storage';

vi.mock('../utils/storage', () => ({
    getHistory: vi.fn(),
    getSettings: vi.fn(),
    getCatalog: vi.fn()
}));

const mockCatalog = [
    { id: 'biceps_curl', name: 'Bicep Curls', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: 'shoulder_press', name: 'Shoulder Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
    { id: 'chest_row', name: 'Chest-Supported Rows', muscleGroup: 'Back', tier: 3, sets: 4 },
    { id: 'incline_bench', name: 'Incline Bench', muscleGroup: 'Chest', tier: 3, sets: 4 },
    { id: 'tri_ext', name: 'Tricep Extensions', muscleGroup: 'Triceps', tier: 3, sets: 3 },
    { id: 'dips', name: 'Dips', muscleGroup: 'Chest', tier: 3, sets: 3 },
    { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 2 },
    { id: 'leg_press', name: 'Leg Press', muscleGroup: 'Legs', tier: 4, sets: 3 }
];

describe('Generator Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T10:00:00Z'));
    });

    it('respects time budget and excludes unrecovered groups', () => {
        storage.getCatalog.mockReturnValue(mockCatalog);
        storage.getHistory.mockReturnValue([]);
        storage.getSettings.mockReturnValue({ staleThreshold: 5 });

        // Unrecovered Biceps -> Biceps should be excluded.
        // Time budget: 10 mins. 
        // 1 set = 1.75 mins.
        const workout = generateWorkout(10, ['Biceps']);
        const totalEstimatedTime = workout.reduce((total, ex) => total + (ex.sets * 1.75), 0);
        
        expect(totalEstimatedTime).toBeLessThanOrEqual(10);
        expect(workout.some(ex => ex.muscleGroup === 'Biceps')).toBe(false);
    });

    it('alternates pivot between Biceps and Shoulders based on history', () => {
        storage.getCatalog.mockReturnValue(mockCatalog);
        storage.getSettings.mockReturnValue({ staleThreshold: 5 });

        // Last pivot was Biceps, so today should be Shoulders
        storage.getHistory.mockReturnValue([
            {
                date: '2026-06-29T10:00:00Z',
                exercises: [{ id: 'biceps_curl' }]
            }
        ]);

        const workout = generateWorkout(60, []); // ample time
        
        // The first exercise should be Shoulders (Tier 1)
        expect(workout[0].muscleGroup).toBe('Shoulders');
        // Biceps shouldn't be included as Tier 1 today, maybe not included at all
        expect(workout.some(ex => ex.muscleGroup === 'Biceps')).toBe(false);
    });

    it('elevates stale exercises to Tier 2', () => {
        storage.getCatalog.mockReturnValue(mockCatalog);
        storage.getSettings.mockReturnValue({ staleThreshold: 5 });

        // Dips were done 6 days ago (stale). Chest rows done 1 day ago (not stale).
        storage.getHistory.mockReturnValue([
            {
                date: '2026-06-24T10:00:00Z', // 6 days ago
                exercises: [{ id: 'dips' }]
            },
            {
                date: '2026-06-29T10:00:00Z', // 1 day ago
                exercises: [{ id: 'chest_row' }]
            }
        ]);

        const workout = generateWorkout(60, []);
        
        // Pivot (Biceps default) should be first
        expect(workout[0].muscleGroup).toBe('Biceps');
        
        // Dips (stale, so Tier 2) should appear before Chest Rows (Tier 3)
        const dipsIndex = workout.findIndex(ex => ex.id === 'dips');
        const rowsIndex = workout.findIndex(ex => ex.id === 'chest_row');
        
        expect(dipsIndex).toBeLessThan(rowsIndex);
    });

    it('drops Tier 4 exercises if time budget is tight', () => {
        storage.getCatalog.mockReturnValue(mockCatalog);
        storage.getHistory.mockReturnValue([]);
        storage.getSettings.mockReturnValue({ staleThreshold: 5 });

        // Enough time for Tier 1 and 3, but not 4.
        // Pivot: Biceps (3 sets * 1.75 = 5.25 mins)
        // Chest Row: 4 sets * 1.75 = 7 mins
        // Total so far: 12.25 mins.
        // If budget is 13 mins, we can't fit any other Tier 3 or 4.
        const workout = generateWorkout(13, []);
        
        expect(workout.some(ex => ex.id === 'biceps_curl')).toBe(true);
        expect(workout.some(ex => ex.id === 'chest_row')).toBe(true);
        expect(workout.some(ex => ex.tier === 4)).toBe(false);
    });
});
