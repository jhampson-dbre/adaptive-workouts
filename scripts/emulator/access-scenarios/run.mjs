import os from 'node:os'; import path from 'node:path'; import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'; import { randomUUID } from 'node:crypto';
import { spawnOwnedProcess, startEmulatorStack, terminateProcessTree } from '../lifecycle.mjs'; import { accessScenarioManifest } from './manifest.mjs'; import { preflightAccessScenario } from './preflight.mjs'; import { createControlServer } from './control-server.mjs'; import { stageAccessAction } from './driver.mjs'; import { applyScenarioAction, stageScenarioStart } from './staging.mjs';

const registry = id => path.join(os.tmpdir(), `private-access-${id}.json`);
const parse = args => Object.fromEntries(args.reduce((out, value, index) => value.startsWith('--') ? [...out, [value.slice(2), args[index + 1]]] : out, []));
const waitForListening = server => new Promise((resolve, reject) => {
  const cleanup = () => { server.off('listening', onListening); server.off('error', onError); };
  const onListening = () => { cleanup(); resolve(); };
  const onError = error => { cleanup(); reject(error); };
  server.once('listening', onListening); server.once('error', onError);
});
const closeServer = server => new Promise((resolve, reject) => {
  try { server.close(error => error ? reject(error) : resolve()); } catch (error) { reject(error); }
});
export async function runPrivateAccessScenario({ scenario, viewport, deps = {} }) {
  const start = deps.startEmulatorStack ?? startEmulatorStack; const spawn = deps.spawn ?? spawnOwnedProcess; const temp = deps.mkdtemp ?? mkdtemp; const remove = deps.rm ?? rm; const write = deps.writeFile ?? writeFile; const createServer = deps.createControlServer ?? createControlServer; const makeSession = deps.randomUUID ?? randomUUID; const terminate = deps.terminateProcessTree ?? terminateProcessTree; const registryPath = deps.registry ?? registry; const stageStart = deps.stageScenarioStart ?? stageScenarioStart; const applyAction = deps.applyScenarioAction ?? applyScenarioAction;
  const preflight = preflightAccessScenario({ scenario, manifest: accessScenarioManifest }); const temporaryRoot = await temp(path.join(os.tmpdir(), 'private-access-')); const scratchDirectory = path.join(temporaryRoot, 'scratch'); const session = makeSession();
  let stack; let server; let vite; let registryFile; let stopPromise;
  const cleanup = async ({ removeRegistry = false } = {}) => {
    const errors = [];
    const attempt = async operation => { try { await operation(); } catch (error) { errors.push(error); } };
    if (vite) await attempt(() => terminate(vite));
    if (server) await attempt(() => closeServer(server));
    if (stack) await attempt(() => stack.stop({ exportScratch: false }));
    await attempt(() => remove(temporaryRoot, { recursive: true, force: true }));
    if (removeRegistry && registryFile) await attempt(() => remove(registryFile, { force: true }));
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Private access scenario cleanup failed');
  };
  try {
    stack = await start({ configPath: 'firebase.emulator-test.json', projectId: 'demo-project', profile: 'scratch', seedProfile: 'test', scratchDirectory });
    const stagedIdentity = await stageStart({ scenario: accessScenarioManifest.scenarios[scenario], projectId: 'demo-project', hosts: stack.hosts });
    let requestStop; const stopped = new Promise(resolve => { requestStop = resolve; });
    server = createServer({ sessionId: session, onAction: async ({ action }) => { stageAccessAction({ manifest: accessScenarioManifest, scenario, action }); return applyAction({ action, projectId: 'demo-project', hosts: stack.hosts }); }, onStop: requestStop });
    await waitForListening(server);
    const controlPort = server.address().port; const controlUrl = `http://127.0.0.1:${controlPort}/sessions/${session}`;
    vite = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5175', '--strictPort', '--mode', 'baseline'], { cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, VITE_FIREBASE_AUTH_EMULATOR_HOST: stack.hosts.auth, VITE_FIRESTORE_EMULATOR_HOST: stack.hosts.firestore, VITE_ACCESS_SCENARIO_CONTROL_SESSION: session, VITE_ACCESS_SCENARIO_CONTROL_URL: controlUrl } });
    const metadata = { ...preflight, stagedIdentity, session, viewport, url: 'http://127.0.0.1:5175', ports: { vite: 5175, control: controlPort }, hosts: stack.hosts, artifactRevision: accessScenarioManifest.artifactRevision, fixtureRevision: accessScenarioManifest.fixtureRevision, authRevision: accessScenarioManifest.authRevision };
    registryFile = registryPath(session); await write(registryFile, JSON.stringify({ ...metadata, controlUrl }));
    return { ...metadata, stopped, stop() { stopPromise ??= cleanup({ removeRegistry: true }); return stopPromise; } };
  } catch (error) {
    try { await cleanup({ removeRegistry: true }); } catch (cleanupError) { throw new AggregateError([error, cleanupError], `${error.message}; startup cleanup failed: ${cleanupError.message}`); }
    throw error;
  }
}
export async function stagePrivateAccessScenario({ session, action }) { const saved = JSON.parse(await readFile(registry(session), 'utf8')); stageAccessAction({ manifest: accessScenarioManifest, scenario: saved.scenario, action }); const response = await fetch(saved.controlUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }); if (!response.ok) throw new Error('Scenario control rejected action'); return response.json(); }
export async function stopPrivateAccessScenario(session) { const saved = JSON.parse(await readFile(registry(session), 'utf8')); await fetch(`${saved.controlUrl}/stop`, { method: 'POST' }); }
if (process.argv[1]?.endsWith('run.mjs')) { const [command, ...args] = process.argv.slice(2); const options = parse(args); if (command === 'stage') console.log(JSON.stringify(await stagePrivateAccessScenario({ session: options.session, action: options.action }))); else if (command === 'stop') await stopPrivateAccessScenario(options.session); else if (command === 'start') { const run = await runPrivateAccessScenario({ scenario: options.scenario, viewport: options.viewport }); console.log(JSON.stringify({ ...run, stopped: undefined })); await Promise.race([run.stopped, new Promise(resolve => process.once('SIGINT', resolve))]); await run.stop(); } else throw new Error('Expected start, stage, or stop'); }
