import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Generator from '../components/Generator';
import { AuthContext } from '../context/AuthContext';
import * as storage from '../utils/storage';
import * as engine from '../utils/engine';

vi.mock('../utils/storage');
vi.mock('../utils/engine');

describe('Generator Component', () => {
    it('keeps the Plan action ahead of optional recovery choices', () => {
        render(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                <Generator
                    timeBudget={45}
                    setTimeBudget={vi.fn()}
                    unrecoveredGroups={[]}
                    setUnrecoveredGroups={vi.fn()}
                    onGenerate={vi.fn()}
                />
            </AuthContext.Provider>
        );

        expect(screen.getByRole('navigation', { name: 'Workout progress' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'How much time do you have?' })).toBeTruthy();
        expect(screen.getByText('Nudge uses your recent workouts and available time to plan today\'s workout.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Plan my workout' })).toBeTruthy();
        expect(screen.getByText('Anything to work around?').closest('details').open).toBe(false);
    });

    afterEach(() => cleanup());
    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn();
        
        storage.getSettings.mockResolvedValue({ legDayOfWeek: 'Friday' });
        storage.getGenerationHistory.mockResolvedValue([]);
        storage.getCatalog.mockResolvedValue([
            { id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3, sets: 3, isActive: true }
        ]);
        
        engine.generateWorkout.mockReturnValue([]);
    });

    const renderWithAuth = (ui) => {
        return render(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                {ui}
            </AuthContext.Provider>
        );
    };

    it('renders and calls onGenerate with normal generation', async () => {
        storage.getCatalog.mockResolvedValue([]); // No primary legs
        const onGenerate = vi.fn();
        const setTimeBudget = vi.fn();
        const setUnrecoveredGroups = vi.fn();
        
        renderWithAuth(<Generator 
            timeBudget={30} 
            setTimeBudget={setTimeBudget} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={setUnrecoveredGroups} 
            onGenerate={onGenerate} 
        />);

        const btn = screen.getByText('Plan my workout');
        fireEvent.click(btn);
        
        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
            expect(onGenerate).toHaveBeenCalled();
            expect(window.confirm).not.toHaveBeenCalled();
        });
    });

    it('forwards the engine phase target snapshot without changing the array-based handoff', async () => {
        storage.getCatalog.mockResolvedValue([]);
        const generated = [];
        Object.defineProperty(generated, 'phaseTargets', { value: Object.freeze({ warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 }) });
        engine.generateWorkout.mockReturnValue(generated);
        const onGenerate = vi.fn();
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(generated, { phaseTargets: { warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 } }));
    });

    it('offers a neutral inline leg-day choice when legs are due', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday'); // Not Friday

        const onGenerate = vi.fn();
        
        renderWithAuth(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Plan my workout'));
        
        await waitFor(() => expect(screen.getByRole('region', { name: 'Leg day choice' })).toBeTruthy());
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Include legs in today\'s workout?' })));
        expect(window.confirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Include legs today' }));
        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], true, expect.any(Array), expect.any(Array), expect.any(Object)); // doLegDay=true
            expect(onGenerate).toHaveBeenCalledWith([], { phaseTargets: { warmupSeconds: 0, performanceSeconds: 2700, cooldownSeconds: 0 } });
        });
    });

    it('keeps the normal schedule when the inline leg-day choice is declined', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(5);
        // Today is Thursday, tomorrow is Friday
        engine.getDayOfWeek.mockImplementation((date) => {
            if (date.getDate() === new Date().getDate()) return 'Thursday';
            return 'Friday';
        });

        const onGenerate = vi.fn();
        
        renderWithAuth(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Plan my workout'));
        
        await waitFor(() => expect(screen.getByRole('region', { name: 'Leg day choice' })).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Leave legs out today' }));
        await waitFor(() => {
            expect(window.confirm).not.toHaveBeenCalled();
            expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
        });
    });

    it('blocks generation on history failure and retries without an empty-history fallback', async () => {
        storage.getCatalog.mockResolvedValue([]);
        storage.getGenerationHistory.mockRejectedValueOnce(new Error('offline'));
        const onGenerate = vi.fn();

        renderWithAuth(<Generator
            timeBudget={30}
            setTimeBudget={vi.fn()}
            unrecoveredGroups={[]}
            setUnrecoveredGroups={vi.fn()}
            onGenerate={onGenerate}
        />);
        fireEvent.click(screen.getByText('Plan my workout'));

        const retry = await screen.findByRole('button', { name: 'Try loading history again' });
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toMatch(/workout history is unavailable/i);
        expect(screen.getByText(/workout history is unavailable/i)).not.toBeNull();
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(onGenerate).not.toHaveBeenCalled();

        let resolveHistory;
        storage.getGenerationHistory.mockReturnValueOnce(new Promise(resolve => { resolveHistory = resolve; }));
        fireEvent.click(retry);
        expect(screen.getByRole('button', { name: 'Loading workout history...' }).disabled).toBe(true);
        resolveHistory([]);

        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledTimes(1);
            expect(onGenerate).toHaveBeenCalledTimes(1);
            expect(screen.queryByText(/workout history is unavailable/i)).toBeNull();
        });
    });

    it('keeps non-history load failures generic without a retry action', async () => {
        storage.getSettings.mockRejectedValueOnce(new Error('settings unavailable'));
        renderWithAuth(<Generator
            timeBudget={30}
            setTimeBudget={vi.fn()}
            unrecoveredGroups={[]}
            setUnrecoveredGroups={vi.fn()}
            onGenerate={vi.fn()}
        />);
        fireEvent.click(screen.getByText('Plan my workout'));

        expect((await screen.findByRole('alert')).textContent).toMatch(/failed to generate workout/i);
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    it('shows actionable catalog validation errors from the engine', async () => {
        storage.getCatalog.mockResolvedValue([]);
        const validationError = new Error('Invalid exercise configuration for "Bad Press" (bad-press). Update it in Manage Catalog / Settings.');
        validationError.name = 'InvalidCatalogExerciseError';
        engine.generateWorkout.mockImplementationOnce(() => { throw validationError; });

        renderWithAuth(<Generator
            timeBudget={30}
            setTimeBudget={vi.fn()}
            unrecoveredGroups={[]}
            setUnrecoveredGroups={vi.fn()}
            onGenerate={vi.fn()}
        />);
        fireEvent.click(screen.getByText('Plan my workout'));

        expect(await screen.findByText(/Bad Press.*bad-press.*Manage Catalog.*Settings/i)).not.toBeNull();
    });

    it('ignores inactive Tier-3 legs when deciding whether to prompt', async () => {
        storage.getCatalog.mockResolvedValue([{
            id: 'inactive-leg', name: 'Inactive Leg', muscleGroup: 'Legs', tier: 3, sets: 3,
            isActive: false, trackingMode: 'weighted', floorReps: 8,
        }]);
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday');

        renderWithAuth(<Generator
            timeBudget={30}
            setTimeBudget={vi.fn()}
            unrecoveredGroups={[]}
            setUnrecoveredGroups={vi.fn()}
            onGenerate={vi.fn()}
        />);
        fireEvent.click(screen.getByText('Plan my workout'));

        await waitFor(() => expect(engine.generateWorkout).toHaveBeenCalled());
        expect(window.confirm).not.toHaveBeenCalled();
    });
});
