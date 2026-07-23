import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'

import { createGitTopologyVerifier, evaluateFinalIntegration } from './validate-final-integration-decision.mjs'

const sha = (character) => character.repeat(40)

function eligibleEvidence() {
  const baseSha = sha('a')
  const candidateSha = sha('b')
  const terminalSha = sha('c')
  const evidence = {
    branch: {
      clean: true,
      mergeAffected: false,
      conflictResolved: false,
      designatedHighRisk: false,
      planningCommits: [sha('d')],
      preCandidateCommits: [],
      nonPlanningCommits: [candidateSha, terminalSha],
      commitTaskIds: { [candidateSha]: 'TREK-246', [terminalSha]: 'TREK-246' },
      taskIds: ['TREK-246'],
      headSha: terminalSha,
    },
    task: {
      id: 'TREK-246',
      risk: 'medium',
      summary: { taskId: 'TREK-246', terminalSha, commitBoundaries: [candidateSha, terminalSha] },
      lifecycle: {
        baselineId: 'RB-TREK-246-01',
        producerValidation: { state: 'valid', reference: 'Review-Baseline:CMT-400' },
        taskBaseSha: baseSha,
        candidateSha,
        terminalSha,
        invalidators: [],
        coverageComplete: true,
        requiredAuthoritiesClosed: true,
        expectedCoverageRows: ['RM-1', 'RM-2'],
        coveredCoverageRows: ['RM-1', 'RM-2'],
        requiredAuthorityIds: ['RA-1', 'RA-2'],
        authorityKinds: { 'RA-1': 'technical', 'RA-2': 'conformance' },
        closures: [
          { authorityId: 'RA-1', kind: 'technical', disposition: 'closed', reviewedSha: terminalSha, reference: 'Review-Closure:CMT-401' },
          { authorityId: 'RA-2', kind: 'conformance', disposition: 'pass', reviewedSha: terminalSha, reference: 'Review-Closure:CMT-402' },
        ],
        invalidated: false,
        rewritten: false,
        stale: false,
        unaccountedIntegration: false,
        scopeDrift: false,
        accountedCommits: [candidateSha, terminalSha],
      },
    },
  }
  Object.defineProperties(evidence.task, {
    canonicalCommitRange: { enumerable: true, get: () => evidence.task.lifecycle.accountedCommits },
    canonicalEvidence: { enumerable: true, get: () => canonicalExport(evidence) },
    terminalSummary: { enumerable: true, get: () => evidence.task.summary },
    authorityPasses: {
      enumerable: true,
      get: () => evidence.task.lifecycle.terminalSha === evidence.task.lifecycle.candidateSha
        ? evidence.task.lifecycle.closures.map((closure) => ({ ...closure }))
        : [],
    },
  })
  evidence.task.summaryReference = 'Summary:CMT-500'
  return evidence
}

