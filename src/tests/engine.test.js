import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWorkout, getDaysSinceLastLegDay } from '../utils/engine';
import { isValidV2ExerciseOccurrence } from '../utils/workoutSchema';

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

function simpleV2Occurrence(catalogExercise, completed) {
    return {
        ...catalogExercise,
        trackingMode: 'simple',
        prescribedSetCount: catalogExercise.sets,
        completed,
    };
}

function weightedV2Occurrence(catalogExercise, completedSets) {
    return {
        ...catalogExercise,
        trackingMode: 'weighted',
        prescribedSetCount: catalogExercise.sets,
        startingWeight: 100,
        targetReps: 8,
        floorReps: 5,
        weightStep: 5,
        setRecords: Array.from({ length: catalogExercise.sets }, (_, index) => ({
            index,
            targetWeight: 100,
            targetReps: 8,
            actualWeight: 100,
            actualReps: 0,
            completed: completedSets[index] ?? false,
            recommendationReason: index === 0 ? {
                decision: 'starting',
                sourceWorkoutId: null,
                sourceWorkoutDate: null,
                sourceAnchorWeight: null,
                appliedWeightStep: 0,
                recommendedWeight: 100,
                reasonCode: 'STARTING_NO_ANCHOR',
            } : {
                recommendedWeight: 100,
                reasonCode: 'BACKOFF_FLOOR_MET',
            },
        })),
    };
}

function completedV2Workout(date, exercises) {
    return { schemaVersion: 2, status: 'completed', date, actualDuration: 30, exercises };
}

