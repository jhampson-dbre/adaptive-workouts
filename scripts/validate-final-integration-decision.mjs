import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const handoffs = {
  equivalent: ['independent-epic-authority', 'independent-conformance-authority', 'reviewed-sha', 'draft-pr-checks'],
  full: ['full-epic-review', 'fresh-epic-conformance-review', 'reviewed-sha', 'draft-pr-checks'],
}

const sha = /^[0-9a-f]{40}$/i

function malformed(evidence) {
  const { branch, task } = evidence ?? {}
  const lifecycle = task?.lifecycle
  const booleans = ['clean', 'mergeAffected', 'conflictResolved', 'designatedHighRisk']
  const lifecycleBooleans = ['coverageComplete', 'requiredAuthoritiesClosed', 'invalidated', 'rewritten', 'stale', 'unaccountedIntegration', 'scopeDrift']
  const summaryShas = task?.summary ? [task.summary.terminalSha, ...(task.summary.commitBoundaries ?? [])] : []
  const shaValues = [branch?.headSha, ...(branch?.planningCommits ?? []), ...(branch?.nonPlanningCommits ?? []), ...(lifecycle?.accountedCommits ?? []), lifecycle?.taskBaseSha, lifecycle?.candidateSha, lifecycle?.terminalSha, ...summaryShas]
  return !branch || !task || !lifecycle || !/^TREK-\d+$/.test(task.id ?? '') || !Array.isArray(branch.planningCommits) || !Array.isArray(branch.nonPlanningCommits) || !Array.isArray(branch.taskIds)
    || !branch.commitTaskIds || booleans.some((key) => typeof branch[key] !== 'boolean')
    || lifecycleBooleans.some((key) => typeof lifecycle[key] !== 'boolean') || !Array.isArray(lifecycle.accountedCommits) || !Array.isArray(lifecycle.closures)
    || !Array.isArray(lifecycle.invalidators) || !Array.isArray(lifecycle.expectedCoverageRows) || !Array.isArray(lifecycle.coveredCoverageRows)
    || !Array.isArray(lifecycle.requiredAuthorityIds) || !lifecycle.authorityKinds
    || typeof lifecycle.baselineId !== 'string' || !lifecycle.producerValidation || typeof lifecycle.producerValidation.state !== 'string' || !lifecycle.producerValidation.reference?.trim()
    || shaValues.some((value) => !sha.test(value ?? ''))
}

const sameOrder = (left, right) => left.length === right.length && left.every((value, index) => value === right[index])
const duplicate = (values) => new Set(values).size !== values.length

export function createGitTopologyVerifier(cwd = process.cwd()) {
  const run = (args) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
  }
  return ({ branch, task }) => {
    const { taskBaseSha, candidateSha, terminalSha } = task.lifecycle
    if (branch.planningCommits.some((commit) => run(['merge-base', '--is-ancestor', commit, taskBaseSha]) === null)) return false
    if (run(['merge-base', '--is-ancestor', taskBaseSha, candidateSha]) === null) return false
    if (run(['merge-base', '--is-ancestor', candidateSha, terminalSha]) === null) return false
    const commits = run(['rev-list', '--reverse', `${candidateSha}^..${terminalSha}`])
    return commits !== null && sameOrder(commits.split(/\r?\n/).filter(Boolean), branch.nonPlanningCommits)
  }
}

