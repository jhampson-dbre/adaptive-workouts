# Adaptive Workouts

Adaptive Workouts is the repository for **Nudge**, a private React app that plans and
records adaptive hypertrophy workouts. It builds each session from the trainee's
available time, recovery constraints, exercise catalog, settings, and recent workout
history.

## What the app does

- Plans a complete warmup, main workout, and cooldown within the selected session time.
- Generates a reviewable workout with reorderable exercises and reusable order
  preferences.
- Guides an active workout with set targets, work/rest timers, early-finish handling,
  interruption recovery, and a factual review before saving.
- Keeps a paged workout history with session, phase, exercise, and set details.
- Provides catalog-first Settings for finding, adding, editing, deactivating, and
  reactivating exercises, plus general defaults and guided superset setup.

Production access uses Google sign-in plus an owner-managed `approved: true` Firebase
Auth claim. Firestore rules isolate every user's settings, catalog, active workout, and
history under their own account.

## Stack

- React 19 and Vite 8
- Firebase Authentication and Firestore
- Vite PWA support
- Vitest, Testing Library, and oxlint
- Firebase Emulator Suite for deterministic local development and rules validation

## Local development

Prerequisites:

- Node.js 24
- Java 21 when running Firestore emulator or rules checks

Install dependencies:

```bash
npm install
```

For the quickest deterministic start, run the popup-free seeded environment:

```bash
npm run dev:baseline
```

Open `http://localhost:5174`. Each launch resets to a synthetic approved user, a known
exercise catalog, default settings, and empty history. It never reads or writes
production Firebase data.

For normal emulator development, run these in separate terminals:

```bash
npm run emulators
npm run dev
```

The emulator profiles, scratch data, history scenarios, private-access scenarios, and
recovery steps are documented in [Deterministic Emulator Workflows](docs/emulator-baseline.md).

## Production configuration

Copy `.env.example` to `.env.local` and provide the Firebase web-app values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Development builds use demo fallbacks and connect to local emulators. Production builds
require real Firebase configuration. Owner approval and revocation procedures are in
[Private access operations](docs/private-access-operations.md).

## Quality gates

Run the complete local gate:

```bash
npm run ci:check
```

It runs tests, warning-free lint, the production build and bundle budget, Firestore
rules tests, the UX workflow contract, and the agent-model contract. Individual commands
are also available:

| Command | Purpose |
| --- | --- |
| `npm run ci:test` | Run the Vitest suite once |
| `npm run ci:lint` | Run oxlint with warnings denied |
| `npm run ci:build` | Build production assets and check the bundle budget |
| `npm run ci:rules` | Validate Firestore isolation against the emulator |
| `npm run ci:workflow` | Validate the repository UX-quality workflow |
| `npm run ci:agent-models` | Validate agent model configuration |

Pull requests and pushes to `main` run `app-quality` and `firestore-rules` jobs in
GitHub Actions. CI does not require production Firebase or Vercel secrets.

## Repository map

- `src/App.jsx` — authentication gate, destination shell, and cross-screen state
- `src/components/Generator.jsx` — Plan and workout generation
- `src/components/WorkoutView.jsx` — Workout ready, active workout, Review, and receipt
- `src/components/WorkoutHistory.jsx` — saved workout history
- `src/components/Settings.jsx` — defaults, supersets, and exercise catalog
- `src/utils/engine.js` — adaptive workout selection and ordering
- `src/utils/activeWorkoutSession.js` — durable workout lifecycle
- `src/utils/storage.js` — Firestore persistence
- `firestore.rules` — per-user data isolation
- `src/tests/` — component, domain, integration, accessibility, and regression tests

Architecture, deployment, and PWA notes are collected in
[Project Context](docs/project-context.md).
