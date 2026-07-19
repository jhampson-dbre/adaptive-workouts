export const createAuthForMode = (app, baseline, {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
}) => baseline
  ? initializeAuth(app, { persistence: inMemoryPersistence })
  : getAuth(app);
