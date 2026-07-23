import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { parseReviewLifecycleBlocks, validateReviewLifecycle, validateReviewLifecycleFile } from './validate-review-lifecycle.mjs'

const sha = (character) => character.repeat(40)

function validLifecycle() {
  return {
    taskId: 'TREK-252',
    taskRange: { baseSha: sha('a'), candidateSha: sha('b'), terminalSha: sha('b') },
    history: { rewritten: false, staleUpstream: false, unaccountedIntegration: false },
    baseline: {
      id: 'RB-TREK-252-01',
      taskBaseSha: sha('a'),
      candidateSha: sha('b'),
      terminalSha: sha('b'),
      sync: { mainSha: sha('d'), syncSha: sha('a'), conflicts: false },
      verification: ['node --test scripts/validate-review-lifecycle.node.mjs'],
      risk: 'medium',
      matrixId: 'RM-TREK-252-01',
      authorities: [
        { id: 'RA-1', kind: 'technical', reviewerId: 'technical-broad' },
        { id: 'RA-2', kind: 'conformance', reviewerId: 'conformance-broad' },
      ],
    },
    matrix: [
      { id: 'RM-1', obligation: 'criterion', authorityId: 'RA-1' },
      { id: 'RM-2', obligation: 'changed-surface', authorityId: 'RA-2' },
      { id: 'RM-3', obligation: 'risk', authorityId: 'RA-1' },
    ],
    expectedCoverage: ['criterion', 'changed-surface', 'risk'],
    findings: [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P1', matrixRows: ['RM-1'], states: ['open', 'accepted', 'fixed-pending-closure', 'closed'] }],
    batches: [{ id: 'RBATCH-1', baselineId: 'RB-TREK-252-01', findingIds: ['RF-1'], fromSha: sha('b'), toSha: sha('c'), artifactChanged: true, evidenceChanged: true, affectedMatrixRows: ['RM-1', 'RM-2'], affectedAuthorityIds: ['RA-1', 'RA-2'], closureRound: 1 }],
    closures: [
      { id: 'RC-1', batchId: 'RBATCH-1', authorityId: 'RA-1', closerId: 'technical-closer', fresh: true, terminalSha: sha('c'), disposition: 'closed' },
      { id: 'RC-2', batchId: 'RBATCH-1', authorityId: 'RA-2', closerId: 'conformance-closer', fresh: true, terminalSha: sha('c'), disposition: 'closed' },
    ],
    invalidators: [],
  }
}

function baselineOnlyLifecycle(cycle, idOffset = 0) {
  const lifecycle = validLifecycle()
  lifecycle.taskRange.candidateSha = sha('c')
  lifecycle.taskRange.terminalSha = sha('c')
  lifecycle.baseline.candidateSha = sha('c')
  lifecycle.baseline.terminalSha = sha('c')
  lifecycle.baseline.id = `RB-TREK-252-${cycle}`
  lifecycle.baseline.matrixId = `RM-TREK-252-${cycle}`
  lifecycle.baseline.authorities = [
    { id: `RA-${idOffset + 1}`, kind: 'technical', reviewerId: `technical-${cycle}` },
    { id: `RA-${idOffset + 2}`, kind: 'conformance', reviewerId: `conformance-${cycle}` },
  ]
  lifecycle.matrix = [
    { id: `RM-${idOffset + 1}`, obligation: 'criterion', authorityId: `RA-${idOffset + 1}` },
    { id: `RM-${idOffset + 2}`, obligation: 'changed-surface', authorityId: `RA-${idOffset + 2}` },
    { id: `RM-${idOffset + 3}`, obligation: 'risk', authorityId: `RA-${idOffset + 1}` },
  ]
  lifecycle.findings = []
  lifecycle.batches = []
  lifecycle.closures = []
  lifecycle.invalidators = []
  return lifecycle
}

const baselineBlock = (lifecycle) => `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle })}\n\`\`\``
const invalidatorBlock = (invalidator) => `Review-Invalidator:\n\`\`\`review-lifecycle\n${JSON.stringify({ invalidator })}\n\`\`\``

test('accepts a reconciled lifecycle with fresh P1 replacement closers', () => {
  assert.doesNotThrow(() => validateReviewLifecycle(validLifecycle()))
})

test('requires canonical two-digit baseline and invalidator cycle identities', () => {
  for (const cycle of ['00', '001', '100']) {
    const lifecycle = baselineOnlyLifecycle(cycle)
    assert.throws(() => validateReviewLifecycle(lifecycle), /cycle.*01.*99/i, cycle)
  }

  const invalidatorAlias = baselineOnlyLifecycle('01')
  invalidatorAlias.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-001', trigger: 'evidence-stale', decision: 'escalated', coordinatorEscalation: 'owner' }]
  assert.throws(() => validateReviewLifecycle(invalidatorAlias), /invalidator.*cycle.*01.*99/i)

  const successorAlias = baselineOnlyLifecycle('01')
  successorAlias.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: 'RB-TREK-252-002' }]
  assert.throws(() => validateReviewLifecycle(successorAlias), /successor.*cycle.*01.*99/i)
})

