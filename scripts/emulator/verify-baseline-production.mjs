import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const markers = [
  'peach.otter.880@example.com',
  'emulator-baseline-user',
  'google-peach-otter-880',
  'emulator-baseline-v1',
  'emulator-baseline-auth-v1',
  'emulator-baseline-auth-v2',
];

const filesUnder = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }))).flat();
};

export async function verifyBaselineProduction() {
  execFileSync(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build'], { stdio: 'inherit' });
  const files = await filesUnder(path.resolve('dist'));
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const marker = markers.find(value => content.includes(value));
    if (marker) throw new Error(`Production bundle contains baseline marker ${marker} in ${file}`);
  }
  try {
    execFileSync(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', 'baseline'], { stdio: 'pipe' });
  } catch {
    return;
  }
  throw new Error('vite build --mode baseline must be rejected');
}

if (import.meta.url === new URL(`file:${process.argv[1]}`).href) await verifyBaselineProduction();
