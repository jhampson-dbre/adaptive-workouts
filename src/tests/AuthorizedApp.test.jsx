import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useState } from 'react'

vi.mock('../components/Generator', () => ({ default: ({ onGenerate }) => <button type="button" onClick={() => onGenerate([])}>Generate empty workout</button> }))

it('preserves the original empty workout result after generation', async () => {
  const { default: AuthorizedApp } = await import('../components/AuthorizedApp')
  function Harness() {
    const [workout, setWorkout] = useState(null)
    return <AuthorizedApp workout={workout} onGenerate={setWorkout} />
  }
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Generate empty workout' })
  trigger.focus(); fireEvent.click(trigger)
  expect(screen.getByRole('heading', { name: 'Your Workout' })).toBeTruthy()
  expect(screen.getByText('No exercises fit the criteria or time budget.')).toBeTruthy()
  expect(document.activeElement).toBe(trigger)
})
