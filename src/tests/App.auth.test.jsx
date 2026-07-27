import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const approved = { uid: 'u1', email: 'safe@example.test' };
const pending = { uid: 'u2', email: 'pending@example.test' };

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.resetModules(); vi.doUnmock('../utils/auth'); vi.doUnmock('../utils/firebase'); vi.doUnmock('../utils/storage'); });

async function mountGate({ evaluate = vi.fn(async () => ({ claims: { approved: true } })), migrate = vi.fn(), signOut = vi.fn() } = {}) {
  const observers = []; const unsubscribes = [];
  vi.doMock('../utils/firebase', () => ({ auth: {}, db: {} }));
  vi.doMock('../utils/auth', () => ({ subscribeToIdTokenChanges: callback => { observers.push(callback); const unsubscribe = vi.fn(); unsubscribes.push(unsubscribe); return unsubscribe; }, evaluateAccessToken: evaluate, isApprovedTokenResult: value => value?.claims?.approved === true, signOutUser: signOut }));
  vi.doMock('../utils/storage', () => ({ migrateLocalData: migrate }));
  const { default: App } = await import('../App'); const view = render(<App />);
  return { emit: value => act(async () => observers.at(-1)(value)), emitSync: value => act(() => observers.at(-1)(value)), observers, unsubscribes, evaluate, migrate, signOut, ...view };
}