export function evaluateFinalIntegration(evidence, { topologyVerifier } = {}) {
  if (malformed(evidence)) return ineligible(['MALFORMED_EVIDENCE'])

  const { branch, task } = evidence
  const { lifecycle, summary } = task
  const codes = []
  const add = (condition, code) => { if (condition) codes.push(code) }
  add(!branch.clean, 'DIRTY_WORKTREE')
  add(branch.mergeAffected, 'MERGE_AFFECTED')
  add(branch.conflictResolved, 'CONFLICT_RESOLVED')
  add(branch.taskIds.length !== 1 || branch.taskIds[0] !== task.id, 'MULTI_TASK_BRANCH')
  add(!['low', 'medium'].includes(task.risk) || branch.designatedHighRisk, 'HIGH_RISK')
  add(!new RegExp(`^RB-${task.id}-\\d+$`).test(lifecycle.baselineId), 'BASELINE_ID_MISMATCH')
  add(lifecycle.producerValidation.state !== 'valid', 'PRODUCER_VALIDATION_FAILED')
  add(lifecycle.invalidators.some((record) => !record?.id || record.baselineId !== lifecycle.baselineId || !['new-cycle', 'escalated'].includes(record.decision)), 'MALFORMED_EVIDENCE')
  add(lifecycle.invalidators.length > 0, 'ACTIVE_INVALIDATOR')
  add(lifecycle.invalidated, 'INVALIDATED_EVIDENCE')
  add(lifecycle.rewritten, 'REWRITTEN_HISTORY')
  add(lifecycle.stale, 'STALE_EVIDENCE')
  add(lifecycle.unaccountedIntegration, 'UNACCOUNTED_INTEGRATION')
  add(lifecycle.scopeDrift, 'SCOPE_DRIFT')
  add(!lifecycle.coverageComplete || !lifecycle.expectedCoverageRows.length || duplicate(lifecycle.expectedCoverageRows) || duplicate(lifecycle.coveredCoverageRows) || !sameOrder([...lifecycle.expectedCoverageRows].sort(), [...lifecycle.coveredCoverageRows].sort()), 'INCOMPLETE_COVERAGE')
  const requiredAuthorities = lifecycle.requiredAuthorityIds
  const closureAuthorityIds = lifecycle.closures.map((closure) => closure?.authorityId)
  const invalidClosure = lifecycle.closures.some((closure) => !closure?.authorityId || closure.kind !== lifecycle.authorityKinds[closure.authorityId] || !['closed', 'pass'].includes(closure.disposition) || !sha.test(closure.reviewedSha ?? '') || closure.reviewedSha !== lifecycle.terminalSha || !closure.reference?.trim())
  add(!lifecycle.requiredAuthoritiesClosed || !requiredAuthorities.length || duplicate(requiredAuthorities) || duplicate(closureAuthorityIds) || !sameOrder([...requiredAuthorities].sort(), [...closureAuthorityIds].sort()) || !requiredAuthorities.some((id) => lifecycle.authorityKinds[id] === 'technical') || !requiredAuthorities.some((id) => lifecycle.authorityKinds[id] === 'conformance') || invalidClosure, 'MISSING_AUTHORITY_CLOSURE')
  add(!summary?.terminalSha || !Array.isArray(summary.commitBoundaries), 'MISSING_SUMMARY')
  add(lifecycle.candidateSha === lifecycle.taskBaseSha || lifecycle.terminalSha === lifecycle.taskBaseSha, 'INVALID_TASK_TOPOLOGY')

  const commits = branch.nonPlanningCommits
  const accountedCommitsMatch = sameOrder(lifecycle.accountedCommits, commits)
  const topologyMismatch = !commits.length || duplicate(commits) || duplicate(branch.planningCommits)
    || branch.planningCommits.some((commit) => commits.includes(commit)) || commits[0] !== lifecycle.candidateSha
    || branch.planningCommits.includes(lifecycle.taskBaseSha) || branch.planningCommits.includes(lifecycle.candidateSha) || branch.planningCommits.includes(lifecycle.terminalSha)
    || commits.at(-1) !== lifecycle.terminalSha || !accountedCommitsMatch
  add(topologyMismatch, 'ORDERED_TOPOLOGY_MISMATCH')
  add(!commits.includes(lifecycle.candidateSha) || !commits.includes(lifecycle.terminalSha) || !accountedCommitsMatch, 'UNACCOUNTED_COMMIT')
  add(!sameOrder(Object.keys(branch.commitTaskIds).sort(), [...commits].sort()), 'COMMIT_TASK_MAPPING_MISMATCH')
  add(commits.some((commit) => branch.commitTaskIds[commit] !== task.id), 'CROSS_TASK_INTEGRATION')
  const summaryBoundaries = lifecycle.candidateSha === lifecycle.terminalSha ? [lifecycle.candidateSha] : [lifecycle.candidateSha, lifecycle.terminalSha]
  add(summary?.taskId !== task.id || summary.terminalSha !== lifecycle.terminalSha || branch.headSha !== lifecycle.terminalSha || !sameOrder(summary.commitBoundaries, summaryBoundaries), 'SUMMARY_TOPOLOGY_MISMATCH')
  add(typeof topologyVerifier !== 'function' || topologyVerifier({ branch, task }) !== true, 'TOPOLOGY_UNVERIFIED')

  return codes.length ? ineligible(codes) : {
    eligible: true,
    mode: 'equivalent-task-evidence',
    reasonCodes: [],
    reviewedSha: lifecycle.terminalSha,
    requiredHandoff: handoffs.equivalent,
  }
}

function ineligible(reasonCodes) {
  return {
    eligible: false,
    mode: 'full-cumulative-gates',
    reasonCodes: [...new Set(reasonCodes)],
    reviewedSha: null,
    requiredHandoff: handoffs.full,
  }
}

if (process.argv[1]?.endsWith('validate-final-integration-decision.mjs')) {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error('usage: node scripts/validate-final-integration-decision.mjs <evidence.json>')
  console.log(JSON.stringify(evaluateFinalIntegration(JSON.parse(readFileSync(inputPath, 'utf8')), { topologyVerifier: createGitTopologyVerifier() }), null, 2))
}
