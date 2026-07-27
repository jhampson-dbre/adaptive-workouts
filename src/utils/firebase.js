import { app, auth } from './firebaseAuth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache } from 'firebase/firestore';
import { parseEmulatorHost } from './firebaseMode';
const db = initializeFirestore(app, {
  localCache: import.meta.env.DEV && import.meta.env.MODE === 'baseline'
    ? memoryLocalCache()
    : persistentLocalCache()
});

if (import.meta.env.DEV) {
  const firestoreHost = parseEmulatorHost(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  connectFirestoreEmulator(db, firestoreHost.host, firestoreHost.port);
}

export { auth, db };
