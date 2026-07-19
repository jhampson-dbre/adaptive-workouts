import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { startEmulatorStack } from './lifecycle.mjs';

const parseArguments = args => {
  const options = {
    configPath: path.resolve('firebase.json'),
    profile: 'canonical',
    scratchDirectory: path.resolve('.firebase', 'emulator-scratch'),
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--scratch') options.profile = 'scratch';
    else if (argument === '--config') options.configPath = path.resolve(args[++index]);
    else if (argument === '--scratch-dir') options.scratchDirectory = path.resolve(args[++index]);
    else throw new Error(`Unknown emulator wrapper argument: ${argument}`);
  }
  return options;
};

export async function runEmulators(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const startupController = new AbortController();
  let stack;
  let shutdownPromise;

  const shutdown = (reason, exitCode, error) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      startupController.abort();
      if (error) console.error(`[emulators] ${reason}:`, error);
      else console.log(`\n[emulators] ${reason}; stopping owned processes...`);
      try {
        await stack?.stop({ exportScratch: options.profile === 'scratch' });
      } catch (cleanupError) {
        console.error('[emulators] cleanup failed:', cleanupError);
        exitCode = 1;
      }
      process.exitCode = exitCode;
    })();
    return shutdownPromise;
  };

  const onSigint = () => void shutdown('SIGINT received', 0);
  const onSigterm = () => void shutdown('SIGTERM received', 0);
  const onUncaught = error => void shutdown('uncaught exception', 1, error);
  const onUnhandled = error => void shutdown('unhandled rejection', 1, error);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  process.once('uncaughtException', onUncaught);
  process.once('unhandledRejection', onUnhandled);

  try {
    stack = await startEmulatorStack({
      ...options,
      signal: startupController.signal,
      onFailure: error => console.error(`[emulators] ${error.message}`),
    });
    console.log(`[emulators] ${options.profile} Auth/Firestore baseline is ready for demo-project.`);
    await stack.unexpectedExit;
  } catch (error) {
    await shutdown('emulator stack failure', 1, error);
  } finally {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    process.off('uncaughtException', onUncaught);
    process.off('unhandledRejection', onUnhandled);
  }
  await shutdownPromise;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runEmulators();
