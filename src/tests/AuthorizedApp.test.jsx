import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

vi.mock('../components/Generator', () => ({ default: () => <section>Planner</section> }))

it('keeps the current generated workout visible while its replacement is edited', async () => {
  const { default: AuthorizedApp } = await import('../components/AuthorizedApp')
  render(<AuthorizedApp workout={[{ id: 'old', name: 'Existing row' }]} />)
  expect(screen.getByRole('heading', { name: 'Current workout' })).toBeTruthy()
  expect(screen.getByText('This workout remains unchanged until a replacement is ready.')).toBeTruthy()
  expect(screen.getByRole('listitem').textContent).toBe('Existing row')
})
