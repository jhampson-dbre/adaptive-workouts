import { describe, expect, it, vi } from 'vitest';

import { createAuthForMode, parseEmulatorHost } from '../utils/firebaseMode';

describe('Firebase baseline mode', () => {
  it('initializes baseline Auth with memory persistence before first use', () => {
    const initializeAuth = vi.fn(() => ({ kind: 'baseline-auth' }));
    const getAuth = vi.fn();
    const persistence = { kind: 'memory' };
    expect(createAuthForMode({}, true, { initializeAuth, getAuth, inMemoryPersistence: persistence }))
      .toEqual({ kind: 'baseline-auth' });
    expect(initializeAuth).toHaveBeenCalledWith({}, { persistence });
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('retains getAuth for non-baseline modes', () => {
    const initializeAuth = vi.fn();
    const getAuth = vi.fn(() => ({ kind: 'normal-auth' }));
    expect(createAuthForMode({}, false, { initializeAuth, getAuth, inMemoryPersistence: {} }))
      .toEqual({ kind: 'normal-auth' });
    expect(getAuth).toHaveBeenCalledOnce();
    expect(initializeAuth).not.toHaveBeenCalled();
  });
});

describe('emulator host parsing', () => {
  it('uses a valid loopback host and rejects malformed input', () => {
    expect(parseEmulatorHost('127.0.0.1:19099')).toMatchObject({ host: '127.0.0.1', port: 19099 });
    expect(() => parseEmulatorHost('remote.example:8080')).toThrow(/Invalid emulator host/);
  });
});
