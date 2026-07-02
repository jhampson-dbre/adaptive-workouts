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
    { id: 'squat', name: 'Squats', muscleGroup: 'Legs', tier: 3, sets: 4 },
    { id: 'leg_press', name: 'Leg Press', muscleGroup: 'Legs', tier: 4, sets: 3 },
    { id: 'leg_extension', name: 'Leg Extension', muscleGroup: 'Legs', tier: 4, sets: 3, linkedTo: 'leg_curl' },
    { id: 'leg_curl', name: 'Leg Curl', muscleGroup: 'Legs', tier: 4, sets: 3 }
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

    it('groups linked exercises together or skips both if they do not fit', () => {
        storage.getCatalog.mockReturnValue(mockCatalog);
        storage.getHistory.mockReturnValue([]);
        storage.getSettings.mockReturnValue({ staleThreshold: 5 });

        // If time budget is only enough for the pivot and one of the linked legs, 
        // neither leg exercise should be included because they are linked.
        // Pivot: Biceps (3 * 1.75 = 5.25 mins)
        // Leg Extension: 3 * 1.75 = 5.25 mins
        // Leg Curl: 3 * 1.75 = 5.25 mins
        // If budget is 12 mins, we have enough for Biceps + Leg Extension (10.5 mins)
        // BUT because it is linked to Leg Curl, the total for the pair + Biceps is 15.75 mins.
        // So both leg exercises should be skipped.

        // Also we don't include unlinked leg press for purity of the test, let's just make budget very tight for the 3.
        const tightBudgetWorkout = generateWorkout(12, ['Back', 'Chest', 'Triceps']); // isolate Biceps + Legs + Core

        expect(tightBudgetWorkout.some(ex => ex.id === 'leg_extension')).toBe(false);
        expect(tightBudgetWorkout.some(ex => ex.id === 'leg_curl')).toBe(false);

        // If budget is 40 mins, they should all fit and both be included
        const enoughBudgetWorkout = generateWorkout(40, ['Back', 'Chest', 'Triceps']);
        
        expect(enoughBudgetWorkout.some(ex => ex.id === 'leg_extension')).toBe(true);
        expect(enoughBudgetWorkout.some(ex => ex.id === 'leg_curl')).toBe(true);
    });

    describe('Leg Day Logic', () => {
        it('assigns dynamicTier: 0 to Tier 3 legs when forceLegDay is true', () => {
            storage.getCatalog.mockReturnValue(mockCatalog);
            storage.getHistory.mockReturnValue([]);
            storage.getSettings.mockReturnValue({ staleThreshold: 5, legDayOfWeek: 'None' });

            const workout = generateWorkout(60, [], true); // forceLegDay = true
            expect(workout[0].muscleGroup).toBe('Legs');
            expect(workout[0].id).toBe('squat');
            expect(workout[0].dynamicTier).toBe(0); 
        });

        it('excludes Tier 4 legs when forceLegDay is true', () => {
            storage.getCatalog.mockReturnValue(mockCatalog);
            storage.getHistory.mockReturnValue([]);
            storage.getSettings.mockReturnValue({ staleThreshold: 5, legDayOfWeek: 'None' });

            const workout = generateWorkout(60, [], true);
            const tier4Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 4);
            expect(tier4Legs.length).toBe(0);
        });

        it('excludes Tier 4 legs when daysSinceLastLeg < 1', () => {
            storage.getCatalog.mockReturnValue(mockCatalog);
            storage.getSettings.mockReturnValue({ staleThreshold: 5, legDayOfWeek: 'None' });
            
            storage.getHistory.mockReturnValue([
                {
                    date: '2026-06-30T10:00:00Z',
                    exercises: [{ id: 'squat', muscleGroup: 'Legs', tier: 3 }]
                }
            ]);

            const workout = generateWorkout(60, [], false);
            const tier4Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 4);
            expect(tier4Legs.length).toBe(0);
        });

        it('skips all Tier 3 leg exercises if they do not fit in the time budget (All-or-Nothing)', () => {
            storage.getCatalog.mockReturnValue(mockCatalog);
            storage.getHistory.mockReturnValue([]);
            storage.getSettings.mockReturnValue({ staleThreshold: 5, legDayOfWeek: 'None' });

            // On forced leg day, squat is dynamicTier 0 and takes 4 sets * 1.75 mins = 7 minutes.
            // If the budget is tight (e.g. 5 minutes), the squat should not fit.
            // Even though it's Tier 0, the All-or-Nothing logic should skip it entirely and NOT include it individually later.
            const workout = generateWorkout(5, [], true); // forceLegDay = true
            const tier3Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 3);
            expect(tier3Legs.length).toBe(0);
        });
    });
});
