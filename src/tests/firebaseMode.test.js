import { describe, expect, it, vi } from 'vitest';

import { createAuthForMode } from '../utils/firebaseMode';

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
