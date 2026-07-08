# Project Context

Adaptive Workouts is a React/Vite app for generating adaptive hypertrophy workouts. It is deployed to Vercel and uses Firebase Auth plus Firestore for production persistence.

## Architecture

- React app entry: `src/main.jsx`
- Main app shell and auth gate: `src/App.jsx`
- Google sign-in UI: `src/components/Login.jsx`
- Workout generation UI: `src/components/Generator.jsx`
- Settings and exercise catalog UI: `src/components/Settings.jsx`
- History and workout saving UI: `src/components/WorkoutView.jsx`
- Workout generation logic: `src/utils/engine.js`
- Firestore storage layer: `src/utils/storage.js`
- Firebase initialization: `src/utils/firebase.js`

## Firebase

Production configuration is supplied through Vite environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Local development uses demo fallbacks in `src/utils/firebase.js` and connects to emulators when `import.meta.env.DEV` is true.

Run emulators with:

```bash
npm run emulators
```

Firestore rules live in `firestore.rules` and restrict each signed-in user to their own `users/{uid}/...` documents.

When deploying to a new domain, add that domain in Firebase Console under Authentication authorized domains. For Vercel, the domain should look like:

```text
adaptive-workouts.vercel.app
```

## Deployment

Production is deployed on Vercel from GitHub.

Expected Vercel settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Production environment variables: all `VITE_FIREBASE_*` values from `.env.example`

Production verification checklist:

- Deployed site loads.
- Google sign-in succeeds.
- Firestore-backed catalog edits save and reload.
- Workout generation works.
- `/manifest.webmanifest` loads.
- `/sw.js` loads.
- `/registerSW.js` loads.

## PWA

PWA support is configured in `vite.config.js` with `vite-plugin-pwa`.

Important assets:

- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/favicon.svg`

The production build should emit:

- `dist/manifest.webmanifest`
- `dist/registerSW.js`
- `dist/sw.js`

## Tests And Quality

Useful commands:

```bash
npm test -- --run
npm run build
npm run lint
```

Tests live under `src/tests/`.

When changing workout logic, prioritize engine tests. When changing storage or auth behavior, check storage tests and production/emulator implications. When changing deployment or PWA behavior, verify `npm run build` output.

## Trekker Map

Trekker is the project tracking system.

Recent completed deployment work:

- `EPIC-1`: Mobile PWA Deployment
- `TREK-2`: Generate App Icons
- `TREK-3`: Install and Configure vite-plugin-pwa
- `TREK-49`: Setup Production Firebase Project
- `TREK-4`: Push to GitHub and Deploy

Current next ready work is in `EPIC-2`, beginning with:

- `TREK-5`: Update Storage Defaults & Migration

