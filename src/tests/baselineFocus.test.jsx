import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const baselineUser = {
  uid: 'emulator-baseline-user',
  providerData: [{ providerId: 'google.com', uid: 'google-peach-otter-880' }],
};

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock('../utils/firebase');
  vi.doUnmock('../utils/baselineAuth');
  vi.doUnmock('../utils/auth');
  vi.doUnmock('../utils/storage');
  vi.doUnmock('../components/Generator');
});

describe('baseline success focus', () => {
  it('moves focus to Generate Workout only after the success screen commits', async () => {
    const priorMode = import.meta.env.MODE;
    import.meta.env.MODE = 'baseline';
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({
      signInToBaseline: async () => ({ user: baselineUser }),
      validateBaselineIdentity: vi.fn(),
      verifyBaselineData: async () => undefined,
    }));
    vi.doMock('../utils/auth', () => ({ subscribeToAuthChanges: vi.fn() }));
    vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    vi.doMock('../components/Generator', () => ({
      default: ({ headingRef }) => <h2 ref={headingRef} tabIndex="-1">Generate Workout</h2>,
    }));
    const { default: App } = await import('../App');
    render(<App />);

    const heading = await screen.findByRole('heading', { name: 'Generate Workout' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    import.meta.env.MODE = priorMode;
  });

  it('renders a disabled retry action above diagnostics before returning to focused loading', async () => {
    const priorMode = import.meta.env.MODE;
    import.meta.env.MODE = 'baseline';
    let nextFrame;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { nextFrame = callback; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const verifyBaselineData = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { phase: 'firestore' }))
      .mockResolvedValue(undefined);
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({
      signInToBaseline: async () => ({ user: baselineUser }),
      validateBaselineIdentity: vi.fn(),
      verifyBaselineData,
    }));
    vi.doMock('../utils/auth', () => ({ subscribeToAuthChanges: vi.fn() }));
    vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App');
    render(<App />);

    const retry = await screen.findByRole('button', { name: 'Retry baseline' });
    const detail = screen.getByText(/seeded settings, catalog, or fixture revision/i);
    expect(retry.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(retry);
    expect(screen.getByRole('button', { name: 'Retrying baseline…' }).disabled).toBe(true);
    await act(async () => nextFrame());
    const loading = await screen.findByRole('heading', { name: 'Preparing emulator baseline…' });
    await waitFor(() => expect(document.activeElement).toBe(loading));
    import.meta.env.MODE = priorMode;
    vi.unstubAllGlobals();
  });
});
