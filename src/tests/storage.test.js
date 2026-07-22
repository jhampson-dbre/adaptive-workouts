import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestore = vi.hoisted(() => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    documentId: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    addDoc: vi.fn(),
}));

vi.mock('../utils/firestoreClient', () => ({
    loadFirestoreClient: async () => ({ ...firestore, db: { name: 'test-db' } }),
}));
import { getGenerationHistory, getHistoryPage, saveWorkout, getSettings, getCatalog, migrateLocalData } from '../utils/storage';

describe('Storage Layer (Async)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('exports all required async functions', () => {
        expect(typeof getGenerationHistory).toBe('function');
        expect(typeof getHistoryPage).toBe('function');
        expect(typeof saveWorkout).toBe('function');
        expect(typeof getSettings).toBe('function');
        expect(typeof getCatalog).toBe('function');
        expect(typeof migrateLocalData).toBe('function');
    });

    it('bounds generator history to the newest 100 raw documents', async () => {
        const historyCollection = { path: 'users/test-user/history' };
        const orderedQuery = { ordered: true };
        firestore.collection.mockReturnValue(historyCollection);
        firestore.orderBy.mockReturnValue({ field: 'date', direction: 'desc' });
        firestore.limit.mockReturnValue({ count: 100 });
        firestore.query.mockReturnValue(orderedQuery);
        firestore.getDocs.mockResolvedValue({
            docs: [
                { id: 'first', data: () => ({ date: '2026-07-08T12:00:00Z', exercises: [] }) },
                { id: 'second', data: () => ({ date: '2026-07-09T12:00:00Z', exercises: [] }) },
            ],
        });

        await expect(getGenerationHistory('test-user')).resolves.toEqual([
            { id: 'first', date: '2026-07-08T12:00:00Z', exercises: [] },
            { id: 'second', date: '2026-07-09T12:00:00Z', exercises: [] },
        ]);
        expect(firestore.collection).toHaveBeenCalledWith({ name: 'test-db' }, 'users', 'test-user', 'history');
        expect(firestore.orderBy).toHaveBeenCalledWith('date', 'desc');
        expect(firestore.query).toHaveBeenCalledWith(historyCollection, { field: 'date', direction: 'desc' }, { count: 100 });
        expect(firestore.getDocs).toHaveBeenCalledWith(orderedQuery);
    });

    it('keeps Firestore document IDs authoritative over payload IDs in both history readers', async () => {
        firestore.collection.mockReturnValue({ path: 'history' });
        firestore.orderBy.mockReturnValue({ ordered: true });
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.limit.mockReturnValue({ count: 101 });
        firestore.query.mockReturnValue({ ordered: true });
        firestore.getDocs.mockResolvedValue({ docs: [{ id: 'path-id', data: () => ({ id: 'payload-id', date: '2026-07-20' }) }] });

        await expect(getGenerationHistory('test-user')).resolves.toEqual([{ id: 'path-id', date: '2026-07-20' }]);
        await expect(getHistoryPage('test-user')).resolves.toMatchObject({ items: [{ id: 'path-id', date: '2026-07-20' }] });
    });

    it('pages newest-first by date then document ID without exposing the lookahead row', async () => {
        const historyCollection = { path: 'users/test-user/history' };
        const orderedQuery = { ordered: true };
        const first = { id: 'z', data: () => ({ date: '2026-07-09' }) };
        const second = { id: 'a', data: () => ({ date: '2026-07-09' }) };
        const lookahead = { id: 'older', data: () => ({ date: '2026-07-08' }) };
        firestore.collection.mockReturnValue(historyCollection);
        firestore.orderBy.mockImplementation((field, direction) => ({ field, direction }));
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.limit.mockReturnValue({ count: 3 });
        firestore.query.mockReturnValue(orderedQuery);
        firestore.getDocs.mockResolvedValue({ docs: [first, second, lookahead] });

        await expect(getHistoryPage('test-user', { pageSize: 2 })).resolves.toEqual({
            items: [{ id: 'z', date: '2026-07-09' }, { id: 'a', date: '2026-07-09' }],
            nextCursor: second,
            hasMore: true,
        });
        expect(firestore.query).toHaveBeenCalledWith(
            historyCollection,
            { field: 'date', direction: 'desc' },
            { field: 'DOCUMENT_ID', direction: 'desc' },
            { count: 3 },
        );

        firestore.startAfter.mockReturnValue({ cursor: second });
        await getHistoryPage('test-user', { cursor: second, pageSize: 2 });
        expect(firestore.query).toHaveBeenLastCalledWith(
            historyCollection,
            { field: 'date', direction: 'desc' },
            { field: 'DOCUMENT_ID', direction: 'desc' },
            { cursor: second },
            { count: 3 },
        );
    });

    it('rejects unsafe history page sizes before querying Firestore', async () => {
        await expect(getHistoryPage('test-user', { pageSize: 0 })).rejects.toThrow(/page size/i);
        await expect(getHistoryPage('test-user', { pageSize: 101 })).rejects.toThrow(/page size/i);
        expect(firestore.getDocs).not.toHaveBeenCalled();
    });

    it('distinguishes an exact 20-document page from a 21-document lookahead', async () => {
        const historyCollection = { path: 'history' };
        firestore.collection.mockReturnValue(historyCollection);
        firestore.orderBy.mockReturnValue({ ordered: true });
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.limit.mockReturnValue({ count: 21 });
        firestore.query.mockReturnValue({ ordered: true });
        const docs = Array.from({ length: 21 }, (_, index) => ({ id: `workout-${index}`, data: () => ({ date: '2026-07-20' }) }));
        firestore.getDocs.mockResolvedValueOnce({ docs: docs.slice(0, 20) });
        const exactPage = await getHistoryPage('test-user');
        expect(exactPage.items).toHaveLength(20);
        expect(exactPage).toMatchObject({ nextCursor: docs[19], hasMore: false });
        firestore.getDocs.mockResolvedValueOnce({ docs });
        const lookaheadPage = await getHistoryPage('test-user');
        expect(lookaheadPage.items).toHaveLength(20);
        expect(lookaheadPage).toMatchObject({ nextCursor: docs[19], hasMore: true });
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

    it('normalizes missing and invalid default rest settings in memory without writing', async () => {
        firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ staleThreshold: 7 }) });
        await expect(getSettings('test-user')).resolves.toMatchObject({ staleThreshold: 7, defaultRestSeconds: 60 });

        firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ defaultRestSeconds: '90' }) });
        await expect(getSettings('test-user')).resolves.toMatchObject({ defaultRestSeconds: 60 });
        expect(firestore.setDoc).not.toHaveBeenCalled();
    });

    it('normalizes canonical phase settings in memory without writing', async () => {
        firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ warmupSeconds: 0, cooldownSeconds: 3600 }) });
        await expect(getSettings('test-user')).resolves.toMatchObject({ warmupSeconds: 0, cooldownSeconds: 3600 });

        firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ warmupSeconds: 600, warmupTime: 45, cooldownSeconds: 300 }) });
        await expect(getSettings('test-user')).resolves.toMatchObject({ warmupSeconds: 600, cooldownSeconds: 300 });

        firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ warmupTime: 10 }) });
        await expect(getSettings('test-user')).resolves.toMatchObject({ warmupSeconds: 600, cooldownSeconds: 300 });
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
