export const createAuthForMode = (app, baseline, {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
}) => baseline
  ? initializeAuth(app, { persistence: inMemoryPersistence })
  : getAuth(app);

export const parseEmulatorHost = (value, fallback) => {
  const host = value ?? fallback;
  if (!/^(127\.0\.0\.1|localhost):[1-9]\d{0,4}$/.test(host)) throw new Error(`Invalid emulator host: ${host}`);
  const [hostname, port] = host.split(':');
  if (Number(port) > 65535) throw new Error(`Invalid emulator host: ${host}`);
  return { host: hostname, port: Number(port), value: host };
};
