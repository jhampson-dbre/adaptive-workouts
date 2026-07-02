import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Generator from '../components/Generator';
import * as storage from '../utils/storage';
import * as engine from '../utils/engine';

vi.mock('../utils/storage');
vi.mock('../utils/engine');

describe('Generator Component', () => {
    afterEach(() => cleanup());
    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn();
        
        storage.getSettings.mockReturnValue({ legDayOfWeek: 'Friday' });
        storage.getHistory.mockReturnValue([]);
        storage.getCatalog.mockReturnValue([
            { id: 'leg1', name: 'Squat', muscleGroup: 'Legs', tier: 3, sets: 3, isActive: true }
        ]);
        
        engine.generateWorkout.mockReturnValue([]);
    });

    it('renders and calls onGenerate with normal generation', () => {
        storage.getCatalog.mockReturnValue([]); // No primary legs
        const onGenerate = vi.fn();
        const setTimeBudget = vi.fn();
        const setUnrecoveredGroups = vi.fn();
        
        render(<Generator 
            timeBudget={30} 
            setTimeBudget={setTimeBudget} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={setUnrecoveredGroups} 
            onGenerate={onGenerate} 
        />);

        const btn = screen.getByText('Generate Plan');
        fireEvent.click(btn);
        
        expect(engine.generateWorkout).toHaveBeenCalledWith(30, [], false);
        expect(onGenerate).toHaveBeenCalled();
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('prompts if leg day is overdue', () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(8);
        engine.getDayOfWeek.mockReturnValue('Monday'); // Not Friday
        window.confirm.mockReturnValue(true);

        const onGenerate = vi.fn();
        
        render(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Generate Plan'));
        
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('overdue'));
        expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], true); // doLegDay=true
    });

    it('prompts if leg day is tomorrow', () => {
        engine.getDaysSinceLastLegDay.mockReturnValue(5);
        // Today is Thursday, tomorrow is Friday
        engine.getDayOfWeek.mockImplementation((date) => {
            if (date.getDate() === new Date().getDate()) return 'Thursday';
            return 'Friday';
        });
        window.confirm.mockReturnValue(true);

        const onGenerate = vi.fn();
        
        render(<Generator 
            timeBudget={45} 
            setTimeBudget={vi.fn()} 
            unrecoveredGroups={[]} 
            setUnrecoveredGroups={vi.fn()} 
            onGenerate={onGenerate} 
        />);

        fireEvent.click(screen.getByText('Generate Plan'));
        
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('early'));
        expect(engine.generateWorkout).toHaveBeenCalledWith(45, [], true); // doEarly=true
    });
});
