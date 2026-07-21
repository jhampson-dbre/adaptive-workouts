import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Generator from '../components/Generator';
import { AuthContext } from '../context/AuthContext';
import * as storage from '../utils/storage';
import * as engine from '../utils/engine';

vi.mock('../utils/storage');
vi.mock('../utils/engine');

describe('Generator Component', () => {
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

        const btn = screen.getByText('Generate Plan');
        fireEvent.click(btn);
        
        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
            expect(onGenerate).toHaveBeenCalled();
            expect(window.confirm).not.toHaveBeenCalled();
        });
    });

    it('prompts if leg day is overdue', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday'); // Not Friday
        window.confirm.mockReturnValue(true);

        const onGenerate = vi.fn();
        
        renderWithAuth(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Generate Plan'));
        
        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('overdue'));
            expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], true, expect.any(Array), expect.any(Array), expect.any(Object)); // doLegDay=true
        });
    });

    it('prompts if leg day is tomorrow', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(5);
        // Today is Thursday, tomorrow is Friday
        engine.getDayOfWeek.mockImplementation((date) => {
            if (date.getDate() === new Date().getDate()) return 'Thursday';
            return 'Friday';
        });
        window.confirm.mockReturnValue(true);

        const onGenerate = vi.fn();
        
        renderWithAuth(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Generate Plan'));
        
        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('early'));
            expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], true, expect.any(Array), expect.any(Array), expect.any(Object)); // doEarly=true
        });
    });

    it('uses normal generation when the early-leg-day prompt is dismissed', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(5);
        engine.getDayOfWeek.mockImplementation((date) => {
            if (date.getDate() === new Date().getDate()) return 'Thursday';
            return 'Friday';
        });
        window.confirm.mockReturnValue(false);

        renderWithAuth(<Generator
            timeBudget={45}
            setTimeBudget={vi.fn()}
            unrecoveredGroups={[]}
            setUnrecoveredGroups={vi.fn()}
            onGenerate={vi.fn()}
        />);

        fireEvent.click(screen.getByText('Generate Plan'));

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('early'));
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
        fireEvent.click(screen.getByText('Generate Plan'));

        const retry = await screen.findByRole('button', { name: 'Retry' });
        expect(screen.getByText(/workout history is unavailable/i)).not.toBeNull();
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(onGenerate).not.toHaveBeenCalled();

        let resolveHistory;
        storage.getGenerationHistory.mockReturnValueOnce(new Promise(resolve => { resolveHistory = resolve; }));
        fireEvent.click(retry);
        expect(screen.getByRole('button', { name: 'Retrying...' }).disabled).toBe(true);
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
        fireEvent.click(screen.getByText('Generate Plan'));

        expect(await screen.findByText(/failed to generate workout/i)).not.toBeNull();
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
        fireEvent.click(screen.getByText('Generate Plan'));

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
        fireEvent.click(screen.getByText('Generate Plan'));

        await waitFor(() => expect(engine.generateWorkout).toHaveBeenCalled());
        expect(window.confirm).not.toHaveBeenCalled();
    });
});