describe('private access gate', () => {
  it('fails closed for missing or non-boolean approval claims and focuses the pending heading', async () => {
    const gate = await mountGate({ evaluate: vi.fn(async () => ({ claims: { approved: 'true' } })) });
    await gate.emit(pending);
    const heading = await screen.findByRole('heading', { name: 'Awaiting approval' });
    expect(document.activeElement).toBe(heading); expect(screen.queryByText('Adaptive Hypertrophy')).toBeNull();
  });

  it('times out initial settlement and forced refresh fail-closed', async () => {
    vi.useFakeTimers(); const gate = await mountGate({ evaluate: vi.fn(() => new Promise(() => {})) });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy();
    await gate.emit(pending); await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy();
  });

  it('retries an initial observer timeout with one fresh owned subscription and ignores the retired listener', async () => {
    vi.useFakeTimers(); const gate = await mountGate({ evaluate: vi.fn(async () => ({ claims: { approved: false } })) });
    const retiredObserver = gate.observers[0];
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const checking = screen.getByRole('heading', { name: 'Checking access' });
    expect(document.activeElement).toBe(checking);
    await act(async () => {});
    expect(gate.observers).toHaveLength(2); expect(gate.unsubscribes[0]).toHaveBeenCalledOnce(); expect(gate.unsubscribes[1]).not.toHaveBeenCalled();

    await act(async () => retiredObserver(approved));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy(); expect(gate.evaluate).not.toHaveBeenCalled();
    await gate.emit(pending); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Awaiting approval' })).toBeTruthy();
  });

  it('ignores a late initial observer callback after its deadline until Retry owns a new attempt', async () => {
    vi.useFakeTimers(); const gate = await mountGate(); const lateObserver = gate.observers[0];
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    const error = screen.getByRole('heading', { name: 'Unable to verify access' }); expect(document.activeElement).toBe(error);
    await act(async () => lateObserver(approved)); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy(); expect(document.activeElement).toBe(error);
    expect(gate.evaluate).not.toHaveBeenCalled(); expect(gate.migrate).not.toHaveBeenCalled();
  });

  it('invalidates a timed-out evaluation so its late approval cannot authorize', async () => {
    vi.useFakeTimers(); let resolve; const gate = await mountGate({ evaluate: vi.fn(() => new Promise(done => { resolve = done; })) });
    await gate.emit(approved); await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    resolve({ claims: { approved: true } }); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy(); expect(gate.migrate).not.toHaveBeenCalled();
  });

  it('does not let an older resolve or rejection retire a newer generation deadline', async () => {
    vi.useFakeTimers(); let resolveOld; let rejectOld; const evaluate = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }))
      .mockImplementationOnce(() => new Promise(() => {}));
    const gate = await mountGate({ evaluate }); gate.emitSync(approved); gate.emitSync({ ...approved, uid: 'u-middle' }); gate.emitSync({ ...approved, uid: 'u-new' });
    resolveOld({ claims: { approved: true } }); rejectOld(new Error('stale')); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('heading', { name: 'Unable to verify access' })).toBeTruthy();
  });

  it('keeps only the newest generation active across listener overlap, retry, and a stale rejection', async () => {
    let rejectOld; let resolveRetry; const evaluate = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce({ claims: { approved: false } })
      .mockImplementationOnce(() => new Promise(resolve => { resolveRetry = resolve; }));
    const gate = await mountGate({ evaluate });
    await gate.emit(pending); await gate.emit(pending);
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    rejectOld(new Error('stale')); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    resolveRetry({ claims: { approved: true } });
    expect(await screen.findByText('Adaptive Hypertrophy')).toBeTruthy(); expect(evaluate).toHaveBeenCalledTimes(3);
  });

  it('removes authorized content immediately for refresh/revocation, then supports approved and pending forced refreshes', async () => {
    const evaluate = vi.fn().mockResolvedValueOnce({ claims: { approved: true } }).mockResolvedValueOnce({ claims: { approved: false } }).mockResolvedValueOnce({ claims: { approved: true } });
    const gate = await mountGate({ evaluate }); await gate.emit(approved);
    expect(await screen.findByText('Adaptive Hypertrophy')).toBeTruthy(); gate.emitSync(approved);
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy(); expect(await screen.findByText('Adaptive Hypertrophy')).toBeTruthy();
    expect(evaluate.mock.calls[2][1]).toEqual({ forceRefresh: true });
  });

  it('signout and account switching retire prior identity and protected content', async () => {
    const signOut = vi.fn(); const evaluate = vi.fn(async user => ({ claims: { approved: user.uid === 'u1' } })); const gate = await mountGate({ evaluate, signOut });
    await gate.emit(approved); expect(await screen.findByText('Adaptive Hypertrophy')).toBeTruthy();
    await gate.emit(pending); expect(await screen.findByText('pending@example.test')).toBeTruthy(); expect(screen.queryByText('Adaptive Hypertrophy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy(); expect(signOut).toHaveBeenCalledOnce();
  });

  it('invalidates access immediately during sign out, then recovers truthfully after rejection', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const gate = await mountGate({ signOut, evaluate: vi.fn(async () => ({ claims: { approved: false } })) });
    await gate.emit(pending);
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());

    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Unable to verify access' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeTruthy();
    expect(gate.evaluate.mock.calls.at(-1)).toEqual([pending, { forceRefresh: true }]);
  });

  it('shows checking during a pending sign out and Login only after it succeeds', async () => {
    let finishSignOut; const signOut = vi.fn(() => new Promise(resolve => { finishSignOut = resolve; }));
    const gate = await mountGate({ signOut, evaluate: vi.fn(async () => ({ claims: { approved: false } })) });
    await gate.emit(pending);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    expect(screen.queryByText('pending@example.test')).toBeNull();
    finishSignOut(); await act(async () => {});
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  });

  it('suppresses non-null token events while manual sign out is pending', async () => {
    let finishSignOut; const signOut = vi.fn(() => new Promise(resolve => { finishSignOut = resolve; }));
    const evaluate = vi.fn().mockResolvedValueOnce({ claims: { approved: false } }).mockResolvedValueOnce({ claims: { approved: true } });
    const gate = await mountGate({ signOut, evaluate });
    await gate.emit(pending);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();

    await gate.emit(approved); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy();
    expect(screen.queryByText('Adaptive Hypertrophy')).toBeNull(); expect(evaluate).toHaveBeenCalledOnce();

    finishSignOut(); await act(async () => {});
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy(); expect(evaluate).toHaveBeenCalledOnce();
  });

  it('suppresses null token events until the owned manual sign out succeeds', async () => {
    let finishSignOut; const signOut = vi.fn(() => new Promise(resolve => { finishSignOut = resolve; }));
    const gate = await mountGate({ signOut, evaluate: vi.fn(async () => ({ claims: { approved: false } })) });
    await gate.emit(pending); fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await gate.emit(null); await act(async () => {});
    const checking = screen.getByRole('heading', { name: 'Checking access' }); expect(document.activeElement).toBe(checking); expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    finishSignOut(); await act(async () => {});
    expect(document.activeElement).toBe(await screen.findByRole('button', { name: 'Sign in with Google' }));
  });

  it('suppresses null token events until a rejected manual sign out reaches focused recovery', async () => {
    let failSignOut; const signOut = vi.fn(() => new Promise((_, reject) => { failSignOut = reject; }));
    const gate = await mountGate({ signOut, evaluate: vi.fn(async () => ({ claims: { approved: false } })) });
    await gate.emit(pending); fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await gate.emit(null); await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    failSignOut(new Error('network unavailable')); await act(async () => {});
    const error = await screen.findByRole('heading', { name: 'Unable to verify access' }); expect(document.activeElement).toBe(error); expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
  });

  it('marks retry actions primary and sign out actions secondary', async () => {
    const gate = await mountGate({ evaluate: vi.fn().mockResolvedValueOnce({ claims: { approved: false } }).mockRejectedValueOnce(new Error('offline')) });
    await gate.emit(pending);
    expect((await screen.findByRole('button', { name: 'Check again' })).className).toContain('access-action-primary');
    expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('access-action-secondary');
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect((await screen.findByRole('button', { name: 'Retry' })).className).toContain('access-action-primary');
    expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('access-action-secondary');
  });

  it('runs migration once per signed-in authorization session, awaits it, resets it on switch, and logs failures while continuing', async () => {
    const migration = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {}); const gate = await mountGate({ migrate: migration });
    await gate.emit(approved); await screen.findByText('Adaptive Hypertrophy'); await gate.emit(approved); await screen.findByText('Adaptive Hypertrophy');
    expect(migration).toHaveBeenCalledTimes(1); await gate.emit({ ...approved, uid: 'u3' }); await screen.findByText('Adaptive Hypertrophy');
    expect(migration).toHaveBeenCalledTimes(2); expect(error).toHaveBeenCalledWith('Migration failed, continuing with Firestore:', expect.any(Error));
  });

  it('keeps protected UI unmounted while one owned migration is in flight and resets migration after same-UID signout', async () => {
    let finishMigration; const migration = vi.fn(() => new Promise(resolve => { finishMigration = resolve; })); const gate = await mountGate({ migrate: migration });
    gate.emitSync(approved); gate.emitSync(approved); await act(async () => {});
    expect(migration).toHaveBeenCalledOnce(); expect(screen.getByRole('heading', { name: 'Checking access' })).toBeTruthy(); expect(screen.queryByText('Adaptive Hypertrophy')).toBeNull();
    finishMigration(); await act(async () => {}); expect(await screen.findByText('Adaptive Hypertrophy')).toBeTruthy();
    await gate.emit(null); await gate.emit(approved); await waitFor(() => expect(migration).toHaveBeenCalledTimes(2));
  });

  it('moves focus to checking, error, authorization main heading, and login; stale results never move it', async () => {
    let resolve; const gate = await mountGate({ evaluate: vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce({ claims: { approved: true } }) });
    gate.emitSync(approved); const checking = screen.getByRole('heading', { name: 'Checking access' }); expect(document.activeElement).toBe(checking);
    await gate.emit(approved); resolve({ claims: { approved: false } }); await act(async () => {});
    const title = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(title));
    await gate.emit(null); expect(document.activeElement).toBe(await screen.findByRole('button', { name: 'Sign in with Google' }));
  });

  it('focuses error and refocuses the current pending destination once after another pending evaluation', async () => {
    const gate = await mountGate({ evaluate: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ claims: { approved: false } }).mockResolvedValueOnce({ claims: { approved: false } }) });
    await gate.emit(approved); const error = await screen.findByRole('heading', { name: 'Unable to verify access' }); expect(document.activeElement).toBe(error);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); const firstPending = await screen.findByRole('heading', { name: 'Awaiting approval' }); expect(document.activeElement).toBe(firstPending);
    fireEvent.click(screen.getByRole('button', { name: 'Check again' })); const secondPending = await screen.findByRole('heading', { name: 'Awaiting approval' }); expect(document.activeElement).toBe(secondPending);
  });

  it('retires the active deadline on unmount and ignores a late result without moving focus', async () => {
    vi.useFakeTimers(); let resolve; const focus = vi.spyOn(HTMLElement.prototype, 'focus'); const gate = await mountGate({ evaluate: vi.fn(() => new Promise(done => { resolve = done; })) });
    gate.emitSync(approved); const focusCallsBeforeUnmount = focus.mock.calls.length; gate.unmount(); resolve({ claims: { approved: true } }); await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(document.body.textContent).toBe(''); expect(focus).toHaveBeenCalledTimes(focusCallsBeforeUnmount);
  });
});
