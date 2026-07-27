import { describe, expect, it } from 'vitest';
import { accessScenarioManifest } from '../../scripts/emulator/access-scenarios/manifest.mjs';
import { validateAccessScenarioManifest } from '../../scripts/emulator/access-scenarios/validate-manifest.mjs';
import { preflightAccessScenario } from '../../scripts/emulator/access-scenarios/preflight.mjs';
import { classifyAccessScenarioEvidence } from '../../scripts/emulator/access-scenarios/classify.mjs';
describe('private access scenario manifest', () => it('pins all approved UX scenarios', () => { expect(validateAccessScenarioManifest()).toBe(true); expect(Object.keys(accessScenarioManifest.scenarios)).toEqual(['UX-10-01', 'UX-10-02', 'UX-10-03', 'UX-10-04']); }));
describe('private access scenario semantics', () => {
  it('rejects altered start states and action sequences', () => {
    const wrongStart = structuredClone(accessScenarioManifest); wrongStart.scenarios['UX-10-02'].startState = 'approved';
    const wrongActions = structuredClone(accessScenarioManifest); wrongActions.scenarios['UX-10-03'].actions = ['pass'];
    expect(() => validateAccessScenarioManifest(wrongStart)).toThrow(/UX-10-02/);
    expect(() => preflightAccessScenario({ scenario: 'UX-10-03', manifest: wrongActions })).toThrow(/UX-10-03/);
  });
});
describe('private access harness boundaries', () => {
  it('checks fixture/rules/staging without observing product UI', () => expect(preflightAccessScenario({ scenario: 'UX-10-01', manifest: accessScenarioManifest }).acknowledgement).toBe(true));
  it('attributes a valid wrong observation to the product but broken capture to the harness', () => {
    expect(classifyAccessScenarioEvidence({ preflight: { acknowledgement: true }, observation: { valid: true, matchesExpected: false } }).classification).toBe('ux-defect');
    expect(classifyAccessScenarioEvidence({ preflight: {}, observation: { valid: true, matchesExpected: false } }).classification).toBe('harness-invalid');
  });
});
