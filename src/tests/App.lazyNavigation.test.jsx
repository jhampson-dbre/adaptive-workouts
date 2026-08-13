import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const approved = uid => ({ uid, email: `${uid}@example.test` })

async function mount({ evaluate = vi.fn(async () => ({ claims: { approved: true } })), settingsFactory, historyFactory, initialSessionState = { status: 'idle', activeWorkout: null }, resumedWorkout, storage = {}, startWorkout = vi.fn(async () => true) } = {}) {
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
  vi.doMock('../components/Generator', () => ({ default: ({ timeBudget, setTimeBudget, unrecoveredGroups, setUnrecoveredGroups, onGenerate, preference }) => <section><h2>Generate Workout</h2><p>Budget {timeBudget}; groups {unrecoveredGroups.join(',')}</p><p>Plan preference {preference?.operation?.state ?? 'none'}</p><label>Time Budget<input aria-label="Time Budget" type="range" value={timeBudget} onChange={event => setTimeBudget(Number(event.target.value))} /></label><label><input aria-label="Back unrecovered" type="checkbox" checked={unrecoveredGroups.includes('Back')} onChange={event => setUnrecoveredGroups(event.target.checked ? ['Back'] : [])} />Back</label><button onClick={() => setTimeBudget(60)}>Set 60</button><button onClick={() => setUnrecoveredGroups(['Back'])}>Set Back</button><button onClick={() => onGenerate([{ id: 'same-workout' }])}>Generate nonempty</button></section> }))
  vi.doMock('../components/Settings', settingsFactory ?? (() => ({ default: props => { settingsProps = props; return <section><h2>Catalog Management</h2><button onClick={props.onClose}>Close</button></section> } })))
  vi.doMock('../components/WorkoutHistory', historyFactory ?? (() => ({ default: ({ historyKey, loadPage }) => <section><h2>History</h2><h3>Workouts</h3><p>History for {historyKey}</p><button onClick={() => loadPage({ cursor: null, pageSize: 20 })}>Load workouts</button></section> })))
  vi.doMock('../components/WorkoutView', () => ({ default: ({ session, sessionState, onResume, onFinish, onComplete, onDiscard, onBackToPlan, preference, onSavePreference, onStarted }) => sessionState.status === 'saved' ? <section><h2>Workout saved</h2><p>Saved receipt {sessionState.savedReceipt?.id}</p></section> : <section><h2>Ready to sweat?</h2><p>Status {sessionState.status}</p><p>Workout {sessionState.activeWorkout?.exercises?.[0]?.id}</p><p>Preference {preference?.operation?.state ?? 'none'}</p>{sessionState.status === 'recovery-available' && <button onClick={async () => { if (await session.resume()) onResume?.() }}>Resume</button>}{sessionState.status === 'generated' && <><button onClick={() => onSavePreference?.({ blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }, { exerciseIds: ['c'] }] }, { a: 'Push-ups', b: 'Pull-ups', c: 'Sit-ups' })}>Save order</button><button onClick={() => onSavePreference?.({ blocks: [{ exerciseIds: ['c'] }, { exerciseIds: ['b'] }, { exerciseIds: ['a'] }] }, { a: 'Push-ups', b: 'Pull-ups', c: 'Sit-ups' })}>Save newer order</button><button onClick={async () => { const successId = preference?.operation?.state === 'success' ? preference.operation.id : undefined; if (await startWorkout()) onStarted?.(sessionState.activeWorkout.exercises, successId) }}>Start workout</button><button onClick={() => (onComplete ?? onFinish)?.()}>Completed back to plan</button><button onClick={async () => { await session.discard(); onBackToPlan?.() }}>Back to Plan</button><button onClick={async () => { await session.discard(); (onDiscard ?? onFinish)?.() }}>Cancel generated</button></>}</section> }))
  const { default: App } = await import('../App'); render(<App />)
  return { emit: value => act(async () => observers[0](value)), emitSync: value => act(() => observers[0](value)), setSessionState: value => act(() => updateSessionState(value)), settingsProps: () => settingsProps, evaluate }
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetModules(); vi.doUnmock('../utils/auth'); vi.doUnmock('../utils/storage'); vi.doUnmock('../utils/useActiveWorkoutSession'); vi.doUnmock('../components/Generator'); vi.doUnmock('../components/Settings'); vi.doUnmock('../components/WorkoutHistory'); vi.doUnmock('../components/WorkoutView') })