test('accepts only an initial 01 and adjacent, ordered, invalidator-linked successor cycles', () => {
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-cycles-'))
  const evidencePath = join(directory, 'evidence.md')
  const initial = baselineOnlyLifecycle('01')
  const second = baselineOnlyLifecycle('02', 3)
  const link = { id: 'RI-1', baselineId: initial.baseline.id, trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: second.baseline.id }
  try {
    writeFileSync(evidencePath, baselineBlock(initial))
    assert.doesNotThrow(() => validateReviewLifecycleFile(evidencePath))

    writeFileSync(evidencePath, [baselineBlock(initial), invalidatorBlock(link), baselineBlock(second)].join('\n'))
    assert.doesNotThrow(() => validateReviewLifecycleFile(evidencePath))

    writeFileSync(evidencePath, baselineBlock(baselineOnlyLifecycle('02')))
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /initial baseline cycle must be 01/i)

    writeFileSync(evidencePath, [baselineBlock(initial), baselineBlock(second)].join('\n'))
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /exactly one preceding new-cycle invalidator/i)

    const third = baselineOnlyLifecycle('03', 6)
    const skippedLink = { ...link, successorBaselineId: third.baseline.id }
    writeFileSync(evidencePath, [baselineBlock(initial), invalidatorBlock(skippedLink), baselineBlock(third)].join('\n'))
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /expected adjacent cycle 02/i)

    const reverseLink = { id: 'RI-2', baselineId: third.baseline.id, trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: second.baseline.id }
    writeFileSync(evidencePath, [
      baselineBlock(initial),
      invalidatorBlock(skippedLink),
      baselineBlock(third),
      invalidatorBlock(reverseLink),
      baselineBlock(second),
    ].join('\n'))
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /expected adjacent cycle 02/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects duplicate IDs, illegal transitions, incomplete coverage, and missing closure', () => {
  const duplicate = validLifecycle()
  duplicate.matrix[1].id = 'RM-1'
  assert.throws(() => validateReviewLifecycle(duplicate), /duplicate ID/i)

  const transition = validLifecycle()
  transition.findings[0].states = ['open', 'closed']
  assert.throws(() => validateReviewLifecycle(transition), /illegal finding transition/i)

  const coverage = validLifecycle()
  coverage.expectedCoverage.push('ux')
  assert.throws(() => validateReviewLifecycle(coverage), /incomplete coverage/i)

  const closure = validLifecycle()
  closure.closures = closure.closures.filter((entry) => entry.authorityId !== 'RA-2')
  assert.throws(() => validateReviewLifecycle(closure), /exactly one fresh replacement conformance closer/i)
})

test('rejects stale, rewritten, unaccounted ranges and invalidator escalation omissions', () => {
  const stale = validLifecycle()
  stale.baseline.candidateSha = sha('z')
  assert.throws(() => validateReviewLifecycle(stale), /candidate SHA/i)

  const unaccounted = validLifecycle()
  unaccounted.history.unaccountedIntegration = true
  assert.throws(() => validateReviewLifecycle(unaccounted), /unaccounted integration/i)

  const invalidated = validLifecycle()
  invalidated.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'history-rewritten', decision: 'new-cycle' }]
  assert.throws(() => validateReviewLifecycle(invalidated), /successor cycle/i)
})

