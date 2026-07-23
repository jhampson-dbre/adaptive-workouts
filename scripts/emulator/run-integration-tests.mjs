import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BASELINE_USER_ID } from './fixtures/baseline.mjs';
import { spawnOwnedProcess, startEmulatorStack, waitForOwnedChild } from './lifecycle.mjs';
import { withAdminEmulators } from './seed-baseline.mjs';
import { replaceScenarioHistory } from './scenarios/load.mjs';
import { buildScenario, scenarioDefinitions } from './scenarios/index.mjs';

const configPath = path.resolve('firebase.emulator-test.json');
const projectId = 'demo-project';
const totalStartedAt = Date.now();

const runFocusedIntegration = async (hosts, testFile, label) => {
  const child = spawnOwnedProcess(process.execPath, [
    path.resolve('node_modules/vitest/vitest.mjs'),
    'run',
    testFile,
    '--fileParallelism=false',
    '--testTimeout=30000',
    '--hookTimeout=30000',
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EMULATOR_BASELINE_INTEGRATION: '1',
      FIREBASE_AUTH_EMULATOR_HOST: hosts.auth,
      FIRESTORE_EMULATOR_HOST: hosts.firestore,
    },
    stdio: 'inherit',
  });
  await waitForOwnedChild(child, {
    label,
    timeoutMs: 60_000,
  });
};

const verifyScratchLifecycle = async scratchDirectory => {
  let stack;
  const firstStartedAt = Date.now();
  try {
    stack = await startEmulatorStack({ configPath, profile: 'scratch', scratchDirectory });
    if (stack.importedScratch) throw new Error('Missing scratch directory was unexpectedly imported');
    for (const name of Object.keys(scenarioDefinitions)) {
      const expected = buildScenario(name, '2026-07-18');
      await replaceScenarioHistory({ name, referenceDate: '2026-07-18', hosts: stack.hosts, profile: 'scratch' });
      await replaceScenarioHistory({ name, referenceDate: '2026-07-18', hosts: stack.hosts, profile: 'scratch' });
      await withAdminEmulators({ projectId, hosts: stack.hosts }, async ({ firestore }) => {
        const history = await firestore.collection(`users/${BASELINE_USER_ID}/history`).get();
        const actualIds = history.docs.map(document => document.id).sort();
        const expectedIds = expected.documents.map(document => document.id).sort();
        if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new Error(`Scenario ${name} was not loaded idempotently`);
      });
    }
    await replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: stack.hosts, profile: 'scratch' });
    await withAdminEmulators({ projectId, hosts: stack.hosts }, async ({ firestore }) => {
      const [user, history, catalog] = await Promise.all([
        firestore.doc(`users/${BASELINE_USER_ID}`).get(),
        firestore.collection(`users/${BASELINE_USER_ID}/history`).get(),
        firestore.collection(`users/${BASELINE_USER_ID}/catalog`).get(),
      ]);
      if (history.size !== 3 || catalog.size !== 15 || user.data()?.warmupTime !== 10) throw new Error('Scenario loader did not atomically replace history while preserving settings and catalog');
    });
    await replaceScenarioHistory({
      name: 'weighted-progression', referenceDate: '2026-07-19', hosts: stack.hosts, profile: 'scratch',
    });
    await withAdminEmulators({ projectId, hosts: stack.hosts }, async ({ firestore }) => {
      const shifted = await firestore.doc(`users/${BASELINE_USER_ID}/history/scenario-weighted-increase`).get();
      if (shifted.data()?.date !== new Date(2026, 6, 9, 12).toISOString()) throw new Error('Scenario reference-date shift was not idempotent');
    });
    await withAdminEmulators({ projectId, hosts: stack.hosts }, async ({ firestore }) => {
      await firestore.doc(`users/${BASELINE_USER_ID}/history/scratch-persistence-probe`).set({ persisted: true });
    });
    await stack.stop();
    stack = undefined;
    console.log(`[integration] scratch initialization/export passed in ${Date.now() - firstStartedAt}ms`);

    const restartStartedAt = Date.now();
    stack = await startEmulatorStack({ configPath, profile: 'scratch', scratchDirectory });
    if (!stack.importedScratch) throw new Error('Existing scratch directory was not imported');
    await withAdminEmulators({ projectId, hosts: stack.hosts }, async ({ firestore }) => {
      const persisted = await firestore.doc(`users/${BASELINE_USER_ID}/history/scratch-persistence-probe`).get();
      if (!persisted.exists || persisted.data()?.persisted !== true) throw new Error('Scratch mutation did not persist across clean restart');
    });
    await stack.stop();
    stack = undefined;
    console.log(`[integration] scratch mutation persistence passed in ${Date.now() - restartStartedAt}ms`);

    const metadataPath = path.join(scratchDirectory, 'firebase-export-metadata.json');
    const validMetadata = await readFile(metadataPath, 'utf8');
    await writeFile(metadataPath, '{corrupt', 'utf8');
    const corruptStartedAt = Date.now();
    let corruptFailure;
    try {
      await startEmulatorStack({ configPath, profile: 'scratch', scratchDirectory });
    } catch (error) {
      corruptFailure = error;
    }
    await writeFile(metadataPath, validMetadata, 'utf8');
    if (!corruptFailure?.message.includes('scratch export is unreadable or corrupt')) {
      throw new Error('Corrupt scratch import did not fail visibly');
    }
    console.log(`[integration] corrupt scratch refusal passed in ${Date.now() - corruptStartedAt}ms`);
  } finally {
    await stack?.stop({ exportScratch: false });
  }
};

