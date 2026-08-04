import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const approved = uid => ({ uid, email: `${uid}@example.test` })

async function mount({ evaluate = vi.fn(async () => ({ claims: { approved: true } })), settingsFactory, initialSessionState = { status: 'idle', activeWorkout: null }, resumedWorkout, storage = {} } = {}) {
  const observers = []
  let updateSessionState; let settingsProps
  vi.doMock('../utils/auth', () => ({
    subscribeToIdTokenChanges: callback => { observers.push(callback); return vi.fn() },
    evaluateAccessToken: evaluate,
    isApprovedTokenResult: value => value?.claims?.approved === true,
    signOutUser: vi.fn(),
  }))
  vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn(), savePreferredOrderRule: vi.fn(), clearPreferredOrderRules: vi.fn(), touchPreferredOrderRuleUsage: vi.fn(), ...storage }))
  vi.doMock('../utils/useActiveWorkoutSession', async () => {
    const React = await import('react')
    return {
      useActiveWorkoutSession: () => {
        const [state, setState] = React.useState(initialSessionState)
        updateSessionState = setState
        const session = React.useMemo(() => ({
          stageGenerated: async (exercises, phaseTargets) => {
            setState({ status: 'generated', activeWorkout: { exercises, phaseTargets } })
            return true
          },
          resume: async () => {
            if (!resumedWorkout) return false
            setState({ status: 'owned', activeWorkout: { exercises: [resumedWorkout] } })
            return true
          },
          discard: async () => {
            setState({ status: 'idle', activeWorkout: null })
          },
          retireIdentity: async () => {},
        }), [])
        return [state, session]
      },
    }
  })
  vi.doMock('../components/Generator', () => ({ default: ({ timeBudget, setTimeBudget, unrecoveredGroups, setUnrecoveredGroups, onGenerate }) => <section><h2>Generate Workout</h2><p>Budget {timeBudget}; groups {unrecoveredGroups.join(',')}</p><label>Time Budget<input aria-label="Time Budget" type="range" value={timeBudget} onChange={event => setTimeBudget(Number(event.target.value))} /></label><label><input aria-label="Back unrecovered" type="checkbox" checked={unrecoveredGroups.includes('Back')} onChange={event => setUnrecoveredGroups(event.target.checked ? ['Back'] : [])} />Back</label><button onClick={() => setTimeBudget(60)}>Set 60</button><button onClick={() => setUnrecoveredGroups(['Back'])}>Set Back</button><button onClick={() => onGenerate([{ id: 'same-workout' }])}>Generate nonempty</button></section> }))
  vi.doMock('../components/Settings', settingsFactory ?? (() => ({ default: props => { settingsProps = props; return <section><h2>Catalog Management</h2><button onClick={props.onClose}>Close</button></section> } })))
  vi.doMock('../components/WorkoutView', () => ({ default: ({ session, sessionState, onResume, onFinish, onComplete, onDiscard, preference, onSavePreference }) => <section><h2>Ready to sweat?</h2><p>Status {sessionState.status}</p><p>Workout {sessionState.activeWorkout?.exercises?.[0]?.id}</p><p>Preference {preference?.operation?.state ?? 'none'}</p>{sessionState.status === 'recovery-available' && <button onClick={async () => { if (await session.resume()) onResume?.() }}>Resume</button>}{sessionState.status === 'generated' && <><button onClick={() => onSavePreference?.({ blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }, { exerciseIds: ['c'] }] }, { a: 'Push-ups', b: 'Pull-ups', c: 'Sit-ups' })}>Save order</button><button onClick={() => onSavePreference?.({ blocks: [{ exerciseIds: ['c'] }, { exerciseIds: ['b'] }, { exerciseIds: ['a'] }] }, { a: 'Push-ups', b: 'Pull-ups', c: 'Sit-ups' })}>Save newer order</button><button onClick={() => (onComplete ?? onFinish)?.()}>Completed back to plan</button><button onClick={async () => { await session.discard(); (onDiscard ?? onFinish)?.() }}>Cancel generated</button></>}</section> }))
  const { default: App } = await import('../App'); render(<App />)
  return { emit: value => act(async () => observers[0](value)), emitSync: value => act(() => observers[0](value)), setSessionState: value => act(() => updateSessionState(value)), settingsProps: () => settingsProps, evaluate }
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetModules(); vi.doUnmock('../utils/auth'); vi.doUnmock('../utils/storage'); vi.doUnmock('../utils/useActiveWorkoutSession'); vi.doUnmock('../components/Generator'); vi.doUnmock('../components/Settings'); vi.doUnmock('../components/WorkoutView') })

