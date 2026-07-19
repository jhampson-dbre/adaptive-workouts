import { describe, expect, it, vi } from 'vitest';

import { createBaselineAttempt } from '../utils/baselineBootstrap';

describe('baseline bootstrap attempt', () => {
  it('uses one deadline across auth, data, and final revision verification', async () => {
    vi.useFakeTimers();
    const pending = new Promise(() => {});
    const attempt = createBaselineAttempt({
      load: async () => ({
      signIn: () => pending,
      verify: vi.fn(),
      validate: vi.fn(),
      }),
      timeoutMs: 15,
    });
    const rejected = expect(attempt.promise).rejects.toMatchObject({ phase: 'auth' });
    await vi.advanceTimersByTimeAsync(15);
    await rejected;
    vi.useRealTimers();
  });

  it('starts the deadline before module loading and attributes that timeout', async () => {
    vi.useFakeTimers();
    const attempt = createBaselineAttempt({ load: () => new Promise(() => {}), timeoutMs: 10 });
    const rejected = expect(attempt.promise).rejects.toMatchObject({ phase: 'bootstrap' });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    vi.useRealTimers();
  });

  it('invalidates timed-out work so a late auth result cannot validate or read Firestore', async () => {
    vi.useFakeTimers();
    let resolveSignIn;
    const validate = vi.fn();
    const verify = vi.fn();
    const attempt = createBaselineAttempt({
      load: async () => ({
        signIn: () => new Promise(resolve => { resolveSignIn = resolve }),
        validate,
        verify,
      }),
      timeoutMs: 10,
    });
    attempt.promise.catch(() => {});
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    resolveSignIn({ user: {} });
    await Promise.resolve();
    expect(validate).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rechecks identity and the server revision immediately before success', async () => {
    const validate = vi.fn();
    const verify = vi.fn().mockResolvedValue(undefined);
    const attempt = createBaselineAttempt({
      load: async () => ({
      signIn: async () => ({ user: { uid: 'emulator-baseline-user' } }),
      verify,
      validate,
      }),
    });
    await expect(attempt.promise).resolves.toBeUndefined();
    expect(validate).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('cancels a superseded attempt without settling late work', async () => {
    let resolveSignIn;
    const attempt = createBaselineAttempt({
      load: async () => ({
      signIn: () => new Promise(resolve => { resolveSignIn = resolve }),
      verify: vi.fn(),
      validate: vi.fn(),
      }),
    });
    await Promise.resolve();
    attempt.cancel();
    resolveSignIn({ user: {} });
    await Promise.resolve();
    await Promise.resolve();
  });
});
