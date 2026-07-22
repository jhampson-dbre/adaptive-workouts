import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { createAuthForMode, parseEmulatorHost } from './firebaseMode';

export const isBaselineBuild = import.meta.env.DEV && import.meta.env.MODE === 'baseline';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '123',
});

export const auth = createAuthForMode(app, isBaselineBuild, { initializeAuth, getAuth, inMemoryPersistence });

if (import.meta.env.DEV) {
  const authHost = parseEmulatorHost(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  connectAuthEmulator(auth, `http://${authHost.value}`);
}

export { app };
