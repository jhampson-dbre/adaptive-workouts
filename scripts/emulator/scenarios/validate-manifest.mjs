import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { scenarioManifest } from './manifest.mjs';

export function assertManifestCompatibility({ gitShow = execFileSync, manifest = scenarioManifest } = {}) {
  if (manifest.revision !== 'emulator-history-scenarios-v1') throw new Error(`Unknown manifest revision: ${manifest.revision}`);
  const template = gitShow('git', ['show', `${manifest.uxEvidence.templateCommit}:${manifest.uxEvidence.templatePath}`], { encoding: 'utf8' });
  for (const field of manifest.uxEvidence.requiredFields) {
    const canonicalCell = `| ${field} |`;
    const codeCell = `| \`${field}\` |`;
    if (!template.includes(canonicalCell) && !template.includes(codeCell)) throw new Error(`Pinned UX template is missing canonical evidence field: ${field}`);
  }
  if (manifest.command !== 'npm run emulators:scenario -- <stable-scenario> --reference-date YYYY-MM-DD') throw new Error('Scenario manifest command is not the approved stable command.');
  for (const [id, scenario] of Object.entries(manifest.scenarios)) {
    const required = ['id', 'name', 'command', 'fixtureRevision', 'profileRevision', 'referenceDateInput', 'algorithmPrecondition', 'expected', 'applicability', 'workflow', 'visibleOutcome', 'evidenceSetup', 'evidenceAction', 'limitation', 'residualRisk'];
    if (!id || !Array.isArray(scenario.viewports) || scenario.viewports.length === 0 || !Array.isArray(scenario.states) || scenario.states.length === 0 || required.some(field => !scenario[field])) throw new Error(`Scenario manifest entry ${id} is incomplete.`);
  }
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertManifestCompatibility();
  console.log(`Scenario manifest ${scenarioManifest.revision} is compatible with ${scenarioManifest.uxEvidence.templateCommit}.`);
}
