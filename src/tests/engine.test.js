import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWorkout } from '../utils/engine';

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

// Catalog with multiple Tier 1 exercises in the same pivot muscle group,
// used to regression-test internal rotation (only one should be selected per day).
const multiTier1BicepsCatalog = [
    { id: 'biceps_curl', name: 'Bicep Curls', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: 'preacher_curl', name: 'Preacher Curls', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: 'incline_curl', name: 'Incline Curls', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: 'shoulder_press', name: 'Shoulder Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
    { id: 'chest_row', name: 'Chest-Supported Rows', muscleGroup: 'Back', tier: 3, sets: 4 },
    { id: 'tri_ext', name: 'Tricep Extensions', muscleGroup: 'Triceps', tier: 3, sets: 3 },
    { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 2 },
];

// Catalog with a third Tier 1 muscle group (Chest) to test N-way dynamic rotation.
const threeGroupTier1Catalog = [
    { id: 'biceps_curl', name: 'Bicep Curls', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: 'shoulder_press', name: 'Shoulder Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
    { id: 'chest_fly', name: 'Cable Chest Fly', muscleGroup: 'Chest', tier: 1, sets: 3 },
    { id: 'chest_row', name: 'Chest-Supported Rows', muscleGroup: 'Back', tier: 3, sets: 4 },
    { id: 'tri_ext', name: 'Tricep Extensions', muscleGroup: 'Triceps', tier: 3, sets: 3 },
    { id: 'plank', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 2 },
];

describe('Generator Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T10:00:00Z'));
    });

    it('respects time budget and excludes unrecovered groups', () => {
        const catalog = mockCatalog;
        const history = [];
        const settings = { staleThreshold: 5 };

        // Unrecovered Biceps -> Biceps should be excluded.
        // Time budget: 10 mins. 
        // 1 set = 1.75 mins.
        const workout = generateWorkout(10, ['Biceps'], false, catalog, history, settings);
        const totalEstimatedTime = workout.reduce((total, ex) => total + (ex.sets * 1.75), 0);
        
        expect(totalEstimatedTime).toBeLessThanOrEqual(10);
        expect(workout.some(ex => ex.muscleGroup === 'Biceps')).toBe(false);
    });

    it('alternates pivot between Biceps and Shoulders based on history', () => {
        const catalog = mockCatalog;
        const settings = { staleThreshold: 5 };

        // Last pivot was Biceps, so today should be Shoulders
        const history = [
            {
                date: '2026-06-29T10:00:00Z',
                exercises: [{ id: 'biceps_curl' }]
            }
        ];

        const workout = generateWorkout(60, [], false, catalog, history, settings); // ample time
        
        // The first exercise should be Shoulders (Tier 1)
        expect(workout[0].muscleGroup).toBe('Shoulders');
        // Biceps shouldn't be included as Tier 1 today, maybe not included at all
        expect(workout.some(ex => ex.muscleGroup === 'Biceps')).toBe(false);
    });

    it('elevates stale exercises to Tier 2', () => {
        const catalog = mockCatalog;
        const settings = { staleThreshold: 5 };

        // Dips were done 6 days ago (stale). Chest rows done 1 day ago (not stale).
        const history = [
            {
                date: '2026-06-24T10:00:00Z', // 6 days ago
                exercises: [{ id: 'dips' }]
            },
            {
                date: '2026-06-29T10:00:00Z', // 1 day ago
                exercises: [{ id: 'chest_row' }]
            }
        ];

        const workout = generateWorkout(60, [], false, catalog, history, settings);
        
        // Pivot (Biceps default) should be first
        expect(workout[0].muscleGroup).toBe('Biceps');
        
        // Dips (stale, so Tier 2) should appear before Chest Rows (Tier 3)
        const dipsIndex = workout.findIndex(ex => ex.id === 'dips');
        const rowsIndex = workout.findIndex(ex => ex.id === 'chest_row');
        
        expect(dipsIndex).toBeLessThan(rowsIndex);
    });

    it('drops Tier 4 exercises if time budget is tight', () => {
        const catalog = mockCatalog;
        const history = [];
        const settings = { staleThreshold: 5 };

        // Enough time for Tier 1 and 3, but not 4.
        // Pivot: Biceps (3 sets * 1.75 = 5.25 mins)
        // Chest Row: 4 sets * 1.75 = 7 mins
        // Total so far: 12.25 mins.
        // If budget is 13 mins, we can't fit any other Tier 3 or 4.
        const workout = generateWorkout(13, [], false, catalog, history, settings);
        
        expect(workout.some(ex => ex.id === 'biceps_curl')).toBe(true);
        expect(workout.some(ex => ex.id === 'chest_row')).toBe(true);
        expect(workout.some(ex => ex.tier === 4)).toBe(false);
    });

    it('groups linked exercises together or skips both if they do not fit', () => {
        const catalog = mockCatalog;
        const history = [];
        const settings = { staleThreshold: 5 };

        // If time budget is only enough for the pivot and one of the linked legs, 
        // neither leg exercise should be included because they are linked.
        // Pivot: Biceps (3 * 1.75 = 5.25 mins)
        // Leg Extension: 3 * 1.75 = 5.25 mins
        // Leg Curl: 3 * 1.75 = 5.25 mins
        // If budget is 12 mins, we have enough for Biceps + Leg Extension (10.5 mins)
        // BUT because it is linked to Leg Curl, the total for the pair + Biceps is 15.75 mins.
        // So both leg exercises should be skipped.

        // Also we don't include unlinked leg press for purity of the test, let's just make budget very tight for the 3.
        const tightBudgetWorkout = generateWorkout(12, ['Back', 'Chest', 'Triceps'], false, catalog, history, settings); // isolate Biceps + Legs + Core

        expect(tightBudgetWorkout.some(ex => ex.id === 'leg_extension')).toBe(false);
        expect(tightBudgetWorkout.some(ex => ex.id === 'leg_curl')).toBe(false);

        // If budget is 40 mins, they should all fit and both be included
        const enoughBudgetWorkout = generateWorkout(40, ['Back', 'Chest', 'Triceps'], false, catalog, history, settings);
        
        expect(enoughBudgetWorkout.some(ex => ex.id === 'leg_extension')).toBe(true);
        expect(enoughBudgetWorkout.some(ex => ex.id === 'leg_curl')).toBe(true);
    });

    // ── Regression: Dynamic Pivot Internal Rotation ──────────────────────────
    describe('Dynamic Pivot – internal rotation (one Tier 1 exercise per day)', () => {
        it('selects only ONE Tier 1 exercise for the pivot group when multiple exist (no prior history)', () => {
            // Regression for: engine included ALL Tier 1 Biceps exercises (e.g. Preacher Curls
            // AND Incline Curls) instead of the single least-recently-done one.
            const settings = { staleThreshold: 5 };
            const history = [];

            const workout = generateWorkout(60, [], false, multiTier1BicepsCatalog, history, settings);

            const bicepExercises = workout.filter(ex => ex.muscleGroup === 'Biceps');
            expect(bicepExercises.length).toBe(1);
        });

        it('selects only ONE Tier 1 exercise for the pivot group when multiple exist (with history)', () => {
            // After one Biceps session, the next pivot should be Shoulders, and still
            // only one Biceps exercise should have been chosen (whichever was least-recently-done).
            const settings = { staleThreshold: 5 };
            // Last session used preacher_curl, so internal rotation should now pick biceps_curl or incline_curl (never done).
            const history = [
                {
                    date: '2026-06-29T10:00:00Z',
                    exercises: [{ id: 'preacher_curl' }]
                }
            ];

            // Today pivot should be Shoulders (last was Biceps)
            const workout = generateWorkout(60, [], false, multiTier1BicepsCatalog, history, settings);

            const shoulderExercises = workout.filter(ex => ex.muscleGroup === 'Shoulders');
            const bicepExercises = workout.filter(ex => ex.muscleGroup === 'Biceps');
            expect(shoulderExercises.length).toBe(1);
            expect(bicepExercises.length).toBe(0); // Biceps is not today's pivot
        });

        it('picks the least-recently-done Tier 1 exercise for internal rotation', () => {
            // preacher_curl was done most recently; incline_curl and biceps_curl have never been done.
            // The engine should pick one of the never-done exercises (oldest = never done first alphabetically or by catalog order).
            const settings = { staleThreshold: 5 };
            const history = [
                {
                    date: '2026-06-25T10:00:00Z', // older
                    exercises: [{ id: 'incline_curl' }]
                },
                {
                    date: '2026-06-28T10:00:00Z', // more recent
                    exercises: [{ id: 'preacher_curl' }]
                }
            ];
            // Last pivot was Biceps (preacher_curl session most recently had a Biceps exercise),
            // so today pivot = Shoulders. Force Biceps pivot by making Shoulders the last pivot.
            const historyLastShoulder = [
                {
                    date: '2026-06-25T10:00:00Z',
                    exercises: [{ id: 'incline_curl' }]
                },
                {
                    date: '2026-06-28T10:00:00Z',
                    exercises: [{ id: 'preacher_curl' }]
                },
                {
                    date: '2026-06-29T10:00:00Z',
                    exercises: [{ id: 'shoulder_press' }]
                }
            ];

            const workout = generateWorkout(60, [], false, multiTier1BicepsCatalog, historyLastShoulder, settings);

            const bicepExercises = workout.filter(ex => ex.muscleGroup === 'Biceps');
            expect(bicepExercises.length).toBe(1);
            // biceps_curl was never done — it should be chosen over incline_curl (done 2026-06-25)
            expect(bicepExercises[0].id).toBe('biceps_curl');
        });
    });

    // ── Regression: Dynamic Tier 1 group detection ───────────────────────────
    describe('Dynamic Pivot – N-way group detection from catalog', () => {
        it('cycles through a third Tier 1 group (Chest) that is only in the catalog', () => {
            // Regression for: engine hardcoded Biceps/Shoulders and ignored any additional
            // Tier 1 groups defined in the catalog.
            const settings = { staleThreshold: 5 };
            // Tier 1 groups sorted alphabetically: ['Biceps', 'Chest', 'Shoulders'].
            // Last session: Biceps → next pivot = Chest (index 1).
            const history = [
                {
                    date: '2026-06-28T10:00:00Z',
                    exercises: [{ id: 'shoulder_press' }]
                },
                {
                    date: '2026-06-29T10:00:00Z',
                    exercises: [{ id: 'biceps_curl' }]
                }
            ];

            const workout = generateWorkout(60, [], false, threeGroupTier1Catalog, history, settings);

            const chestTier1 = workout.filter(ex => ex.muscleGroup === 'Chest' && ex.tier === 1);
            const bicepsTier1 = workout.filter(ex => ex.muscleGroup === 'Biceps');
            const shouldersTier1 = workout.filter(ex => ex.muscleGroup === 'Shoulders');

            expect(chestTier1.length).toBe(1);     // Chest is today's pivot
            expect(bicepsTier1.length).toBe(0);    // Not today's pivot
            expect(shouldersTier1.length).toBe(0); // Not today's pivot
        });
    });

    describe('Leg Day Logic', () => {
        it('assigns dynamicTier: 0 to Tier 3 legs when forceLegDay is true', () => {
            const catalog = mockCatalog;
            const history = [];
            const settings = { staleThreshold: 5, legDayOfWeek: 'None' };

            const workout = generateWorkout(60, [], true, catalog, history, settings); // forceLegDay = true
            expect(workout[0].muscleGroup).toBe('Legs');
            expect(workout[0].id).toBe('squat');
            expect(workout[0].dynamicTier).toBe(0); 
        });

        it('excludes Tier 4 legs when forceLegDay is true', () => {
            const catalog = mockCatalog;
            const history = [];
            const settings = { staleThreshold: 5, legDayOfWeek: 'None' };

            const workout = generateWorkout(60, [], true, catalog, history, settings);
            const tier4Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 4);
            expect(tier4Legs.length).toBe(0);
        });

        it('excludes Tier 4 legs when daysSinceLastLeg < 1', () => {
            const catalog = mockCatalog;
            const settings = { staleThreshold: 5, legDayOfWeek: 'None' };
            const history = [
                {
                    date: '2026-06-30T10:00:00Z',
                    exercises: [{ id: 'squat', muscleGroup: 'Legs', tier: 3 }]
                }
            ];

            const workout = generateWorkout(60, [], false, catalog, history, settings);
            const tier4Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 4);
            expect(tier4Legs.length).toBe(0);
        });

        it('skips all Tier 3 leg exercises if they do not fit in the time budget (All-or-Nothing)', () => {
            const catalog = mockCatalog;
            const history = [];
            const settings = { staleThreshold: 5, legDayOfWeek: 'None' };

            // On forced leg day, squat is dynamicTier 0 and takes 4 sets * 1.75 mins = 7 minutes.
            // If the budget is tight (e.g. 5 minutes), the squat should not fit.
            // Even though it's Tier 0, the All-or-Nothing logic should skip it entirely and NOT include it individually later.
            const workout = generateWorkout(5, [], true, catalog, history, settings); // forceLegDay = true
            const tier3Legs = workout.filter(ex => ex.muscleGroup === 'Legs' && ex.tier === 3);
            expect(tier3Legs.length).toBe(0);
        });
    });
});
