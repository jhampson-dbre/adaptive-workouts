import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

import { buildScenario, scenarioDefinitions } from '../../scripts/emulator/scenarios/index.mjs';
import { scenarioManifest } from '../../scripts/emulator/scenarios/manifest.mjs';
import { mapScenarioFailure, replaceScenarioHistory } from '../../scripts/emulator/scenarios/load.mjs';
import { assertManifestCompatibility } from '../../scripts/emulator/scenarios/validate-manifest.mjs';
import { isValidV3WorkoutDocument } from '../utils/workoutSchema';
import { getNextSessionRecommendation } from '../utils/progression';
import { generateWorkout } from '../utils/engine';
import baselineFixture from '../../scripts/emulator/fixtures/baseline.mjs';

const fakeAdmin = ({ profile = 'scratch', history = new Map(), retries = 1 } = {}) => async (_options, callback) => {
  const userRef = {
    collection: () => ({
      limit: count => ({ count }),
      doc: id => ({ id }),
    }),
  };
  const firestore = {
    doc: () => userRef,
    runTransaction: async callback => {
      for (let attempt = 0; attempt < retries; attempt += 1) {
        const writes = [];
        await callback({
          get: async target => target.count === undefined
            ? { exists: true, data: () => ({ emulatorProfile: profile }) }
            : { size: Math.min(history.size, target.count), docs: [...history.keys()].slice(0, target.count).map(id => ({ id, ref: { id } })) },
          delete: ref => writes.push(['delete', ref.id]),
          set: (ref, data) => writes.push(['set', ref.id, data]),
        });
        if (attempt === retries - 1) for (const [kind, id, data] of writes) {
          if (kind === 'delete') history.delete(id); else history.set(id, data);
        }
      }
    },
  };
  return callback({ firestore });
};

