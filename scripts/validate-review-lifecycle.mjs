import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..')
const shaPattern = /^[0-9a-f]{40}$/i
const authorities = new Set(['technical', 'conformance', 'ux', 'specialist'])
const severities = new Set(['P0', 'P1', 'P2'])
const invalidatorTriggers = new Set(['history-rewritten', 'stale-upstream', 'conflict', 'unrelated-range', 'evidence-stale', 'approved-intent-change', 'missing-authority'])
const transitions = new Map([
  ['open', new Set(['accepted', 'rejected', 'escalated'])],
  ['accepted', new Set(['fixed-pending-closure'])],
  ['fixed-pending-closure', new Set(['closed'])],
  ['escalated', new Set(['accepted', 'rejected'])],
])

function assertSha(value, label) {
  assert.match(value ?? '', shaPattern, `${label} must be a 40-character SHA`)
}

function assertUniqueIds(lifecycle) {
  const ids = new Set()
  for (const collection of ['matrix', 'findings', 'batches', 'closures', 'invalidators']) {
    for (const item of lifecycle[collection] ?? []) {
      assert.ok(item.id, `${collection} entries require stable IDs`)
      assert.ok(!ids.has(item.id), `duplicate ID: ${item.id}`)
      ids.add(item.id)
    }
  }
}

function validateFinding(finding, matrixIds, authorityIds) {
  assert.ok(authorityIds.has(finding.authorityId), `finding ${finding.id} has an unknown authority ID`)
  assert.ok(severities.has(finding.severity), `finding ${finding.id} needs supported severity P0, P1, or P2`)
  assert.ok(Array.isArray(finding.states) && finding.states[0] === 'open', `finding ${finding.id} must start open`)
  for (let index = 1; index < finding.states.length; index += 1) {
    const from = finding.states[index - 1]
    const to = finding.states[index]
    assert.ok(transitions.get(from)?.has(to), `illegal finding transition for ${finding.id}: ${from} -> ${to}`)
  }
  for (const row of finding.matrixRows ?? []) assert.ok(matrixIds.has(row), `finding ${finding.id} references unknown matrix row ${row}`)
}

function validateNoSecrets(value, path = 'record') {
  if (Array.isArray(value)) return value.forEach((entry, index) => validateNoSecrets(entry, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!/(secret|token|password|credential|private.?key)/i.test(key), `${path}.${key} is not sanitized`)
    validateNoSecrets(child, `${path}.${key}`)
  }
}

function validateGitTopology(lifecycle, batches, gitVerifier) {
  if (!gitVerifier) return
  for (const sha of [lifecycle.baseline.taskBaseSha, lifecycle.baseline.candidateSha, ...batches.flatMap((batch) => [batch.fromSha, batch.toSha])]) {
    assert.ok(gitVerifier.exists(sha), `Git object does not exist: ${sha}`)
  }
  assert.ok(gitVerifier.isAncestor(lifecycle.baseline.taskBaseSha, lifecycle.baseline.candidateSha), 'task base must be an ancestor of candidate')
  for (const batch of batches) assert.ok(gitVerifier.isAncestor(batch.fromSha, batch.toSha), `batch ${batch.id} additive range is not an ancestor range`)
}