describe('lazy authorized navigation', () => {
  it('routes an active acquisition blocker to WorkoutView', async () => {
    const app = await mount({ initialSessionState: { status: 'blocked', blocked: true, error: 'unsupported', activeWorkout: { exercises: [{ id: 'blocked-workout' }] } } })
    await app.emit(approved('u1'))
    expect(await screen.findByText('Status blocked')).toBeTruthy()
  })

  it('hides the Catalog utility only while the Workout destination is forced by session recovery', async () => {
    const app = await mount(); await app.emit(approved('u1'))
    expect(await screen.findByRole('button', { name: 'Manage Catalog' })).toBeTruthy()
    for (const status of ['checking', 'recovery-available', 'recovery-blocked', 'blocked']) {
      app.setSessionState({ status, blocked: true, error: status === 'recovery-blocked' ? 'timeout' : null, activeWorkout: null })
      expect(await screen.findByText(`Status ${status}`)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Manage Catalog' })).toBeNull()
    }
    app.setSessionState({ status: 'owned', blocked: false, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } })
    expect(await screen.findByRole('button', { name: 'Manage Catalog' })).toBeTruthy()
    app.setSessionState({ status: 'review', blocked: true, pendingSave: { state: 'blocked-conflict' }, activeWorkout: { exercises: [{ id: 'ordinary-review' }] } })
    expect(screen.getByRole('button', { name: 'Manage Catalog' })).toBeTruthy()
  })

  it('keeps the recovered workout destination after Resume and Settings detours', async () => {
    const app = await mount({ initialSessionState: { status: 'recovery-available', blocked: true, activeWorkout: { exercises: [{ id: 'recovered-workout' }] } }, resumedWorkout: { id: 'recovered-workout' } })
    await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))
    expect(await screen.findByText('Status owned')).toBeTruthy()
    expect(screen.getByText('Workout recovered-workout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' }))
    await screen.findByRole('heading', { name: 'Catalog Management' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByText('Workout recovered-workout')).toBeTruthy()
  })

  it('keeps focus on Plan controls when lifted selections rerender App', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    const slider = screen.getByRole('slider', { name: 'Time Budget' }); slider.focus(); fireEvent.change(slider, { target: { value: '60' } })
    expect(document.activeElement).toBe(slider)
    const checkbox = screen.getByRole('checkbox', { name: 'Back unrecovered' }); checkbox.focus(); fireEvent.click(checkbox)
    expect(document.activeElement).toBe(checkbox)
  })

  it('routes unsaved Settings state into the shell sign-out confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const app = await mount(); await app.emit(approved('u1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    act(() => app.settingsProps().onDirtyChange(true));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(confirm).toHaveBeenCalled();
  })

  it('returns Settings opened from Plan to preserved selections through Close and header Back', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByText('Set 60')); fireEvent.click(screen.getByText('Set Back'))
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' })
    expect(screen.getByRole('button', { name: 'Back to Generator' })).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const plan = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(plan)); expect(screen.getByText('Budget 60; groups Back')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Back to Generator' }))
    const returnedPlan = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(returnedPlan))
  })

  it('returns Settings opened from Workout to the same generated workout through Close and header Back', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' }); expect(screen.getByRole('button', { name: 'Back to Workout' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' })); const workout = await screen.findByRole('heading', { name: 'Ready to sweat?' }); await waitFor(() => expect(document.activeElement).toBe(workout)); expect(screen.getByText('Workout same-workout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Back to Workout' }))
    const returnedWorkout = await screen.findByRole('heading', { name: 'Ready to sweat?' }); await waitFor(() => expect(document.activeElement).toBe(returnedWorkout))
  })

  it('does not resurrect a cancelled generated plan after a Settings detour', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByText('Workout same-workout');
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel generated' }));
    expect(await screen.findByRole('heading', { name: 'Generate Workout' })).toBeTruthy();
    expect(screen.queryByText('Workout same-workout')).toBeNull();
  })

  it('keeps one captured save operation across a Settings detour and releases only Start after 15 seconds', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save order' })) }); expect(screen.getByText('Preference pending')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15_000) });
    expect(screen.getByText('Preference indeterminate')).toBeTruthy(); vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.state).toBe('indeterminate');
    await act(async () => settle({ contextKey: '["a","b"]' }));
    expect(app.settingsProps().preference.operation.state).toBe('success');
    expect(savePreferredOrderRule).toHaveBeenCalledOnce();
  })

  it('keeps an indeterminate save after completed-workout exit but clears it after discard', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: 'Save order' })); expect(screen.getByText('Preference pending')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15_000) }); expect(screen.getByText('Preference indeterminate')).toBeTruthy(); vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Completed back to plan' })); await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.state).toBe('indeterminate');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Workout' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); fireEvent.click(screen.getByRole('button', { name: 'Cancel generated' }));
    await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation).toBeNull();
    await act(async () => settle({ contextKey: '["a","b","c"]', evicted: null, overridden: [] }));
    expect(app.settingsProps().preference.operation).toBeNull();
  })

  it('keeps named override and eviction outcome copy above lazy destinations', async () => {
    const savePreferredOrderRule = vi.fn().mockResolvedValue({ contextKey: '["a","b","c"]', evicted: '["a","b"]', overridden: [{ contextKey: '["a","b"]', rule: { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }] } }] });
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' })); await waitFor(() => expect(savePreferredOrderRule).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.successMessage).toBe('Order saved for workouts with Push-ups, Pull-ups, and Sit-ups. This order takes priority over your saved preference for Push-ups before Pull-ups. That preference still applies in workouts without Sit-ups. Nudge removed the saved order for Push-ups and Pull-ups to keep your 50 most recently used orders.');
  })

  it('captures a later dirty save instead of reusing a prior successful candidate', async () => {
    const savePreferredOrderRule = vi.fn().mockResolvedValue({ contextKey: '["a","b","c"]', evicted: null, overridden: [] });
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' })); await waitFor(() => expect(screen.getByText('Preference success')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Save newer order' }));
    await waitFor(() => expect(savePreferredOrderRule).toHaveBeenCalledTimes(2));
    expect(savePreferredOrderRule.mock.calls[1][1]).toEqual({ blocks: [{ exerciseIds: ['c'] }, { exerciseIds: ['b'] }, { exerciseIds: ['a'] }] });
  })

  it('keeps a definitive save retry after a clear failure', async () => {
    const candidate = { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }, { exerciseIds: ['c'] }] };
    const app = await mount({ storage: { savePreferredOrderRule: vi.fn().mockRejectedValue(new Error('offline')), clearPreferredOrderRules: vi.fn().mockRejectedValue(new Error('offline')) } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await waitFor(() => expect(screen.getByText('Preference failure')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    await act(async () => { app.settingsProps().onClearPreferences() });
    await waitFor(() => expect(app.settingsProps().preference.operation).toMatchObject({ state: 'failure', candidate }));
  })

  it('ignores a delayed save settlement after identity reset', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await app.emit(null); await screen.findByRole('button', { name: 'Sign in with Google' }); await act(async () => settle({ contextKey: '["a","b","c"]', evicted: null, overridden: [] }));
    await app.emit(approved('u2')); await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation).toBeNull();
  })

  it('preserves same-UID lifted state but clears it for changed UID, pending access, and signout/reapproval', async () => {
    const evaluate = vi.fn(async user => ({ claims: { approved: user.uid !== 'pending' } })); const app = await mount({ evaluate })
    await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByText('Set 60')); fireEvent.click(screen.getByText('Set Back'))
    app.emitSync(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' }); expect(screen.getByText('Budget 60; groups Back')).toBeTruthy()
    await app.emit(approved('u2')); await screen.findByRole('heading', { name: 'Generate Workout' }); expect(screen.getByText('Budget 45; groups')).toBeTruthy()
    fireEvent.click(screen.getByText('Set 60')); await app.emit(approved('pending')); await screen.findByRole('heading', { name: 'Awaiting approval' }); await app.emit(approved('u2')); await screen.findByRole('heading', { name: 'Generate Workout' }); expect(screen.getByText('Budget 45; groups')).toBeTruthy()
    fireEvent.click(screen.getByText('Set 60')); await app.emit(null); await screen.findByRole('button', { name: 'Sign in with Google' }); await app.emit(approved('u2')); await screen.findByRole('heading', { name: 'Generate Workout' }); expect(screen.getByText('Budget 45; groups')).toBeTruthy()
  })

  it('suppresses a deferred Settings result after Back restores Plan', async () => {
    let resolveSettings
    const app = await mount({ settingsFactory: () => new Promise(resolve => { resolveSettings = () => resolve({ default: () => <h2>Catalog Management</h2> }) }) })
    await app.emit(approved('u1')); const plan = await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage Catalog' })); expect(screen.getByRole('heading', { name: 'Loading catalog settings…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Generator' })); const restored = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(restored))
    await act(async () => resolveSettings())
    expect(screen.queryByRole('heading', { name: 'Catalog Management' })).toBeNull(); expect(document.activeElement).toBe(restored); expect(plan).not.toBeNull()
  })
})