export async function runIntegrationTests() {
  let canonicalStack;
  const scratchRoot = await mkdtemp(path.join(os.tmpdir(), 'adaptive-workouts-scratch-integration-'));
  const scratchDirectory = path.join(scratchRoot, 'state');
  let runError;
  try {
    const canonicalStartedAt = Date.now();
    canonicalStack = await startEmulatorStack({
      configPath,
      profile: 'canonical',
      seedProfile: 'test',
    });
    console.log(`[integration] canonical startup/seed/verification passed in ${Date.now() - canonicalStartedAt}ms`);
    await runFocusedIntegration(canonicalStack.hosts, 'src/tests/emulatorBaseline.integration.test.js', 'Baseline emulator integration');
    await runFocusedIntegration(canonicalStack.hosts, 'src/tests/immutableWorkoutSave.integration.test.js', 'Immutable-save integration');
    await runFocusedIntegration(canonicalStack.hosts, 'src/tests/firestore.rules.test.js', 'Firestore rules suite');
    console.log(`[integration] baseline, immutable-save, and rules suites passed in ${Date.now() - canonicalStartedAt}ms`);
    await canonicalStack.stop();
    canonicalStack = undefined;

    await verifyScratchLifecycle(scratchDirectory);
    console.log(`[integration] all emulator baseline scenarios passed in ${Date.now() - totalStartedAt}ms`);
  } catch (error) {
    runError = error;
  }

  let cleanupError;
  try {
    await cleanupIntegrationResources({ canonicalStack, scratchRoot });
  } catch (error) {
    cleanupError = error;
  }
  if (runError && cleanupError && runError !== cleanupError) {
    throw new AggregateError([runError, cleanupError], `${runError.message}; integration cleanup failed: ${cleanupError.message}`);
  }
  if (runError) throw runError;
  if (cleanupError) throw cleanupError;
}

export async function cleanupIntegrationResources({ canonicalStack, scratchRoot, remove = rm }) {
  const errors = [];
  try {
    await canonicalStack?.stop({ exportScratch: false });
  } catch (error) {
    errors.push(error);
  }
  try {
    await remove(scratchRoot, { recursive: true, force: true });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Integration cleanup encountered multiple failures');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runIntegrationTests();
