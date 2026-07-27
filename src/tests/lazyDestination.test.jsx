import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LazyDestination from '../components/LazyDestination'

describe('LazyDestination', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })
  it.each([
    ['plan', 'Loading workout planner…', 'Loading the workout planner.', 'Workout planner unavailable', 'The workout planner couldn’t be loaded.'],
    ['settings', 'Loading catalog settings…', 'Loading catalog settings.', 'Catalog settings unavailable', 'Catalog settings couldn’t be loaded.'],
    ['workout', 'Loading your workout…', 'Loading your workout.', 'Workout unavailable', 'Your generated workout couldn’t be loaded.'],
  ])('renders exact %s loading and failure feedback with focused labelled headings', async (destination, loadingHeading, loading, failureHeading, failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<LazyDestination destination={destination} loader={() => new Promise(() => {})} />)
    const heading = screen.getByRole('heading', { name: loadingHeading })
    expect(document.activeElement).toBe(heading)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe(loading)
    cleanup()
    render(<LazyDestination destination={destination} loader={() => Promise.reject(new Error('offline'))} />)
    const unavailable = await screen.findByRole('heading', { name: failureHeading })
    expect(document.activeElement).toBe(unavailable)
    expect(screen.getByRole('alert').textContent).toBe(failure)
    expect(unavailable.parentElement.getAttribute('aria-labelledby')).toContain('failure-heading')
  })

  it('keeps retry focused while a fresh import attempt is pending', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn(() => new Promise(() => {}))
    render(<LazyDestination destination="plan" loader={() => Promise.reject(new Error('offline'))} retryLoader={retry} />)
    const button = await screen.findByRole('button', { name: 'Retry loading planner' })
    button.focus(); fireEvent.click(button)
    expect(document.activeElement).toBe(button)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Retrying…')
    expect(retry).toHaveBeenCalledOnce()
  })

  it('restores the alert and enabled same retry control after a rejected retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn(() => Promise.reject(new Error('still offline')))
    render(<LazyDestination destination="plan" loader={() => Promise.reject(new Error('offline'))} retryLoader={retry} />)
    const button = await screen.findByRole('button', { name: 'Retry loading planner' })
    fireEvent.click(button)
    await act(async () => {})
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry loading planner' })).toBe(button)
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await act(async () => {})
    expect(retry.mock.calls.map(([generation]) => generation)).toEqual([1, 2])
  })

  it('uses a fresh retry module and ignores a stale resolution', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let resolve; const retry = vi.fn(() => new Promise(done => { resolve = done }))
    render(<LazyDestination destination="workout" loader={() => Promise.reject(new Error('offline'))} retryLoader={retry} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry loading workout' }))
    await act(async () => resolve({ default: () => <h2>Ready to sweat?</h2> }))
    const ready = await screen.findByRole('heading', { name: 'Ready to sweat?' })
    expect(document.activeElement).toBe(ready)
    cleanup()
    let staleResolve; render(<LazyDestination destination="plan" loader={() => Promise.reject(new Error('offline'))} retryLoader={() => new Promise(done => { staleResolve = done })} isCurrent={() => false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry loading planner' }))
    await act(async () => staleResolve({ default: () => <h2>Generate Workout</h2> }))
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Generate Workout' })).toBeNull()
  })
})
