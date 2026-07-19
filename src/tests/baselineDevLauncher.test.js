import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import {
  createBaselineShutdown,
  installBaselineProcessHandlers,
  stopBaselineChildren,
} from '../../scripts/emulator/run-baseline-dev.mjs';

describe('baseline dev launcher cleanup', () => {
  it('routes uncaught exceptions and unhandled rejections through one cleanup path', async () => {
    const processObject = new EventEmitter();
    const shutdown = vi.fn(() => Promise.resolve());
    const remove = installBaselineProcessHandlers(processObject, shutdown);
    const error = new Error('boom');
    processObject.emit('uncaughtException', error);
    processObject.emit('unhandledRejection', error);
    expect(shutdown).toHaveBeenCalledTimes(2);
    expect(shutdown).toHaveBeenNthCalledWith(1, 1, 'uncaught exception', error);
    expect(shutdown).toHaveBeenNthCalledWith(2, 1, 'unhandled rejection', error);
    remove();
    expect(processObject.listenerCount('uncaughtException')).toBe(0);
    expect(processObject.listenerCount('unhandledRejection')).toBe(0);
  });

  it('reports cleanup failures rather than swallowing them', async () => {
    const cleanupError = new Error('vite cleanup failed');
    await expect(stopBaselineChildren({
      vite: {},
      stack: { stop: vi.fn().mockResolvedValue(undefined) },
      terminateTree: vi.fn().mockRejectedValue(cleanupError),
    })).rejects.toThrow(/vite cleanup failed/);
  });

  it('settles concurrent fatal shutdown requests through one teardown', async () => {
    const stopChildren = vi.fn().mockResolvedValue(undefined);
    const processObject = { exitCode: undefined };
    const shutdown = createBaselineShutdown({
      controller: { abort: vi.fn() },
      getVite: () => ({}),
      getStack: () => ({}),
      processObject,
      stopChildren,
      logger: { error: vi.fn() },
    });
    const first = shutdown(1, 'uncaught exception', new Error('first'));
    const second = shutdown(1, 'unhandled rejection', new Error('second'));
    expect(second).toBe(first);
    await first;
    expect(stopChildren).toHaveBeenCalledOnce();
    expect(processObject.exitCode).toBe(1);
  });
});