test('requires a checkpoint and escalation after two unsuccessful closure rounds', () => {
  const lifecycle = validLifecycle()
  lifecycle.findings[0].states = ['open', 'accepted', 'fixed-pending-closure']
  lifecycle.batches = [
    { ...lifecycle.batches[0], id: 'RBATCH-2', closureRound: 2 },
  ]
  lifecycle.closures = []
  assert.throws(() => validateReviewLifecycle(lifecycle), /checkpoint and coordinator escalation/i)
})

test('parses canonical append-only Review blocks', () => {
  const lifecycle = validLifecycle()
  const markdown = `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle })}\n\`\`\``
  assert.deepEqual(parseReviewLifecycleBlocks(markdown), [{ type: 'Baseline', order: 0, lifecycle }])
})

test('requires UX closure when changed prescribed UX evidence is affected', () => {
  const lifecycle = validLifecycle()
  lifecycle.baseline.authorities.push({ id: 'RA-3', kind: 'ux', reviewerId: 'ux-broad' })
  lifecycle.matrix.push({ id: 'RM-4', obligation: 'ux-evidence', authorityId: 'RA-3' })
  lifecycle.expectedCoverage.push('ux-evidence')
  lifecycle.batches[0].affectedMatrixRows.push('RM-4')
  assert.throws(() => validateReviewLifecycle(lifecycle), /UX closure/i)
})

test('introduces findings append-only in Review-Batch after a finding-free baseline', () => {
  const lifecycle = validLifecycle()
  delete lifecycle.findings
  lifecycle.batches[0].findings = [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P1', matrixRows: ['RM-1'], states: ['open', 'accepted', 'fixed-pending-closure', 'closed'] }]
  delete lifecycle.batches[0].findingIds
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  const baselineBlock = `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle })}\n\`\`\``
  const batchBlock = `Review-Batch:\n\`\`\`review-lifecycle\n${JSON.stringify({ batch: lifecycle.batches[0] })}\n\`\`\``
  const closureBlocks = lifecycle.closures.map((closure) => `Review-Closure:\n\`\`\`review-lifecycle\n${JSON.stringify({ closure })}\n\`\`\``).join('\n')
  try {
    writeFileSync(evidencePath, `${batchBlock}\n${baselineBlock}\n${closureBlocks}`)
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /batch RBATCH-1 must follow its baseline/i)
    writeFileSync(evidencePath, `${baselineBlock}\n${closureBlocks}\n${batchBlock}`)
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /closure RC-1 must follow its batch/i)
    writeFileSync(evidencePath, `${baselineBlock}\n${batchBlock}\n${closureBlocks}`)
    assert.doesNotThrow(() => validateReviewLifecycleFile(evidencePath))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects unauthorised N/A, duplicated P1 closers, and a non-replacement fresh closer', () => {
  const na = validLifecycle()
  na.matrix[2] = { id: 'RM-3', obligation: 'N/A', covers: 'risk', authorityId: 'RA-1' }
  assert.throws(() => validateReviewLifecycle(na), /N\/A.*rationale.*authority/i)

  const duplicate = validLifecycle()
  duplicate.closures.push({ ...duplicate.closures[0], id: 'RC-3' })
  assert.throws(() => validateReviewLifecycle(duplicate), /exactly one fresh replacement/i)

  const replacement = validLifecycle()
  replacement.baseline.authorities[0].reviewerId = 'technical-closer'
  replacement.findings[0].authorityId = 'RA-1'
  replacement.closures[0].authorityId = 'RA-1'
  replacement.closures[1].authorityId = 'RA-2'
  assert.throws(() => validateReviewLifecycle(replacement), /must differ from original broad reviewer/i)
})

test('separately rejects rewritten history, stale upstream, and terminal accepted findings', () => {
  for (const [key, message] of [['rewritten', /history rewrite/i], ['staleUpstream', /stale upstream/i]]) {
    const lifecycle = validLifecycle()
    lifecycle.history[key] = true
    assert.throws(() => validateReviewLifecycle(lifecycle), message)
  }
  const accepted = validLifecycle()
  accepted.findings[0].states = ['open', 'accepted']
  assert.throws(() => validateReviewLifecycle(accepted), /terminal accepted finding/i)
})

