import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitestPackageJson = require.resolve('vitest/package.json');
const vitestBin = path.join(path.dirname(vitestPackageJson), 'vitest.mjs');

const result = spawnSync(process.execPath, [vitestBin, 'run', 'src/tests/firestore.rules.test.js'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
