import { normalizeCatalogExercise, normalizeWorkoutSettings, normalizePreferredOrderRules, preferredOrderContextKey, preferredOrderRuleFingerprint } from './workoutSchema';
import { visibleCalendarDate } from './historyDate';

const loadFirestore = () => import('./firestoreClient').then(({ loadFirestoreClient }) => loadFirestoreClient());

function historyDocumentToEntry(historyDoc) {
  return { ...historyDoc.data(), id: historyDoc.id };
}

const DEFAULT_CATALOG = [
    { id: '1', name: 'Barbell Curl', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: '2', name: 'Overhead Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
    { id: '3', name: 'Bench Press', muscleGroup: 'Chest', tier: 3, sets: 3 },
    { id: '4', name: 'Pull Up', muscleGroup: 'Back', tier: 3, sets: 3 },
    { id: '5', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 3 },
    { id: '6', name: 'Squat', muscleGroup: 'Legs', tier: 4, sets: 3 }
];

export async function migrateLocalData(userId) {
  const { db, doc, getDoc, setDoc, collection, addDoc } = await loadFirestore();
  const localHistoryStr = localStorage.getItem('adaptive-history');
  const localSettingsStr = localStorage.getItem('adaptive-settings');
  const localCatalogStr = localStorage.getItem('adaptive-catalog');

  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    let settings;
    try { settings = localSettingsStr ? JSON.parse(localSettingsStr) : null; } catch { settings = null; }
    settings = normalizeWorkoutSettings(settings ?? { staleThreshold: 5, legDayOfWeek: 'None' });
    await setDoc(userDocRef, settings);
    
    let catalog;
    try { catalog = localCatalogStr ? JSON.parse(localCatalogStr) : null; } catch { catalog = null; }
    catalog = catalog ?? DEFAULT_CATALOG;
    const catalogRef = collection(db, 'users', userId, 'catalog');
    for (const item of catalog) {
       await setDoc(doc(catalogRef, item.id), item);
    }
    
    if (localHistoryStr) {
      let history;
      try { history = JSON.parse(localHistoryStr); } catch { history = []; }
      const historyRef = collection(db, 'users', userId, 'history');
      for (const workout of history) {
         await addDoc(historyRef, workout);
      }
    }
    
    // Only remove localStorage after all writes succeed
    localStorage.removeItem('adaptive-history');
    localStorage.removeItem('adaptive-settings');
    localStorage.removeItem('adaptive-catalog');
  }
}

export async function getSettings(userId) {
  const { db, doc, getDoc } = await loadFirestore();
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return normalizeWorkoutSettings(docSnap.exists()
    ? docSnap.data()
    : { warmupTime: 10, staleThreshold: 5, legDayOfWeek: 'None' });
}

export async function saveSettings(userId, settings) {
  const { db, doc, setDoc } = await loadFirestore();
  await setDoc(doc(db, 'users', userId), settings, { merge: true });
}

export async function savePreferredOrderRule(userId, candidate) {
  const { db, doc, runTransaction } = await loadFirestore();
  return runTransaction(db, async transaction => {
    const ref = doc(db, 'users', userId); const current = (await transaction.get(ref)).data() ?? {};
    const normalized = normalizePreferredOrderRules(current); const key = preferredOrderContextKey(candidate);
    const rules = [candidate, ...normalized.preferredOrderRules.filter(rule => preferredOrderContextKey(rule) !== key)];
    const usage = [key, ...normalized.preferredOrderRuleUsage.filter(value => value !== key)];
    const next = normalizePreferredOrderRules({ preferredOrderRules: rules, preferredOrderRuleUsage: usage });
    const evicted = normalized.preferredOrderRuleUsage.find(value => !next.preferredOrderRuleUsage.includes(value)) ?? null;
    const candidateIds = new Set(JSON.parse(key));
    const overridden = next.preferredOrderRules.filter(rule => {
      const ids = JSON.parse(preferredOrderContextKey(rule));
      return preferredOrderContextKey(rule) !== key && ids.length < candidateIds.size && ids.every(id => candidateIds.has(id));
    }).map(rule => ({ contextKey: preferredOrderContextKey(rule), rule }));
    transaction.set(ref, next, { merge: true }); return { evicted, overridden, contextKey: key, fingerprint: preferredOrderRuleFingerprint(candidate) };
  });
}

export async function clearPreferredOrderRules(userId) {
  const { db, doc, runTransaction } = await loadFirestore();
  return runTransaction(db, async transaction => transaction.set(doc(db, 'users', userId), { preferredOrderRules: [], preferredOrderRuleUsage: [] }, { merge: true }));
}

