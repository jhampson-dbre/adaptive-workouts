import { describe, expect, it, vi } from 'vitest';
import { applyScenarioAction, stageScenarioStart } from '../../scripts/emulator/access-scenarios/staging.mjs';

const hosts = { auth: '127.0.0.1:19099', firestore: '127.0.0.1:18080' };
const withFakeAdmin = (claims = { approved: true }) => {
  const auth = { getUser: vi.fn(async () => ({ uid: 'emulator-baseline-user', customClaims: claims })), setCustomUserClaims: vi.fn(async (_uid, next) => { claims = next; }) };
  const withAdmin = vi.fn(async (options, callback) => callback({ auth }));
  return { auth, withAdmin };
};

describe('access scenario claim staging', () => {
  it('stages UX-10-02 pending before startup and reads the exact state back through the project/host-bound Admin client', async () => {
    const fake = withFakeAdmin(); const result = await stageScenarioStart({ scenario: { id: 'UX-10-02', startState: 'pending' }, projectId: 'demo-project', hosts, withAdmin: fake.withAdmin });
    expect(fake.withAdmin).toHaveBeenCalledWith({ projectId: 'demo-project', hosts }, expect.any(Function));
    expect(fake.auth.setCustomUserClaims).toHaveBeenCalledWith('emulator-baseline-user', {}); expect(result).toEqual({ uid: 'emulator-baseline-user', approved: false, claims: {} });
  });
  it('executes registered approve and revoke actions with observed claim readback, while adapter controls only queue evaluator faults', async () => {
    const fake = withFakeAdmin({}); const approve = await applyScenarioAction({ action: 'approve-user', projectId: 'demo-project', hosts, withAdmin: fake.withAdmin }); const revoke = await applyScenarioAction({ action: 'revoke-user', projectId: 'demo-project', hosts, withAdmin: fake.withAdmin });
    expect(approve).toMatchObject({ action: 'approve-user', approved: true }); expect(approve).not.toHaveProperty('queueAction'); expect(revoke).toMatchObject({ action: 'revoke-user', approved: false, claims: {} });
    expect(await applyScenarioAction({ action: 'reject-next-evaluation', projectId: 'demo-project', hosts, withAdmin: fake.withAdmin })).toEqual({ action: 'reject-next-evaluation', queueAction: 'reject-next-evaluation', acknowledgement: true });
    expect(await applyScenarioAction({ action: 'pass', projectId: 'demo-project', hosts, withAdmin: fake.withAdmin })).toEqual({ action: 'pass', acknowledgement: true });
  });
});
