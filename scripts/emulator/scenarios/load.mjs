import { pathToFileURL } from 'node:url';

import { BASELINE_PROJECT_ID, BASELINE_USER_ID } from '../fixtures/baseline.mjs';
import { withAdminEmulators } from '../seed-baseline.mjs';
import { buildScenario, MAX_SCENARIO_DOCUMENTS } from './index.mjs';

const maxExistingFor = scenarioCount => 451 - scenarioCount;
const allowedProfiles = new Set(['scratch', 'test']);
const resetGuidance = ' Reset scratch state (`npm run emulators:scratch` with a fresh scratch export) and retry.';

export const mapScenarioFailure = error => {
  const code = error?.code ?? error?.cause?.code;
  const message = error?.message ?? String(error);
  if (['RESOURCE_EXHAUSTED', 'DEADLINE_EXCEEDED', 'ABORTED'].includes(code)
    || /resource exhausted|request.*(?:size|too large)|deadline|timed out|transaction.*(?:retry|aborted)/i.test(message)) {
    return new Error(`Scenario transaction could not complete (${code ?? message}).${resetGuidance}`, { cause: error });
  }
  return error;
};

export async function replaceScenarioHistory({ name, referenceDate, hosts, projectId = BASELINE_PROJECT_ID, profile = 'scratch', userId = BASELINE_USER_ID, withAdmin = withAdminEmulators }) {
  if (!allowedProfiles.has(profile)) {
    throw new Error('Scenario loading refuses the canonical profile; use an approved scratch or test profile.');
  }
  const scenario = buildScenario(name, referenceDate);
  if (scenario.documents.length > MAX_SCENARIO_DOCUMENTS) throw new Error(`Scenario contains ${scenario.documents.length} documents; maximum is ${MAX_SCENARIO_DOCUMENTS}.`);
  const queryLimit = maxExistingFor(scenario.documents.length);
  if (queryLimit < 1) throw new Error('Scenario request exceeds the safe 450-document transaction limit.');
  try { await withAdmin({ projectId, hosts }, async ({ firestore }) => {
    const userRef = firestore.doc(`users/${userId}`);
    await firestore.runTransaction(async transaction => {
      const user = await transaction.get(userRef);
      if (!user.exists || !allowedProfiles.has(user.data()?.emulatorProfile)) throw new Error('Scenario loading requires an existing scratch or test profile user. Reset scratch state and retry.');
      const history = userRef.collection('history');
      const existing = await transaction.get(history.limit(queryLimit));
      if (existing.size === queryLimit) throw new Error(`Existing history reaches the conservative bound (${queryLimit}); scenario was not changed. Reset scratch state before retrying.`);
      if (existing.size + scenario.documents.length > MAX_SCENARIO_DOCUMENTS) throw new Error(`Existing history plus scenario exceeds ${MAX_SCENARIO_DOCUMENTS}; scenario was not changed. Reset scratch state before retrying.`);
      const desiredIds = new Set(scenario.documents.map(item => item.id));
      for (const item of existing.docs) if (!desiredIds.has(item.id)) transaction.delete(item.ref);
      for (const item of scenario.documents) {
        const { id, ...data } = item;
        transaction.set(history.doc(id), data);
      }
    });
  }); } catch (error) { throw mapScenarioFailure(error); }
  return scenario;
}

const parseArgs = args => {
  const [name, ...rest] = args;
  let referenceDate;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--reference-date') throw new Error(`Unknown argument ${rest[index]}`);
    referenceDate = rest[++index];
  }
  if (!name || !referenceDate) throw new Error('Usage: npm run emulators:scenario -- <stable-scenario> --reference-date YYYY-MM-DD');
  return { name, referenceDate };
};

export async function main(args = process.argv.slice(2)) {
  const { name, referenceDate } = parseArgs(args);
  const hosts = { auth: process.env.FIREBASE_AUTH_EMULATOR_HOST, firestore: process.env.FIRESTORE_EMULATOR_HOST };
  if (!hosts.auth || !hosts.firestore) throw new Error('Set FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST from an owned scratch emulator session.');
  const scenario = await replaceScenarioHistory({ name, referenceDate, hosts });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localNoon = new Date(`${referenceDate}T12:00:00`).toISOString();
  console.log(`Loaded ${scenario.name} (${scenario.documents.length} documents); timezone=${timezone}; reference-date=${referenceDate}; local-noon=${localNoon}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
