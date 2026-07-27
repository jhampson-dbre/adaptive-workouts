export const accessScenarioManifest = {
  revision: 'private-access-ux-scenarios-v1', artifactRevision: 'private-owner-approved-access@v2', fixtureRevision: 'emulator-baseline-v1', authRevision: 'emulator-baseline-auth-v2',
  command: 'npm run ux:private-access -- start --scenario UX-10-XX --viewport WIDTHxHEIGHT',
  scenarios: {
    'UX-10-01': { id: 'UX-10-01', startState: 'approved', actions: ['pass'] },
    'UX-10-02': { id: 'UX-10-02', startState: 'pending', actions: ['approve-user', 'pass'] },
    'UX-10-03': { id: 'UX-10-03', startState: 'approved', actions: ['reject-next-evaluation', 'hold-next-evaluation', 'pass'] },
    'UX-10-04': { id: 'UX-10-04', startState: 'approved', actions: ['revoke-user', 'approve-user', 'pass'] },
  },
};
