import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProcessSupervisor, spawnOwnedProcess, startEmulatorStack, terminateProcessTree } from './lifecycle.mjs';

export async function stopBaselineChildren({ vite, stack, terminateTree = terminateProcessTree }) {
  const results = await Promise.allSettled([
    vite ? terminateTree(vite) : undefined,
    stack ? stack.stop({ exportScratch: false }) : undefined,
  ]);
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Baseline process cleanup failed');
}

export function installBaselineProcessHandlers(processObject, shutdown) {
  const invoke = (...args) => void shutdown(...args).catch(error => console.error('[dev:baseline] shutdown failed:', error));
  const onSigint = () => invoke(0, 'SIGINT received');
  const onSigterm = () => invoke(0, 'SIGTERM received');
  const onUncaught = error => invoke(1, 'uncaught exception', error);
  const onUnhandled = error => invoke(1, 'unhandled rejection', error);
  processObject.once('SIGINT', onSigint);
  processObject.once('SIGTERM', onSigterm);
  processObject.once('uncaughtException', onUncaught);
  processObject.once('unhandledRejection', onUnhandled);
  return () => {
    processObject.off('SIGINT', onSigint);
    processObject.off('SIGTERM', onSigterm);
    processObject.off('uncaughtException', onUncaught);
    processObject.off('unhandledRejection', onUnhandled);
  };
}

export function createBaselineShutdown({
  controller,
  getVite,
  getStack,
  processObject = process,
  stopChildren = stopBaselineChildren,
  logger = console,
}) {
  let shutdownPromise;
  return (code, reason, error) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      controller.abort();
      if (reason) logger.error(`[dev:baseline] ${reason}`, error ?? '');
      try {
        await stopChildren({ vite: getVite(), stack: getStack() });
      } catch (cleanupError) {
        processObject.exitCode = 1;
        throw cleanupError;
      }
      processObject.exitCode = code;
    })();
    return shutdownPromise;
  };
}

export async function runBaselineDev() {
  const controller = new AbortController();
  let stack;
  let vite;
  const stop = createBaselineShutdown({ controller, getVite: () => vite, getStack: () => stack });
  const removeHandlers = installBaselineProcessHandlers(process, stop);
  try {
    stack = await startEmulatorStack({
      configPath: path.resolve('firebase.json'),
      profile: 'canonical',
      signal: controller.signal,
    });
    vite = spawnOwnedProcess(process.execPath, [
      path.resolve('node_modules/vite/bin/vite.js'),
      '--host', '127.0.0.1', '--port', '5174', '--strictPort', '--mode', 'baseline',
    ], { cwd: process.cwd(), stdio: 'inherit' });
    const supervisor = createProcessSupervisor();
    supervisor.watch('Vite baseline server', vite);
    await Promise.race([
      stack.unexpectedExit,
      supervisor.unexpectedExit,
    ]);
    await stop(1, 'an owned emulator or Vite process exited unexpectedly');
  } catch (error) {
    await stop(1, error.message, error);
  } finally {
    removeHandlers();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runBaselineDev();