export function validateReviewLifecycle(lifecycle, { gitVerifier } = {}) {
  assert.ok(lifecycle && typeof lifecycle === 'object', 'review lifecycle must be an object')
  validateNoSecrets(lifecycle)
  assert.match(lifecycle.taskId ?? '', /^TREK-\d+$/, 'task ID must be a Trekker ID')
  const { taskRange, baseline } = lifecycle
  assert.ok(taskRange && baseline, 'task range and Review-Baseline are required')
  const historyLabels = { rewritten: 'history rewrite', staleUpstream: 'stale upstream', unaccountedIntegration: 'unaccounted integration' }
  for (const key of Object.keys(historyLabels)) assert.equal(lifecycle.history?.[key], false, `${historyLabels[key]} must be false for a valid review baseline`)
  for (const [label, value] of Object.entries(taskRange)) assertSha(value, `task range ${label}`)
  assert.match(baseline.id ?? '', /^RB-TREK-\d+-\d+$/, 'baseline ID must be immutable and task scoped')
  assert.equal(baseline.id.match(/^RB-(TREK-\d+)-/)?.[1], lifecycle.taskId, 'baseline task ID must match lifecycle taskId')
  assertSha(baseline.taskBaseSha, 'baseline task base SHA')
  assertSha(baseline.candidateSha, 'baseline candidate SHA')
  assertSha(baseline.terminalSha, 'baseline terminal SHA')
  assertSha(baseline.sync?.mainSha, 'sync main SHA')
  assertSha(baseline.sync?.syncSha, 'sync SHA')
  assert.equal(typeof baseline.sync?.conflicts, 'boolean', 'sync conflicts state is required')
  assert.equal(baseline.sync.conflicts, false, 'unresolved conflicts require invalidator and new cycle')
  assert.ok(Array.isArray(baseline.verification) && baseline.verification.length, 'baseline verification is required')
  assert.ok(['low', 'medium', 'high'].includes(baseline.risk), 'baseline risk classification is required')
  assert.ok(Array.isArray(baseline.authorities) && baseline.authorities.length, 'baseline authorities are required')
  const authorityIds = new Map()
  for (const authority of baseline.authorities) {
    assert.ok(authority.id && authority.kind && authority.reviewerId, 'authority needs stable ID, kind, and reviewer identity')
    assert.ok(authorities.has(authority.kind), `authority ${authority.id} has an unknown kind`)
    assert.ok(!authorityIds.has(authority.id), `duplicate authority ID: ${authority.id}`)
    authorityIds.set(authority.id, authority)
  }
  assert.ok([...authorityIds.values()].filter((authority) => authority.kind === 'specialist').length <= 1, 'specialist authority is capped at one reviewer')
  for (const kind of ['technical', 'conformance']) assert.ok([...authorityIds.values()].some((authority) => authority.kind === kind), `baseline requires ${kind} authority`)
  assert.equal(taskRange.baseSha, baseline.taskBaseSha, 'task base SHA does not reconcile with baseline')
  assert.equal(taskRange.candidateSha, baseline.candidateSha, 'candidate SHA does not reconcile with baseline')
  assert.equal(taskRange.terminalSha, baseline.terminalSha, 'initial terminal SHA does not reconcile with immutable baseline')
  assert.equal(baseline.terminalSha, baseline.candidateSha, 'immutable baseline terminal SHA must equal candidate SHA')

  assertUniqueIds(lifecycle)
  const matrix = lifecycle.matrix ?? []
  const matrixIds = new Set(matrix.map((row) => row.id))
  assert.ok(matrix.length, 'coverage matrix is required')
  for (const row of matrix) {
    assert.ok(row.obligation, `matrix row ${row.id} needs an obligation`)
    assert.ok(authorityIds.has(row.authorityId), `matrix row ${row.id} has an unknown authority ID`)
    if (row.obligation === 'N/A') assert.ok(row.covers && row.rationale && row.authorityId, `N/A row ${row.id} needs non-empty covers, rationale, and authority acknowledgement`)
  }
  for (const obligation of lifecycle.expectedCoverage ?? []) {
    assert.ok(matrix.some((row) => row.obligation === obligation || row.covers === obligation), `incomplete coverage: ${obligation}`)
  }
  if (matrix.some((row) => authorityIds.get(row.authorityId).kind === 'ux')) {
    assert.ok(matrix.some((row) => row.obligation === 'ux-scenario' || row.obligation === 'ux-evidence'), 'UX authority requires a UX scenario or evidence row')
  }

  const findings = lifecycle.findings ?? []
  for (const finding of findings) validateFinding(finding, matrixIds, authorityIds)
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]))
  const batches = lifecycle.batches ?? []
  let expectedFromSha = baseline.candidateSha
  for (const batch of batches) {
    assert.equal(batch.baselineId, baseline.id, `batch ${batch.id} attaches to the wrong baseline cycle`)
    assert.ok(Array.isArray(batch.findingIds) && batch.findingIds.length, `batch ${batch.id} needs frozen finding IDs`)
    assertSha(batch.fromSha, `batch ${batch.id} from SHA`)
    assertSha(batch.toSha, `batch ${batch.id} to SHA`)
    assert.equal(batch.fromSha, expectedFromSha, `unaccounted range before batch ${batch.id}`)
    assert.equal(typeof batch.artifactChanged, 'boolean', `batch ${batch.id} needs artifactChanged state`)
    assert.equal(typeof batch.evidenceChanged, 'boolean', `batch ${batch.id} needs evidenceChanged state`)
    if (batch.artifactChanged || batch.evidenceChanged) assert.notEqual(batch.fromSha, batch.toSha, `batch ${batch.id} needs a distinct additive range for artifact/evidence change`)
    assert.ok(Array.isArray(batch.affectedAuthorityIds) && batch.affectedAuthorityIds.length, `batch ${batch.id} needs affected authority IDs`)
    assert.ok(Array.isArray(batch.affectedMatrixRows) && batch.affectedMatrixRows.length, `batch ${batch.id} needs affected matrix rows`)
    for (const rowId of batch.affectedMatrixRows) assert.ok(matrixIds.has(rowId), `batch ${batch.id} references unknown affected matrix row ${rowId}`)
    for (const authorityId of batch.affectedAuthorityIds) assert.ok(authorityIds.has(authorityId), `batch ${batch.id} has an unknown affected authority ID`)
    const affectedKinds = batch.affectedAuthorityIds.map((authorityId) => authorityIds.get(authorityId).kind)
    if (batch.artifactChanged || batch.evidenceChanged) {
      for (const kind of ['technical', 'conformance']) assert.ok(affectedKinds.includes(kind), `batch ${batch.id} needs ${kind} closure for changed artifact/evidence`)
      if (batch.affectedMatrixRows.some((rowId) => authorityIds.get(matrix.find((row) => row.id === rowId).authorityId).kind === 'ux')) {
        assert.ok(affectedKinds.includes('ux'), `batch ${batch.id} needs UX closure for changed prescribed UX evidence`)
      }
    }
    for (const findingId of batch.findingIds) {
      const finding = findingsById.get(findingId)
      assert.ok(finding, `batch ${batch.id} references unknown finding ${findingId}`)
      assert.ok(batch.affectedAuthorityIds.includes(finding.authorityId), `finding ${finding.id} authority must be included in batch affected authorities`)
      for (const rowId of finding.matrixRows ?? []) assert.ok(batch.affectedMatrixRows.includes(rowId), `finding ${finding.id} matrix row must be included in batch affected rows`)
    }
    expectedFromSha = batch.toSha
  }

  const closures = lifecycle.closures ?? []
  for (const batch of batches) {
    const batchFindings = batch.findingIds.map((id) => findingsById.get(id))
    const needsClosure = batch.artifactChanged || batch.evidenceChanged || batchFindings.some((finding) => finding.states.includes('accepted'))
    for (const closure of closures.filter((closure) => closure.batchId === batch.id)) {
      assert.ok(batch.affectedAuthorityIds.includes(closure.authorityId), `unaffected authority closure ${closure.id} for batch ${batch.id}`)
    }
    if (!needsClosure) continue
    const allResolved = batchFindings.every((finding) => ['closed', 'rejected'].includes(finding.states.at(-1)))
    if (!allResolved) {
      assert.ok(batch.closureRound >= 2 && batch.checkpoint && batch.coordinatorEscalation, `terminal accepted finding in batch ${batch.id} requires checkpoint and coordinator escalation after two unsuccessful closure rounds`)
    }
    for (const authorityId of batch.affectedAuthorityIds) {
      const authority = authorityIds.get(authorityId)
      const matching = closures.filter((closure) => closure.batchId === batch.id && closure.authorityId === authorityId)
      const hasAcceptedP0P1 = batchFindings.some((finding) => finding.states.includes('accepted') && ['P0', 'P1'].includes(finding.severity))
      assert.ok(matching.length === 1, hasAcceptedP0P1 ? `P0/P1 batch ${batch.id} requires exactly one fresh replacement ${authority.kind} closer` : `missing ${authority.kind} closure for batch ${batch.id}`)
      const closure = matching[0]
      assertSha(closure.terminalSha, `closure ${closure.id} terminal SHA`)
      assert.equal(closure.terminalSha, batch.toSha, `closure ${closure.id} terminal SHA does not reconcile with batch`)
      assert.ok(closure.closerId, `closure ${closure.id} needs closer identity`)
      if (allResolved) assert.equal(closure.disposition, 'closed', `closure ${closure.id} must be closed for a resolved finding`)
      if (hasAcceptedP0P1) {
        assert.equal(closure.fresh, true, `P0/P1 batch ${batch.id} requires exactly one fresh replacement ${authority.kind} closer`)
        assert.notEqual(closure.closerId, authority.reviewerId, `P0/P1 replacement closer for ${authority.id} must differ from original broad reviewer`)
      }
    }
  }

  for (const invalidator of lifecycle.invalidators ?? []) {
    assert.match(invalidator.baselineId ?? '', /^RB-TREK-\d+-\d+$/, `invalidator ${invalidator.id} needs a baseline ID`)
    assert.ok(invalidatorTriggers.has(invalidator.trigger), `invalidator trigger is not supported: ${invalidator.trigger}`)
    assert.ok(['new-cycle', 'escalated'].includes(invalidator.decision), `invalidator ${invalidator.id} needs a decision`)
    if (invalidator.decision === 'new-cycle') {
      assert.match(invalidator.successorBaselineId ?? '', /^RB-TREK-\d+-\d+$/, `invalidator ${invalidator.id} requires successor cycle`)
      assert.equal(invalidator.successorBaselineId.match(/^RB-(TREK-\d+)-/)?.[1], lifecycle.taskId, `successor ${invalidator.successorBaselineId} must remain in the same task`)
    }
    if (invalidator.decision === 'escalated') assert.ok(invalidator.coordinatorEscalation, `invalidator ${invalidator.id} requires coordinator escalation`)
  }
  assert.equal(baseline.matrixId, baseline.id.replace(/^RB-/, 'RM-'), 'baseline matrix ID must match task lifecycle')
  validateGitTopology(lifecycle, batches, gitVerifier)
  return { ...lifecycle, currentTerminalSha: expectedFromSha }
}

