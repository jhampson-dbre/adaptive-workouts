import { accessScenarioManifest } from './manifest.mjs';
const requiredScenarios = {
  'UX-10-01': { startState: 'approved', actions: ['pass'] },
  'UX-10-02': { startState: 'pending', actions: ['approve-user', 'pass'] },
  'UX-10-03': { startState: 'approved', actions: ['reject-next-evaluation', 'hold-next-evaluation', 'pass'] },
  'UX-10-04': { startState: 'approved', actions: ['revoke-user', 'approve-user', 'pass'] },
};
export function validateAccessScenarioManifest(manifest = accessScenarioManifest) {
  if (manifest.revision !== 'private-access-ux-scenarios-v1' || manifest.artifactRevision !== 'private-owner-approved-access@v2') throw new Error('Invalid private access scenario manifest revision');
  if (JSON.stringify(Object.keys(manifest.scenarios ?? {})) !== JSON.stringify(Object.keys(requiredScenarios))) throw new Error('Invalid private access scenario set');
  for (const [id, expected] of Object.entries(requiredScenarios)) {
    const scenario = manifest.scenarios[id];
    if (scenario?.id !== id || scenario.startState !== expected.startState || JSON.stringify(scenario.actions) !== JSON.stringify(expected.actions)) throw new Error(`Invalid scenario ${id}`);
  }
  return true;
}
if (process.argv[1]?.endsWith('validate-manifest.mjs')) { validateAccessScenarioManifest(); console.log('Private access scenario manifest valid.'); }
