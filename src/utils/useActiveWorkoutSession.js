import { useEffect, useMemo, useState } from 'react';
import { createActiveWorkoutCoordinator } from './activeWorkoutCoordinator';
import { createBrowserActiveWorkoutAdapter } from './activeWorkoutBrowserAdapter';
import { createActiveWorkoutSession } from './activeWorkoutSession';
import * as storage from './storage';

/** The caller supplies the product-approved recovery expiry policy. */
export function useActiveWorkoutSession({ projectId, user, staleAfterMs }) {
  const uid = user?.uid ?? null;
  const session = useMemo(() => {
    const adapter = createBrowserActiveWorkoutAdapter();
    const coordinator = createActiveWorkoutCoordinator({ ...adapter, staleAfterMs });
    return createActiveWorkoutSession({ coordinator, projectId, subscribeHandoff: adapter.subscribeHandoff,
      saveImmutableWorkout: (...args) => storage.saveImmutableWorkout(...args),
      readImmutableWorkoutFromServer: (...args) => storage.readImmutableWorkoutFromServer(...args),
    });
  }, [projectId, staleAfterMs]);
  const [state, setState] = useState(session.getState());
  useEffect(() => session.subscribe(setState), [session]);
  useEffect(() => {
    if (!uid || session.isIdentity(uid)) return;
    setState({ ...session.getState(), status: 'checking', blocked: true, error: null });
    void session.bootstrap({ uid });
  }, [session, uid]);
  return [state, session];
}