export function parseReviewLifecycleBlocks(markdown) {
  const blocks = []
  const pattern = /^Review-(Baseline|Batch|Closure|Invalidator):\s*\r?\n```review-lifecycle\r?\n([\s\S]*?)\r?\n```$/gm
  for (const match of markdown.matchAll(pattern)) {
    try {
      const payload = JSON.parse(match[2])
      assert.ok(!Object.hasOwn(payload, 'type') && !Object.hasOwn(payload, 'order'), 'review lifecycle block cannot contain reserved top-level type or order fields')
      blocks.push({ ...payload, type: match[1], order: blocks.length })
    } catch (error) {
      throw new Error(`malformed Review-${match[1]} block: ${error.message}`)
    }
  }
  return blocks
}

export function validateReviewLifecycleFile(path, { gitVerifier } = {}) {
  const contents = readFileSync(path, 'utf8')
  const blocks = parseReviewLifecycleBlocks(contents)
  assert.ok(blocks.length, 'no canonical Review-* evidence blocks found')
  const baselineBlocks = blocks.filter((block) => block.type === 'Baseline')
  assert.ok(baselineBlocks.length, 'Review-Baseline block is required')
  const batchBlocks = blocks.filter((block) => block.type === 'Batch')
  const batches = batchBlocks.map((block) => block.batch)
  for (const batch of batches) {
    assert.ok(Array.isArray(batch.findings) && batch.findings.length, `Review-Batch ${batch.id} needs frozen finding records`)
    batch.findingIds = batch.findings.map((finding) => finding.id)
  }
  const invalidatorBlocks = blocks.filter((block) => block.type === 'Invalidator')
  const invalidators = invalidatorBlocks.map((block) => block.invalidator)
  const baselineIds = new Set(baselineBlocks.map((block) => block.lifecycle?.baseline?.id))
  assert.equal(baselineIds.size, baselineBlocks.length, 'duplicate baseline ID across cycles')
  for (const invalidator of invalidators) {
    if (invalidator.decision === 'new-cycle') assert.ok(baselineIds.has(invalidator.successorBaselineId), `invalidator ${invalidator.id} requires appended successor baseline block`)
  }
  for (const block of baselineBlocks) {
    const baselineId = block.lifecycle.baseline?.id
    const cycle = Number(baselineId?.match(/-(\d+)$/)?.[1])
    if (cycle > 1) {
      const predecessors = invalidators.filter((invalidator) => invalidator.decision === 'new-cycle' && invalidator.successorBaselineId === baselineId)
      assert.equal(predecessors.length, 1, `successor cycle ${baselineId} requires exactly one predecessor new-cycle invalidator`)
      assert.equal(predecessors[0].baselineId.match(/^RB-(TREK-\d+)-/)?.[1], block.lifecycle.taskId, `successor cycle ${baselineId} must remain in the same task`)
    }
  }
  const closureBlocks = blocks.filter((block) => block.type === 'Closure')
  const closures = closureBlocks.map((block) => block.closure)
  const globalIds = new Set()
  const assertGlobalId = (item, label) => {
    assert.ok(item?.id, `${label} needs a stable ID`)
    assert.ok(!globalIds.has(item.id), `duplicate ID across cycles: ${item.id}`)
    globalIds.add(item.id)
  }
  for (const block of baselineBlocks) {
    assert.ok(!block.lifecycle.findings?.length, 'Review-Baseline must precede broad review and cannot embed findings')
    assertGlobalId(block.lifecycle.baseline, 'baseline')
    for (const authority of block.lifecycle.baseline.authorities ?? []) assertGlobalId(authority, 'authority')
    for (const row of block.lifecycle.matrix ?? []) assertGlobalId(row, 'matrix row')
  }
  for (const batch of batches) {
    assertGlobalId(batch, 'batch')
    for (const finding of batch.findings) assertGlobalId(finding, 'finding')
  }
  for (const closure of closures) assertGlobalId(closure, 'closure')
  for (const invalidator of invalidators) assertGlobalId(invalidator, 'invalidator')

  const validatedCycles = []
  for (const block of baselineBlocks) {
    const baselineId = block.lifecycle.baseline?.id
    const cycleBatches = batches.filter((batch) => batch.baselineId === baselineId)
    const cycleBatchIds = new Set(cycleBatches.map((batch) => batch.id))
    const cycleClosures = closures.filter((closure) => cycleBatchIds.has(closure.batchId))
    const cycleInvalidators = invalidators.filter((invalidator) => invalidator.baselineId === baselineId)
    const baselineOrder = block.order
    for (const batchBlock of batchBlocks.filter((entry) => entry.batch.baselineId === baselineId)) assert.ok(batchBlock.order > baselineOrder, `batch ${batchBlock.batch.id} must follow its baseline`)
    for (const closureBlock of closureBlocks) {
      const batchBlock = batchBlocks.find((entry) => entry.batch.id === closureBlock.closure.batchId)
      assert.ok(batchBlock && closureBlock.order > batchBlock.order, `closure ${closureBlock.closure.id} must follow its batch`)
    }
    for (const invalidatorBlock of invalidatorBlocks.filter((entry) => entry.invalidator.baselineId === baselineId)) {
      assert.ok(invalidatorBlock.order > baselineOrder, `invalidator ${invalidatorBlock.invalidator.id} must follow its baseline`)
      if (invalidatorBlock.invalidator.decision === 'new-cycle') {
        const successorBlocks = baselineBlocks.filter((entry) => entry.lifecycle.baseline?.id === invalidatorBlock.invalidator.successorBaselineId)
        assert.equal(successorBlocks.length, 1, `successor ${invalidatorBlock.invalidator.successorBaselineId} must have exactly one baseline block`)
        assert.ok(successorBlocks[0].order > invalidatorBlock.order, `successor baseline ${invalidatorBlock.invalidator.successorBaselineId} must follow its invalidator`)
      }
    }
    validatedCycles.push(validateReviewLifecycle({
      ...block.lifecycle,
      findings: cycleBatches.flatMap((batch) => batch.findings),
      batches: cycleBatches,
      closures: cycleClosures,
      invalidators: cycleInvalidators,
    }, { gitVerifier }))
  }
  for (const batch of batches) assert.ok(baselineIds.has(batch.baselineId), `batch ${batch.id} attaches to unknown baseline cycle`)
  for (const closure of closures) assert.ok(batches.some((batch) => batch.id === closure.batchId), `closure ${closure.id} attaches to unknown batch`)
  for (const invalidator of invalidators) assert.ok(baselineIds.has(invalidator.baselineId), `invalidator ${invalidator.id} attaches to unknown baseline cycle`)
  return validatedCycles
}

export function createGitVerifier(cwd = repositoryRoot) {
  const run = (args) => {
    try { execFileSync('git', args, { cwd, stdio: 'ignore' }); return true } catch { return false }
  }
  return { exists: (sha) => run(['cat-file', '-e', `${sha}^{commit}`]), isAncestor: (fromSha, toSha) => run(['merge-base', '--is-ancestor', fromSha, toSha]) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2]
  assert.ok(path, 'usage: node scripts/validate-review-lifecycle.mjs <evidence-file>')
  validateReviewLifecycleFile(resolve(repositoryRoot, path), { gitVerifier: createGitVerifier(repositoryRoot) })
  console.log('Review lifecycle evidence validated.')
}
