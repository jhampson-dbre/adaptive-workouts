import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const approved = uid => ({ uid, email: `${uid}@example.test` })

async function mount({ evaluate = vi.fn(async () => ({ claims: { approved: true } })), settingsFactory } = {}) {
  const observers = []
  vi.doMock('../utils/auth', () => ({
    subscribeToIdTokenChanges: callback => { observers.push(callback); return vi.fn() },
    evaluateAccessToken: evaluate,
    isApprovedTokenResult: value => value?.claims?.approved === true,
    signOutUser: vi.fn(),
  }))
  vi.doMock('../utils/storage', () => ({ migrateLocalData: vi.fn() }))
  vi.doMock('../components/Generator', () => ({ default: ({ timeBudget, setTimeBudget, unrecoveredGroups, setUnrecoveredGroups, onGenerate }) => <section><h2>Generate Workout</h2><p>Budget {timeBudget}; groups {unrecoveredGroups.join(',')}</p><label>Time Budget<input aria-label="Time Budget" type="range" value={timeBudget} onChange={event => setTimeBudget(Number(event.target.value))} /></label><label><input aria-label="Back unrecovered" type="checkbox" checked={unrecoveredGroups.includes('Back')} onChange={event => setUnrecoveredGroups(event.target.checked ? ['Back'] : [])} />Back</label><button onClick={() => setTimeBudget(60)}>Set 60</button><button onClick={() => setUnrecoveredGroups(['Back'])}>Set Back</button><button onClick={() => onGenerate([{ id: 'same-workout' }])}>Generate nonempty</button></section> }))
  vi.doMock('../components/Settings', settingsFactory ?? (() => ({ default: ({ onClose }) => <section><h2>Catalog Management</h2><button onClick={onClose}>Close</button></section> })))
  vi.doMock('../components/WorkoutView', () => ({ default: ({ workout }) => <section><h2>Ready to sweat?</h2><p>Workout {workout?.[0]?.id}</p></section> }))
  const { default: App } = await import('../App'); render(<App />)
  return { emit: value => act(async () => observers[0](value)), emitSync: value => act(() => observers[0](value)), evaluate }
}

afterEach(() => { cleanup(); vi.resetModules(); vi.doUnmock('../utils/auth'); vi.doUnmock('../utils/storage'); vi.doUnmock('../components/Generator'); vi.doUnmock('../components/Settings'); vi.doUnmock('../components/WorkoutView') })

describe('lazy authorized navigation', () => {
  it('keeps focus on Plan controls when lifted selections rerender App', async () => {
    const app = await mount(); await app.emit(approved('u1')); await screen.findByRole('heading', { name: 'Generate Workout' })
    const slider = screen.getByRole('slider', { name: 'Time Budget' }); slider.focus(); fireEvent.change(slider, { target: { value: '60' } })
    expect(document.activeElement).toBe(slider)
    const checkbox = screen.getByRole('checkbox', { name: 'Back unrecovered' }); checkbox.focus(); fireEvent.click(checkbox)
    expect(document.activeElement).toBe(checkbox)
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
