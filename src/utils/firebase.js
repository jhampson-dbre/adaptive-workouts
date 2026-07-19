import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache } from 'firebase/firestore';
import { createAuthForMode } from './firebaseMode';

export const isBaselineBuild = import.meta.env.DEV && import.meta.env.MODE === 'baseline';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "123"
};

const app = initializeApp(firebaseConfig);
const auth = createAuthForMode(app, isBaselineBuild, { initializeAuth, getAuth, inMemoryPersistence });
const db = initializeFirestore(app, {
  localCache: isBaselineBuild ? memoryLocalCache() : persistentLocalCache()
});

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export { auth, db };
