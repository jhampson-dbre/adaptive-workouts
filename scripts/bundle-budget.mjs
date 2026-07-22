import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { gzipSync } from 'node:zlib'

export const LIMITS = { boot: { raw: 760000, gzip: 225000 }, firstPlan: { raw: 760000, gzip: 225000 }, chunkRaw: 500000 }
const planKey = 'src/components/AuthorizedApp.jsx'
const firestoreMarker = '/node_modules/@firebase/firestore/'
const jsFile = file => /\.m?js$/i.test(file)
const gzip = bytes => gzipSync(bytes, { level: 9, mtime: 0 }).byteLength
const readJson = async file => JSON.parse(await readFile(file, 'utf8'))

export async function analyzeBuild(distDir = 'dist') {
  const manifestPath = join(distDir, '.vite', 'manifest.json')
  const precachePath = join(distDir, '.vite', 'pwa-precache.json')
  const provenancePath = join(distDir, '.vite', 'chunk-provenance.json')
  if (!existsSync(manifestPath)) throw new Error(`Missing Vite manifest: ${manifestPath}`)
  const manifest = await readJson(manifestPath)
  const entries = Object.entries(manifest)
  const roots = entries.filter(([, value]) => value.isEntry)
  if (roots.length !== 1) throw new Error(`Expected exactly one manifest entry, found ${roots.length}`)
  const plan = manifest[planKey]
  if (!plan?.isDynamicEntry) throw new Error(`Missing dynamic Plan root ${planKey}`)
  if (!existsSync(precachePath)) throw new Error(`Missing PWA precache report: ${precachePath}`)
  if (!existsSync(provenancePath)) throw new Error(`Missing chunk provenance: ${provenancePath}`)
  const recordsByFile = new Map()
  for (const [key, record] of entries) {
    if (!record.file) throw new Error(`Manifest record ${key} is missing file`)
    if (!jsFile(record.file)) continue
    const prior = recordsByFile.get(record.file)
    if (prior && JSON.stringify(prior.record) !== JSON.stringify(record)) throw new Error(`Conflicting manifest records emit ${record.file}`)
    recordsByFile.set(record.file, { key, record })
  }
  const closure = async key => {
    const files = []; const seen = new Set()
    const visit = current => {
      const record = manifest[current]
      if (!record) throw new Error(`Missing imported manifest record ${current}`)
      if (!jsFile(record.file)) throw new Error(`Closure record ${current} emits non-JavaScript file ${record.file}`)
      if (seen.has(record.file)) return
      seen.add(record.file); files.push(record.file)
      for (const imported of record.imports ?? []) visit(imported)
    }
    visit(key)
    return files
  }
  const entryKey = roots[0][0]
  const bootFiles = await closure(entryKey)
  const planFiles = await closure(planKey)
  const firstPlanFiles = [...bootFiles, ...planFiles.filter(file => !bootFiles.includes(file))]
  const firestoreRecords = entries.filter(([, record]) => record.name === 'firestore-sdk' && jsFile(record.file))
  if (firestoreRecords.length !== 1) throw new Error(`Expected exactly one firestore-sdk manifest record, found ${firestoreRecords.length}`)
  const firestoreFile = firestoreRecords[0][1].file
  const provenance = await readJson(provenancePath)
  const firestoreProvenance = provenance.filter(record => record.file === firestoreFile)
  if (firestoreProvenance.length !== 1) throw new Error(`Expected exactly one provenance record for firestore-sdk asset ${firestoreFile}`)
  const firestoreModules = firestoreProvenance[0].modules
  if (!Array.isArray(firestoreModules) || !firestoreModules.length) throw new Error('firestore-sdk provenance has no Firestore modules')
  if (firestoreModules.some(id => typeof id !== 'string' || !id.includes(firestoreMarker))) throw new Error('firestore-sdk provenance mixes src or non-Firestore package modules')
  for (const record of provenance) if (record.file !== firestoreFile && record.modules?.some(id => typeof id === 'string' && id.includes(firestoreMarker))) throw new Error(`Firestore module leaked outside firestore-sdk: ${record.file}`)
  if (bootFiles.includes(firestoreFile) || firstPlanFiles.includes(firestoreFile)) throw new Error('firestore-sdk must not be in boot or first-Plan static closure')
  const measure = async files => {
    const assets = await Promise.all(files.map(async file => {
      const path = join(distDir, file)
      if (!existsSync(path)) throw new Error(`Manifest asset is missing: ${file}`)
      const bytes = await readFile(path)
      return { file, raw: bytes.byteLength, gzip: gzip(bytes) }
    }))
    return { files, assets, raw: assets.reduce((sum, value) => sum + value.raw, 0), gzip: assets.reduce((sum, value) => sum + value.gzip, 0) }
  }
  const precacheEntries = await readJson(precachePath)
  const urls = new Set(precacheEntries.map(entry => typeof entry === 'string' ? entry : entry.url).filter(Boolean).map(url => url.replace(/^\//, '').split('?')[0]))
  const appFiles = [...recordsByFile.keys()]
  for (const file of appFiles) if (!urls.has(file)) throw new Error(`App JavaScript is absent from final precache: ${file}`)
  const precacheFiles = [...urls].map(url => normalize(url)).filter(file => !file.startsWith('..'))
  const precache = await measure(precacheFiles)
  const rootFiles = await readdir(distDir)
  const sw = ['sw.js', ...rootFiles.filter(file => /^workbox-[^\\/]+\.js$/i.test(file))]
  if (!existsSync(join(distDir, 'sw.js'))) throw new Error('Missing required sw.js')
  if (sw.length < 2) throw new Error('Missing required Workbox runtime')
  const chunks = await measure(appFiles)
  const appCode = (await Promise.all(appFiles.map(file => readFile(join(distDir, file), 'utf8')))).join('\n')
  const retryRoots = [planKey, 'src/components/Settings.jsx', 'src/components/WorkoutView.jsx'].map(key => manifest[key]?.file)
  if (retryRoots.some(file => !file || !jsFile(file))) throw new Error('Missing emitted lazy entry for fragment retry')
  for (const file of retryRoots) if (!appCode.includes(file.split('/').at(-1))) throw new Error(`Retry runtime does not reference emitted lazy entry ${file}`)
  if (!appCode.includes('#retry=')) throw new Error('Retry runtime is missing fragment-only module keys')
  if (appCode.includes('?retry=')) throw new Error('Retry runtime must not introduce query-string module URLs')
  return { boot: await measure(bootFiles), firstPlan: await measure(firstPlanFiles), chunks: chunks.assets, firestoreSdk: firestoreFile, precache, sw: await measure(sw) }
}

const format = value => `${value.raw} raw / ${value.gzip} gzip`
export async function checkBuild(distDir = 'dist') {
  const report = await analyzeBuild(distDir)
  const failures = []
  for (const [name, limit] of Object.entries({ boot: LIMITS.boot, firstPlan: LIMITS.firstPlan })) {
    const total = report[name]
    if (total.raw > limit.raw || total.gzip > limit.gzip) failures.push(`${name} exceeds ${limit.raw} raw / ${limit.gzip} gzip: ${format(total)}`)
  }
  for (const chunk of report.chunks) if (chunk.raw > LIMITS.chunkRaw) failures.push(`chunk ${chunk.file} exceeds ${LIMITS.chunkRaw} raw: ${chunk.raw}`)
  const describe = group => `${group.files.join(', ')} = ${format(group)}`
  console.log(`Bundle budget\nboot: ${describe(report.boot)}\nfirst Plan: ${describe(report.firstPlan)}\napp chunks: ${report.chunks.map(chunk => `${chunk.file} ${format(chunk)}`).join('; ')}\nprecache: ${format(report.precache)}\nservice worker/runtime: ${format(report.sw)}`)
  if (failures.length) throw new Error(`Bundle budget failed:\n${failures.join('\n')}`)
  return report
}