export async function touchPreferredOrderRuleUsage(userId, acceptedRules) {
  if (!Array.isArray(acceptedRules) || !acceptedRules.length) return;
  const { db, doc, runTransaction } = await loadFirestore();
  return runTransaction(db, async transaction => {
    const ref = doc(db, 'users', userId); const current = (await transaction.get(ref)).data() ?? {};
    const normalized = normalizePreferredOrderRules(current);
    const matching = acceptedRules.filter(({ contextKey, fingerprint }) => normalized.preferredOrderRules.some(rule =>
      preferredOrderContextKey(rule) === contextKey && preferredOrderRuleFingerprint(rule) === fingerprint,
    ));
    const keys = matching.map(rule => rule.contextKey);
    const usage = [...keys, ...normalized.preferredOrderRuleUsage.filter(key => !keys.includes(key))];
    if (usage.every((key, index) => key === normalized.preferredOrderRuleUsage[index])) return;
    transaction.set(ref, { preferredOrderRuleUsage: usage }, { merge: true });
  });
}

export async function saveSettingsAndCatalogItem(userId, settings, item) {
  const { db, doc, writeBatch } = await loadFirestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId), settings, { merge: true });
  batch.set(doc(db, 'users', userId, 'catalog', item.id), item);
  await batch.commit();
}

export async function getGenerationHistory(userId) {
  const { db, collection, getDocs, query, orderBy, limit } = await loadFirestore();
  const colRef = collection(db, 'users', userId, 'history');
  const historyQuery = query(colRef, orderBy('date', 'desc'), limit(100));
  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map(historyDocumentToEntry);
}

export async function getHistoryPage(userId, { cursor = null, pageSize = 20 } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('History page size must be an integer from 1 to 100.');
  }
  const { db, collection, getDocs, query, orderBy, limit, startAfter, documentId } = await loadFirestore();
  const colRef = collection(db, 'users', userId, 'history');
  const constraints = [
    orderBy('date', 'desc'),
    orderBy(documentId(), 'desc'),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const snapshot = await getDocs(query(colRef, ...constraints));
  const docs = snapshot.docs;
  const displayedDocs = docs.slice(0, pageSize);
  return {
    items: displayedDocs.map(historyDocumentToEntry),
    nextCursor: displayedDocs.at(-1) ?? null,
    hasMore: docs.length > pageSize,
  };
}

const RANGE_MONTHS = Object.freeze({ '1M': 1, '3M': 3, '6M': 6, '1Y': 12 });

function completeCalendarRange({ range, endDate }) {
  const months = RANGE_MONTHS[range];
  if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(endDate ?? '')) throw new RangeError('Range must be 1M, 3M, 6M, or 1Y with a calendar end date.');
  const [year, month, day] = endDate.split('-').map(Number); const end = new Date(year, month - 1, day);
  if (end.getFullYear() !== year || end.getMonth() !== month - 1 || end.getDate() !== day) throw new RangeError('End date must be a valid calendar date.');
  const start = new Date(year, month - 1, 1); start.setMonth(start.getMonth() - months);
  start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  const startDate = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-');
  const startOfDay = start.toISOString();
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { startDate, start: startDate < startOfDay ? startDate : startOfDay, end: endOfDay.toISOString(), endDate };
}

export async function getCompleteHistoryRange(userId, options) {
  const { startDate, start, end, endDate } = completeCalendarRange(options ?? {});
  const { db, collection, getDocs, query, where, orderBy, documentId } = await loadFirestore();
  const colRef = collection(db, 'users', userId, 'history');
  const snapshot = await getDocs(query(colRef,
    where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'), orderBy(documentId(), 'asc'),
  ));
  return snapshot.docs.map(historyDocumentToEntry).filter(entry => {
    const date = visibleCalendarDate(entry.date);
    return date !== null && date >= startDate && date <= endDate;
  });
}

export async function saveWorkout(userId, workout) {
  const { db, collection, addDoc } = await loadFirestore();
  const colRef = collection(db, 'users', userId, 'history');
  await addDoc(colRef, workout);
}

/** A8's production immutable-write path for completed workout history. */
export async function saveImmutableWorkout(userId, workoutId, candidate) {
  const { db, doc, setDoc } = await loadFirestore();
  const historyRef = doc(db, 'users', userId, 'history', workoutId);
  await setDoc(historyRef, candidate);
}

export async function readImmutableWorkoutFromServer(userId, workoutId) {
  const { db, doc, getDocFromServer } = await loadFirestore();
  return getDocFromServer(doc(db, 'users', userId, 'history', workoutId));
}

export async function getCatalog(userId) {
  const { db, collection, getDocs } = await loadFirestore();
  const colRef = collection(db, 'users', userId, 'catalog');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => normalizeCatalogExercise({ ...doc.data(), id: doc.id }));
}

export async function saveCatalogItem(userId, item) {
  const { db, doc, setDoc } = await loadFirestore();
  const itemRef = doc(db, 'users', userId, 'catalog', item.id);
  await setDoc(itemRef, item);
}
