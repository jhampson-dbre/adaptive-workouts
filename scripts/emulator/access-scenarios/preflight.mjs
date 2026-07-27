import { validateAccessScenarioManifest } from './validate-manifest.mjs';
import baselineFixture, { BASELINE_AUTH_MARKER, BASELINE_FIXTURE_REVISION } from '../fixtures/baseline.mjs';
import { readFileSync } from 'node:fs';
export function preflightAccessScenario({ projectId = 'demo-project', scenario, manifest, fixture = baselineFixture, rules = readFileSync('firestore.rules', 'utf8') } = {}) {
  validateAccessScenarioManifest(manifest);
  if (projectId !== 'demo-project') throw new Error('Private access scenarios require demo-project');
  const entry = manifest.scenarios[scenario];
  if (!entry?.startState || !entry.actions?.length) throw new Error(`Unknown or incomplete scenario ${scenario}`);
  if (manifest.fixtureRevision !== BASELINE_FIXTURE_REVISION || manifest.authRevision !== BASELINE_AUTH_MARKER) throw new Error('Manifest provenance does not match baseline fixture');
  const user = fixture.auth?.users?.[0];
  if (fixture.revision !== BASELINE_FIXTURE_REVISION || fixture.auth?.contractRevision !== BASELINE_AUTH_MARKER || user?.customClaims?.approved !== true || Object.keys(user.customClaims).length !== 1) throw new Error('Fixture does not carry the exact strict approved claim');
  for (const predicate of ['request.auth != null', 'request.auth.uid == userId', 'request.auth.token.approved == true']) if (!rules.includes(predicate)) throw new Error(`Rules are not strict-ready: ${predicate}`);
  return { kind: 'private-access-preflight', projectId, scenario, startState: entry.startState, actions: entry.actions, acknowledgement: true };
}