test('caps specialist authority at one reviewer', () => {
  const lifecycle = validLifecycle()
  lifecycle.baseline.authorities.push(
    { id: 'RA-3', kind: 'specialist', reviewerId: 'specialist-one' },
    { id: 'RA-4', kind: 'specialist', reviewerId: 'specialist-two' },
  )
  assert.throws(() => validateReviewLifecycle(lifecycle), /specialist authority is capped/i)
})

test('requires an append-only successor baseline for a correction invalidator', () => {
  const lifecycle = validLifecycle()
  lifecycle.taskRange.candidateSha = sha('c')
  lifecycle.taskRange.terminalSha = sha('c')
  lifecycle.baseline.candidateSha = sha('c')
  lifecycle.baseline.terminalSha = sha('c')
  lifecycle.findings = []
  lifecycle.batches = []
  lifecycle.closures = []
  lifecycle.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: 'RB-TREK-252-02' }]
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  writeFileSync(evidencePath, `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle })}\n\`\`\`\nReview-Invalidator:\n\`\`\`review-lifecycle\n${JSON.stringify({ invalidator: lifecycle.invalidators[0] })}\n\`\`\``)
  try {
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /successor baseline block/i)
    const successor = structuredClone(lifecycle)
    successor.baseline.id = 'RB-TREK-252-02'
    successor.baseline.matrixId = 'RM-TREK-252-02'
    successor.baseline.authorities = [{ id: 'RA-3', kind: 'technical', reviewerId: 'technical-successor' }, { id: 'RA-4', kind: 'conformance', reviewerId: 'conformance-successor' }]
    successor.matrix = [{ id: 'RM-4', obligation: 'criterion', authorityId: 'RA-3' }, { id: 'RM-5', obligation: 'changed-surface', authorityId: 'RA-4' }, { id: 'RM-6', obligation: 'risk', authorityId: 'RA-3' }]
    successor.invalidators = []
    writeFileSync(evidencePath, `${readFileSync(evidencePath, 'utf8')}\nReview-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: successor })}\n\`\`\``)
    assert.doesNotThrow(() => validateReviewLifecycleFile(evidencePath))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('keeps the baseline terminal immutable and derives a later additive terminal', () => {
  const lifecycle = validLifecycle()
  lifecycle.batches[0].toSha = sha('d')
  lifecycle.closures.forEach((closure) => { closure.terminalSha = sha('d') })
  const validated = validateReviewLifecycle(lifecycle)
  assert.equal(validated.currentTerminalSha, sha('d'))
  assert.equal(validated.baseline.terminalSha, sha('b'))
})

test('validates appended successor cycles and rejects malformed successors', () => {
  const initial = validLifecycle()
  initial.taskRange.candidateSha = sha('c')
  initial.taskRange.terminalSha = sha('c')
  initial.baseline.candidateSha = sha('c')
  initial.baseline.terminalSha = sha('c')
  initial.findings = []
  initial.batches = []
  initial.closures = []
  initial.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: 'RB-TREK-252-02' }]
  const successor = structuredClone(initial)
  successor.baseline.id = 'RB-TREK-252-02'
  successor.baseline.matrixId = 'RM-TREK-252-02'
  successor.baseline.authorities = [{ id: 'RA-3', kind: 'technical', reviewerId: 'technical-successor' }, { id: 'RA-4', kind: 'conformance', reviewerId: 'conformance-successor' }]
  successor.matrix = [{ id: 'RM-4', obligation: 'criterion', authorityId: 'RA-3' }, { id: 'RM-5', obligation: 'changed-surface', authorityId: 'RA-4' }, { id: 'RM-6', obligation: 'risk', authorityId: 'RA-3' }]
  successor.invalidators = []
  delete successor.baseline.risk
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  writeFileSync(evidencePath, `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: initial })}\n\`\`\`\nReview-Invalidator:\n\`\`\`review-lifecycle\n${JSON.stringify({ invalidator: initial.invalidators[0] })}\n\`\`\`\nReview-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: successor })}\n\`\`\``)
  try {
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /risk classification/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects a batch attached to the wrong cycle', () => {
  const lifecycle = validLifecycle()
  lifecycle.batches[0].baselineId = 'RB-TREK-252-02'
  assert.throws(() => validateReviewLifecycle(lifecycle), /wrong baseline cycle/i)
})

