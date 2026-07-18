# Adaptive Workouts

Adaptive Workouts is a React/Vite app for generating adaptive hypertrophy workouts. It uses Firebase Auth and Firestore for production persistence, with local Firebase emulator support for rules validation.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

For deterministic Firebase emulator profiles, popup-free baseline mode, dynamic
history scenarios, and recovery guidance, see
[docs/emulator-baseline.md](docs/emulator-baseline.md).

## Quality Gates

Pull requests and pushes to `main` run two GitHub Actions jobs:

- `app-quality`: unit tests, warning-free lint, and production build.
- `firestore-rules`: behavioral Firestore security rules validation against the emulator.

Run the same full gate locally before opening a PR:

```bash
npm run ci:check
```

The app-quality scripts are also available individually:

```bash
npm run ci:test
npm run ci:lint
npm run ci:build
```

Firestore rules validation starts the Firestore emulator with the demo project and does not require production Firebase or Vercel secrets:

```bash
npm run ci:rules
```
