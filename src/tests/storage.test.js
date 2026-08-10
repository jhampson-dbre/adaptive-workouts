import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';

const isLocalRangeChild = process.env.STORAGE_LOCAL_RANGE_CHILD === '1';

const runLocalRangeChild = (timeZone, testName) => {
    const child = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/tests/storage.test.js', '-t', testName, '--fileParallelism=false'], {
        cwd: process.cwd(), env: { ...process.env, STORAGE_LOCAL_RANGE_CHILD: '1', TZ: timeZone }, encoding: 'utf8', timeout: 30_000,
    });
    expect(child.status, child.stderr).toBe(0);
};

const firestore = vi.hoisted(() => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    documentId: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocFromServer: vi.fn(),
    setDoc: vi.fn(),
    addDoc: vi.fn(),
    writeBatch: vi.fn(),
}));

vi.mock('../utils/firestoreClient', () => ({
    loadFirestoreClient: async () => ({ ...firestore, db: { name: 'test-db' } }),
}));
import { getGenerationHistory, getHistoryPage, getCompleteHistoryRange, saveWorkout, saveImmutableWorkout, readImmutableWorkoutFromServer, getSettings, getCatalog, migrateLocalData, saveSettingsAndCatalogItem, savePreferredOrderRule, clearPreferredOrderRules, touchPreferredOrderRuleUsage } from '../utils/storage';
import { runTransaction } from '../utils/firestoreOperations';

