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
        localStorage.clear();
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

    it('normalizes an absent catalog tracking mode in memory without writing', async () => {
        firestore.collection.mockReturnValue({ path: 'catalog' });
        firestore.getDocs.mockResolvedValue({
            docs: [
                { id: 'legacy', data: () => ({ name: 'Curl', sets: 3 }) },
                { id: 'invalid', data: () => ({ name: 'Press', sets: 3, trackingMode: 'invalid' }) },
            ],
        });

        await expect(getCatalog('test-user')).resolves.toEqual([
            { id: 'legacy', name: 'Curl', sets: 3, trackingMode: 'simple' },
            { id: 'invalid', name: 'Press', sets: 3, trackingMode: 'invalid' },
        ]);
        expect(firestore.setDoc).not.toHaveBeenCalled();
    });

    it('passes v2 and legacy workout payloads through verbatim', async () => {
        const historyCollection = { path: 'history' };
        const legacy = { date: '2025-01-01', exercises: [{ id: 'curl' }] };
        const v2 = { schemaVersion: 2, status: 'completed', date: '2026-07-12', actualDuration: 1, exercises: [] };
        firestore.collection.mockReturnValue(historyCollection);

        await saveWorkout('test-user', legacy);
        await saveWorkout('test-user', v2);

        expect(firestore.addDoc).toHaveBeenNthCalledWith(1, historyCollection, legacy);
        expect(firestore.addDoc).toHaveBeenNthCalledWith(2, historyCollection, v2);
        expect(firestore.addDoc.mock.calls[0][1]).toBe(legacy);
        expect(firestore.addDoc.mock.calls[1][1]).toBe(v2);
    });

    it('preserves legacy shapes during localStorage migration', async () => {
        const legacyCatalogItem = { id: 'curl', name: 'Curl', sets: 3, customLegacyField: true };
        const legacyWorkout = { date: '2025-01-01', exercises: [{ id: 'curl', oldCompletion: 'unknown' }] };
        localStorage.setItem('adaptive-catalog', JSON.stringify([legacyCatalogItem]));
        localStorage.setItem('adaptive-history', JSON.stringify([legacyWorkout]));
        firestore.getDoc.mockResolvedValue({ exists: () => false });

        await migrateLocalData('test-user');

        expect(firestore.setDoc.mock.calls[1][1]).toEqual(legacyCatalogItem);
        expect(firestore.setDoc.mock.calls[1][1]).not.toHaveProperty('trackingMode');
        expect(firestore.addDoc.mock.calls[0][1]).toEqual(legacyWorkout);
        expect(firestore.addDoc.mock.calls[0][1]).not.toHaveProperty('schemaVersion');
        expect(localStorage.getItem('adaptive-catalog')).toBeNull();
        expect(localStorage.getItem('adaptive-history')).toBeNull();
    });
});
