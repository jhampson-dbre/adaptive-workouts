import { describe, it, expect, beforeEach } from 'vitest';
import { getHistory, saveWorkout, getSettings, getCatalog, migrateLocalData } from '../utils/storage';

describe('Storage Layer (Async)', () => {
    it('exports all required async functions', () => {
        expect(typeof getHistory).toBe('function');
        expect(typeof saveWorkout).toBe('function');
        expect(typeof getSettings).toBe('function');
        expect(typeof getCatalog).toBe('function');
        expect(typeof migrateLocalData).toBe('function');
    });
});