describe('emulator history scenarios', () => {
  it('proves Chicago local noon across summer, winter, and shifted reference dates in a child process', () => {
    const script = `import { buildScenario } from './scripts/emulator/scenarios/index.mjs'; console.log(JSON.stringify({ summer: buildScenario('weighted-progression', '2026-07-18').documents.map(x => x.date), shifted: buildScenario('weighted-progression', '2026-07-19').documents.map(x => x.date), winter: buildScenario('weighted-progression', '2026-01-18').documents.map(x => x.date) }));`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: process.cwd(), env: { ...process.env, TZ: 'America/Chicago' }, encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      summer: ['2026-07-08T17:00:00.000Z', '2026-07-09T17:00:00.000Z', '2026-07-10T17:00:00.000Z'],
      shifted: ['2026-07-09T17:00:00.000Z', '2026-07-10T17:00:00.000Z', '2026-07-11T17:00:00.000Z'],
      winter: ['2026-01-08T18:00:00.000Z', '2026-01-09T18:00:00.000Z', '2026-01-10T18:00:00.000Z'],
    });
  });

  it('provides four stable, schema-valid scenario definitions with expected outcomes', () => {
    expect(Object.keys(scenarioDefinitions)).toEqual([
      'weighted-progression', 'pivot-rotation-staleness', 'recent-primary-leg-suppresses-tier4', 'tier4-quota-closed-open',
    ]);
    for (const name of Object.keys(scenarioDefinitions)) {
      const scenario = buildScenario(name, '2026-07-18');
      expect(scenario.documents.every(isValidV3WorkoutDocument)).toBe(true);
      expect(scenario.expected).toBeDefined();
    }
  });

  it('keeps weighted progression outcomes real against the engine helper', () => {
    const scenario = buildScenario('weighted-progression', '2026-07-18');
    const catalog = new Map(baselineFixture.firestore.catalog.map(exercise => [exercise.id, exercise]));
    for (const [id, decision] of Object.entries(scenario.expected.progression)) {
      expect(getNextSessionRecommendation(catalog.get(id), scenario.documents).decision).toBe(decision);
    }
  });

  it('preserves the intended pivot, leg suppression, and quota scenario signals', () => {
    const catalog = baselineFixture.firestore.catalog;
    const settings = baselineFixture.firestore.user;
    const pivot = generateWorkout(60, [], false, catalog, buildScenario('pivot-rotation-staleness', '2026-07-18').documents, settings);
    expect(pivot[0].muscleGroup).toBe('Shoulders');
    const staleBench = buildScenario('pivot-rotation-staleness', '2026-07-18').documents.find(document => document.id === 'scenario-stale-chest');
    expect(Math.round((Date.parse('2026-07-18T12:00:00-05:00') - Date.parse(staleBench.date)) / 86_400_000)).toBeGreaterThan(settings.staleThreshold);
    const legs = generateWorkout(60, [], false, catalog, buildScenario('recent-primary-leg-suppresses-tier4', '2026-07-18').documents, settings);
    expect(legs.filter(exercise => exercise.tier === 4 && exercise.muscleGroup === 'Legs')).toEqual([]);
    const quota = buildScenario('tier4-quota-closed-open', '2026-07-18');
    const quotaCatalog = catalog.filter(exercise => ['bench-press', 'cable-row', 'standing-calf-raise'].includes(exercise.id)).map(exercise => ({ ...exercise, sets: 1 }));
    const quotaSettings = { ...settings, staleThreshold: 99 };
    const closed = generateWorkout(1.75, [], false, quotaCatalog, quota.documents.slice(0, 3), quotaSettings);
    const open = generateWorkout(1.75, [], false, quotaCatalog, quota.documents, quotaSettings);
    expect(closed.map(exercise => exercise.id)).toEqual(quota.expected.quota.closedOutput);
    expect(open.map(exercise => exercise.id)).toEqual(quota.expected.quota.openOutput);
  });

  it('replaces only scratch history idempotently, including overlaps and transaction retries', async () => {
    const history = new Map([['old-history', { date: 'old' }], ['scenario-weighted-increase', { date: 'stale' }]]);
    await replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: {}, withAdmin: fakeAdmin({ history, retries: 2 }) });
    expect([...history.keys()].sort()).toEqual(['scenario-weighted-decrease', 'scenario-weighted-hold', 'scenario-weighted-increase']);
    expect(history.get('scenario-weighted-increase').date).toBe(new Date(2026, 6, 8, 12).toISOString());
  });

  it('refuses canonical and conservative-bound requests without changing history', async () => {
    const history = new Map(Array.from({ length: 448 }, (_, index) => [`old-${index}`, {}]));
    await expect(replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: {}, profile: 'canonical', withAdmin: fakeAdmin({ history }) })).rejects.toThrow(/canonical/);
    await expect(replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: {}, withAdmin: fakeAdmin({ history }) })).rejects.toThrow(/conservative bound/);
    expect(history).toHaveLength(448);
  });

  it('accepts persisted test profiles, rejects invalid dates, and maps retryable Firestore failures', async () => {
    const history = new Map();
    await replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: {}, profile: 'test', withAdmin: fakeAdmin({ profile: 'test', history }) });
    expect(history).toHaveLength(3);
    expect(() => buildScenario('weighted-progression', '2026-02-30')).toThrow(/valid calendar date/);
    const mapped = mapScenarioFailure(Object.assign(new Error('deadline exceeded'), { code: 'DEADLINE_EXCEEDED' }));
    expect(mapped.message).toMatch(/Reset scratch state/);
  });

  it('maps exhausted transaction retries without changing history', async () => {
    const history = new Map([['existing', { date: 'unchanged' }]]);
    const original = [...history.entries()];
    const cause = Object.assign(new Error('transaction retries exhausted'), { code: 'ABORTED' });
    const withAdmin = async () => { throw cause; };
    await expect(replaceScenarioHistory({ name: 'weighted-progression', referenceDate: '2026-07-18', hosts: {}, withAdmin }))
      .rejects.toMatchObject({ cause, message: expect.stringMatching(/Reset scratch state/) });
    expect([...history.entries()]).toEqual(original);
  });

  it('keeps the self-contained manifest compatible with the pinned canonical template', () => {
    expect(scenarioManifest.fixtureRevision).toBe('emulator-baseline-v1');
    expect(assertManifestCompatibility({ gitShow: () => scenarioManifest.uxEvidence.requiredFields.map(field => `| ${field} |`).join('\n') })).toBe(true);
    expect(() => assertManifestCompatibility({
      manifest: { ...scenarioManifest, revision: 'unknown-revision' },
      gitShow: () => scenarioManifest.uxEvidence.requiredFields.map(field => `| ${field} |`).join('\n'),
    })).toThrow(/unknown manifest revision/i);
  });
});
