import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'

import { createGitTopologyVerifier, evaluateFinalIntegration } from './validate-final-integration-decision.mjs'

const sha = (character) => character.repeat(40)

function eligibleEvidence() {
  const baseSha = sha('a')
  const candidateSha = sha('b')
  const terminalSha = sha('c')
  return {
    branch: {
      clean: true,
      mergeAffected: false,
      conflictResolved: false,
      designatedHighRisk: false,
      planningCommits: [sha('d')],
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
    ['rewritten', (evidence) => { evidence.task.lifecycle.rewritten = true }, 'REWRITTEN_HISTORY'],
    ['stale', (evidence) => { evidence.task.lifecycle.stale = true }, 'STALE_EVIDENCE'],
    ['unaccounted integration', (evidence) => { evidence.task.lifecycle.unaccountedIntegration = true }, 'UNACCOUNTED_INTEGRATION'],
    ['scope drift', (evidence) => { evidence.task.lifecycle.scopeDrift = true }, 'SCOPE_DRIFT'],
    ['missing coverage', (evidence) => { evidence.task.lifecycle.coverageComplete = false }, 'INCOMPLETE_COVERAGE'],
    ['missing closure', (evidence) => { evidence.task.lifecycle.requiredAuthoritiesClosed = false }, 'MISSING_AUTHORITY_CLOSURE'],
    ['missing summary', (evidence) => { delete evidence.task.summary }, 'MISSING_SUMMARY'],
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
    ['baseline missing', (evidence) => { delete evidence.task.lifecycle.baselineId }, 'MALFORMED_EVIDENCE'],
    ['missing designated-risk boolean', (evidence) => { delete evidence.branch.designatedHighRisk }, 'MALFORMED_EVIDENCE'],
    ['string eligibility boolean', (evidence) => { evidence.branch.clean = 'true' }, 'MALFORMED_EVIDENCE'],
    ['baseline mismatched', (evidence) => { evidence.task.lifecycle.baselineId = 'RB-TREK-252-01' }, 'BASELINE_ID_MISMATCH'],
    ['missing producer state', (evidence) => { delete evidence.task.lifecycle.producerValidation.state }, 'MALFORMED_EVIDENCE'],
    ['empty producer reference', (evidence) => { evidence.task.lifecycle.producerValidation.reference = '' }, 'MALFORMED_EVIDENCE'],
    ['producer invalid', (evidence) => { evidence.task.lifecycle.producerValidation.state = 'invalid' }, 'PRODUCER_VALIDATION_FAILED'],
    ['active invalidator', (evidence) => { evidence.task.lifecycle.invalidators = [{ id: 'RI-1', baselineId: 'RB-TREK-246-01', decision: 'new-cycle' }] }, 'ACTIVE_INVALIDATOR'],
    ['malformed invalidator', (evidence) => { evidence.task.lifecycle.invalidators = [{ id: 'RI-1' }] }, 'MALFORMED_EVIDENCE'],
    ['coverage mismatch', (evidence) => { evidence.task.lifecycle.coveredCoverageRows.pop() }, 'INCOMPLETE_COVERAGE'],
    ['authority mismatch', (evidence) => { evidence.task.lifecycle.closures.pop() }, 'MISSING_AUTHORITY_CLOSURE'],
    ['missing technical authority', (evidence) => { evidence.task.lifecycle.authorityKinds['RA-1'] = 'ux' }, 'MISSING_AUTHORITY_CLOSURE'],
    ['duplicate closure', (evidence) => { evidence.task.lifecycle.closures.push({ ...evidence.task.lifecycle.closures[0] }) }, 'MISSING_AUTHORITY_CLOSURE'],
    ['closure wrong terminal', (evidence) => { evidence.task.lifecycle.closures[0].reviewedSha = sha('d') }, 'MISSING_AUTHORITY_CLOSURE'],
    ['closure invalid SHA', (evidence) => { evidence.task.lifecycle.closures[0].reviewedSha = 'bad' }, 'MISSING_AUTHORITY_CLOSURE'],
    ['closure not closed', (evidence) => { evidence.task.lifecycle.closures[0].disposition = 'open' }, 'MISSING_AUTHORITY_CLOSURE'],
    ['closure missing reference', (evidence) => { delete evidence.task.lifecycle.closures[0].reference }, 'MISSING_AUTHORITY_CLOSURE'],
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
  assert.ok(malformed.reasonCodes.includes('MALFORMED_EVIDENCE'))

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
    assert.equal(decision.eligible, true)
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
