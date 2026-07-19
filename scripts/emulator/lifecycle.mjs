import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_STOP_GRACE_MS = 5_000;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const pathExists = async target => access(target).then(() => true, () => false);

export function resolveFirebaseToolsBin() {
  return require.resolve('firebase-tools/lib/bin/firebase.js');
}

export async function readEmulatorConfig(configPath) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const emulators = config.emulators ?? {};
  const services = [
    { name: 'Auth', host: emulators.auth?.host ?? '127.0.0.1', port: emulators.auth?.port },
    { name: 'Firestore', host: emulators.firestore?.host ?? '127.0.0.1', port: emulators.firestore?.port },
    { name: 'hub', host: emulators.hub?.host ?? '127.0.0.1', port: emulators.hub?.port ?? 4400 },
  ];
  if (emulators.ui?.enabled !== false) {
    services.push({ name: 'UI', host: emulators.ui?.host ?? '127.0.0.1', port: emulators.ui?.port ?? 4000 });
  }
  if (emulators.logging?.port) {
    services.push({ name: 'logging', host: emulators.logging?.host ?? '127.0.0.1', port: emulators.logging.port });
  }
  if (emulators.firestore?.websocketPort) {
    services.push({
      name: 'Firestore websocket',
      host: emulators.firestore?.host ?? '127.0.0.1',
      port: emulators.firestore.websocketPort,
    });
  }
  for (const service of services) {
    if (!Number.isInteger(service.port)) throw new Error(`Missing fixed ${service.name} emulator port in ${configPath}`);
  }
  return { config, services };
}

const checkPort = ({ host, port }) => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once('error', reject);
  server.listen({ host, port, exclusive: true }, () => server.close(resolve));
});

export async function preflightPorts(services, { check = checkPort } = {}) {
  for (const service of services) {
    try {
      await check(service);
    } catch (error) {
      if (error?.code !== 'EADDRINUSE' && error?.code !== 'EACCES') throw error;
      const guidance = process.platform === 'win32'
        ? `Run Get-NetTCPConnection -LocalPort ${service.port} to identify the owning process.`
        : `Run lsof -i :${service.port} to identify the owning process.`;
      throw new Error(`${service.name} emulator port ${service.port} is already in use at ${service.host}. ${guidance}`);
    }
  }
}

