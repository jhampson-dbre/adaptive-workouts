import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const baselineUser = { uid: 'emulator-baseline-user', providerData: [{ providerId: 'google.com', uid: 'google-peach-otter-880' }] };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetModules(); vi.doUnmock('../utils/firebase'); vi.doUnmock('../utils/baselineAuth'); vi.doUnmock('../utils/baselineBootstrap'); vi.doUnmock('../utils/auth'); vi.doUnmock('../utils/storage'); vi.doUnmock('../components/Generator'); });
const accessAuth = () => ({ subscribeToIdTokenChanges: vi.fn(), evaluateAccessToken: vi.fn(async () => ({ claims: { approved: true } })), isApprovedTokenResult: value => value.claims.approved === true, signOutUser: vi.fn() });
describe('baseline shared access gate', () => {
  it('focuses the generated-workout heading after identity, claim, and fixture verification', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: vi.fn(), verifyBaselineData: async () => undefined }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    vi.doMock('../components/Generator', () => ({ default: () => <h2 tabIndex="-1">Generate Workout</h2> }));
    const { default: App } = await import('../App'); render(<App />);
    const preparing = screen.getByRole('heading', { name: 'Preparing emulator baseline…' }); expect(document.activeElement).toBe(preparing); expect(screen.getByRole('status').textContent).toMatch(/seeded account and workout data/i);
    const heading = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(heading)); import.meta.env.MODE = priorMode;
  });
  it('uses baseline Firestore diagnostics when post-claim fixture verification fails', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: vi.fn(), verifyBaselineData: vi.fn().mockRejectedValue(new Error('offline')) }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App'); render(<App />);
    expect(await screen.findByRole('heading', { name: 'Baseline unavailable' })).toBeTruthy(); expect(screen.getByText('Workout data unavailable')).toBeTruthy(); expect(screen.getByText(/seeded settings, catalog, or fixture revision/i)).toBeTruthy(); import.meta.env.MODE = priorMode;
  });
  it('keeps strict claim evaluator failures on the shared verification error surface', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline'; const verifyBaselineData = vi.fn();
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: vi.fn(), verifyBaselineData }));
    vi.doMock('../utils/auth', () => ({ ...accessAuth(), evaluateAccessToken: vi.fn().mockRejectedValue(new Error('claim evaluator offline')) })); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App'); render(<App />);
    expect(await screen.findByRole('heading', { name: 'Unable to verify access' })).toBeTruthy(); expect(screen.queryByRole('heading', { name: 'Baseline unavailable' })).toBeNull(); expect(verifyBaselineData).not.toHaveBeenCalled(); import.meta.env.MODE = priorMode;
  });
  it('retries baseline bootstrap after a sign-in failure before any user is available', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    const signInToBaseline = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise(() => {}));
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline, validateBaselineIdentity: vi.fn(), verifyBaselineData: vi.fn(async () => undefined) }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    vi.doMock('../components/Generator', () => ({ default: () => <h2 tabIndex="-1">Generate Workout</h2> }));
    const { default: App } = await import('../App'); render(<App />);
    expect(await screen.findByText('Auth emulator unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry baseline' }));
    const preparing = screen.getByRole('heading', { name: 'Preparing emulator baseline…' }); expect(document.activeElement).toBe(preparing); expect(signInToBaseline).toHaveBeenCalledTimes(1);
    await act(async () => {}); expect(signInToBaseline).toHaveBeenCalledTimes(2);
    import.meta.env.MODE = priorMode;
  });
  it('shows fixed identity mismatch diagnostics and restart guidance', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    const mismatch = Object.assign(new Error('wrong account'), { code: 'baseline/identity-mismatch', observed: { uid: 'other-user', providerUid: 'other-provider' } });
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: () => { throw mismatch; }, verifyBaselineData: vi.fn() }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App'); render(<App />);
    expect(await screen.findByText('Baseline account mismatch')).toBeTruthy(); expect(screen.getByText(/Observed UID other-user and provider other-provider/)).toBeTruthy(); expect(screen.getByText(/Browser Retry cannot repair seeded baseline data/)).toBeTruthy(); import.meta.env.MODE = priorMode;
  });
  it('shows fixture revision diagnostics and restart guidance', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    const mismatch = Object.assign(new Error('wrong revision'), { code: 'baseline/revision-mismatch', observedRevision: 'stale-v0' });
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: vi.fn(), verifyBaselineData: vi.fn().mockRejectedValue(mismatch) }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App'); render(<App />);
    expect(await screen.findByText('Baseline data mismatch')).toBeTruthy(); expect(screen.getByText(/Expected revision emulator-baseline-v1. Observed revision stale-v0/)).toBeTruthy(); expect(screen.getByText(/Browser Retry cannot repair seeded baseline data/)).toBeTruthy(); import.meta.env.MODE = priorMode;
  });
  it('keeps fixture verification inside the App access deadline and ignores its late completion', async () => {
    vi.useFakeTimers(); const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline'; let completeVerification;
    vi.doMock('../utils/firebase', () => ({ auth: { currentUser: baselineUser }, db: {} }));
    const verifyBaselineData = vi.fn(() => new Promise(resolve => { completeVerification = resolve; }));
    vi.doMock('../utils/baselineAuth', () => ({ signInToBaseline: async () => ({ user: baselineUser }), validateBaselineIdentity: vi.fn(), verifyBaselineData }));
    vi.doMock('../utils/baselineBootstrap', () => ({ createBaselineAttempt: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) }));
    vi.doMock('../utils/auth', accessAuth); vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }));
    const { default: App } = await import('../App'); render(<App />);
    await act(async () => {});
    expect(verifyBaselineData).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    const error = screen.getByRole('heading', { name: 'Unable to verify access' });
    expect(document.activeElement).toBe(error); expect(screen.queryByText('Adaptive Hypertrophy')).toBeNull();
    completeVerification(); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy(); expect(document.activeElement).toBe(error);
    import.meta.env.MODE = priorMode;
  });
});