describe('Generator Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-30T10:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('diversity-first floating selection', () => {
        const exercise = (id, muscleGroup, tier, sets = 1, extra = {}) => ({
            id, name: id, muscleGroup, tier, sets, ...extra,
        });
        const legacyWorkout = (date, ...ids) => ({
            date,
            exercises: ids.map(id => ({ id })),
        });
        const ids = workout => workout.map(item => item.id);

        it('replaces a second Back exercise with eligible older Chest work', () => {
            const catalog = [
                exercise('shoulder', 'Shoulders', 1),
                exercise('back-oldest', 'Back', 3),
                exercise('back-second', 'Back', 3),
                exercise('chest', 'Chest', 3),
            ];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'back-oldest'),
                legacyWorkout('2026-06-21T10:00:00Z', 'back-second'),
                legacyWorkout('2026-06-22T10:00:00Z', 'chest'),
            ];

            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['shoulder', 'back-oldest', 'chest']);
        });

        it('keeps scanning when the oldest diverse unit does not fit', () => {
            const catalog = [
                exercise('pivot', 'Biceps', 1),
                exercise('large', 'Chest', 3, 3),
                exercise('small', 'Core', 3),
            ];
            expect(ids(generateWorkout(3.5, [], false, catalog, [], { staleThreshold: 5 })))
                .toEqual(['pivot', 'small']);
        });

        it('puts an age-two duplicate before an age-one unrepresented unit', () => {
            vi.setSystemTime(new Date('2026-06-30T12:00:00-05:00'));
            const catalog = [
                exercise('back-old', 'Back', 3),
                exercise('back-age-two', 'Back', 3),
                exercise('chest-age-one', 'Chest', 3),
                exercise('core-age-zero', 'Core', 3),
            ];
            const history = [
                legacyWorkout('2026-06-20T12:00:00-05:00', 'back-old'),
                legacyWorkout('2026-06-28T12:00:00-05:00', 'back-age-two'),
                legacyWorkout('2026-06-29T12:00:00-05:00', 'chest-age-one'),
                legacyWorkout('2026-06-30T12:00:00-05:00', 'core-age-zero'),
            ];

            expect(ids(generateWorkout(7, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['back-old', 'back-age-two', 'chest-age-one', 'core-age-zero']);
        });

        it('treats exact stale threshold as closed and threshold plus one as bypass-eligible', () => {
            vi.setSystemTime(new Date('2026-06-30T12:00:00-05:00'));
            const required = exercise('required', 'Back', 3);
            const reset = exercise('reset', 'Reset', 4);
            const exact = exercise('exact', 'Exact', 4);
            const stale = exercise('stale', 'Stale', 4);
            const commonHistory = [
                legacyWorkout('2026-06-28T12:00:00-05:00', 'required'),
                legacyWorkout('2026-06-29T12:00:00-05:00', 'reset'),
            ];
            const exactHistory = [
                legacyWorkout('2026-06-25T12:00:00-05:00', 'exact'),
                ...commonHistory,
            ];
            const staleHistory = [
                legacyWorkout('2026-06-24T12:00:00-05:00', 'stale'),
                ...commonHistory,
            ];

            expect(ids(generateWorkout(1.75, [], false, [exact, required, reset], exactHistory, { staleThreshold: 5 })))
                .toEqual(['required']);
            expect(ids(generateWorkout(1.75, [], false, [stale, required, reset], staleHistory, { staleThreshold: 5 })))
                .toEqual(['stale']);
        });

        it('orders Tier 3 and an open Tier 4 promotion strictly oldest-first', () => {
            const catalog = [exercise('tier3', 'Chest', 3), exercise('tier4', 'Core', 4)];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'tier4'),
                legacyWorkout('2026-06-22T10:00:00Z', 'tier3'),
            ];
            // The Tier 4 reset closes ordinary promotion, but it is stale and bypasses the quota.
            expect(ids(generateWorkout(3.5, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['tier4', 'tier3']);
        });

        it('reconstructs closed, open, reset-boundary, and empty-set quota states', () => {
            const catalog = [
                exercise('core', 'Core', 4),
                exercise('chest', 'Chest', 3),
                exercise('back', 'Back', 3),
            ];
            const settings = { staleThreshold: 50 };
            const noReset = [
                legacyWorkout('2026-06-19T10:00:00Z', 'back'),
                legacyWorkout('2026-06-21T10:00:00Z', 'chest'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, noReset, settings))).toEqual(['core']);

            const closed = [
                legacyWorkout('2026-06-19T10:00:00Z', 'back'),
                legacyWorkout('2026-06-20T10:00:00Z', 'core'),
                legacyWorkout('2026-06-21T10:00:00Z', 'chest'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, closed, settings))).toEqual(['back']);

            const open = [
                ...closed,
                legacyWorkout('2026-06-22T10:00:00Z', 'back'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, open, settings))).toEqual(['core']);

            const sameWorkout = [completedV2Workout('2026-06-20T10:00:00Z', [
                simpleV2Occurrence(catalog[0], true),
                simpleV2Occurrence(catalog[1], true),
                simpleV2Occurrence(catalog[2], true),
            ])];
            expect(ids(generateWorkout(1.75, [], false, catalog, sameWorkout, settings))).toEqual(['chest']);
            expect(ids(generateWorkout(1.75, ['Chest', 'Back'], false, catalog, closed, settings)))
                .toEqual(['core']);
        });

        it('compares quota timestamps by epoch and requires strictly later Tier 3 credit', () => {
            const catalog = [exercise('core', 'Core', 4), exercise('chest', 'Chest', 3)];
            const sameEpoch = [
                completedV2Workout('2026-06-20T10:00:00Z', [simpleV2Occurrence(catalog[0], true)]),
                completedV2Workout('2026-06-20T05:00:00-05:00', [simpleV2Occurrence(catalog[1], true)]),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, sameEpoch, { staleThreshold: 50 })))
                .toEqual(['chest']);
            sameEpoch.push(completedV2Workout(
                '2026-06-20T05:00:01-05:00',
                [simpleV2Occurrence(catalog[1], true)],
            ));
            expect(ids(generateWorkout(1.75, [], false, catalog, sameEpoch, { staleThreshold: 50 })))
                .toEqual(['core']);
        });

        it('ignores skipped and malformed V2 occurrences when reconstructing quota state', () => {
            const catalog = [exercise('core', 'Core', 4), exercise('chest', 'Chest', 3)];
            const malformed = { ...simpleV2Occurrence(catalog[0], true), prescribedSetCount: 99 };
            const history = [
                completedV2Workout('2026-06-20T10:00:00Z', [simpleV2Occurrence(catalog[0], false)]),
                completedV2Workout('2026-06-21T10:00:00Z', [malformed]),
                legacyWorkout('2026-06-22T10:00:00Z', 'chest'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['core']);
        });

        it('allows never-performed and stale Tier 4 units to bypass a closed quota', () => {
            const catalog = [
                exercise('reset', 'Reset', 4),
                exercise('never', 'Never', 4),
                exercise('stale', 'Stale', 4),
                exercise('required', 'Required', 3),
            ];
            const history = [
                legacyWorkout('2026-06-28T10:00:00Z', 'required'),
                legacyWorkout('2026-06-29T10:00:00Z', 'reset'),
                legacyWorkout('2026-06-20T10:00:00Z', 'stale'),
            ];
            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['never', 'required', 'stale']);
        });

        it('promotes only one Tier 4 unit but does not let a non-fitting unit consume the slot', () => {
            const catalog = [
                exercise('large', 'Large', 4, 4),
                exercise('core', 'Core', 4),
                exercise('calves', 'Calves', 4),
                exercise('chest', 'Chest', 3),
            ];
            const history = [
                legacyWorkout('2026-06-10T10:00:00Z', 'large'),
                legacyWorkout('2026-06-11T10:00:00Z', 'core'),
                legacyWorkout('2026-06-12T10:00:00Z', 'calves'),
                legacyWorkout('2026-06-13T10:00:00Z', 'chest'),
            ];
            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['core', 'chest', 'calves']);
        });

        it('keeps a quota-closed oldest Tier 4 representative for Phase 2', () => {
            const catalog = [
                exercise('old-tier4', 'Chest', 4),
                exercise('new-tier3', 'Chest', 3),
                exercise('required', 'Back', 3),
                exercise('reset', 'Reset', 4),
            ];
            const history = [
                legacyWorkout('2026-06-20T12:00:00-05:00', 'old-tier4'),
                legacyWorkout('2026-06-24T12:00:00-05:00', 'required'),
                legacyWorkout('2026-06-25T12:00:00-05:00', 'reset'),
                legacyWorkout('2026-06-26T12:00:00-05:00', 'new-tier3'),
            ];

            expect(ids(generateWorkout(3.5, [], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['required', 'old-tier4']);
        });

        it('keeps the next oldest Tier 4 representative for Phase 2 after promotion is consumed', () => {
            const catalog = [
                exercise('promoted', 'Core', 4),
                exercise('old-tier4', 'Chest', 4),
                exercise('new-tier3', 'Chest', 3),
                exercise('required', 'Back', 3),
            ];
            const history = [
                legacyWorkout('2026-06-10T12:00:00-05:00', 'promoted'),
                legacyWorkout('2026-06-11T12:00:00-05:00', 'old-tier4'),
                legacyWorkout('2026-06-12T12:00:00-05:00', 'new-tier3'),
                legacyWorkout('2026-06-13T12:00:00-05:00', 'required'),
            ];

            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['promoted', 'required', 'old-tier4']);
        });

        it('reconsiders a fitting Tier 3 exposed by a non-fitting closed-quota Tier 4', () => {
            const catalog = [
                exercise('old-tier4', 'Chest', 4, 2),
                exercise('new-tier3', 'Chest', 3),
                exercise('blocking-required', 'Back', 3, 2),
                exercise('reset', 'Reset', 4),
            ];
            const history = [
                legacyWorkout('2026-06-20T12:00:00-05:00', 'old-tier4'),
                legacyWorkout('2026-06-24T12:00:00-05:00', 'blocking-required'),
                legacyWorkout('2026-06-25T12:00:00-05:00', 'reset'),
                legacyWorkout('2026-06-26T12:00:00-05:00', 'new-tier3'),
            ];

            expect(ids(generateWorkout(
                1.75,
                ['Reset'],
                false,
                catalog,
                history,
                { staleThreshold: 50 },
            ))).toEqual(['new-tier3']);
        });

        it('reconsiders a fitting Tier 3 exposed after the promotion slot is consumed', () => {
            const catalog = [
                exercise('promoted', 'Core', 4),
                exercise('old-tier4', 'Chest', 4, 2),
                exercise('new-tier3', 'Chest', 3),
            ];
            const history = [
                legacyWorkout('2026-06-10T12:00:00-05:00', 'promoted'),
                legacyWorkout('2026-06-11T12:00:00-05:00', 'old-tier4'),
                legacyWorkout('2026-06-12T12:00:00-05:00', 'new-tier3'),
            ];

            expect(ids(generateWorkout(3.5, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['promoted', 'new-tier3']);
        });

        it('puts closed older Tier 4 fallback before duplicates, but older duplicates before recent Tier 4', () => {
            const catalog = [
                exercise('back-old', 'Back', 3),
                exercise('back-duplicate', 'Back', 3),
                exercise('core-old', 'Core', 4),
                exercise('recent-tier4', 'Recent', 4),
            ];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'core-old'),
                legacyWorkout('2026-06-21T10:00:00Z', 'back-old'),
                legacyWorkout('2026-06-22T10:00:00Z', 'back-duplicate'),
                legacyWorkout('2026-06-30T09:00:00Z', 'recent-tier4'),
            ];
            expect(ids(generateWorkout(7, [], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['back-old', 'core-old', 'back-duplicate', 'recent-tier4']);
        });

        it('prefers recent unrepresented groups before recent duplicates', () => {
            const catalog = [
                exercise('back-old', 'Back', 3),
                exercise('back-recent', 'Back', 3),
                exercise('chest-recent', 'Chest', 3),
            ];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'back-old'),
                legacyWorkout('2026-06-30T08:00:00Z', 'back-recent'),
                legacyWorkout('2026-06-30T09:00:00Z', 'chest-recent'),
            ];
            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['back-old', 'chest-recent', 'back-recent']);
        });

        it('recomputes recent representation after each selected unit', () => {
            const catalog = [
                exercise('chest-first', 'Chest', 3),
                exercise('chest-second', 'Chest', 3),
                exercise('core', 'Core', 3),
            ];
            const history = [
                legacyWorkout('2026-06-29T07:00:00Z', 'chest-first'),
                legacyWorkout('2026-06-29T08:00:00Z', 'chest-second'),
                legacyWorkout('2026-06-29T09:00:00Z', 'core'),
            ];
            expect(ids(generateWorkout(5.25, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['chest-first', 'core', 'chest-second']);
        });

        it('keeps the required Tier 3 set independent of the current fit budget', () => {
            const catalog = [
                exercise('core', 'Core', 4),
                exercise('large-required', 'Chest', 3, 3),
                exercise('small-required', 'Back', 3),
            ];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'core'),
                legacyWorkout('2026-06-21T10:00:00Z', 'small-required'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['small-required']);
        });

        it('recalculates required Tier 3 groups for leg reservation and recovery filters', () => {
            const catalog = [exercise('core', 'Core', 4), exercise('legs', 'Legs', 3)];
            const history = [legacyWorkout('2026-06-20T10:00:00Z', 'core')];
            const settings = { staleThreshold: 50, legDayOfWeek: 'Monday' };

            expect(ids(generateWorkout(1.75, [], false, catalog, history, settings))).toEqual(['core']);
            expect(ids(generateWorkout(1.75, ['Legs'], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['core']);
            expect(ids(generateWorkout(1.75, [], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(['legs']);
        });

        it('treats surviving linked candidates atomically with freshest-member recency and all-group representation', () => {
            const catalog = [
                exercise('mixed-tier3', 'Chest', 3, 1, { linkedTo: 'mixed-tier4' }),
                exercise('mixed-tier4', 'Core', 4),
                exercise('chest-duplicate', 'Chest', 3),
                exercise('filtered-partner', 'Back', 3, 1, { linkedTo: 'inactive' }),
                exercise('inactive', 'Arms', 3, 1, { isActive: false }),
            ];
            const history = [
                legacyWorkout('2026-06-20T10:00:00Z', 'mixed-tier3'),
                legacyWorkout('2026-06-30T09:00:00Z', 'mixed-tier4'),
                legacyWorkout('2026-06-22T10:00:00Z', 'chest-duplicate'),
            ];
            expect(ids(generateWorkout(7, [], false, catalog, history, { staleThreshold: 5 })))
                .toEqual(['filtered-partner', 'chest-duplicate', 'mixed-tier3', 'mixed-tier4']);
        });

        it('emits the chosen Tier 1 pivot before an earlier-catalog linked partner', () => {
            const catalog = [
                exercise('partner', 'Chest', 3, 1, { linkedTo: 'pivot' }),
                exercise('pivot', 'Biceps', 1),
            ];

            expect(ids(generateWorkout(3.5, [], false, catalog, [], { staleThreshold: 5 })))
                .toEqual(['pivot', 'partner']);
        });

        it('uses V2 snapshots and current-catalog legacy lookup for quota classification', () => {
            const catalog = [exercise('changed', 'Chest', 3), exercise('required', 'Back', 3), exercise('core', 'Core', 4)];
            const v2Snapshot = exercise('changed', 'Old Group', 4);
            const v2History = [
                legacyWorkout('2026-06-10T10:00:00Z', 'core'),
                completedV2Workout('2026-06-20T10:00:00Z', [simpleV2Occurrence(v2Snapshot, true)]),
                legacyWorkout('2026-06-21T10:00:00Z', 'required'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, v2History, { staleThreshold: 50 })))
                .toEqual(['changed']);

            const v3History = [
                legacyWorkout('2026-06-10T10:00:00Z', 'core'),
                {
                    schemaVersion: 3,
                    status: 'completed',
                    date: '2026-06-20T10:00:00Z',
                    actualDurationSeconds: 60,
                    exercises: [{
                        ...v2Snapshot,
                        occurrenceId: 'changed:0',
                        trackingMode: 'simple',
                        prescribedSetCount: v2Snapshot.sets,
                        setRecords: [{
                            index: 0,
                            completed: true,
                            plannedRestSeconds: null,
                            workDurationSeconds: 1,
                            actualRestSeconds: null,
                        }],
                    }],
                },
                legacyWorkout('2026-06-21T10:00:00Z', 'required'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, v3History, { staleThreshold: 50 })))
                .toEqual(['changed']);

            const legacyHistory = [
                legacyWorkout('2026-06-10T10:00:00Z', 'core'),
                legacyWorkout('2026-06-20T10:00:00Z', 'changed'),
                legacyWorkout('2026-06-21T10:00:00Z', 'required'),
            ];
            expect(ids(generateWorkout(1.75, [], false, catalog, legacyHistory, { staleThreshold: 50 })))
                .toEqual(['core']);
        });

        it('is deterministic for unordered malformed history and equal-recency catalog ties', () => {
            const catalog = [exercise('first', 'A', 3), exercise('second', 'B', 3), exercise('third', 'C', 4)];
            const history = [
                { date: 'bad', exercises: [{ id: 'third' }] },
                legacyWorkout('2026-06-20T10:00:00Z', 'second'),
                { date: '2026-06-20T10:00:00Z', exercises: null },
                legacyWorkout('2026-06-20T10:00:00Z', 'first'),
            ];
            const reversed = [...history].reverse();
            expect(ids(generateWorkout(5.25, ['C'], false, catalog, history, { staleThreshold: 50 })))
                .toEqual(ids(generateWorkout(5.25, ['C'], false, catalog, reversed, { staleThreshold: 50 })));
            expect(ids(generateWorkout(5.25, ['C'], false, catalog, history, { staleThreshold: 50 })).slice(0, 2))
                .toEqual(['first', 'second']);
        });
    });

    it('respects time budget and excludes unrecovered groups', () => {
        const catalog = mockCatalog;
        const settings = { staleThreshold: 5 };

        // Unrecovered Biceps -> Biceps should be excluded.
        // Time budget: 10 mins. 
        // 1 set = 1.75 mins.
        const workout = generateWorkout(10, ['Biceps'], false, catalog, [], settings);
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

    it('does not let a skipped v2 occurrence reset stale-exercise recency', () => {
        const settings = { staleThreshold: 5 };
        const dips = mockCatalog.find(ex => ex.id === 'dips');
        const history = [
            { date: '2026-06-24T10:00:00Z', exercises: [{ id: 'dips' }] },
            { date: '2026-06-29T10:00:00Z', exercises: [{ id: 'chest_row' }] },
            completedV2Workout('2026-06-30T09:00:00Z', [simpleV2Occurrence(dips, false)]),
        ];

        const generated = generateWorkout(60, [], false, mockCatalog, history, settings);
        expect(generated.findIndex(ex => ex.id === 'dips'))
            .toBeLessThan(generated.findIndex(ex => ex.id === 'chest_row'));
    });

    it('ignores skipped v2 Tier-1 occurrences when rotating the pivot', () => {
        const biceps = mockCatalog.find(ex => ex.id === 'biceps_curl');
        const shoulders = mockCatalog.find(ex => ex.id === 'shoulder_press');
        const history = [
            completedV2Workout('2026-06-28T10:00:00Z', [simpleV2Occurrence(biceps, true)]),
            completedV2Workout('2026-06-29T10:00:00Z', [simpleV2Occurrence(shoulders, false)]),
        ];

        const generated = generateWorkout(60, [], false, mockCatalog, history, { staleThreshold: 5 });
        expect(generated[0].muscleGroup).toBe('Shoulders');
    });

    describe('tracking enrichment', () => {
        const trackingCatalog = [
            { id: 'simple', name: 'Plank', muscleGroup: 'Core', tier: 3, sets: 2, dynamicTier: 99 },
            {
                id: 'weighted', name: 'Bench Press', muscleGroup: 'Chest', tier: 3, sets: 2,
                trackingMode: 'weighted', startingWeight: 100, targetReps: 8, floorReps: 5, weightStep: 10,
            },
            {
                id: 'bodyweight', name: 'Pull Up', muscleGroup: 'Back', tier: 3, sets: 2,
                trackingMode: 'bodyweight', targetReps: 6,
            },
        ];

        it('preserves selection order while enriching every mode into valid occurrences', () => {
            const generated = generateWorkout(60, [], false, trackingCatalog, [], { staleThreshold: 5 });

            expect(generated.map(ex => ex.id)).toEqual(['simple', 'weighted', 'bodyweight']);
            expect(generated.every(isValidV2ExerciseOccurrence)).toBe(true);
            expect(generated[0]).toMatchObject({
                trackingMode: 'simple', prescribedSetCount: 2, completed: false, dynamicTier: 3,
            });
            expect(generated[1].setRecords).toHaveLength(2);
            expect(generated[1].setRecords[0]).toMatchObject({
                index: 0, targetWeight: 100, actualWeight: 100, targetReps: 8, actualReps: 8, completed: false,
                recommendationReason: { decision: 'starting', reasonCode: 'STARTING_NO_ANCHOR' },
            });
            expect(generated[1].setRecords[1]).toMatchObject({
                index: 1, targetWeight: 100, actualWeight: 100, targetReps: 8, actualReps: 8, completed: false,
                recommendationReason: { recommendedWeight: 100, reasonCode: 'BACKOFF_AWAITING_PRIOR_SET' },
            });
            expect(generated[2].setRecords[0]).toMatchObject({
                index: 0, targetReps: 6, fullReps: 0, assistedReps: 0, eccentricReps: 0, completed: false,
            });
            expect(trackingCatalog[0]).not.toHaveProperty('trackingMode');
            expect(trackingCatalog[0].dynamicTier).toBe(99);
        });

        it('adds stable occurrence identities and v3-ready timing records while remaining valid v2', () => {
            const generated = generateWorkout(60, [], false, trackingCatalog, [], {
                staleThreshold: 5,
                defaultRestSeconds: 75,
            });

            expect(generated.map(exercise => exercise.occurrenceId)).toEqual([
                'simple:0', 'weighted:1', 'bodyweight:2',
            ]);
            expect(new Set(generated.map(exercise => exercise.occurrenceId)).size).toBe(generated.length);
            expect(generated.every(isValidV2ExerciseOccurrence)).toBe(true);
            generated.forEach(exercise => {
                expect(exercise.setRecords).toHaveLength(exercise.sets);
                exercise.setRecords.forEach((record, index) => {
                    expect(record).toMatchObject({
                        index,
                        completed: false,
                        plannedRestSeconds: index === exercise.sets - 1 ? null : 75,
                        workDurationSeconds: null,
                        actualRestSeconds: null,
                    });
                });
            });
            expect(generated[0].completed).toBe(false);
        });

        it('adds immutable phase targets without changing selected exercise output', () => {
            const baseline = generateWorkout(60, [], false, trackingCatalog, [], { defaultRestSeconds: 75 });
            const settings = {
                defaultRestSeconds: 75, warmupSeconds: 600, cooldownSeconds: 300,
            };
            const generated = generateWorkout(60, [], false, trackingCatalog, [], settings);

            expect(generated.map(exercise => exercise.id)).toEqual(baseline.map(exercise => exercise.id));
            expect(generated.phaseTargets).toEqual({ warmupSeconds: 600, performanceSeconds: 3600, cooldownSeconds: 300 });
            expect(Object.isFrozen(generated.phaseTargets)).toBe(true);
            expect(Object.keys(generated)).not.toContain('phaseTargets');
            settings.warmupSeconds = 0;
            settings.cooldownSeconds = 3600;
            expect(generated.phaseTargets).toEqual({ warmupSeconds: 600, performanceSeconds: 3600, cooldownSeconds: 300 });
        });

        it('rejects negative and fractional-second phase target budgets', () => {
            expect(() => generateWorkout(-1, [], false, trackingCatalog, [], {}))
                .toThrow('Time budget must be a nonnegative number of whole seconds.');
            expect(() => generateWorkout(1.234, [], false, trackingCatalog, [], {}))
                .toThrow('Time budget must be a nonnegative number of whole seconds.');
        });

        it('snapshots catalog rest overrides, inherits after clearing, and normalizes invalid defaults', () => {
            const overridden = trackingCatalog.map(exercise => (
                exercise.id === 'weighted' ? { ...exercise, restSeconds: 120 } : exercise
            ));
            const generated = generateWorkout(60, [], false, overridden, [], { defaultRestSeconds: 90 });
            expect(generated.find(exercise => exercise.id === 'weighted').setRecords[0].plannedRestSeconds).toBe(120);
            expect(generated.find(exercise => exercise.id === 'simple').setRecords[0].plannedRestSeconds).toBe(90);

            const fallback = generateWorkout(60, [], false, trackingCatalog, [], { defaultRestSeconds: 0 });
            expect(fallback[0].setRecords[0].plannedRestSeconds).toBe(60);
        });

        it('uses the invalid-catalog error path for an invalid explicit rest override', () => {
            const invalid = { ...trackingCatalog[0], restSeconds: 4 };
            expect(() => generateWorkout(60, [], false, [invalid], [], { defaultRestSeconds: 60 }))
                .toThrow(/Plank.*simple.*Manage Catalog|Settings/i);
        });

        it('uses source snapshots for the decision and the current step in top-set provenance', () => {
            const current = trackingCatalog[1];
            const source = weightedV2Occurrence({ ...current, weightStep: 5 }, [true, true]);
            source.setRecords.forEach(record => {
                record.actualReps = record.index === 0 ? 8 : 5;
            });
            const history = [{
                ...completedV2Workout('2026-06-29T10:00:00Z', [source]),
                id: 'source-workout',
            }];

            const [generated] = generateWorkout(60, [], false, [current], history, { staleThreshold: 5 });
            expect(generated.setRecords[0].recommendationReason).toEqual({
                decision: 'increase',
                sourceWorkoutId: 'source-workout',
                sourceWorkoutDate: '2026-06-29T10:00:00Z',
                sourceAnchorWeight: 100,
                appliedWeightStep: 10,
                recommendedWeight: 110,
                reasonCode: 'INCREASE_ALL_SETS_QUALIFIED',
            });
            expect(generated.setRecords.every(record => record.targetWeight === 110)).toBe(true);
        });

        it('blocks malformed active catalog data by name and id but ignores inactive malformed data', () => {
            const invalid = {
                id: 'bad-press', name: 'Bad Press', muscleGroup: 'Chest', tier: 3, sets: 2,
                trackingMode: 'weighted', startingWeight: 100, targetReps: 8, floorReps: 8, weightStep: 5,
            };
            expect(() => generateWorkout(60, [], false, [invalid], [], { staleThreshold: 5 }))
                .toThrow(/Bad Press.*bad-press.*Manage Catalog|Settings/i);
            expect(generateWorkout(60, [], false, [{ ...invalid, isActive: false }], [], { staleThreshold: 5 }))
                .toEqual([]);
        });
    });

    it('fails closed on malformed exercise containers and primitive occurrences', () => {
        const shoulders = simpleV2Occurrence(
            mockCatalog.find(ex => ex.id === 'shoulder_press'),
            true,
        );
        const history = [
            { schemaVersion: 2, status: 'completed', date: '2026-06-28T10:00:00Z', actualDuration: 30, exercises: {} },
            completedV2Workout('2026-06-29T10:00:00Z', [null, 'bad-occurrence', shoulders]),
        ];

        expect(() => generateWorkout(60, [], false, mockCatalog, history, { staleThreshold: 5 }))
            .not.toThrow();
        expect(generateWorkout(60, [], false, mockCatalog, history, { staleThreshold: 5 })[0].muscleGroup)
            .toBe('Biceps');
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

    describe('History ordering', () => {
        const liveTier1Catalog = [
            { id: 'incline_curl', name: 'Incline Curl', muscleGroup: 'Biceps', tier: 1, sets: 3, isActive: true },
            { id: 'preacher_curl', name: 'Preacher Curl', muscleGroup: 'Biceps', tier: 1, sets: 3, isActive: true },
            { id: 'lateral_raise', name: 'Lateral Shoulder Raise', muscleGroup: 'Shoulders', tier: 1, sets: 3, isActive: true },
            { id: 'incline_press', name: 'Incline Press', muscleGroup: 'Chest', tier: 3, sets: 3, isActive: true },
            { id: 'split_squat', name: 'Split Squat', muscleGroup: 'Legs', tier: 3, sets: 3, isActive: true },
        ];

        it('selects Preacher Curl for the live unordered history regardless of input order', () => {
            const settings = { staleThreshold: 5, legDayOfWeek: 'None' };
            const unorderedHistory = [
                { date: '2026-07-09T12:00:00Z', exercises: [{ id: 'lateral_raise' }] },
                { date: '2026-07-08T12:00:00Z', exercises: [{ id: 'incline_curl' }] },
                { date: '2026-07-10T12:00:00Z', exercises: [{ id: 'incline_press' }] },
                { date: '2026-07-11T12:00:00Z', exercises: [{ id: 'split_squat', muscleGroup: 'Legs', tier: 3 }] },
            ];
            const sortedHistory = [...unorderedHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
            const newestFirstHistory = [...sortedHistory].reverse();

            const unorderedWorkout = generateWorkout(60, [], false, liveTier1Catalog, unorderedHistory, settings);
            const sortedWorkout = generateWorkout(60, [], false, liveTier1Catalog, sortedHistory, settings);
            const newestFirstWorkout = generateWorkout(60, [], false, liveTier1Catalog, newestFirstHistory, settings);

            expect(unorderedWorkout.filter(ex => ex.tier === 1).map(ex => ex.id)).toEqual(['preacher_curl']);
            expect(sortedWorkout.filter(ex => ex.tier === 1).map(ex => ex.id)).toEqual(['preacher_curl']);
            expect(newestFirstWorkout.filter(ex => ex.tier === 1).map(ex => ex.id)).toEqual(['preacher_curl']);
        });

        it('uses the newest valid leg session regardless of input order', () => {
            const unorderedHistory = [
                { date: '2026-06-20T12:00:00Z', exercises: [{ id: 'squat', muscleGroup: 'Legs', tier: 3 }] },
                { date: 'not-a-date', exercises: [{ id: 'squat', muscleGroup: 'Legs', tier: 3 }] },
                { date: '2026-06-28T12:00:00Z', exercises: [{ id: 'squat', muscleGroup: 'Legs', tier: 3 }] },
            ];

            expect(getDaysSinceLastLegDay(unorderedHistory, new Date('2026-06-30T12:00:00Z'))).toBe(2);
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

        it('counts partial tracked leg work but ignores fully skipped v2 leg occurrences', () => {
            const squat = mockCatalog.find(ex => ex.id === 'squat');
            const partial = weightedV2Occurrence(squat, [true, false, false, false]);
            const skipped = weightedV2Occurrence(squat, [false, false, false, false]);

            expect(getDaysSinceLastLegDay(
                [completedV2Workout('2026-06-29T10:00:00Z', [partial])],
                new Date('2026-06-30T10:00:00Z'),
            )).toBe(1);
            expect(getDaysSinceLastLegDay(
                [completedV2Workout('2026-06-29T10:00:00Z', [skipped])],
                new Date('2026-06-30T10:00:00Z'),
            )).toBe(Infinity);
        });

        it('counts a valid leg sibling when another v2 occurrence is malformed', () => {
            const squat = simpleV2Occurrence(mockCatalog.find(ex => ex.id === 'squat'), true);
            const malformed = { ...squat, id: 'bad-leg', sets: 99 };
            expect(getDaysSinceLastLegDay(
                [
                    { schemaVersion: 2, status: 'completed', date: '2026-06-28T10:00:00Z', actualDuration: 30, exercises: 'bad' },
                    completedV2Workout('2026-06-29T10:00:00Z', [null, malformed, squat]),
                ],
                new Date('2026-06-30T10:00:00Z'),
            )).toBe(1);
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
