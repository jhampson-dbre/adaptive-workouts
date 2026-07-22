import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { analyzeBuild, checkBuild } from './bundle-budget.mjs'

const firestoreId = '/repo/node_modules/@firebase/firestore/dist/index.esm.js'
const write = (root, file, value = 'export default 1') => writeFile(join(root, file), value)
const fixture = async ({ manifestPatch = {}, provenancePatch, firestoreSize = 309235 } = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'bundle-budget-')); await mkdir(join(root, '.vite'))
  const files = { 'entry.js': 100, 'shared.js': 40, 'plan.js': 80, 'settings.js': 900, 'workout.js': 900, 'firestore-sdk.js': firestoreSize, 'sw.js': 17, 'workbox-abc.js': 7 }
  await Promise.all(Object.entries(files).map(([file, size]) => write(root, file, 'x'.repeat(size))))
  await write(root, 'entry.js', 'plan.js settings.js workout.js #retry=')
  const manifest = {
    'index.html': { file: 'entry.js', isEntry: true, imports: ['shared'] }, shared: { file: 'shared.js' },
    'src/components/AuthorizedApp.jsx': { file: 'plan.js', isDynamicEntry: true, imports: ['shared'] }, 'src/components/Settings.jsx': { file: 'settings.js', isDynamicEntry: true }, 'src/components/WorkoutView.jsx': { file: 'workout.js', isDynamicEntry: true }, firestore: { file: 'firestore-sdk.js', name: 'firestore-sdk' }, ...manifestPatch,
  }
  const provenance = provenancePatch ?? [{ file: 'entry.js', modules: ['/repo/src/main.jsx'] }, { file: 'firestore-sdk.js', modules: [firestoreId] }]
  await writeFile(join(root, '.vite', 'manifest.json'), JSON.stringify(manifest))
  await writeFile(join(root, '.vite', 'chunk-provenance.json'), JSON.stringify(provenance))
  await writeFile(join(root, '.vite', 'pwa-precache.json'), JSON.stringify(Object.keys(files).map(url => ({ url }))))
  return root
}
const withFixture = async (options, run) => { const root = await fixture(options); try { await run(root) } finally { await rm(root, { recursive: true, force: true }) } }

test('permits the under-500000 isolated firestore SDK and keeps it out of boot and Plan', async () => withFixture({}, async root => {
  const report = await analyzeBuild(root)
  assert.deepEqual(report.boot.files, ['entry.js', 'shared.js'])
  assert.deepEqual(report.firstPlan.files, ['entry.js', 'shared.js', 'plan.js'])
  assert.equal(report.firestoreSdk, 'firestore-sdk.js')
  await checkBuild(root)
}))

test('rejects missing or duplicate firestore manifest/provenance records', async () => {
  await withFixture({ manifestPatch: { firestore: { file: 'firestore-sdk.js' } } }, root => assert.rejects(() => analyzeBuild(root), /exactly one firestore-sdk manifest/))
  await withFixture({ manifestPatch: { duplicate: { file: 'firestore-sdk.js', name: 'firestore-sdk' } } }, root => assert.rejects(() => analyzeBuild(root), /exactly one firestore-sdk manifest/))
  await withFixture({ provenancePatch: [] }, root => assert.rejects(() => analyzeBuild(root), /exactly one provenance/))
  await withFixture({ provenancePatch: [{ file: 'firestore-sdk.js', modules: [firestoreId] }, { file: 'firestore-sdk.js', modules: [firestoreId] }] }, root => assert.rejects(() => analyzeBuild(root), /exactly one provenance/))
})

test('rejects absent Firestore, mixed modules, and Firestore in another chunk', async () => {
  await withFixture({ provenancePatch: [{ file: 'firestore-sdk.js', modules: [] }] }, root => assert.rejects(() => analyzeBuild(root), /no Firestore modules/))
  await withFixture({ provenancePatch: [{ file: 'firestore-sdk.js', modules: [firestoreId, '/repo/src/bad.js'] }] }, root => assert.rejects(() => analyzeBuild(root), /mixes src/))
  await withFixture({ provenancePatch: [{ file: 'firestore-sdk.js', modules: [firestoreId, '/repo/node_modules/other/index.js'] }] }, root => assert.rejects(() => analyzeBuild(root), /mixes src/))
  await withFixture({ provenancePatch: [{ file: 'firestore-sdk.js', modules: [firestoreId] }, { file: 'entry.js', modules: [firestoreId] }] }, root => assert.rejects(() => analyzeBuild(root), /leaked outside/))
})

test('rejects Firestore SDK leakage into boot or first Plan and size failures', async () => {
  await withFixture({ manifestPatch: { 'index.html': { file: 'entry.js', isEntry: true, imports: ['shared', 'firestore'] } } }, root => assert.rejects(() => analyzeBuild(root), /must not be in boot/))
  await withFixture({ manifestPatch: { 'src/components/AuthorizedApp.jsx': { file: 'plan.js', isDynamicEntry: true, imports: ['shared', 'firestore'] } } }, root => assert.rejects(() => analyzeBuild(root), /must not be in boot/))
  await withFixture({ firestoreSize: 500001 }, root => assert.rejects(() => checkBuild(root), /firestore-sdk\.js exceeds 500000/))
  await withFixture({ manifestPatch: { settings: { file: 'settings.js', isDynamicEntry: true } } }, async root => { await write(root, 'settings.js', 'x'.repeat(500001)); await assert.rejects(() => checkBuild(root), /exceeds 500000/) })
})

test('rejects query retry URLs and missing emitted lazy-entry identity', async () => {
  await withFixture({}, async root => { await write(root, 'entry.js', 'plan.js settings.js workout.js ?retry='); await assert.rejects(() => analyzeBuild(root), /missing fragment|query-string/) })
  await withFixture({}, async root => { await write(root, 'entry.js', 'plan.js settings.js #retry='); await assert.rejects(() => analyzeBuild(root), /does not reference emitted lazy entry/) })
})
