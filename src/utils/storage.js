import { doc, getDoc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';

const DEFAULT_CATALOG = [
    { id: '1', name: 'Barbell Curl', muscleGroup: 'Biceps', tier: 1, sets: 3 },
    { id: '2', name: 'Overhead Press', muscleGroup: 'Shoulders', tier: 1, sets: 3 },
    { id: '3', name: 'Bench Press', muscleGroup: 'Chest', tier: 3, sets: 3 },
    { id: '4', name: 'Pull Up', muscleGroup: 'Back', tier: 3, sets: 3 },
    { id: '5', name: 'Plank', muscleGroup: 'Core', tier: 4, sets: 3 },
    { id: '6', name: 'Squat', muscleGroup: 'Legs', tier: 4, sets: 3 }
];

export async function migrateLocalData(userId) {
  const localHistoryStr = localStorage.getItem('adaptive-history');
  const localSettingsStr = localStorage.getItem('adaptive-settings');
  const localCatalogStr = localStorage.getItem('adaptive-catalog');

  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    let settings;
    try { settings = localSettingsStr ? JSON.parse(localSettingsStr) : null; } catch { settings = null; }
    settings = settings ?? { warmupTime: 10, staleThreshold: 5, legDayOfWeek: 'None' };
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
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : { warmupTime: 10, staleThreshold: 5, legDayOfWeek: 'None' };
}

export async function saveSettings(userId, settings) {
  await setDoc(doc(db, 'users', userId), settings, { merge: true });
}

export async function getHistory(userId) {
  const colRef = collection(db, 'users', userId, 'history');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveWorkout(userId, workout) {
  const colRef = collection(db, 'users', userId, 'history');
  await addDoc(colRef, workout);
}

export async function getCatalog(userId) {
  const colRef = collection(db, 'users', userId, 'catalog');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

export async function saveCatalogItem(userId, item) {
  const itemRef = doc(db, 'users', userId, 'catalog', item.id);
  await setDoc(itemRef, item);
}