describe('Storage Layer (Async)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('exports all required async functions', () => {
        expect(typeof getGenerationHistory).toBe('function');
        expect(typeof getHistoryPage).toBe('function');
        expect(typeof saveWorkout).toBe('function');
        expect(typeof saveImmutableWorkout).toBe('function');
        expect(typeof getSettings).toBe('function');
        expect(typeof getCatalog).toBe('function');
        expect(typeof migrateLocalData).toBe('function');
        expect(typeof saveSettingsAndCatalogItem).toBe('function');
        expect(typeof touchPreferredOrderRuleUsage).toBe('function');
    });

    it('exposes the transaction operation required by the production preferred-order save path', () => {
        expect(typeof runTransaction).toBe('function');
    });

    it('touches only matching rule fingerprints and avoids a write when usage is unchanged', async () => {
        const transaction = { get: vi.fn().mockResolvedValue({ data: () => ({
            preferredOrderRules: [{ blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }] }],
            preferredOrderRuleUsage: ['["a","b"]'],
        }) }), set: vi.fn() };
        firestore.runTransaction = vi.fn(async (_db, callback) => callback(transaction));
        firestore.doc.mockReturnValue({ path: 'users/test-user' });
        await touchPreferredOrderRuleUsage('test-user', [{ contextKey: '["a","b"]', fingerprint: '[[{"exerciseIds":["a"]}],[{"exerciseIds":["b"]}]]' }]);
        expect(transaction.set).not.toHaveBeenCalled();
    });

    it('uses transactions for order save and clear without replacing unrelated settings', async () => {
        const transaction = { get: vi.fn().mockResolvedValue({ data: () => ({ staleThreshold: 7, preferredOrderRules: [], preferredOrderRuleUsage: [] }) }), set: vi.fn() };
        firestore.runTransaction = vi.fn(async (_db, callback) => callback(transaction)); firestore.doc.mockReturnValue({ path: 'users/test-user' });
        await savePreferredOrderRule('test-user', { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }] });
        expect(transaction.set).toHaveBeenCalledWith({ path: 'users/test-user' }, expect.objectContaining({ preferredOrderRules: expect.any(Array), preferredOrderRuleUsage: ['["a","b"]'] }), { merge: true });
        transaction.set.mockClear(); await clearPreferredOrderRules('test-user');
        expect(transaction.set).toHaveBeenCalledWith({ path: 'users/test-user' }, { preferredOrderRules: [], preferredOrderRuleUsage: [] }, { merge: true });
    });

    it('returns transient override and eviction contexts without persisting outcome metadata', async () => {
        const oldRules = [
            { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }] },
            ...Array.from({ length: 49 }, (_, index) => ({ blocks: [{ exerciseIds: [`x${index}`] }, { exerciseIds: [`y${index}`] }] })),
        ];
        const oldUsage = oldRules.map(rule => JSON.stringify(rule.blocks.flatMap(block => block.exerciseIds).sort()));
        const transaction = { get: vi.fn().mockResolvedValue({ data: () => ({ preferredOrderRules: oldRules, preferredOrderRuleUsage: oldUsage }) }), set: vi.fn() };
        firestore.runTransaction = vi.fn(async (_db, callback) => callback(transaction)); firestore.doc.mockReturnValue({ path: 'users/test-user' });

        await expect(savePreferredOrderRule('test-user', { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }, { exerciseIds: ['c'] }] })).resolves.toMatchObject({
            contextKey: '["a","b","c"]', evicted: '["x48","y48"]', overridden: [{ contextKey: '["a","b"]' }],
        });
        expect(Object.keys(transaction.set.mock.calls[0][1]).sort()).toEqual(['preferredOrderRuleUsage', 'preferredOrderRules']);
    });

    it('atomically saves a catalog change with its superset membership', async () => {
        const batch = { set: vi.fn(), commit: vi.fn().mockResolvedValue() };
        firestore.writeBatch.mockReturnValue(batch);
        firestore.doc
            .mockReturnValueOnce({ path: 'users/test-user' })
            .mockReturnValueOnce({ path: 'users/test-user/catalog/bench' });

        await saveSettingsAndCatalogItem('test-user', { supersets: [] }, { id: 'bench', isActive: false });

        expect(batch.set).toHaveBeenNthCalledWith(1, { path: 'users/test-user' }, { supersets: [] }, { merge: true });
        expect(batch.set).toHaveBeenNthCalledWith(2, { path: 'users/test-user/catalog/bench' }, { id: 'bench', isActive: false });
        expect(batch.commit).toHaveBeenCalledOnce();
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

    it('reads every workout in an inclusive calendar range with deterministic ordering and rejects whole-query failures', async () => {
        const historyCollection = { path: 'users/test-user/history' };
        const completeQuery = { complete: true };
        firestore.collection.mockReturnValue(historyCollection);
        firestore.where.mockImplementation((field, operator, value) => ({ field, operator, value }));
        firestore.orderBy.mockImplementation((field, direction) => ({ field, direction }));
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.query.mockReturnValue(completeQuery);
        firestore.getDocs.mockResolvedValue({ docs: [{ id: 'start', data: () => ({ date: '2026-06-10' }) }, { id: 'end', data: () => ({ date: '2026-07-10' }) }] });

        await expect(getCompleteHistoryRange('test-user', { range: '1M', endDate: '2026-07-10' })).resolves.toEqual([
            { id: 'start', date: '2026-06-10' }, { id: 'end', date: '2026-07-10' },
        ]);
        expect(firestore.query).toHaveBeenCalledWith(historyCollection,
            { field: 'date', operator: '>=', value: '2026-06-10' },
            expect.objectContaining({ field: 'date', operator: '<=', value: expect.any(String) }),
            { field: 'date', direction: 'asc' }, { field: 'DOCUMENT_ID', direction: 'asc' },
        );
        firestore.where.mockClear();
        firestore.getDocs.mockResolvedValue({ docs: [] });
        await getCompleteHistoryRange('test-user', { range: '1M', endDate: '2024-03-31' });
        await getCompleteHistoryRange('test-user', { range: '1M', endDate: '2025-03-31' });
        await getCompleteHistoryRange('test-user', { range: '3M', endDate: '2026-07-10' });
        await getCompleteHistoryRange('test-user', { range: '6M', endDate: '2026-07-10' });
        await getCompleteHistoryRange('test-user', { range: '1Y', endDate: '2024-02-29' });
        expect(firestore.where.mock.calls.filter(([field, operator]) => field === 'date' && operator === '>=').map(([, , value]) => value)).toEqual([
            '2024-02-29', '2025-02-28', '2026-04-10', '2026-01-10', '2023-02-28',
        ]);
        firestore.getDocs.mockRejectedValueOnce(new Error('unavailable'));
        await expect(getCompleteHistoryRange('test-user', { range: '1M', endDate: '2026-07-10' })).rejects.toThrow('unavailable');
    });

    it('matches viewer-local History dates across DST, date-only values, and month-end clamping', async () => {
        if (!isLocalRangeChild) return runLocalRangeChild('America/Chicago', 'matches viewer-local History dates');
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Chicago');
        firestore.collection.mockReturnValue({ path: 'history' });
        firestore.where.mockImplementation((field, operator, value) => ({ field, operator, value }));
        firestore.orderBy.mockImplementation((field, direction) => ({ field, direction }));
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.query.mockReturnValue({ complete: true });
        firestore.getDocs.mockResolvedValue({ docs: [
            { id: 'before-start', data: () => ({ date: '2026-07-10T04:59:59.999Z' }) },
            { id: 'literal-start', data: () => ({ date: '2026-07-10' }) },
            { id: 'local-start', data: () => ({ date: '2026-07-10T05:00:00.000Z' }) },
            { id: 'literal-end', data: () => ({ date: '2026-08-10' }) },
            { id: 'local-end', data: () => ({ date: '2026-08-11T04:59:59.999Z' }) },
            { id: 'after-end', data: () => ({ date: '2026-08-11T05:00:00.000Z' }) },
        ] });

        await expect(getCompleteHistoryRange('test-user', { range: '1M', endDate: '2026-08-10' })).resolves.toMatchObject([
            { id: 'literal-start' }, { id: 'local-start' }, { id: 'literal-end' }, { id: 'local-end' },
        ]);
        expect(firestore.where).toHaveBeenNthCalledWith(1, 'date', '>=', '2026-07-10');
        expect(firestore.where).toHaveBeenNthCalledWith(2, 'date', '<=', '2026-08-11T04:59:59.999Z');
        firestore.where.mockClear(); firestore.getDocs.mockResolvedValue({ docs: [] });
        await getCompleteHistoryRange('test-user', { range: '1M', endDate: '2024-03-31' });
        expect(firestore.where).toHaveBeenCalledWith('date', '>=', '2024-02-29');
    });

    it('widens the lower bound for east-of-UTC local start dates', async () => {
        if (!isLocalRangeChild) return runLocalRangeChild('Pacific/Kiritimati', 'widens the lower bound');
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Kiritimati');
        firestore.collection.mockReturnValue({ path: 'history' });
        firestore.where.mockImplementation((field, operator, value) => ({ field, operator, value }));
        firestore.orderBy.mockImplementation((field, direction) => ({ field, direction }));
        firestore.documentId.mockReturnValue('DOCUMENT_ID');
        firestore.query.mockReturnValue({ complete: true });
        firestore.getDocs.mockResolvedValue({ docs: [
            { id: 'local-start', data: () => ({ date: '2026-07-09T10:00:00.000Z' }) },
            { id: 'literal-start', data: () => ({ date: '2026-07-10' }) },
        ] });

        await expect(getCompleteHistoryRange('test-user', { range: '1M', endDate: '2026-08-10' })).resolves.toMatchObject([
            { id: 'local-start' }, { id: 'literal-start' },
        ]);
        expect(firestore.where).toHaveBeenNthCalledWith(1, 'date', '>=', '2026-07-09T10:00:00.000Z');
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

    it('keeps A6 stable-ID operations separate from the legacy writer', async () => {
        const candidate = { id: '123e4567-e89b-42d3-a456-426614174000', schemaVersion: 4 };
        const ref = { path: 'users/test-user/history/123e4567-e89b-42d3-a456-426614174000' };
        firestore.doc.mockReturnValue(ref);
        firestore.getDocFromServer.mockResolvedValue({ exists: () => false });

        await saveImmutableWorkout('test-user', candidate.id, candidate);
        await expect(readImmutableWorkoutFromServer('test-user', candidate.id)).resolves.toEqual({ exists: expect.any(Function) });

        expect(firestore.doc).toHaveBeenNthCalledWith(1, { name: 'test-db' }, 'users', 'test-user', 'history', candidate.id);
        expect(firestore.setDoc).toHaveBeenCalledWith(ref, candidate);
        expect(firestore.getDocFromServer).toHaveBeenCalledWith(ref);
        expect(firestore.addDoc).not.toHaveBeenCalled();
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
