import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { cleanup(); vi.resetModules(); vi.doUnmock('../utils/activeWorkoutSession'); vi.doUnmock('../utils/activeWorkoutCoordinator'); vi.doUnmock('../utils/activeWorkoutBrowserAdapter'); vi.doUnmock('../utils/storage'); });

test('does not retire an active identity during a transient same-UID authorization check', async () => {
  const session = { getState: () => ({ status: 'owned', activeWorkout: { phase: 'performance' }, blocked: false }), subscribe: () => () => {}, bootstrap: vi.fn(async () => {}), retireIdentity: vi.fn(async () => {}), isIdentity: vi.fn(() => true) };
  vi.doMock('../utils/activeWorkoutSession', () => ({ createActiveWorkoutSession: () => session }));
  vi.doMock('../utils/activeWorkoutCoordinator', () => ({ createActiveWorkoutCoordinator: () => ({}) }));
  vi.doMock('../utils/activeWorkoutBrowserAdapter', () => ({ createBrowserActiveWorkoutAdapter: () => ({ subscribeHandoff: () => () => {} }) }));
  vi.doMock('../utils/storage', () => ({ saveImmutableWorkout: vi.fn(), readImmutableWorkoutFromServer: vi.fn() }));
  const { useActiveWorkoutSession } = await import('../utils/useActiveWorkoutSession');
  function Harness({ user }) { useActiveWorkoutSession({ projectId: 'p', user, staleAfterMs: 1 }); return null; }
  const view = render(<Harness user={{ uid: 'u' }} />);
  await act(async () => {});
  view.rerender(<Harness user={null} />);
  await act(async () => {});
  view.rerender(<Harness user={{ uid: 'u' }} />);
  await act(async () => {});

  expect(session.retireIdentity).not.toHaveBeenCalled();
  expect(session.bootstrap).not.toHaveBeenCalled();
});
