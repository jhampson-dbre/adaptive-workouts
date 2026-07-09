import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firebaseToolsBin = require.resolve('firebase-tools/lib/bin/firebase.js');
const configHome = mkdtempSync(path.join(os.tmpdir(), 'adaptive-workouts-firebase-config-'));

const env = {
  ...process.env,
  XDG_CONFIG_HOME: configHome,
};

const result = spawnSync(
  process.execPath,
  [firebaseToolsBin, 'emulators:exec', '--project', 'demo-project', '--only', 'firestore', 'node scripts/run-firestore-rules-tests.mjs'],
  {
    env,
    stdio: 'inherit',
  },
);

rmSync(configHome, { recursive: true, force: true });

process.exit(result.status ?? 1);