function canonicalExport(evidence) {
  const l = evidence.task.lifecycle
  if (l.producerValidation?.state !== 'valid' || !l.producerValidation?.reference || l.closures.some((closure) => !closure.reference)) return ''
  const hasBatch = l.terminalSha !== l.candidateSha
  const authorities = Object.entries(l.authorityKinds).map(([id, kind]) => ({ id, kind, reviewerId: kind }))
  const matrix = l.coverageComplete ? l.coveredCoverageRows.map((id, index) => ({ id, obligation: index ? 'changed-surface' : 'criterion', authorityId: index ? 'RA-2' : 'RA-1' })) : []
  const lifecycle = {
    taskId: evidence.task.id, taskRange: { baseSha: l.taskBaseSha, candidateSha: l.candidateSha, terminalSha: l.candidateSha }, history: { rewritten: l.rewritten, staleUpstream: l.stale, unaccountedIntegration: l.unaccountedIntegration },
    baseline: { id: l.baselineId, taskBaseSha: l.taskBaseSha, candidateSha: l.candidateSha, terminalSha: l.candidateSha, sync: { mainSha: sha('d'), syncSha: l.taskBaseSha, conflicts: false }, verification: ['test'], risk: evidence.task.risk, matrixId: 'RM-TREK-246-01', authorities },
    expectedCoverage: l.coverageComplete ? ['criterion', 'changed-surface'] : [], matrix,
    findings: hasBatch ? [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P2', matrixRows: ['RM-1'], states: ['open', 'accepted', 'fixed-pending-closure', 'closed'] }] : [],
    batches: hasBatch ? [{ id: 'RBATCH-1', baselineId: l.baselineId, findingIds: ['RF-1'], findings: [{ id: 'RF-1', authorityId: 'RA-1', severity: 'P2', matrixRows: ['RM-1'], states: ['open', 'accepted', 'fixed-pending-closure', 'closed'] }], fromSha: l.candidateSha, toSha: l.terminalSha, artifactChanged: true, evidenceChanged: true, affectedMatrixRows: ['RM-1'], affectedAuthorityIds: ['RA-1', 'RA-2'], closureRound: 1 }] : [],
    closures: hasBatch && l.requiredAuthoritiesClosed ? l.closures.map((closure, index) => ({ id: `RC-${index + 1}`, batchId: 'RBATCH-1', authorityId: closure.authorityId, closerId: closure.kind, fresh: false, terminalSha: closure.reviewedSha, disposition: closure.disposition === 'pass' ? 'closed' : closure.disposition })) : [], invalidators: (l.invalidated || l.scopeDrift) && !l.invalidators.length ? [{ id: 'RI-1', baselineId: l.baselineId, trigger: l.scopeDrift ? 'unrelated-range' : 'evidence-stale', decision: 'escalated', coordinatorEscalation: 'test' }] : l.invalidators.map((invalidator) => ({ ...invalidator, trigger: 'evidence-stale', decision: 'escalated', coordinatorEscalation: 'test' })),
  }
  const baseline = { ...lifecycle, findings: [], batches: [], closures: [], invalidators: [] }
  const blocks = [`Review-Baseline:\n\`\`\`review-lifecycle\n${JSON.stringify({ lifecycle: baseline })}\n\`\`\``]
  if (hasBatch) {
    blocks.push(`Review-Batch:\n\`\`\`review-lifecycle\n${JSON.stringify({ batch: lifecycle.batches[0] })}\n\`\`\``)
    for (const closure of lifecycle.closures) blocks.push(`Review-Closure:\n\`\`\`review-lifecycle\n${JSON.stringify({ closure })}\n\`\`\``)
  }
  for (const invalidator of lifecycle.invalidators) blocks.push(`Review-Invalidator:\n\`\`\`review-lifecycle\n${JSON.stringify({ invalidator })}\n\`\`\``)
  blocks.push('Summary:\nValidated task terminal and authority evidence.')
  return blocks.join('\n')
}

const trustedTopology = { topologyVerifier: () => true }

test('accepts only a clean single-task low or medium risk topology with reconciled canonical evidence', () => {
  const decision = evaluateFinalIntegration(eligibleEvidence(), trustedTopology)

  assert.equal(decision.eligible, true)
  assert.equal(decision.mode, 'equivalent-task-evidence')
  assert.deepEqual(decision.reasonCodes, [])
  assert.equal(decision.reviewedSha, sha('c'))
  assert.deepEqual(decision.requiredHandoff, ['independent-epic-authority', 'independent-conformance-authority', 'reviewed-sha', 'draft-pr-checks'])
})

test('fails closed for each final-integration ineligibility condition', () => {
  const cases = [
    ['dirty', (evidence) => { evidence.branch.clean = false }, 'DIRTY_WORKTREE'],
    ['merge affected', (evidence) => { evidence.branch.mergeAffected = true }, 'MERGE_AFFECTED'],
    ['conflict resolved', (evidence) => { evidence.branch.conflictResolved = true }, 'CONFLICT_RESOLVED'],
    ['multi task', (evidence) => { evidence.branch.taskIds.push('TREK-252') }, 'MULTI_TASK_BRANCH'],
    ['cross-task integration', (evidence) => { evidence.branch.commitTaskIds[sha('c')] = 'TREK-252' }, 'CROSS_TASK_INTEGRATION'],
    ['high risk', (evidence) => { evidence.task.risk = 'high' }, 'HIGH_RISK'],
    ['designated high risk', (evidence) => { evidence.branch.designatedHighRisk = true }, 'HIGH_RISK'],
    ['invalidated', (evidence) => { evidence.task.lifecycle.invalidated = true }, 'INVALIDATED_EVIDENCE'],
    ['rewritten', (evidence) => { evidence.task.lifecycle.rewritten = true }, 'CANONICAL_EVIDENCE_INVALID'],
    ['stale', (evidence) => { evidence.task.lifecycle.stale = true }, 'CANONICAL_EVIDENCE_INVALID'],
    ['unaccounted integration', (evidence) => { evidence.task.lifecycle.unaccountedIntegration = true }, 'CANONICAL_EVIDENCE_INVALID'],
    ['scope drift', (evidence) => { evidence.task.lifecycle.scopeDrift = true }, 'SCOPE_DRIFT'],
    ['missing coverage', (evidence) => { evidence.task.lifecycle.coverageComplete = false }, 'CANONICAL_EVIDENCE_INVALID'],
    ['missing closure', (evidence) => { evidence.task.lifecycle.requiredAuthoritiesClosed = false }, 'CANONICAL_EVIDENCE_INVALID'],
    ['missing summary', (evidence) => { delete evidence.task.summary }, 'CANONICAL_EVIDENCE_INVALID'],
    ['unaccounted commit', (evidence) => { evidence.task.lifecycle.accountedCommits.pop() }, 'UNACCOUNTED_COMMIT'],
    ['substantive post-task change', (evidence) => { evidence.branch.nonPlanningCommits.push(sha('d')) }, 'UNACCOUNTED_COMMIT'],
    ['candidate not on branch', (evidence) => { evidence.branch.nonPlanningCommits[0] = sha('d') }, 'UNACCOUNTED_COMMIT'],
  ]

  for (const [name, mutate, expectedCode] of cases) {
    const evidence = eligibleEvidence()
    mutate(evidence)
    const decision = evaluateFinalIntegration(evidence, trustedTopology)
    assert.equal(decision.eligible, false, name)
    assert.equal(decision.mode, 'full-cumulative-gates', name)
    assert.ok(decision.reasonCodes.includes(expectedCode), `${name}: ${decision.reasonCodes.join(', ')}`)
    assert.deepEqual(decision.requiredHandoff, ['full-epic-review', 'fresh-epic-conformance-review', 'reviewed-sha', 'draft-pr-checks'], name)
  }
})

test('requires canonical producer identity, invalidator records, auditable coverage, closure, summary, and trusted topology', () => {
  const cases = [
    ['baseline missing', (evidence) => { delete evidence.task.lifecycle.baselineId }, 'CANONICAL_EVIDENCE_INVALID'],
    ['missing designated-risk boolean', (evidence) => { delete evidence.branch.designatedHighRisk }, 'MALFORMED_EVIDENCE'],
    ['string eligibility boolean', (evidence) => { evidence.branch.clean = 'true' }, 'MALFORMED_EVIDENCE'],
    ['baseline mismatched', (evidence) => { evidence.task.lifecycle.baselineId = 'RB-TREK-252-01' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['missing producer state', (evidence) => { delete evidence.task.lifecycle.producerValidation.state }, 'CANONICAL_EVIDENCE_INVALID'],
    ['empty producer reference', (evidence) => { evidence.task.lifecycle.producerValidation.reference = '' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['producer invalid', (evidence) => { evidence.task.lifecycle.producerValidation.state = 'invalid' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['active invalidator', (evidence) => { evidence.task.lifecycle.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-246-01', decision: 'new-cycle' }] }, 'ACTIVE_INVALIDATOR'],
    ['malformed invalidator', (evidence) => { evidence.task.lifecycle.invalidators = [{ id: 'RI-1' }] }, 'CANONICAL_EVIDENCE_INVALID'],
    ['coverage mismatch', (evidence) => { evidence.task.lifecycle.coveredCoverageRows.pop() }, 'CANONICAL_EVIDENCE_INVALID'],
    ['authority mismatch', (evidence) => { evidence.task.lifecycle.closures.pop() }, 'CANONICAL_EVIDENCE_INVALID'],
    ['missing technical authority', (evidence) => { evidence.task.lifecycle.authorityKinds['RA-1'] = 'ux' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['duplicate closure', (evidence) => { evidence.task.lifecycle.closures.push({ ...evidence.task.lifecycle.closures[0] }) }, 'CANONICAL_EVIDENCE_INVALID'],
    ['closure wrong terminal', (evidence) => { evidence.task.lifecycle.closures[0].reviewedSha = sha('d') }, 'CANONICAL_EVIDENCE_INVALID'],
    ['closure invalid SHA', (evidence) => { evidence.task.lifecycle.closures[0].reviewedSha = 'bad' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['closure not closed', (evidence) => { evidence.task.lifecycle.closures[0].disposition = 'open' }, 'CANONICAL_EVIDENCE_INVALID'],
    ['closure missing reference', (evidence) => { delete evidence.task.lifecycle.closures[0].reference }, 'CANONICAL_EVIDENCE_INVALID'],
    ['summary task mismatch', (evidence) => { evidence.task.summary.taskId = 'TREK-252' }, 'SUMMARY_TOPOLOGY_MISMATCH'],
    ['head mismatch', (evidence) => { evidence.branch.headSha = sha('d') }, 'SUMMARY_TOPOLOGY_MISMATCH'],
    ['reversed topology', (evidence) => { evidence.branch.nonPlanningCommits.reverse(); evidence.task.lifecycle.accountedCommits.reverse() }, 'ORDERED_TOPOLOGY_MISMATCH'],
    ['duplicate topology commit', (evidence) => { evidence.branch.nonPlanningCommits.push(sha('c')) }, 'ORDERED_TOPOLOGY_MISMATCH'],
    ['planning overlap', (evidence) => { evidence.branch.planningCommits.push(sha('b')) }, 'ORDERED_TOPOLOGY_MISMATCH'],
    ['invalid branch SHA', (evidence) => { evidence.branch.headSha = 'bad' }, 'MALFORMED_EVIDENCE'],
    ['extra task mapping', (evidence) => { evidence.branch.commitTaskIds[sha('d')] = 'TREK-246' }, 'COMMIT_TASK_MAPPING_MISMATCH'],
    ['missing task mapping', (evidence) => { delete evidence.branch.commitTaskIds[sha('b')] }, 'COMMIT_TASK_MAPPING_MISMATCH'],
  ]

  for (const [name, mutate, expectedCode] of cases) {
    const evidence = eligibleEvidence()
    mutate(evidence)
    const decision = evaluateFinalIntegration(evidence, trustedTopology)
    assert.equal(decision.eligible, false, name)
    assert.ok(decision.reasonCodes.includes(expectedCode), `${name}: ${decision.reasonCodes.join(', ')}`)
  }

  const untrusted = evaluateFinalIntegration(eligibleEvidence())
  assert.equal(untrusted.eligible, false)
  assert.ok(untrusted.reasonCodes.includes('TOPOLOGY_UNVERIFIED'))

  const treeIdCannotRescue = eligibleEvidence()
  treeIdCannotRescue.branch.treeId = 'same-tree'
  treeIdCannotRescue.branch.patchId = 'same-patch'
  treeIdCannotRescue.branch.clean = false
  const decision = evaluateFinalIntegration(treeIdCannotRescue, trustedTopology)
  assert.equal(decision.eligible, false)
  assert.ok(decision.reasonCodes.includes('DIRTY_WORKTREE'))
})

test('treats malformed producer evidence and planning commits as ineligible rather than implicit passes', () => {
  const malformed = evaluateFinalIntegration({})
  assert.equal(malformed.eligible, false)
  assert.ok(malformed.reasonCodes.includes('CANONICAL_EVIDENCE_INVALID'))

  const planningAsCandidate = eligibleEvidence()
  planningAsCandidate.task.lifecycle.candidateSha = planningAsCandidate.task.lifecycle.taskBaseSha
  const decision = evaluateFinalIntegration(planningAsCandidate, trustedTopology)
  assert.equal(decision.eligible, false)
  assert.ok(decision.reasonCodes.includes('INVALID_TASK_TOPOLOGY'))
})

test('CLI fixture emits the explicit decision, reason codes, and reviewed SHA', () => {
  const directory = mkdtempSync(join(tmpdir(), 'final-integration-'))
  const fixture = join(directory, 'eligible.json')
  try {
    writeFileSync(fixture, JSON.stringify(eligibleEvidence()))
    const output = execFileSync(process.execPath, [resolve('scripts/validate-final-integration-decision.mjs'), fixture], { encoding: 'utf8' })
    const decision = JSON.parse(output)
    assert.equal(decision.eligible, false)
    assert.ok(decision.reasonCodes.includes('TOPOLOGY_UNVERIFIED'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CLI accepts a real Git topology and a candidate-equals-terminal lifecycle is unambiguous', () => {
  const directory = mkdtempSync(join(tmpdir(), 'final-integration-git-'))
  const runGit = (args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  const commit = (message) => {
    writeFileSync(join(directory, 'history.txt'), `${message}\n`, { flag: 'a' })
    runGit(['add', 'history.txt'])
    runGit(['commit', '-m', message])
    return runGit(['rev-parse', 'HEAD'])
  }
  try {
    runGit(['init'])
    runGit(['config', 'core.autocrlf', 'false'])
    runGit(['config', 'user.email', 'codex@example.test'])
    runGit(['config', 'user.name', 'Codex Test'])
    const planning = commit('planning')
    const base = commit('base')
    const candidate = commit('candidate')
    const terminal = commit('terminal')
    const evidence = eligibleEvidence()
    evidence.branch.planningCommits = [planning]
    evidence.branch.nonPlanningCommits = [candidate, terminal]
    evidence.branch.commitTaskIds = { [candidate]: 'TREK-246', [terminal]: 'TREK-246' }
    evidence.branch.headSha = terminal
    evidence.task.summary = { taskId: 'TREK-246', terminalSha: terminal, commitBoundaries: [candidate, terminal] }
    Object.assign(evidence.task.lifecycle, {
      taskBaseSha: base,
      candidateSha: candidate,
      terminalSha: terminal,
      accountedCommits: [candidate, terminal],
      closures: [
        { authorityId: 'RA-1', kind: 'technical', disposition: 'closed', reviewedSha: terminal, reference: 'Review-Closure:CMT-401' },
        { authorityId: 'RA-2', kind: 'conformance', disposition: 'pass', reviewedSha: terminal, reference: 'Review-Closure:CMT-402' },
      ],
    })
    const fixture = join(directory, 'eligible.json')
    writeFileSync(fixture, JSON.stringify(evidence))
    const output = execFileSync(process.execPath, [resolve('scripts/validate-final-integration-decision.mjs'), fixture], { cwd: directory, encoding: 'utf8' })
    const decision = JSON.parse(output)
    assert.equal(decision.eligible, true, JSON.stringify(decision))
    assert.equal(decision.reviewedSha, terminal)

    const verifier = createGitTopologyVerifier(directory)
    const nonexistentPlanning = structuredClone(evidence)
    nonexistentPlanning.branch.planningCommits = [sha('e')]
    assert.ok(evaluateFinalIntegration(nonexistentPlanning, { topologyVerifier: verifier }).reasonCodes.includes('TOPOLOGY_UNVERIFIED'))
    const afterBasePlanning = structuredClone(evidence)
    afterBasePlanning.branch.planningCommits = [candidate]
    assert.ok(evaluateFinalIntegration(afterBasePlanning, { topologyVerifier: verifier }).reasonCodes.includes('TOPOLOGY_UNVERIFIED'))

    const single = eligibleEvidence()
    single.branch.nonPlanningCommits = [sha('b')]
    single.branch.commitTaskIds = { [sha('b')]: 'TREK-246' }
    single.branch.headSha = sha('b')
    single.task.summary = { taskId: 'TREK-246', terminalSha: sha('b'), commitBoundaries: [sha('b')] }
    Object.assign(single.task.lifecycle, {
      candidateSha: sha('b'), terminalSha: sha('b'), accountedCommits: [sha('b')],
      closures: [
        { authorityId: 'RA-1', kind: 'technical', disposition: 'closed', reviewedSha: sha('b'), reference: 'Review-Closure:CMT-401' },
        { authorityId: 'RA-2', kind: 'conformance', disposition: 'pass', reviewedSha: sha('b'), reference: 'Review-Closure:CMT-402' },
      ],
    })
    assert.equal(evaluateFinalIntegration(single, trustedTopology).eligible, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('fails closed instead of throwing on malformed collections and detects an injected pre-candidate commit', () => {
  for (const mutate of [
    (evidence) => { evidence.branch.planningCommits = {} },
    (evidence) => { evidence.branch.nonPlanningCommits = {} },
  ]) {
    const evidence = eligibleEvidence()
    mutate(evidence)
    assert.doesNotThrow(() => evaluateFinalIntegration(evidence, trustedTopology))
    assert.ok(evaluateFinalIntegration(evidence, trustedTopology).reasonCodes.includes('MALFORMED_EVIDENCE'))
  }

  const directory = mkdtempSync(join(tmpdir(), 'final-integration-pre-candidate-'))
  const runGit = (args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  const commit = (message) => {
    writeFileSync(join(directory, 'history.txt'), `${message}\n`, { flag: 'a' })
    runGit(['add', 'history.txt']); runGit(['commit', '-m', message]); return runGit(['rev-parse', 'HEAD'])
  }
  try {
    runGit(['init']); runGit(['config', 'core.autocrlf', 'false']); runGit(['config', 'user.email', 'codex@example.test']); runGit(['config', 'user.name', 'Codex Test'])
    const planning = commit('planning'); const base = commit('base'); const injected = commit('injected'); const candidate = commit('candidate'); const terminal = commit('terminal')
    const evidence = eligibleEvidence()
    Object.assign(evidence.branch, { planningCommits: [planning], nonPlanningCommits: [candidate, terminal], commitTaskIds: { [candidate]: 'TREK-246', [terminal]: 'TREK-246' }, headSha: terminal })
    Object.assign(evidence.task.lifecycle, { taskBaseSha: base, candidateSha: candidate, terminalSha: terminal, accountedCommits: [candidate, terminal] })
    evidence.task.summary = { taskId: 'TREK-246', terminalSha: terminal, commitBoundaries: [candidate, terminal] }
    assert.equal(createGitTopologyVerifier(directory)({ branch: evidence.branch, task: evidence.task }), false, `injected ${injected} must be reconciled`)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('epic completion dispatches full cumulative gates only for ineligible decisions', () => {
  const skill = readFileSync('.codex/skills/epic-development-branch-completion/SKILL.md', 'utf8')
  assert.match(skill, /When the decision is \*\*ineligible\*\*, dispatch both full cumulative reviews/)
  assert.match(skill, /When the decision is \*\*eligible\*\*, dispatch the same two independent authorities as\s+scoped acknowledgements/)
  assert.match(skill, /Do not ask them to repeat cumulative branch analysis/)
})

test('rejects a foreign-task pre-candidate commit across the full task range', () => {
  const evidence = eligibleEvidence()
  evidence.branch.preCandidateCommits = [sha('e')]
  evidence.branch.commitTaskIds = {
    [sha('e')]: 'TREK-999',
    [sha('b')]: 'TREK-246',
    [sha('c')]: 'TREK-246',
  }
  evidence.task.lifecycle.accountedCommits = [sha('e'), sha('b'), sha('c')]

  const decision = evaluateFinalIntegration(evidence, trustedTopology)
  assert.equal(decision.eligible, false)
  assert.ok(decision.reasonCodes.includes('CROSS_TASK_INTEGRATION'))
})

test('accepts prose Summary compatibility and fails closed on divergent envelope evidence', () => {
  const evidence = structuredClone(eligibleEvidence())
  assert.match(evidence.task.canonicalEvidence, /Summary:\nValidated task terminal/)
  assert.equal(evaluateFinalIntegration(evidence, trustedTopology).eligible, true)

  const noFinding = structuredClone(eligibleEvidence())
  noFinding.branch.nonPlanningCommits = [sha('b')]
  noFinding.branch.commitTaskIds = { [sha('b')]: 'TREK-246' }
  noFinding.branch.headSha = sha('b')
  noFinding.task.lifecycle.terminalSha = sha('b')
  noFinding.task.lifecycle.accountedCommits = [sha('b')]
  noFinding.task.terminalSummary = { taskId: 'TREK-246', terminalSha: sha('b'), commitBoundaries: [sha('b')] }
  noFinding.task.authorityPasses = [
    { authorityId: 'RA-1', kind: 'technical', disposition: 'pass', reviewedSha: sha('b'), reference: 'Summary:RA-1' },
    { authorityId: 'RA-2', kind: 'conformance', disposition: 'pass', reviewedSha: sha('b'), reference: 'Summary:RA-2' },
  ]
  noFinding.task.canonicalCommitRange = [sha('b')]
  noFinding.task.canonicalEvidence = canonicalExport(noFinding)
  assert.equal(evaluateFinalIntegration(noFinding, trustedTopology).eligible, true)

  const divergent = structuredClone(evidence)
  divergent.task.terminalSummary.terminalSha = sha('b')
  const decision = evaluateFinalIntegration(divergent, trustedTopology)
  assert.equal(decision.eligible, false)
  assert.ok(decision.reasonCodes.includes('SUMMARY_TOPOLOGY_MISMATCH'))

  const stalePass = structuredClone(noFinding)
  stalePass.task.authorityPasses[0].reviewedSha = sha('c')
  assert.ok(evaluateFinalIntegration(stalePass, trustedTopology).reasonCodes.includes('MISSING_AUTHORITY_CLOSURE'))
})
