import net from 'node:net';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildEmulatorArgs,
  createProcessSupervisor,
  preflightPorts,
  spawnEmulatorProcess,
  spawnOwnedProcess,
  terminateEmulatorProcessTree,
  terminateProcessTree,
  validateScratchExport,
  waitForOwnedChild,
  waitForServices,
} from '../../scripts/emulator/lifecycle.mjs';

const cleanup = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(cleanup.splice(0).map(task => task()));
});

const fakeChild = pid => Object.assign(new EventEmitter(), {
  pid,
  exitCode: null,
  signalCode: null,
});

const expectSettledWithin = promise => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('supervisor did not settle')), 50)),
]);

describe('emulator lifecycle', () => {
  it('fails preflight with the exact occupied port instead of selecting another', async () => {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const { port } = server.address();

    await expect(preflightPorts([{ name: 'Auth', host: '127.0.0.1', port }]))
      .rejects.toThrow(`Auth emulator port ${port} is already in use`);
  });

  it('waits for every service and fails after the bounded timeout', async () => {
    let attempts = 0;
    const probe = vi.fn(async service => {
      attempts += 1;
      return service.name === 'hub' || attempts > 3;
    });

    await waitForServices([{ name: 'hub' }, { name: 'Auth' }], {
      probe,
      timeoutMs: 100,
      intervalMs: 1,
    });
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Auth' }));

    await expect(waitForServices([{ name: 'Firestore' }], {
      probe: async () => false,
      timeoutMs: 10,
      intervalMs: 1,
    })).rejects.toThrow('Timed out waiting for Firestore');
  });

  it('keeps canonical mutable-state free and imports scratch only when present', () => {
    const canonical = buildEmulatorArgs({ configPath: 'firebase.json', profile: 'canonical' });
    expect(canonical).not.toContain('--import');
    expect(canonical).not.toContain('--export-on-exit');

    const freshScratch = buildEmulatorArgs({
      configPath: 'firebase.json',
      profile: 'scratch',
      scratchDirectory: 'missing',
      scratchExists: false,
    });
    expect(freshScratch).not.toContain('--import');

    const persistedScratch = buildEmulatorArgs({
      configPath: 'firebase.json',
      profile: 'scratch',
      scratchDirectory: 'persisted',
      scratchExists: true,
    });
    expect(persistedScratch).toContain('--import');
    expect(persistedScratch).toContain('persisted');
  });

  it('rejects corrupt scratch exports instead of treating them as absent', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'emulator-scratch-unit-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    await writeFile(path.join(directory, 'firebase-export-metadata.json'), '{not json', 'utf8');

    await expect(validateScratchExport(directory)).rejects.toThrow('scratch export is unreadable or corrupt');
  });

  it('accepts a readable Auth and Firestore scratch export manifest', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'emulator-scratch-unit-'));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    await mkdir(path.join(directory, 'auth_export'));
    await mkdir(path.join(directory, 'firestore_export'));
    await writeFile(path.join(directory, 'firebase-export-metadata.json'), JSON.stringify({
      auth: { path: 'auth_export' },
      firestore: { path: 'firestore_export', metadata_file: 'firestore_export/firestore_export.overall_export_metadata' },
    }), 'utf8');
    await writeFile(path.join(directory, 'firestore_export', 'firestore_export.overall_export_metadata'), 'metadata');

    await expect(validateScratchExport(directory)).resolves.toBeUndefined();
  });

  it('rejects with actionable details when graceful and forced tree termination both fail', async () => {
    const child = fakeChild(510001);
    const taskkill = vi.fn()
      .mockReturnValueOnce({ status: 0, signal: null })
      .mockReturnValueOnce({ status: 0, signal: null });
    const wait = vi.fn(async () => false);

    await expect(terminateProcessTree(child, {
      graceMs: 1,
      platform: 'win32',
      taskkill,
      waitForExit: wait,
    })).rejects.toThrow(/PID 510001.*win32.*graceful.*forced/i);
    expect(taskkill.mock.calls).toEqual([[510001, false], [510001, true]]);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('surfaces Windows taskkill failures if the process tree remains alive', async () => {
    const child = fakeChild(510002);
    const taskkill = vi.fn()
      .mockReturnValueOnce({ status: null, signal: null, error: new Error('taskkill spawn denied') })
      .mockReturnValueOnce({ status: 5, signal: null });

    await expect(terminateProcessTree(child, {
      graceMs: 1,
      platform: 'win32',
      taskkill,
      waitForExit: async () => false,
    })).rejects.toThrow(/taskkill spawn denied.*status 5/i);
  });

  it('forces detached Windows emulator tree cleanup before accepting root exit', async () => {
    const child = fakeChild(510020);
    const taskkill = vi.fn(() => ({ status: 0, signal: null }));

    await expect(terminateEmulatorProcessTree(child, {
      platform: 'win32',
      taskkill,
      waitForExit: async () => true,
    })).resolves.toBeUndefined();

    expect(taskkill).toHaveBeenCalledExactlyOnceWith(510020, true);
  });

  it('accepts a raced child exit even when graceful taskkill reports nonzero', async () => {
    const child = fakeChild(510003);
    const taskkill = vi.fn(() => ({ status: 128, signal: null }));

    await expect(terminateProcessTree(child, {
      graceMs: 1,
      platform: 'win32',
      taskkill,
      waitForExit: async () => true,
    })).resolves.toBeUndefined();
    expect(taskkill).toHaveBeenCalledOnce();
    expect(taskkill).toHaveBeenCalledWith(510003, false);
  });

  it('settles a timed-out owned child with both timeout and termination failures', async () => {
    const child = fakeChild(510004);
    const startedAt = Date.now();
    const failure = await waitForOwnedChild(child, {
      label: 'focused integration',
      timeoutMs: 1,
      terminateTree: async ownedChild => {
        ownedChild.emit('exit', 0, null);
        throw new Error('forced cleanup failed');
      },
    }).catch(error => error);

    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toContain('focused integration timed out after 1ms');
    expect(failure.message).toContain('forced cleanup failed');
    expect(failure.errors).toHaveLength(2);
  });

  it('spawns bounded owned children in a detached POSIX process group only', () => {
    const child = fakeChild(510005);
    const spawnProcess = vi.fn(() => child);

    expect(spawnOwnedProcess('node', ['test.js'], { stdio: 'pipe' }, {
      platform: 'linux',
      spawnProcess,
    })).toBe(child);
    expect(spawnProcess).toHaveBeenLastCalledWith('node', ['test.js'], expect.objectContaining({
      detached: true,
      shell: false,
    }));

    spawnOwnedProcess('node', ['test.js'], { stdio: 'pipe' }, {
      platform: 'win32',
      spawnProcess,
    });
    expect(spawnProcess).toHaveBeenLastCalledWith('node', ['test.js'], expect.objectContaining({
      detached: false,
      shell: false,
    }));
  });

  it('isolates the long-running emulator stack from Windows Ctrl+C broadcasts', () => {
    const child = fakeChild(510006);
    const spawnProcess = vi.fn(() => child);

    expect(spawnEmulatorProcess('node', ['firebase.js', 'emulators:start'], { stdio: 'inherit' }, { spawnProcess })).toBe(child);
    expect(spawnProcess).toHaveBeenCalledWith('node', ['firebase.js', 'emulators:start'], expect.objectContaining({
      detached: true,
      shell: false,
    }));
  });

  it('attempts integration stack stop and scratch removal independently', async () => {
    const { cleanupIntegrationResources } = await import('../../scripts/emulator/run-integration-tests.mjs');
    const stack = { stop: vi.fn(async () => { throw new Error('canonical stop failed'); }) };
    const remove = vi.fn(async () => { throw new Error('scratch removal failed'); });

    const failure = await cleanupIntegrationResources({
      canonicalStack: stack,
      scratchRoot: 'isolated-scratch-root',
      remove,
    }).catch(error => error);

    expect(stack.stop).toHaveBeenCalledWith({ exportScratch: false });
    expect(remove).toHaveBeenCalledWith('isolated-scratch-root', { recursive: true, force: true });
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors.map(error => error.message)).toEqual([
      'canonical stop failed',
      'scratch removal failed',
    ]);
  });

  it.each([
    { code: 0, signal: null, expected: 'code 0, signal none' },
    { code: 1, signal: null, expected: 'code 1, signal none' },
    { code: null, signal: 'SIGTERM', expected: 'code none, signal SIGTERM' },
  ])('treats an unexpected $expected child exit as stack failure and cleans up once', async ({ code, signal, expected }) => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.exitCode = null;
    child.signalCode = null;
    const sibling = new EventEmitter();
    sibling.pid = 4244;
    sibling.exitCode = null;
    sibling.signalCode = null;
    const terminateTree = vi.fn(async ownedChild => ownedChild.emit('exit', null, 'SIGTERM'));
    const onFailure = vi.fn();
    const supervisor = createProcessSupervisor({ terminateTree, onFailure });
    supervisor.watch('Firebase emulators', child);
    supervisor.watch('Sibling process', sibling);

    child.emit('exit', code, signal);
    child.emit('exit', 27, null);
    await supervisor.settled;

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining(`Firebase emulators exited unexpectedly (${expected})`),
    }));
    expect(terminateTree).toHaveBeenCalledOnce();
  });

  it('allows coordinated shutdown without reporting child failure', async () => {
    const child = new EventEmitter();
    child.pid = 4243;
    child.exitCode = null;
    child.signalCode = null;
    const terminateTree = vi.fn(async () => child.emit('exit', null, 'SIGTERM'));
    const onFailure = vi.fn();
    const supervisor = createProcessSupervisor({ terminateTree, onFailure });
    supervisor.watch('Firebase emulators', child);

    await supervisor.stop();

    expect(terminateTree).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('settles one-shot supervisor state while surfacing coordinated cleanup failure', async () => {
    const child = fakeChild(4245);
    const cleanupError = new Error('owned tree still alive');
    const supervisor = createProcessSupervisor({ terminateTree: vi.fn(async () => { throw cleanupError; }) });
    supervisor.watch('Firebase emulators', child);

    await expect(supervisor.stop()).rejects.toThrow('owned tree still alive');
    await expect(expectSettledWithin(supervisor.settled)).resolves.toBeUndefined();
    await expect(supervisor.unexpectedExit).resolves.toBeUndefined();
    expect(supervisor.state).toBe('stopped');
  });

  it('combines unexpected-child and cleanup failures without hanging settlement', async () => {
    const child = fakeChild(4246);
    const sibling = fakeChild(4247);
    const onFailure = vi.fn();
    const supervisor = createProcessSupervisor({
      terminateTree: vi.fn(async () => { throw new Error('sibling tree still alive'); }),
      onFailure,
    });
    supervisor.watch('Firebase emulators', child);
    supervisor.watch('Sibling process', sibling);

    child.emit('exit', 1, null);
    const failure = await supervisor.unexpectedExit.catch(error => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toContain('Firebase emulators exited unexpectedly');
    expect(failure.message).toContain('sibling tree still alive');
    expect(failure.errors).toHaveLength(2);
    await expect(expectSettledWithin(supervisor.settled)).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(supervisor.state).toBe('stopped');
  });
});