export async function probeService(service, projectId = 'demo-project') {
  const base = `http://${service.host}:${service.port}`;
  const pathname = service.name === 'hub'
    ? '/emulators'
    : service.name === 'Auth'
      ? `/emulator/v1/projects/${projectId}/config`
      : service.name === 'Firestore'
        ? `/v1/projects/${projectId}/databases/(default)/documents?pageSize=1`
        : '/';
  try {
    const response = await fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(1_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

export async function waitForServices(services, {
  probe = probeService,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  intervalMs = 200,
} = {}) {
  const pending = new Map(services.map(service => [service.name, service]));
  const deadline = Date.now() + timeoutMs;
  while (pending.size && Date.now() < deadline) {
    for (const [name, service] of pending) {
      if (await probe(service)) pending.delete(name);
    }
    if (pending.size) await delay(intervalMs);
  }
  if (pending.size) throw new Error(`Timed out waiting for ${[...pending.keys()].join(', ')} after ${timeoutMs}ms`);
}

export function buildEmulatorArgs({
  configPath,
  profile,
  projectId = 'demo-project',
  scratchDirectory,
  scratchExists = false,
}) {
  const args = [
    resolveFirebaseToolsBin(),
    'emulators:start',
    '--project', projectId,
    '--config', configPath,
    '--only', 'auth,firestore',
  ];
  if (profile === 'scratch' && scratchExists) args.push('--import', scratchDirectory);
  return args;
}

const ensureWithinDirectory = (directory, relativePath) => {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error('invalid export path');
  }
  const root = path.resolve(directory);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('export path escapes scratch directory');
  return resolved;
};

export async function validateScratchExport(directory) {
  try {
    const manifestPath = path.join(directory, 'firebase-export-metadata.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const authPath = ensureWithinDirectory(directory, manifest.auth?.path);
    const firestorePath = ensureWithinDirectory(directory, manifest.firestore?.path);
    const firestoreMetadata = ensureWithinDirectory(directory, manifest.firestore?.metadata_file);
    const [authStats, firestoreStats, metadataStats] = await Promise.all([
      stat(authPath),
      stat(firestorePath),
      stat(firestoreMetadata),
    ]);
    if (!authStats.isDirectory() || !firestoreStats.isDirectory() || !metadataStats.isFile()) throw new Error('missing export content');
  } catch (error) {
    throw new Error(`scratch export is unreadable or corrupt at ${directory}: ${error.message}`, { cause: error });
  }
}

const waitForExit = (child, timeoutMs) => new Promise(resolve => {
  if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
  const timeout = setTimeout(() => {
    child.off('exit', onExit);
    resolve(false);
  }, timeoutMs);
  const onExit = () => {
    clearTimeout(timeout);
    resolve(true);
  };
  child.once('exit', onExit);
});

const runTaskkill = (pid, force) => {
  const args = ['/pid', String(pid), '/T'];
  if (force) args.push('/F');
  return spawnSync('taskkill.exe', args, { stdio: 'ignore', windowsHide: true });
};

const describeTerminationResult = (label, result) => {
  if (!result) return `${label}: no result`;
  const details = [`status ${result.status ?? 'none'}`, `signal ${result.signal ?? 'none'}`];
  if (result.error) details.push(`error ${result.error.message}`);
  return `${label}: ${details.join(', ')}`;
};

export async function terminateProcessTree(child, {
  graceMs = DEFAULT_STOP_GRACE_MS,
  platform = process.platform,
  taskkill = runTaskkill,
  waitForExit: wait = waitForExit,
} = {}) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  let gracefulResult;
  let forcedResult;
  if (platform === 'win32') {
    gracefulResult = taskkill(child.pid, false);
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (await wait(child, graceMs)) return;
  if (platform === 'win32') {
    forcedResult = taskkill(child.pid, true);
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (await wait(child, graceMs)) return;
  const details = platform === 'win32'
    ? ` ${describeTerminationResult('graceful taskkill', gracefulResult)}; ${describeTerminationResult('forced taskkill', forcedResult)}.`
    : ' Graceful SIGTERM and forced SIGKILL attempts did not produce an exit.';
  throw new Error(`Failed to terminate process tree PID ${child.pid} on ${platform} after graceful and forced attempts.${details}`);
}

// A detached Firebase CLI process can exit before its Java emulator descendant
// after non-forced taskkill. Force the complete owned tree after export instead.
export async function terminateEmulatorProcessTree(child, {
  graceMs = DEFAULT_STOP_GRACE_MS,
  platform = process.platform,
  taskkill = runTaskkill,
  waitForExit: wait = waitForExit,
} = {}) {
  if (platform !== 'win32') {
    return terminateProcessTree(child, { graceMs, platform, taskkill, waitForExit: wait });
  }
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;

  const firstResult = taskkill(child.pid, true);
  if (await wait(child, graceMs)) return;
  const secondResult = taskkill(child.pid, true);
  if (await wait(child, graceMs)) return;
  throw new Error(
    `Failed to force terminate emulator process tree PID ${child.pid} on win32. ${describeTerminationResult('first forced taskkill', firstResult)}; ${describeTerminationResult('second forced taskkill', secondResult)}.`,
  );
}

export function spawnOwnedProcess(command, args, options = {}, {
  platform = process.platform,
  spawnProcess = spawn,
} = {}) {
  return spawnProcess(command, args, {
    ...options,
    shell: false,
    detached: platform !== 'win32',
    windowsHide: true,
  });
}

// The emulator stack must not share the wrapper's Windows console: a Ctrl+C is
// the wrapper's shutdown signal and needs the running emulators to remain alive
// long enough for `emulators:export` to complete.
export function spawnEmulatorProcess(command, args, options = {}, {
  spawnProcess = spawn,
} = {}) {
  return spawnProcess(command, args, {
    ...options,
    shell: false,
    detached: true,
    windowsHide: true,
  });
}

export function waitForOwnedChild(child, {
  label,
  timeoutMs,
  terminateTree = terminateProcessTree,
}) {
  return new Promise((resolve, reject) => {
    let state = 'waiting';
    const removeListeners = () => {
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const finish = (settle, value) => {
      if (state === 'settled') return;
      state = 'settled';
      clearTimeout(timeout);
      removeListeners();
      settle(value);
    };
    const onError = error => {
      if (state !== 'waiting') return;
      finish(reject, new Error(`${label} failed to launch: ${error.message}`, { cause: error }));
    };
    const onExit = (code, signal) => {
      if (state !== 'waiting') return;
      if (code === 0) finish(resolve, { code, signal });
      else finish(reject, new Error(`${label} failed (code ${code ?? 'none'}, signal ${signal ?? 'none'})`));
    };
    const timeout = setTimeout(() => {
      if (state !== 'waiting') return;
      state = 'terminating';
      removeListeners();
      const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms`);
      Promise.resolve()
        .then(() => terminateTree(child))
        .then(
          () => finish(reject, timeoutError),
          cleanupError => finish(reject, new AggregateError(
            [timeoutError, cleanupError],
            `${timeoutError.message}; process cleanup failed: ${cleanupError.message}`,
          )),
        );
    }, timeoutMs);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

export function createProcessSupervisor({ terminateTree = terminateProcessTree, onFailure = () => {} } = {}) {
  let state = 'running';
  const children = new Map();
  let cleanupPromise;
  let settle;
  let resolveUnexpected;
  let rejectUnexpected;
  const settled = new Promise(resolve => { settle = resolve; });
  const unexpectedExit = new Promise((resolve, reject) => {
    resolveUnexpected = resolve;
    rejectUnexpected = reject;
  });
  unexpectedExit.catch(() => {});

  const cleanup = () => {
    cleanupPromise ??= (async () => {
      try {
        const results = await Promise.allSettled([...children.values()].map(({ child }) => terminateTree(child)));
        const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) throw new AggregateError(failures, `Failed to terminate ${failures.length} owned process trees`);
      } finally {
        if (state !== 'failing') {
          resolveUnexpected();
          state = 'stopped';
          settle();
        }
      }
    })();
    return cleanupPromise;
  };

  const stop = async () => {
    if (state === 'stopped') return cleanupPromise;
    if (state === 'running') state = 'stopping';
    return cleanup();
  };

  const fail = async error => {
    if (state !== 'running') return;
    state = 'failing';
    let reportedError = error;
    try {
      await cleanup();
    } catch (cleanupError) {
      reportedError = new AggregateError(
        [error, cleanupError],
        `${error.message}; process cleanup failed: ${cleanupError.message}`,
      );
    }
    onFailure(reportedError);
    rejectUnexpected(reportedError);
    state = 'stopped';
    settle();
  };

  return {
    settled,
    unexpectedExit,
    watch(name, child) {
      children.set(name, { name, child });
      child.once('exit', (code, signal) => {
        children.delete(name);
        if (state === 'running') {
          const error = new Error(`${name} exited unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'})`);
          void fail(error);
        }
      });
      child.once('error', error => void fail(new Error(`${name} failed to launch: ${error.message}`, { cause: error })));
      return child;
    },
    stop,
    get state() { return state; },
  };
}

const runFirebaseCommand = (args, { env, stdio = 'inherit', timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  const child = spawnOwnedProcess(process.execPath, [resolveFirebaseToolsBin(), ...args], {
    cwd: process.cwd(),
    env,
    stdio,
  });
  return waitForOwnedChild(child, {
    label: `Firebase CLI command ${args.join(' ')}`,
    timeoutMs,
  });
};

export async function startEmulatorStack({
  configPath,
  profile = 'canonical',
  projectId = 'demo-project',
  scratchDirectory = path.resolve('.firebase', 'emulator-scratch'),
  seedProfile = profile,
  readinessTimeoutMs = DEFAULT_TIMEOUT_MS,
  stdio = 'inherit',
  onFailure = () => {},
  signal,
} = {}) {
  if (!['canonical', 'scratch'].includes(profile)) throw new Error(`Unknown emulator profile: ${profile}`);
  if (signal?.aborted) throw new Error('Emulator startup was cancelled');
  const absoluteConfig = path.resolve(configPath);
  const absoluteScratch = path.resolve(scratchDirectory);
  const { services } = await readEmulatorConfig(absoluteConfig);
  await preflightPorts(services);

  const scratchExists = profile === 'scratch' && await pathExists(absoluteScratch);
  if (scratchExists) await validateScratchExport(absoluteScratch);

  const configHome = await mkdtemp(path.join(os.tmpdir(), 'adaptive-workouts-firebase-config-'));
  const env = { ...process.env, XDG_CONFIG_HOME: configHome };
  const args = buildEmulatorArgs({
    configPath: absoluteConfig,
    profile,
    projectId,
    scratchDirectory: absoluteScratch,
    scratchExists,
  });
  const child = spawnEmulatorProcess(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio,
  });
  const supervisor = createProcessSupervisor({ onFailure, terminateTree: terminateEmulatorProcessTree });
  supervisor.watch('Firebase emulators', child);

  const auth = services.find(service => service.name === 'Auth');
  const firestore = services.find(service => service.name === 'Firestore');
  const readinessServices = services.filter(service => ['hub', 'Auth', 'Firestore'].includes(service.name));
  const hosts = {
    auth: `${auth.host}:${auth.port}`,
    firestore: `${firestore.host}:${firestore.port}`,
  };
  let stopped = false;
  let stopPromise;

  const throwCollectedErrors = (message, errors) => {
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, message);
  };

  const stop = ({ exportScratch = profile === 'scratch' } = {}) => {
    if (stopped) return stopPromise;
    stopped = true;
    stopPromise = (async () => {
      const errors = [];
      if (exportScratch && supervisor.state === 'running') {
        try {
          await runFirebaseCommand([
            'emulators:export', absoluteScratch,
            '--force',
            '--project', projectId,
            '--config', absoluteConfig,
          ], { env });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        await supervisor.stop();
      } catch (error) {
        errors.push(error);
      }
      try {
        await rm(configHome, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
      throwCollectedErrors('Emulator shutdown encountered multiple failures', errors);
    })();
    return stopPromise;
  };

  let removeAbortListener = () => {};
  try {
    const aborted = new Promise((_, reject) => {
      if (!signal) return;
      const onAbort = () => reject(new Error('Emulator startup was cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
    });
    await Promise.race([
      waitForServices(readinessServices, {
        probe: service => probeService(service, projectId),
        timeoutMs: readinessTimeoutMs,
      }),
      supervisor.unexpectedExit,
      aborted,
    ]);
    if (signal?.aborted) throw new Error('Emulator startup was cancelled');
    const { resetAndSeedBaseline, verifyBaseline } = await import('./seed-baseline.mjs');
    if (profile === 'canonical' || !scratchExists) {
      await resetAndSeedBaseline({ projectId, hosts, profile: seedProfile });
    } else {
      await verifyBaseline({ projectId, hosts, profile: 'scratch', allowMutable: true });
    }
    if (signal?.aborted) throw new Error('Emulator startup was cancelled');
  } catch (error) {
    try {
      await stop({ exportScratch: false });
    } catch (cleanupError) {
      const alreadyReported = error === cleanupError
        || (error instanceof AggregateError && error.errors.includes(cleanupError));
      if (!alreadyReported) {
        throw new AggregateError(
          [error, cleanupError],
          `${error.message}; emulator shutdown failed: ${cleanupError.message}`,
        );
      }
    }
    throw error;
  } finally {
    removeAbortListener();
  }

  return {
    child,
    env,
    hosts,
    importedScratch: scratchExists,
    services,
    stop,
    unexpectedExit: supervisor.unexpectedExit,
  };
}
