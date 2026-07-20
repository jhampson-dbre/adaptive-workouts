import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { runPrivateAccessScenario } from '../../scripts/emulator/access-scenarios/run.mjs';

describe('private access scenario runner lifecycle', () => {
  it('owns the emulator, baseline Vite server, control session, and scratch cleanup', async () => {
    const writes = []; const removes = []; const terminated = vi.fn(); const stackStop = vi.fn(); const spawn = vi.fn(() => ({ pid: 123, exitCode: null, signalCode: null }));
    const server = new EventEmitter(); server.address = () => ({ port: 4321 }); server.close = done => done();
    const createServer = vi.fn(() => { queueMicrotask(() => server.emit('listening')); return server; });
    const run = await runPrivateAccessScenario({ scenario: 'UX-10-03', viewport: '375x812', deps: {
      mkdtemp: vi.fn(async () => 'C:/temp/private-access-run'), randomUUID: () => 'session-1', writeFile: async (target, contents) => writes.push([target, JSON.parse(contents)]), rm: async (target, options) => removes.push([target, options]), registry: session => `C:/registry/${session}.json`, createControlServer: createServer, spawn, terminateProcessTree: terminated, stageScenarioStart: vi.fn(async options => { expect(options).toMatchObject({ projectId: 'demo-project', hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, scenario: { id: 'UX-10-03', startState: 'approved' } }); return { uid: 'emulator-baseline-user', approved: true, claims: { approved: true } }; }), applyScenarioAction: vi.fn(async ({ action }) => ({ action, acknowledgement: true, queueAction: action })),
      startEmulatorStack: async options => { expect(options).toMatchObject({ configPath: 'firebase.emulator-test.json', projectId: 'demo-project', profile: 'scratch', seedProfile: 'test' }); expect(options.scratchDirectory).toMatch(/private-access-run[\\/]scratch$/); return { hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, stop: stackStop }; },
    } });
    expect(spawn).toHaveBeenCalledWith(process.execPath, expect.arrayContaining(['--host', '127.0.0.1', '--port', '5175', '--strictPort', '--mode', 'baseline']), expect.objectContaining({ env: expect.objectContaining({ VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', VITE_ACCESS_SCENARIO_CONTROL_SESSION: 'session-1', VITE_ACCESS_SCENARIO_CONTROL_URL: 'http://127.0.0.1:4321/sessions/session-1' }) }));
    expect(writes[0][1]).toMatchObject({ scenario: 'UX-10-03', session: 'session-1', viewport: '375x812', stagedIdentity: { approved: true, claims: { approved: true } }, artifactRevision: 'private-owner-approved-access@v2' });
    const acknowledgement = await createServer.mock.calls[0][0].onAction({ action: 'reject-next-evaluation' });
    expect(acknowledgement).toMatchObject({ acknowledgement: true, action: 'reject-next-evaluation', queueAction: 'reject-next-evaluation' });
    await run.stop();
    expect(terminated).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(removes).toEqual(expect.arrayContaining([['C:/temp/private-access-run', { recursive: true, force: true }], ['C:/registry/session-1.json', { force: true }]]));
  });
  it('stops the owned stack and removes scratch when claim staging cannot read back', async () => {
    const stackStop = vi.fn(); const remove = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-02', viewport: '375x812', deps: {
      mkdtemp: async () => 'C:/temp/private-access-failure', rm: remove, startEmulatorStack: async () => ({ hosts: { auth: '127.0.0.1:9099', firestore: '127.0.0.1:8080' }, stop: stackStop }), stageScenarioStart: async () => { throw new Error('claim readback failed'); },
    } })).rejects.toThrow('claim readback failed');
    expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-failure', { recursive: true, force: true });
  });
  it('removes scratch without cleaning unacquired resources when stack startup fails', async () => {
    const remove = vi.fn(); const createServer = vi.fn(); const spawn = vi.fn(); const terminate = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', deps: {
      mkdtemp: async () => 'C:/temp/private-access-stack-failure', rm: remove, startEmulatorStack: async () => { throw new Error('stack failed'); }, createControlServer: createServer, spawn, terminateProcessTree: terminate,
    } })).rejects.toThrow('stack failed');
    expect(remove).toHaveBeenCalledWith('C:/temp/private-access-stack-failure', { recursive: true, force: true }); expect(createServer).not.toHaveBeenCalled(); expect(spawn).not.toHaveBeenCalled(); expect(terminate).not.toHaveBeenCalled();
  });
  it('stops the acquired stack when control-server creation fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn();
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', deps: {
      mkdtemp: async () => 'C:/temp/private-access-server-failure', rm: remove, startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { throw new Error('server failed'); }, terminateProcessTree: terminate,
    } })).rejects.toThrow('server failed');
    expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-server-failure', { recursive: true, force: true }); expect(terminate).not.toHaveBeenCalled();
  });
  it('closes the server and stops the stack when control listening fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn(); const server = new EventEmitter(); server.close = vi.fn(done => done());
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', deps: {
      mkdtemp: async () => 'C:/temp/private-access-listen-failure', rm: remove, startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { queueMicrotask(() => server.emit('error', new Error('listen failed'))); return server; }, terminateProcessTree: terminate,
    } })).rejects.toThrow('listen failed');
    expect(server.close).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-listen-failure', { recursive: true, force: true }); expect(terminate).not.toHaveBeenCalled();
  });
  it('terminates every acquired resource when registry persistence fails', async () => {
    const remove = vi.fn(); const stackStop = vi.fn(); const terminate = vi.fn(); const vite = { pid: 123, exitCode: null, signalCode: null }; const server = new EventEmitter(); server.address = () => ({ port: 4321 }); server.close = vi.fn(done => done());
    await expect(runPrivateAccessScenario({ scenario: 'UX-10-01', viewport: '375x812', deps: {
      mkdtemp: async () => 'C:/temp/private-access-write-failure', rm: remove, registry: session => `C:/registry/${session}.json`, randomUUID: () => 'session-failure', startEmulatorStack: async () => ({ hosts: {}, stop: stackStop }), stageScenarioStart: vi.fn(), createControlServer: () => { queueMicrotask(() => server.emit('listening')); return server; }, spawn: () => vite, terminateProcessTree: terminate, writeFile: async () => { throw new Error('write failed'); },
    } })).rejects.toThrow('write failed');
    expect(terminate).toHaveBeenCalledWith(vite); expect(server.close).toHaveBeenCalled(); expect(stackStop).toHaveBeenCalledWith({ exportScratch: false }); expect(remove).toHaveBeenCalledWith('C:/temp/private-access-write-failure', { recursive: true, force: true }); expect(remove).toHaveBeenCalledWith('C:/registry/session-failure.json', { force: true });
  });
});
