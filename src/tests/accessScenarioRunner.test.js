import { EventEmitter } from 'node:events';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runPrivateAccessScenario } from '../../scripts/emulator/access-scenarios/run.mjs';

describe('private access scenario runner lifecycle', () => {
  it('owns the emulator, baseline Vite server, control session, and scratch cleanup', async () => {
    const writes = []; const removes = []; const terminated = vi.fn(); const stackStop = vi.fn(); const spawn = vi.fn(() => ({ pid: 123, exitCode: null, signalCode: null }));
    const server = new EventEmitter(); server.address = () => ({ port: 4321 }); server.close = done => done();
    const createServer = vi.fn(() => { queueMicrotask(() => server.emit('listening')); return server; });
    const run = await runPrivateAccessScenario({ scenario: 'UX-10-03', viewport: '375x812', slot: 1, deps: {
      mkdtemp: vi.fn(async () => 'C:/temp/private-access-run'), randomUUID: () => 'session-1', writeFile: async (target, contents) => writes.push([target, JSON.parse(contents)]), rm: async (target, options) => removes.push([target, options]), registry: session => `C:/registry/${session}.json`, createControlServer: createServer, spawn, terminateProcessTree: terminated, stageScenarioStart: vi.fn(async options => { expect(options).toMatchObject({ projectId: 'demo-project', hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, scenario: { id: 'UX-10-03', startState: 'approved' } }); return { uid: 'emulator-baseline-user', approved: true, claims: { approved: true } }; }), applyScenarioAction: vi.fn(async ({ action }) => ({ action, acknowledgement: true, queueAction: action })),
      startEmulatorStack: async options => { expect(options).toMatchObject({ configPath: expect.stringContaining('firebase.emulator-test.json'), projectId: 'demo-project', profile: 'scratch', seedProfile: 'test' }); expect(options.scratchDirectory).toMatch(/private-access-run[\\/]scratch$/); return { hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, stop: stackStop }; },
    } });
    expect(spawn).toHaveBeenCalledWith(process.execPath, expect.arrayContaining(['--host', '127.0.0.1', '--port', '19152', '--strictPort', '--mode', 'baseline']), expect.objectContaining({ env: expect.objectContaining({ VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', VITE_ACCESS_SCENARIO_CONTROL_SESSION: 'session-1', VITE_ACCESS_SCENARIO_CONTROL_URL: 'http://127.0.0.1:4321/sessions/session-1' }) }));
    expect(writes[0][1]).toMatchObject({ firestore: { rules: path.resolve('firestore.rules') } }); expect(writes[1][1]).toMatchObject({ scenario: 'UX-10-03', slot: 1, session: 'session-1', viewport: '375x812', stagedIdentity: { approved: true, claims: { approved: true } }, artifactRevision: 'private-owner-approved-access@v2' });
    const acknowledgement = await createServer.mock.calls[0][0].onAction({ action: 'reject-next-evaluation' });
    expect(acknowledgement).toMatchObject({ acknowledgement: true, action: 'reject-next-evaluation', queueAction: 'reject-next-evaluation' });
    await run.stop();
    expect(terminated).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(removes).toEqual(expect.arrayContaining([['C:/temp/private-access-run', { recursive: true, force: true }], ['C:/registry/session-1.json', { force: true }]]));
  });
  it('stops the owned stack and removes scratch when claim staging cannot read back', async () => {
    const stackStop = vi.fn(); const remove = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-02', viewport: '375x812', slot: 1, deps: {
      mkdtemp: async () => 'C:/temp/private-access-failure', rm: remove, writeFile: vi.fn(), startEmulatorStack: async () => ({ hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, stop: stackStop }), stageScenarioStart: async () => { throw new Error('claim readback failed'); },
    } })).rejects.toThrow('claim readback failed');
    expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-failure', { recursive: true, force: true });
  });
  it('isolates two deterministic lease slots through startup and teardown', async () => {
    const writes = []; const removes = []; const stacks = []; let root = 0; let session = 0;
    const createServer = vi.fn(() => { const server = new EventEmitter(); server.address = () => ({ port: 4320 + createServer.mock.calls.length }); server.close = done => done(); queueMicrotask(() => server.emit('listening')); return server; });
    const startEmulatorStack = vi.fn(async options => { const stack = { hosts: options.configPath.includes('one') ? { auth: '127.0.0.1:19099', firestore: '127.0.0.1:18080' } : { auth: '127.0.0.1:19100', firestore: '127.0.0.1:18081' }, stop: vi.fn() }; stacks.push([options, stack]); return stack; });
    const deps = { mkdtemp: async () => `C:/temp/private-access-${['one', 'two'][root++]}`, randomUUID: () => `session-${++session}`, writeFile: async (target, contents) => writes.push([target, JSON.parse(contents)]), rm: async (target, options) => removes.push([target, options]), registry: id => `C:/registry/${id}.json`, createControlServer: createServer, spawn: () => ({ pid: 123, exitCode: null, signalCode: null }), terminateProcessTree: vi.fn(), stageScenarioStart: vi.fn(async () => ({ approved: true })), startEmulatorStack };
    const one = await runPrivateAccessScenario({ scenario: 'UX-10-03', viewport: '375x812', slot: 1, deps });
    const two = await runPrivateAccessScenario({ scenario: 'UX-10-03', viewport: '375x812', slot: 2, deps });
    expect(one).toMatchObject({ slot: 1, url: 'http://127.0.0.1:19152', ports: { auth: 19099, firestore: 18080, firestoreWebsocket: 19150, hub: 14400, logging: 14500, vite: 19152 }, hosts: { auth: '127.0.0.1:19099', firestore: '127.0.0.1:18080' } });
    expect(two).toMatchObject({ slot: 2, url: 'http://127.0.0.1:19153', ports: { auth: 19100, firestore: 18081, firestoreWebsocket: 19151, hub: 14401, logging: 14501, vite: 19153 }, hosts: { auth: '127.0.0.1:19100', firestore: '127.0.0.1:18081' } });
    const fixedPorts = [one, two].flatMap(({ ports }) => Object.entries(ports).filter(([name]) => name !== 'control').map(([, port]) => port));
    expect(new Set(fixedPorts)).toHaveLength(fixedPorts.length);
    expect(stacks.map(([options]) => [options.configPath, options.scratchDirectory])).toEqual(['one', 'two'].map(name => [path.join('C:/temp', `private-access-${name}`, 'firebase.emulator-test.json'), path.join('C:/temp', `private-access-${name}`, 'scratch')]));
    expect(writes.filter(([target]) => target.endsWith('firebase.emulator-test.json')).map(([, config]) => [config.emulators.auth.port, config.emulators.firestore.port, config.emulators.hub.port, config.emulators.logging.port, config.emulators.firestore.websocketPort, config.firestore.rules])).toEqual([[19099, 18080, 14400, 14500, 19150, path.resolve('firestore.rules')], [19100, 18081, 14401, 14501, 19151, path.resolve('firestore.rules')]]);
    expect(createServer.mock.calls.map(([options]) => options.origin)).toEqual(['http://127.0.0.1:19152', 'http://127.0.0.1:19153']);
    await Promise.all([one.stop(), two.stop()]);
    for (const [, stack] of stacks) expect(stack.stop).toHaveBeenCalledWith({ exportScratch: false });
    expect(removes).toEqual(expect.arrayContaining([['C:/temp/private-access-one', { recursive: true, force: true }], ['C:/temp/private-access-two', { recursive: true, force: true }], ['C:/registry/session-1.json', { force: true }], ['C:/registry/session-2.json', { force: true }]]));
  });
  it('removes scratch without cleaning unacquired resources when stack startup fails', async () => {
    const remove = vi.fn(); const createServer = vi.fn(); const spawn = vi.fn(); const terminate = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', slot: 1, deps: {
      mkdtemp: async () => 'C:/temp/private-access-stack-failure', rm: remove, writeFile: vi.fn(), startEmulatorStack: async () => { throw new Error('stack failed'); }, createControlServer: createServer, spawn, terminateProcessTree: terminate,
    } })).rejects.toThrow('stack failed');
    expect(remove).toHaveBeenCalledWith('C:/temp/private-access-stack-failure', { recursive: true, force: true }); expect(createServer).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled(); expect(terminate).not.toHaveBeenCalled();
  });
  it('stops the acquired stack when control-server creation fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', slot: 1, deps: {
      mkdtemp: async () => 'C:/temp/private-access-server-failure', rm: remove, writeFile: vi.fn(), startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { throw new Error('server failed'); }, terminateProcessTree: terminate,
    } })).rejects.toThrow('server failed');
    expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-server-failure', { recursive: true, force: true }); expect(terminate).not.toHaveBeenCalled();
  });
  it('closes the server and stops the stack when control listening fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn(); const server = new EventEmitter(); server.close = vi.fn(done => done());
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', slot: 1, deps: {
      mkdtemp: async () => 'C:/temp/private-access-listen-failure', rm: remove, writeFile: vi.fn(), startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { queueMicrotask(() => server.emit('error', new Error('listen failed'))); return server; }, terminateProcessTree: terminate,
    } })).rejects.toThrow('listen failed');
    expect(server.close).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-listen-failure', { recursive: true, force: true }); expect(terminate).not.toHaveBeenCalled();
  });
  it('terminates every acquired resource when registry persistence fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn(); const vite = { pid: 123, exitCode: null, signalCode: null }; const server = new EventEmitter(); server.address = () => ({ port: 4321 }); server.close = vi.fn(done => done());
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', slot: 1, deps: {
      mkdtemp: async () => 'C:/temp/private-access-write-failure', rm: remove, registry: session => `C:/registry/${session}.json`, randomUUID: () => 'session-failure', startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { queueMicrotask(() => server.emit('listening')); return server; }, spawn: () => vite, terminateProcessTree: terminate, writeFile: async target => { if (target.includes('registry')) throw new Error('write failed'); },
    } })).rejects.toThrow('write failed');
    expect(terminate).toHaveBeenCalledWith(vite); expect(server.close).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-write-failure', { recursive: true, force: true }); expect(remove).toHaveBeenCalledWith('C:/registry/session-failure.json', { force: true });
  });
});
