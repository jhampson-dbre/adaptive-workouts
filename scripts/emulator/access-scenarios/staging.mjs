import { BASELINE_PROJECT_ID, BASELINE_USER_ID } from '../fixtures/baseline.mjs';
import { withAdminEmulators } from '../seed-baseline.mjs';

const claimState = user => ({ uid: user.uid, approved: user.customClaims?.approved === true, claims: user.customClaims ?? {} });
const expectedClaims = state => state === 'approved' ? { approved: true } : {};

export async function stageScenarioStart({ scenario, projectId = BASELINE_PROJECT_ID, hosts, withAdmin = withAdminEmulators }) {
  if (!['approved', 'pending'].includes(scenario?.startState)) throw new Error(`Unsupported access scenario start state: ${scenario?.startState}`);
  return withAdmin({ projectId, hosts }, async ({ auth }) => {
    await auth.setCustomUserClaims(BASELINE_USER_ID, expectedClaims(scenario.startState));
    const observed = claimState(await auth.getUser(BASELINE_USER_ID));
    if (observed.approved !== (scenario.startState === 'approved') || JSON.stringify(observed.claims) !== JSON.stringify(expectedClaims(scenario.startState))) throw new Error(`Scenario start state readback failed for ${scenario.id}`);
    return observed;
  });
}

export async function applyScenarioAction({ action, projectId = BASELINE_PROJECT_ID, hosts, withAdmin = withAdminEmulators }) {
  if (action === 'reject-next-evaluation' || action === 'hold-next-evaluation') return { action, queueAction: action, acknowledgement: true };
  if (action === 'pass') return { action, acknowledgement: true };
  if (!['approve-user', 'revoke-user'].includes(action)) throw new Error(`Unregistered access action: ${action}`);
  return withAdmin({ projectId, hosts }, async ({ auth }) => {
    const claims = action === 'approve-user' ? { approved: true } : {};
    await auth.setCustomUserClaims(BASELINE_USER_ID, claims);
    const observed = claimState(await auth.getUser(BASELINE_USER_ID));
    if (JSON.stringify(observed.claims) !== JSON.stringify(claims)) throw new Error(`Scenario action readback failed for ${action}`);
    return { action, acknowledgement: true, ...observed };
  });
}
