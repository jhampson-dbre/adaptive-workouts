import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../../scripts/manage-user-approval.mjs';

const createDeps = (overrides = {}) => {
  const auth = {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    setCustomUserClaims: vi.fn(),
  };
  return {
    applicationDefault: vi.fn(() => ({ kind: 'adc' })),
    auth,
    error: vi.fn(),
    getAuth: vi.fn(() => auth),
    info: vi.fn(),
    initializeApp: vi.fn(() => ({ kind: 'app' })),
    ...overrides,
  };
};

describe('manage-user-approval', () => {
  it('keeps the complete inline value when a selector contains an equals sign', async () => {
    const deps = createDeps();
    deps.auth.getUserByEmail.mockResolvedValue({
      customClaims: {},
      email: 'owner=ops@example.com',
      uid: 'user-123',
    });

    await expect(main(['approve', '--email=owner=ops@example.com', '--project-id=demo-project'], deps)).resolves.toBe(0);

    expect(deps.auth.getUserByEmail).toHaveBeenCalledWith('owner=ops@example.com');
  });

  it('maps both package aliases to the intended action', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['approve-user']).toBe('node scripts/manage-user-approval.mjs approve');
    expect(packageJson.scripts['revoke-user']).toBe('node scripts/manage-user-approval.mjs revoke');
  });

  it('initializes Admin with explicit project-targeted ADC and approves by email', async () => {
    const deps = createDeps();
    deps.auth.getUserByEmail.mockResolvedValue({
      customClaims: { role: 'coach' },
      email: 'person@example.com',
      uid: 'user-123',
    });

    await expect(main(['approve', '--email', 'person@example.com', '--project-id', 'demo-project'], deps)).resolves.toBe(0);

    expect(deps.applicationDefault).toHaveBeenCalledOnce();
    expect(deps.initializeApp).toHaveBeenCalledWith({ credential: { kind: 'adc' }, projectId: 'demo-project' });
    expect(deps.getAuth).toHaveBeenCalledWith({ kind: 'app' });
    expect(deps.auth.getUserByEmail).toHaveBeenCalledWith('person@example.com');
    expect(deps.auth.setCustomUserClaims).toHaveBeenCalledWith('user-123', { approved: true, role: 'coach' });
    expect(deps.info).toHaveBeenCalledWith(expect.stringContaining('demo-project'));
    expect(deps.info).toHaveBeenCalledWith(expect.stringContaining('updated'));
  });

  it('revokes by UID without changing unrelated claims', async () => {
    const deps = createDeps();
    deps.auth.getUser.mockResolvedValue({
      customClaims: { approved: false, role: 'coach' },
      email: 'person@example.com',
      uid: 'user-123',
    });

    await expect(main(['revoke', '--uid=user-123', '--project-id=demo-project'], deps)).resolves.toBe(0);

    expect(deps.auth.getUser).toHaveBeenCalledWith('user-123');
    expect(deps.auth.setCustomUserClaims).toHaveBeenCalledWith('user-123', { role: 'coach' });
  });

  it('succeeds without mutation when the requested claim state already exists', async () => {
    const deps = createDeps();
    deps.auth.getUser.mockResolvedValue({
      customClaims: { approved: true, role: 'coach' },
      email: 'person@example.com',
      uid: 'user-123',
    });

    await expect(main(['approve', '--uid', 'user-123', '--project-id', 'demo-project'], deps)).resolves.toBe(0);

    expect(deps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.info).toHaveBeenCalledWith(expect.stringContaining('no change'));
  });

  it('does not mutate when revocation has no approval claim to remove', async () => {
    const deps = createDeps();
    deps.auth.getUser.mockResolvedValue({
      customClaims: { role: 'coach' },
      email: 'person@example.com',
      uid: 'user-123',
    });

    await expect(main(['revoke', '--uid', 'user-123', '--project-id', 'demo-project'], deps)).resolves.toBe(0);

    expect(deps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.info).toHaveBeenCalledWith(expect.stringContaining('no change'));
  });

  it.each([
    ['approve', '--email', 'person@example.com'],
    ['approve', '--email', 'person@example.com', '--uid', 'user-123', '--project-id', 'demo-project'],
    ['approve', '--email', 'person@example.com', '--project-id', 'demo-project', '--unexpected'],
  ])('rejects invalid input without initializing or mutating', async (...argv) => {
    const deps = createDeps();

    await expect(main(argv, deps)).resolves.toBe(1);

    expect(deps.initializeApp).not.toHaveBeenCalled();
    expect(deps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledOnce();
  });

  it('reports lookup and credential failures without mutation or secret output', async () => {
    const lookupDeps = createDeps();
    lookupDeps.auth.getUser.mockRejectedValue(new Error('permission denied'));
    await expect(main(['approve', '--uid', 'user-123', '--project-id', 'demo-project'], lookupDeps)).resolves.toBe(1);
    expect(lookupDeps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(lookupDeps.error).toHaveBeenCalledWith(expect.stringContaining('Unable to approve user'));

    const credentialDeps = createDeps({ applicationDefault: vi.fn(() => { throw new Error('credential unavailable: super-secret-token'); }) });
    await expect(main(['approve', '--uid', 'user-123', '--project-id', 'demo-project'], credentialDeps)).resolves.toBe(1);
    expect(credentialDeps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(credentialDeps.error).toHaveBeenCalledWith(expect.stringContaining('Unable to approve user'));
    expect(credentialDeps.error).not.toHaveBeenCalledWith(expect.stringContaining('super-secret-token'));

    const initializationDeps = createDeps({ initializeApp: vi.fn(() => { throw new Error('initialization failed'); }) });
    await expect(main(['approve', '--uid', 'user-123', '--project-id', 'demo-project'], initializationDeps)).resolves.toBe(1);
    expect(initializationDeps.getAuth).not.toHaveBeenCalled();
    expect(initializationDeps.auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('returns nonzero without mutation when the selected user is missing', async () => {
    const deps = createDeps();
    deps.auth.getUserByEmail.mockRejectedValue(Object.assign(new Error('missing user'), { code: 'auth/user-not-found' }));

    await expect(main(['approve', '--email', 'missing@example.com', '--project-id', 'demo-project'], deps)).resolves.toBe(1);

    expect(deps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.info).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('Unable to approve user'));
  });

  it('returns nonzero without lookup or mutation when explicit project targeting fails', async () => {
    const deps = createDeps({ initializeApp: vi.fn(() => { throw new Error('project not found'); }) });

    await expect(main(['revoke', '--uid', 'user-123', '--project-id', 'wrong-project'], deps)).resolves.toBe(1);

    expect(deps.initializeApp).toHaveBeenCalledWith({ credential: { kind: 'adc' }, projectId: 'wrong-project' });
    expect(deps.getAuth).not.toHaveBeenCalled();
    expect(deps.auth.getUser).not.toHaveBeenCalled();
    expect(deps.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('Unable to revoke user'));
  });
});
