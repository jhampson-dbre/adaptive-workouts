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
        expect(screen.getByRole('heading', { name: "Plan today's workout" })).toBeTruthy();
        expect(screen.getByText('Nudge uses your recent workouts and available time to plan today\'s workout.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Plan my workout' })).toBeTruthy();
        expect(screen.getByText('Any areas need rest?').closest('details').open).toBe(false);
    });

    it('reports a returned order-save outcome without moving focus from the Plan heading', () => {
        render(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                <Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} preference={{ operation: { state: 'success', successMessage: 'Order saved.' } }} />
            </AuthContext.Provider>
        );

        const heading = screen.getByRole('heading', { name: "Plan today's workout" });
        expect(screen.getByRole('status').textContent).toBe('Order saved.');
        expect(document.activeElement).not.toBe(screen.getByRole('status'));
        expect(heading).toBeTruthy();
    });

    it('keeps a returned order-save failure visible on Plan', () => {
        render(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                <Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} preference={{ operation: { state: 'failure' } }} />
            </AuthContext.Provider>
        );

        expect(screen.getByRole('alert').textContent).toBe("Couldn't save this exercise order. Your saved exercise orders and today's workout order are unchanged.");
    });

    it('offers precise five-minute adjustments alongside the slider', () => {
        const setTimeBudget = vi.fn();
        const view = render(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                <Generator timeBudget={20} setTimeBudget={setTimeBudget} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />
            </AuthContext.Provider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Decrease time by 5 minutes' }));
        fireEvent.click(screen.getByRole('button', { name: 'Increase time by 5 minutes' }));
        expect(setTimeBudget.mock.calls).toEqual([[15], [25]]);

        view.rerender(
            <AuthContext.Provider value={{ uid: 'test-user' }}>
                <Generator timeBudget={15} setTimeBudget={setTimeBudget} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />
            </AuthContext.Provider>
        );
        expect(screen.getByRole('button', { name: 'Decrease time by 5 minutes' }).disabled).toBe(true);
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
            expect(engine.generateWorkout).toHaveBeenCalledWith(15, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
            expect(onGenerate).toHaveBeenCalled();
            expect(window.confirm).not.toHaveBeenCalled();
        });
    });

    it('uses Time available as the total phase budget', async () => {
        storage.getCatalog.mockResolvedValue([]);
        storage.getSettings.mockResolvedValue({ legDayOfWeek: 'None', warmupSeconds: 420, cooldownSeconds: 180 });
        const onGenerate = vi.fn();
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledWith(35, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
            expect(onGenerate).toHaveBeenCalledWith([], { phaseTargets: { warmupSeconds: 420, performanceSeconds: 2100, cooldownSeconds: 180 } });
        });
    });

    it('recalculates the main budget when configured phases change', async () => {
        storage.getCatalog.mockResolvedValue([]);
        storage.getSettings.mockResolvedValueOnce({ legDayOfWeek: 'None', warmupSeconds: 420, cooldownSeconds: 180 }).mockResolvedValueOnce({ legDayOfWeek: 'None', warmupSeconds: 600, cooldownSeconds: 300 });
        const first = renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => expect(engine.generateWorkout).toHaveBeenLastCalledWith(35, [], false, expect.any(Array), expect.any(Array), expect.any(Object)));
        first.unmount();
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);
        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => expect(engine.generateWorkout).toHaveBeenLastCalledWith(30, [], false, expect.any(Array), expect.any(Array), expect.any(Object)));
    });

    it('reports a no-fit plan when configured phases consume the total budget', async () => {
        storage.getCatalog.mockResolvedValue([]);
        storage.getSettings.mockResolvedValue({ legDayOfWeek: 'None', warmupSeconds: 1800, cooldownSeconds: 900 });
        const onGenerate = vi.fn();
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        expect((await screen.findByRole('alert')).textContent).toMatch(/no time remains for exercises/i);
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('forwards the engine phase target snapshot without changing the array-based handoff', async () => {
        storage.getCatalog.mockResolvedValue([]);
        const generated = [];
        Object.defineProperty(generated, 'phaseTargets', { value: Object.freeze({ warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 }) });
        engine.generateWorkout.mockReturnValue(generated);
        const onGenerate = vi.fn();
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(generated, { phaseTargets: { warmupSeconds: 600, performanceSeconds: 900, cooldownSeconds: 300 }, preferredOrderResolution: undefined }));
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
            expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], true, expect.any(Array), expect.any(Array), expect.any(Object)); // doLegDay=true
            expect(onGenerate).toHaveBeenCalledWith([], { phaseTargets: { warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 }, preferredOrderResolution: undefined });
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
            expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], false, expect.any(Array), expect.any(Array), expect.any(Object));
        });
    });

    it('makes today a leg day directly and keeps the primary Plan action dominant', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday');
        const generated = [{ id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3 }];
        engine.generateWorkout.mockReturnValue(generated);
        const onGenerate = vi.fn();

        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        const primaryAction = screen.getByRole('button', { name: 'Plan my workout' });
        const legDayAction = screen.getByRole('button', { name: 'Make today a leg day' });
        expect(primaryAction.compareDocumentPosition(legDayAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(legDayAction);

        await waitFor(() => {
            expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], true, expect.any(Array), expect.any(Array), expect.any(Object));
            expect(onGenerate).toHaveBeenCalledWith(generated, {
                phaseTargets: { warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 },
                preferredOrderResolution: undefined,
            });
        });
        expect(screen.queryByRole('region', { name: 'Leg day choice' })).toBeNull();
    });

    it('disables the manual leg-day action while Legs are marked for rest', () => {
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={['Legs']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        const action = screen.getByRole('button', { name: 'Make today a leg day' });
        const explanation = screen.getByText('Legs are marked for rest.');
        expect(action.disabled).toBe(true);
        expect(action.getAttribute('aria-describedby')).toBe(explanation.id);
    });

    it('keeps a manual leg-day request when retrying history loading', async () => {
        storage.getGenerationHistory.mockRejectedValueOnce(new Error('offline'));
        const generated = [{ id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3 }];
        engine.generateWorkout.mockReturnValue(generated);

        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Try loading history again' }));

        await waitFor(() => expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], true, expect.any(Array), expect.any(Array), expect.any(Object)));
    });

    it('holds the selected planning inputs while a manual leg-day request is loading', () => {
        storage.getGenerationHistory.mockReturnValue(new Promise(() => {}));
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));

        expect(screen.getByRole('button', { name: 'Planning...' }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Make today a leg day' }).disabled).toBe(true);
        expect(screen.getByRole('slider', { name: /Time available/i }).disabled).toBe(true);
        expect(screen.getByRole('checkbox', { name: /LegsReady/i }).disabled).toBe(true);
    });

    it('holds the manual request through an async workout handoff and handles its failure', async () => {
        const generated = [{ id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3 }];
        engine.generateWorkout.mockReturnValue(generated);
        let rejectHandoff;
        const onGenerate = vi.fn(() => new Promise((resolve, reject) => { rejectHandoff = reject; }));
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));
        await waitFor(() => expect(onGenerate).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: 'Planning...' }).disabled).toBe(true);

        rejectHandoff(new Error('handoff failed'));
        expect((await screen.findByRole('alert')).textContent).toMatch(/failed to generate workout/i);
        expect(screen.getByRole('button', { name: 'Plan my workout' }).disabled).toBe(false);
    });

    it('does not retry a manual request after Legs are marked for rest', async () => {
        storage.getGenerationHistory.mockRejectedValueOnce(new Error('offline'));
        const props = { timeBudget: 45, setTimeBudget: vi.fn(), setUnrecoveredGroups: vi.fn(), onGenerate: vi.fn() };
        const view = renderWithAuth(<Generator {...props} unrecoveredGroups={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));
        const retry = await screen.findByRole('button', { name: 'Try loading history again' });
        view.rerender(<AuthContext.Provider value={{ uid: 'test-user' }}><Generator {...props} unrecoveredGroups={['Legs']} /></AuthContext.Provider>);
        fireEvent.click(retry);

        await Promise.resolve();
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(storage.getGenerationHistory).toHaveBeenCalledTimes(1);
        expect(retry.disabled).toBe(true);
    });

    it('clears an open scheduled leg-day choice when the direct action starts', async () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday');
        const generated = [{ id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3 }];
        engine.generateWorkout.mockReturnValue(generated);
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        expect(await screen.findByRole('region', { name: 'Leg day choice' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));

        await waitFor(() => expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], true, expect.any(Array), expect.any(Array), expect.any(Object)));
        expect(screen.queryByRole('region', { name: 'Leg day choice' })).toBeNull();
    });

    it('keeps the manual leg-day request one-off', async () => {
        storage.getSettings.mockResolvedValue({ legDayOfWeek: 'None' });
        const generated = [{ id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3 }];
        engine.generateWorkout.mockReturnValue(generated);
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));
        await waitFor(() => expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], true, expect.any(Array), expect.any(Array), expect.any(Object)));
        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));

        await waitFor(() => expect(engine.generateWorkout).toHaveBeenLastCalledWith(30, [], false, expect.any(Array), expect.any(Array), expect.any(Object)));
        expect(engine.generateWorkout).toHaveBeenCalledTimes(2);
    });

    it('keeps invalid manual leg-day outcomes on Plan with actionable recovery', async () => {
        const onGenerate = vi.fn();
        storage.getCatalog.mockResolvedValueOnce([]);
        const view = renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));
        expect((await screen.findByRole('alert')).textContent).toMatch(/add an active primary Legs exercise in Settings/i);
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(onGenerate).not.toHaveBeenCalled();

        view.unmount();
        engine.generateWorkout.mockReturnValue([{ id: 'curl', name: 'Curl', muscleGroup: 'Biceps', tier: 1 }]);
        renderWithAuth(<Generator timeBudget={45} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);
        fireEvent.click(screen.getByRole('button', { name: 'Make today a leg day' }));

        expect((await screen.findByRole('alert')).textContent).toMatch(/leg workout needs more time.*increase Time available/i);
        expect(onGenerate).not.toHaveBeenCalled();
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