test('rejects duplicate stable IDs across appended cycles', () => {
  const initial = validLifecycle()
  initial.taskRange.candidateSha = sha('c')
  initial.taskRange.terminalSha = sha('c')
  initial.baseline.candidateSha = sha('c')
  initial.baseline.terminalSha = sha('c')
  initial.findings = []
  initial.batches = []
  initial.closures = []
  const successor = structuredClone(initial)
  successor.baseline.id = 'RB-TREK-252-02'
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  writeFileSync(evidencePath, `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: initial })}\n\`\`\`\nReview-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: successor })}\n\`\`\``)
  try {
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /successor cycle RB-TREK-252-02 requires exactly one preceding/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('accepts rejected-only no-change batches and mixed rejected plus closed remediation', () => {
  const rejected = validLifecycle()
  rejected.taskRange.candidateSha = sha('c')
  rejected.taskRange.terminalSha = sha('c')
  rejected.baseline.candidateSha = sha('c')
  rejected.baseline.terminalSha = sha('c')
  rejected.findings = [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P2', matrixRows: ['RM-1'], states: ['open', 'rejected'] }]
  rejected.batches = [{ id: 'RBATCH-1', baselineId: 'RB-TREK-252-01', findingIds: ['RF-1'], fromSha: sha('c'), toSha: sha('c'), artifactChanged: false, evidenceChanged: false, affectedMatrixRows: ['RM-1'], affectedAuthorityIds: ['RA-1'], closureRound: 1 }]
  rejected.closures = []
  assert.doesNotThrow(() => validateReviewLifecycle(rejected))

  const mixed = validLifecycle()
  mixed.findings.push({ id: 'RF-2', authorityId: 'RA-2', severity: 'P2', matrixRows: ['RM-2'], states: ['open', 'rejected'] })
  mixed.batches[0].findingIds.push('RF-2')
  assert.doesNotThrow(() => validateReviewLifecycle(mixed))
})

test('rejects unresolved sync conflicts, extra closures, and cross-task baseline IDs', () => {
  const conflict = validLifecycle()
  conflict.baseline.sync.conflicts = true
  assert.throws(() => validateReviewLifecycle(conflict), /unresolved conflicts/i)

  const extraClosure = validLifecycle()
  extraClosure.baseline.authorities.push({ id: 'RA-3', kind: 'ux', reviewerId: 'ux-broad' })
  extraClosure.closures.push({ id: 'RC-3', batchId: 'RBATCH-1', authorityId: 'RA-3', closerId: 'ux-closer', fresh: false, terminalSha: sha('c'), disposition: 'closed' })
  assert.throws(() => validateReviewLifecycle(extraClosure), /unaffected authority closure/i)

  const crossTask = validLifecycle()
  crossTask.baseline.id = 'RB-TREK-999-01'
  crossTask.batches[0].baselineId = 'RB-TREK-999-01'
  assert.throws(() => validateReviewLifecycle(crossTask), /baseline task ID/i)
})

test('rejects review schema gaps that bypass authority or fresh-closer rules', () => {
  const na = validLifecycle()
  na.matrix[2] = { id: 'RM-3', obligation: 'N/A', covers: '', rationale: '', authorityId: 'RA-1' }
  assert.throws(() => validateReviewLifecycle(na), /N\/A.*covers.*rationale/i)

  const missingTechnical = validLifecycle()
  missingTechnical.baseline.authorities = missingTechnical.baseline.authorities.filter((authority) => authority.kind !== 'technical')
  missingTechnical.matrix.forEach((row) => { row.authorityId = 'RA-2' })
  missingTechnical.findings[0].authorityId = 'RA-2'
  missingTechnical.batches[0].affectedAuthorityIds = ['RA-2']
  missingTechnical.closures = [{ ...missingTechnical.closures[1] }]
  assert.throws(() => validateReviewLifecycle(missingTechnical), /technical authority/i)

  const findingScope = validLifecycle()
  findingScope.baseline.authorities.push({ id: 'RA-3', kind: 'ux', reviewerId: 'ux-broad' })
  findingScope.findings[0].authorityId = 'RA-3'
  assert.throws(() => validateReviewLifecycle(findingScope), /finding.*authority.*affected/i)

  const sameRange = validLifecycle()
  sameRange.batches[0].toSha = sameRange.batches[0].fromSha
  sameRange.closures.forEach((closure) => { closure.terminalSha = sameRange.batches[0].fromSha })
  assert.throws(() => validateReviewLifecycle(sameRange), /distinct additive range/i)

  const severity = validLifecycle()
  severity.findings[0].severity = 'P9'
  assert.throws(() => validateReviewLifecycle(severity), /supported severity/i)
})

test('rejects invalidator, matrix ID, and injected Git topology gaps', () => {
  const trigger = validLifecycle()
  trigger.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'invented-trigger', decision: 'escalated', coordinatorEscalation: 'owner' }]
  assert.throws(() => validateReviewLifecycle(trigger), /invalidator trigger/i)

  const matrixId = validLifecycle()
  matrixId.baseline.matrixId = 'RM-TREK-252-02'
  assert.throws(() => validateReviewLifecycle(matrixId), /matrix ID/i)

  const topology = validLifecycle()
  assert.throws(() => validateReviewLifecycle(topology, { gitVerifier: { exists: () => false, isAncestor: () => false } }), /Git object/i)
})

test('rejects a cross-task successor even when both cycles are cycle 01', () => {
  const source = validLifecycle()
  source.taskRange.candidateSha = sha('c')
  source.taskRange.terminalSha = sha('c')
  source.baseline.candidateSha = sha('c')
  source.baseline.terminalSha = sha('c')
  source.findings = []
  source.batches = []
  source.closures = []
  const invalidator = { id: 'RI-1', baselineId: 'RB-TREK-252-01', trigger: 'evidence-stale', decision: 'new-cycle', successorBaselineId: 'RB-TREK-999-01' }
  const successor = structuredClone(source)
  successor.taskId = 'TREK-999'
  successor.baseline.id = 'RB-TREK-999-01'
  successor.baseline.matrixId = 'RM-TREK-999-01'
  successor.baseline.authorities = [{ id: 'RA-9', kind: 'technical', reviewerId: 'technical-next' }, { id: 'RA-10', kind: 'conformance', reviewerId: 'conformance-next' }]
  successor.matrix = [{ id: 'RM-9', obligation: 'criterion', authorityId: 'RA-9' }, { id: 'RM-10', obligation: 'changed-surface', authorityId: 'RA-10' }, { id: 'RM-11', obligation: 'risk', authorityId: 'RA-9' }]
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  writeFileSync(evidencePath, `Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: source })}\n\`\`\`\nReview-Invalidator:\n\`\`\`review-lifecycle\n${JSON.stringify({ invalidator })}\n\`\`\`\nReview-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: successor })}\n\`\`\``)
  try {
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /successor.*same task/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('does not allow injected order fields to hide Batch-before-Baseline text order', () => {
  const lifecycle = validLifecycle()
  lifecycle.taskRange.candidateSha = sha('c')
  lifecycle.taskRange.terminalSha = sha('c')
  lifecycle.baseline.candidateSha = sha('c')
  lifecycle.baseline.terminalSha = sha('c')
  lifecycle.findings = []
  lifecycle.batches = []
  lifecycle.closures = []
  const batch = { id: 'RBATCH-1', baselineId: lifecycle.baseline.id, findings: [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P2', matrixRows: ['RM-1'], states: ['open', 'rejected'] }], fromSha: sha('c'), toSha: sha('c'), artifactChanged: false, evidenceChanged: false, affectedMatrixRows: ['RM-1'], affectedAuthorityIds: ['RA-1'], closureRound: 1 }
  const directory = mkdtempSync(join(tmpdir(), 'review-lifecycle-'))
  const evidencePath = join(directory, 'evidence.md')
  writeFileSync(evidencePath, `Review-Batch:\n\`\`\`review-lifecycle\n${JSON.stringify({ order: 2, batch })}\n\`\`\`\nReview-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ order: 0, lifecycle })}\n\`\`\``)
  try {
    assert.throws(() => validateReviewLifecycleFile(evidencePath), /reserved.*order|must follow its baseline/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
