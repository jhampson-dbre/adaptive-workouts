import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestore = vi.hoisted(() => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    addDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('../utils/firebase', () => ({ db: { name: 'test-db' } }));
import { getHistory, saveWorkout, getSettings, getCatalog, migrateLocalData } from '../utils/storage';

describe('Storage Layer (Async)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exports all required async functions', () => {
        expect(typeof getHistory).toBe('function');
        expect(typeof saveWorkout).toBe('function');
        expect(typeof getSettings).toBe('function');
        expect(typeof getCatalog).toBe('function');
        expect(typeof migrateLocalData).toBe('function');
    });

    it('requests history in ascending workout-date order and maps documents', async () => {
        const historyCollection = { path: 'users/test-user/history' };
        const orderedQuery = { ordered: true };
        firestore.collection.mockReturnValue(historyCollection);
        firestore.orderBy.mockReturnValue({ field: 'date', direction: 'asc' });
        firestore.query.mockReturnValue(orderedQuery);
        firestore.getDocs.mockResolvedValue({
            docs: [
                { id: 'first', data: () => ({ date: '2026-07-08T12:00:00Z', exercises: [] }) },
                { id: 'second', data: () => ({ date: '2026-07-09T12:00:00Z', exercises: [] }) },
            ],
        });

        await expect(getHistory('test-user')).resolves.toEqual([
            { id: 'first', date: '2026-07-08T12:00:00Z', exercises: [] },
            { id: 'second', date: '2026-07-09T12:00:00Z', exercises: [] },
        ]);
        expect(firestore.collection).toHaveBeenCalledWith({ name: 'test-db' }, 'users', 'test-user', 'history');
        expect(firestore.orderBy).toHaveBeenCalledWith('date', 'asc');
        expect(firestore.query).toHaveBeenCalledWith(historyCollection, { field: 'date', direction: 'asc' });
        expect(firestore.getDocs).toHaveBeenCalledWith(orderedQuery);
    });
});
