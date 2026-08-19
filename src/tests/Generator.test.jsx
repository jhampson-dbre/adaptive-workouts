import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Generator from '../components/Generator';
import { AuthContext } from '../context/AuthContext';
import * as storage from '../utils/storage';
import * as engine from '../utils/engine';
import * as accessScenarioControl from '../utils/accessScenarioControl';

vi.mock('../utils/storage');
vi.mock('../utils/engine');
vi.mock('../utils/accessScenarioControl', () => ({ loadAccessScenarioEvaluator: vi.fn(async evaluate => evaluate) }));

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
        expect(screen.getByText('Skip any muscle groups today?').closest('details').open).toBe(false);
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
        
        engine.generateWorkout.mockReturnValue([{ id: 'generated' }]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([]);
        accessScenarioControl.loadAccessScenarioEvaluator.mockImplementation(async evaluate => evaluate);
    });

    it('shows and focuses the one-option recovery without handing off an empty workout', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        const onGenerate = vi.fn().mockResolvedValue(true);
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back']} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));

        const checking = await screen.findByRole('status');
        expect(checking.textContent).toBe('Checking other muscle groups…');
        expect(checking.closest('[aria-busy="true"]')).toBeTruthy();
        const heading = await screen.findByRole('heading', { name: 'No workout fits these choices' });
        await waitFor(() => expect(document.activeElement).toBe(heading));
        expect(screen.getByText('You can make a workout fit by including Back.')).toBeTruthy();
        expect(onGenerate).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Include Back and replan' }));
        await waitFor(() => expect(onGenerate).toHaveBeenCalledWith([{ id: 'row' }], expect.objectContaining({ appliedUnrecoveredGroups: [] })));
    });

    it('shows only three neutral options initially and preserves selection when revealing more', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue(['Back', 'Chest', 'Core', 'Legs'].map(group => ({ groups: [group], workout: [{ id: group }] })));
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back', 'Chest', 'Core', 'Legs']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        await screen.findByRole('radiogroup', { name: 'Muscle groups to include' });
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        fireEvent.click(screen.getByRole('radio', { name: 'Chest' }));
        fireEvent.click(screen.getByRole('button', { name: 'Show 1 more option' }));
        expect(screen.getAllByRole('radio')).toHaveLength(4);
        expect(screen.getByRole('radio', { name: 'Chest' }).checked).toBe(true);
    });

    it('invalidates suggestions when time changes and returns initial planning focus on cancel', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        await screen.findByText('You can make a workout fit by including Back.');
        fireEvent.change(screen.getByRole('slider', { name: /Time available/ }), { target: { value: '35' } });
        expect(screen.queryByText('You can make a workout fit by including Back.')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        await screen.findByText('You can make a workout fit by including Back.');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        const summary = screen.getByText('Skip any muscle groups today?');
        expect(summary.closest('details').open).toBe(false);
        expect(document.activeElement).toBe(summary);
    });

    it('reveals minimum-time recovery actions before focusing its heading', async () => {
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = scrollIntoView;
        storage.getSettings.mockResolvedValue({ warmupSeconds: 600, cooldownSeconds: 300, legDayOfWeek: 'None' });
        try {
            renderWithAuth(<Generator timeBudget={15} setTimeBudget={vi.fn()} unrecoveredGroups={['Biceps', 'Shoulders', 'Back', 'Chest', 'Triceps', 'Core', 'Legs']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

            fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));

            const heading = await screen.findByRole('heading', { name: 'No workout fits these choices in 15 minutes' });
            await waitFor(() => expect(document.activeElement).toBe(heading));
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
            expect(screen.getByText('Add time or include any muscle groups you can train today. If neither is possible, stop planning for now.')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Change time' })).toBeTruthy();
            fireEvent.click(screen.getByRole('button', { name: 'Stop planning for now' }));
            expect(screen.queryByRole('heading', { name: 'No workout fits these choices in 15 minutes' })).toBeNull();
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it('keeps the applied skips unchanged when replacement staging fails', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        const setUnrecoveredGroups = vi.fn();
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back']} setUnrecoveredGroups={setUnrecoveredGroups} onGenerate={vi.fn().mockResolvedValue(false)} workout={[{ id: 'old', name: 'Old row', muscleGroup: 'Chest' }]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Replan workout' }));
        await screen.findByText('You can make a workout fit by including Back.');
        fireEvent.click(screen.getByRole('button', { name: 'Include Back and replan' }));

        expect((await screen.findByRole('alert')).textContent).toBe('Failed to generate workout. Please try again.');
        expect(setUnrecoveredGroups).not.toHaveBeenCalled();
        expect(screen.getByRole('checkbox', { name: /Back/ }).checked).toBe(true);
    });

    it('hands off a one-option recovery only once while staging is pending', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        let settleHandoff;
        const onGenerate = vi.fn(() => new Promise(resolve => { settleHandoff = resolve; }));
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back']} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        const apply = await screen.findByRole('button', { name: 'Include Back and replan' });
        fireEvent.click(apply);
        fireEvent.click(apply);

        expect(onGenerate).toHaveBeenCalledTimes(1);
        settleHandoff(false);
        await waitFor(() => expect(apply.disabled).toBe(false));
    });

    it('locks recovery choices, muscle groups, and time until a multiple-option handoff settles', async () => {
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue(['Back', 'Chest'].map(group => ({ groups: [group], workout: [{ id: group }] })));
        let settleHandoff;
        const onGenerate = vi.fn(() => new Promise(resolve => { settleHandoff = resolve; }));
        const setTimeBudget = vi.fn();
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={setTimeBudget} unrecoveredGroups={['Back', 'Chest']} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
        fireEvent.click(await screen.findByRole('radio', { name: 'Back' }));
        const apply = screen.getByRole('button', { name: 'Apply and replan' });
        fireEvent.click(apply);
        fireEvent.click(apply);

        expect(onGenerate).toHaveBeenCalledTimes(1);
        expect(apply.disabled).toBe(true);
        expect(apply.closest('.no-fit-recovery').getAttribute('aria-busy')).toBe('true');
        expect(screen.getAllByRole('radio').every(input => input.disabled)).toBe(true);
        expect(screen.getByRole('slider', { name: /Time available/ }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Decrease time by 5 minutes' }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Increase time by 5 minutes' }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
        expect(screen.getAllByRole('checkbox').every(input => input.disabled)).toBe(true);
        fireEvent.click(screen.getByRole('checkbox', { name: /Back/ }));
        fireEvent.change(screen.getByRole('slider', { name: /Time available/ }), { target: { value: '35' } });
        expect(screen.getByRole('checkbox', { name: /Back/ }).checked).toBe(true);
        expect(setTimeBudget).not.toHaveBeenCalled();

        settleHandoff(false);
        await waitFor(() => expect(apply.disabled).toBe(false));
        expect(screen.getByRole('alert').textContent).toBe('Failed to generate workout. Please try again.');
        expect(screen.getAllByRole('radio').every(input => !input.disabled)).toBe(true);
    });

    it('invalidates stale suggestions on manual selection and supports no-fit, failure, change-time, and cancel recovery', async () => {
        engine.generateWorkout.mockReturnValue([]);
        const setTimeBudget = vi.fn(); const cancel = vi.fn();
        engine.findMinimumMuscleGroupRelaxations.mockReturnValueOnce([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        const view = renderWithAuth(<Generator timeBudget={30} setTimeBudget={setTimeBudget} unrecoveredGroups={['Back']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} onCancelReplan={cancel} workout={[{ id: 'old', name: 'Old row', muscleGroup: 'Chest' }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Replan workout' }));
        await screen.findByText('You can make a workout fit by including Back.');
        fireEvent.click(screen.getByRole('checkbox', { name: /Back/ }));
        expect(screen.queryByText('You can make a workout fit by including Back.')).toBeNull();

        engine.findMinimumMuscleGroupRelaxations.mockReturnValueOnce([]);
        fireEvent.click(screen.getByRole('button', { name: 'Replan workout' }));
        await screen.findByRole('heading', { name: 'No workout fits these choices in 30 minutes' });
        expect(screen.getByText('Add time or include any muscle groups you can train today. If neither is possible, keep your current workout.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Keep current workout' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Change time' }));
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('slider', { name: /Time available/ })));

        engine.findMinimumMuscleGroupRelaxations.mockReturnValueOnce([]);
        fireEvent.click(screen.getByRole('button', { name: 'Replan workout' }));
        await screen.findByRole('heading', { name: 'No workout fits these choices in 30 minutes' });
        fireEvent.click(screen.getByRole('button', { name: 'Keep current workout' }));
        expect(cancel).toHaveBeenCalledOnce();

        engine.findMinimumMuscleGroupRelaxations.mockImplementationOnce(() => { throw new Error('failed'); });
        fireEvent.click(screen.getByRole('button', { name: 'Replan workout' }));
        expect(await screen.findByText("Couldn’t check other muscle groups.")).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(cancel).toHaveBeenCalledTimes(2);
        view.unmount();
    });

    it('recovers when the baseline scenario rejects one relaxation analysis', async () => {
        const priorMode = import.meta.env.MODE;
        import.meta.env.MODE = 'baseline';
        engine.generateWorkout.mockReturnValue([]);
        engine.findMinimumMuscleGroupRelaxations.mockReturnValue([{ groups: ['Back'], workout: [{ id: 'row' }] }]);
        let rejectNext = true;
        accessScenarioControl.loadAccessScenarioEvaluator.mockImplementation(async evaluate => async (...args) => {
            if (rejectNext) { rejectNext = false; throw new Error('Scenario verification rejection'); }
            return evaluate(...args);
        });
        try {
            renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={['Back']} setUnrecoveredGroups={vi.fn()} onGenerate={vi.fn()} />);

            fireEvent.click(screen.getByRole('button', { name: 'Plan my workout' }));
            expect(await screen.findByRole('heading', { name: 'Couldn’t check other muscle groups.' })).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
            expect(await screen.findByText('You can make a workout fit by including Back.')).toBeTruthy();
            expect(engine.findMinimumMuscleGroupRelaxations).toHaveBeenCalledOnce();
        } finally { import.meta.env.MODE = priorMode; }
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
            expect(onGenerate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ phaseTargets: { warmupSeconds: 420, performanceSeconds: 2100, cooldownSeconds: 180 } }));
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
        expect(await screen.findByRole('heading', { name: 'No workout fits these choices in 45 minutes' })).toBeTruthy();
        expect(engine.generateWorkout).not.toHaveBeenCalled();
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('forwards the engine phase target snapshot without changing the array-based handoff', async () => {
        storage.getCatalog.mockResolvedValue([]);
        const generated = [{ id: 'generated' }];
        Object.defineProperty(generated, 'phaseTargets', { value: Object.freeze({ warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 }) });
        engine.generateWorkout.mockReturnValue(generated);
        const onGenerate = vi.fn();
        renderWithAuth(<Generator timeBudget={30} setTimeBudget={vi.fn()} unrecoveredGroups={[]} setUnrecoveredGroups={vi.fn()} onGenerate={onGenerate} />);

        fireEvent.click(screen.getByText('Plan my workout'));
        await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(generated, expect.objectContaining({ phaseTargets: { warmupSeconds: 600, performanceSeconds: 900, cooldownSeconds: 300 }, preferredOrderResolution: undefined })));
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
            expect(onGenerate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ phaseTargets: { warmupSeconds: 600, performanceSeconds: 1800, cooldownSeconds: 300 }, preferredOrderResolution: undefined }));
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