describe('lazy authorized navigation', () => {
  it('opens History as a lazy primary destination and preserves Plan inputs', async () => {
    const getHistoryPage = vi.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null })
    const app = await mount({ storage: { getHistoryPage } }); await app.emit(approved('u1'))
    await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByText('Set 60'))
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    const history = await screen.findByRole('heading', { name: 'History' })
    await waitFor(() => expect(document.activeElement).toBe(history))
    fireEvent.click(screen.getByRole('button', { name: 'Load workouts' }))
    await waitFor(() => expect(getHistoryPage).toHaveBeenCalledWith('u1', { cursor: null, pageSize: 20 }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(await screen.findByText('Budget 60; groups')).toBeTruthy()
  })

  it('passes History an account-scoped complete-range loader', async () => {
    let historyProps
    const getCompleteHistoryRange = vi.fn().mockResolvedValue([])
    const app = await mount({
      storage: { getCompleteHistoryRange },
      historyFactory: () => ({ default: props => { historyProps = props; return <section><h2>History</h2></section> } }),
    })
    await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    await screen.findByRole('heading', { name: 'History' })
    await historyProps.loadRange({ range: '3M', endDate: '2026-08-10' })
    expect(getCompleteHistoryRange).toHaveBeenCalledWith('u1', { range: '3M', endDate: '2026-08-10' })
    const stableLoader = historyProps.loadRange
    app.setSessionState({ status: 'owned', blocked: false, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } })
    await waitFor(() => expect(historyProps.loadRange).toBe(stableLoader))
  })

  it('returns an empty-History Plan action to an existing generated review', async () => {
    const app = await mount({
      historyFactory: () => ({ default: ({ onPlan }) => <section><h2>History</h2><button onClick={onPlan}>Plan a workout</button></section> }),
    })
    await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Generate nonempty' }))
    await screen.findByRole('heading', { name: 'Ready to sweat?' })
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Plan a workout' }))

    expect(await screen.findByText('Workout same-workout')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy()
  })

  it('retries a failed History lazy import from its generated entry URL', async () => {
    const app = await mount({ historyFactory: () => Promise.reject(new Error('offline')) })
    await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry loading workout history' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy()
  })

  it('preserves an ordinary active workout through History and forces Workout while saving or blocked', async () => {
    const app = await mount({ initialSessionState: { status: 'owned', blocked: false, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } } })
    await app.emit(approved('u1'))
    expect(await screen.findByRole('button', { name: 'History' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await screen.findByRole('heading', { name: 'History' })
    fireEvent.click(screen.getByRole('button', { name: 'Workout' }))
    expect(await screen.findByText('Workout ordinary-workout')).toBeTruthy()
    app.setSessionState({ status: 'save-pending', blocked: false, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } })
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull()
    app.setSessionState({ status: 'owned', blocked: true, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } })
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull()
  })

  it('labels a generated workout as Plan until Start workout succeeds', async () => {
    const app = await mount(); await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Generate nonempty' }))
    await screen.findByRole('heading', { name: 'Ready to sweat?' })
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Workout' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Start workout' }))
    app.setSessionState({ status: 'owned', blocked: false, activeWorkout: { exercises: [{ id: 'same-workout' }], workoutStartedAt: 1 } })
    expect(screen.getByRole('button', { name: 'Workout' })).toBeTruthy()
  })

  it('returns from History to the authoritative saved receipt', async () => {
    const app = await mount({ initialSessionState: { status: 'saved', blocked: false, activeWorkout: null, savedReceipt: { id: 'saved-receipt' } } })
    await app.emit(approved('u1'))
    expect(await screen.findByRole('heading', { name: 'Workout saved' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Workout' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await screen.findByRole('heading', { name: 'History' })
    fireEvent.click(screen.getByRole('button', { name: 'Workout' }))
    expect(await screen.findByText('Saved receipt saved-receipt')).toBeTruthy()
  })
  it('routes an active acquisition blocker to WorkoutView', async () => {
    const app = await mount({ initialSessionState: { status: 'blocked', blocked: true, error: 'unsupported', activeWorkout: { exercises: [{ id: 'blocked-workout' }] } } })
    await app.emit(approved('u1'))
    expect(await screen.findByText('Status blocked')).toBeTruthy()
  })

  it('hides the Catalog utility only while the Workout destination is forced by session recovery', async () => {
    const app = await mount(); await app.emit(approved('u1'))
    expect(await screen.findByRole('button', { name: 'Settings' })).toBeTruthy()
    for (const status of ['checking', 'recovery-available', 'recovery-blocked', 'blocked']) {
      app.setSessionState({ status, blocked: true, error: status === 'recovery-blocked' ? 'timeout' : null, activeWorkout: null })
      expect(await screen.findByText(`Status ${status}`)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
    }
    app.setSessionState({ status: 'owned', blocked: false, activeWorkout: { exercises: [{ id: 'ordinary-workout' }] } })
    expect(await screen.findByRole('button', { name: 'Settings' })).toBeTruthy()
    app.setSessionState({ status: 'review', blocked: true, pendingSave: { state: 'blocked-conflict' }, activeWorkout: { exercises: [{ id: 'ordinary-review' }] } })
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })

  it('keeps the recovered workout destination after Resume and Settings detours', async () => {
    const app = await mount({ initialSessionState: { status: 'recovery-available', blocked: true, activeWorkout: { exercises: [{ id: 'recovered-workout' }] } }, resumedWorkout: { id: 'recovered-workout' } })
    await app.emit(approved('u1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))
    expect(await screen.findByText('Status owned')).toBeTruthy()
    expect(screen.getByText('Workout recovered-workout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
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
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    act(() => app.settingsProps().onDirtyChange(true));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(confirm).toHaveBeenCalled();
  })

  it('returns Settings opened from Plan to preserved selections through Close and header Back', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByText('Set 60')); fireEvent.click(screen.getByText('Set Back'))
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' })
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const plan = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(plan)); expect(screen.getByText('Budget 60; groups Back')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    const returnedPlan = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(returnedPlan))
  })

  it('returns Settings opened from Workout to the same generated workout through Close and header Back', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' })
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' }); expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' })); const workout = await screen.findByRole('heading', { name: 'Ready to sweat?' }); await waitFor(() => expect(document.activeElement).toBe(workout)); expect(screen.getByText('Workout same-workout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    const returnedWorkout = await screen.findByRole('heading', { name: 'Ready to sweat?' }); await waitFor(() => expect(document.activeElement).toBe(returnedWorkout))
  })

  it('does not resurrect a cancelled generated plan after a Settings detour', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByText('Workout same-workout');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' }); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel generated' }));
    expect(await screen.findByRole('heading', { name: 'Generate Workout' })).toBeTruthy();
    expect(screen.queryByText('Workout same-workout')).toBeNull();
  })

  it('returns an unstarted workout to Plan without retiring its pending order save', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByText('Set 60')); fireEvent.click(screen.getByText('Set Back')); fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' })); expect(screen.getByText('Preference pending')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Plan' }));
    const plan = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(plan));
    expect(screen.getByText('Budget 60; groups Back')).toBeTruthy(); expect(screen.getByText('Plan preference pending')).toBeTruthy(); expect(screen.queryByText('Workout same-workout')).toBeNull();
    await act(async () => settle({ contextKey: '["a","b","c"]', evicted: null, overridden: [] }));
    await waitFor(() => expect(screen.getByText('Plan preference success')).toBeTruthy()); expect(document.activeElement).toBe(plan);
  })

  it('keeps one captured save operation across a Settings detour and releases only Start after 15 seconds', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save order' })) }); expect(screen.getByText('Preference pending')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Start workout' })); expect(screen.getByText('Preference pending')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15_000) });
    expect(screen.getByText('Preference indeterminate')).toBeTruthy(); vi.useRealTimers(); fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.state).toBe('indeterminate');
    await act(async () => settle({ contextKey: '["a","b"]' }));
    expect(app.settingsProps().preference.operation.state).toBe('success');
    expect(savePreferredOrderRule).toHaveBeenCalledOnce();
  })

  it('retires only a successful preference save when the workout starts', async () => {
    const candidate = { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }, { exerciseIds: ['c'] }] };
    const savePreferredOrderRule = vi.fn().mockResolvedValue({ contextKey: '["a","b","c"]', evicted: null, overridden: [] });
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' })); await waitFor(() => expect(screen.getByText('Preference success')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.successMessage).toBe('Order saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Plan' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' })); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference).toMatchObject({ baseline: candidate, resolution: null, operation: null });
  })

  it('keeps a save that settles while Start is pending', async () => {
    let settleSave; let settleStart;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settleSave = resolve }));
    const startWorkout = vi.fn(() => new Promise(resolve => { settleStart = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule }, startWorkout }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: 'Save order' })); await act(async () => { vi.advanceTimersByTime(15_000) }); vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start workout' })); await act(async () => settleSave({ contextKey: '["a","b","c"]', evicted: null, overridden: [] })); await waitFor(() => expect(screen.getByText('Preference success')).toBeTruthy());
    await act(async () => settleStart(true)); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation).toMatchObject({ state: 'success' });
  })

  it('keeps an indeterminate save after completed-workout exit but clears it after discard', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: 'Save order' })); expect(screen.getByText('Preference pending')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15_000) }); expect(screen.getByText('Preference indeterminate')).toBeTruthy(); vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Completed back to plan' })); await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation.state).toBe('indeterminate');
    fireEvent.click(screen.getByRole('button', { name: 'Plan' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); fireEvent.click(screen.getByRole('button', { name: 'Cancel generated' }));
    await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation).toBeNull();
    await act(async () => settle({ contextKey: '["a","b","c"]', evicted: null, overridden: [] }));
    expect(app.settingsProps().preference.operation).toBeNull();
  })

  it('keeps named override and eviction outcome copy above lazy destinations', async () => {
    const savePreferredOrderRule = vi.fn().mockResolvedValue({ contextKey: '["a","b","c"]', evicted: '["a","b"]', overridden: [{ contextKey: '["a","b"]', rule: { blocks: [{ exerciseIds: ['a'] }, { exerciseIds: ['b'] }] } }] });
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' })); await waitFor(() => expect(savePreferredOrderRule).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
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
    await waitFor(() => expect(screen.getByText('Preference failure')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: 'Start workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
    expect(app.settingsProps().preference.operation).toMatchObject({ state: 'failure', candidate });
    await act(async () => { app.settingsProps().onClearPreferences() });
    await waitFor(() => expect(app.settingsProps().preference.operation).toMatchObject({ state: 'failure', candidate }));
  })

  it('ignores a delayed save settlement after identity reset', async () => {
    let settle;
    const savePreferredOrderRule = vi.fn(() => new Promise(resolve => { settle = resolve }));
    const app = await mount({ storage: { savePreferredOrderRule } }); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate nonempty' })); await screen.findByRole('heading', { name: 'Ready to sweat?' }); fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await app.emit(null); await screen.findByRole('button', { name: 'Sign in with Google' }); await act(async () => settle({ contextKey: '["a","b","c"]', evicted: null, overridden: [] }));
    await app.emit(approved('u2')); await screen.findByRole('heading', { name: 'Generate Workout' }); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); await screen.findByRole('heading', { name: 'Catalog Management' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Settings' })); expect(screen.getByRole('heading', { name: 'Loading catalog settings…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plan' })); const restored = await screen.findByRole('heading', { name: 'Generate Workout' }); await waitFor(() => expect(document.activeElement).toBe(restored))
    await act(async () => resolveSettings())
    expect(screen.queryByRole('heading', { name: 'Catalog Management' })).toBeNull(); expect(document.activeElement).toBe(restored); expect(plan).not.toBeNull()
  })
})
