import { readFileSync } from 'node:fs'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseReviewLifecycleBlocks, validateReviewLifecycleFile } from './validate-review-lifecycle.mjs'

const handoffs = {
  equivalent: ['independent-epic-authority', 'independent-conformance-authority', 'reviewed-sha', 'draft-pr-checks'],
  full: ['full-epic-review', 'fresh-epic-conformance-review', 'reviewed-sha', 'draft-pr-checks'],
}

const sha = /^[0-9a-f]{40}$/i

function consumeCanonicalEvidence(task) {
  const markdown = task?.canonicalEvidence
  if (typeof markdown !== 'string') throw new Error('canonical evidence export is required')
  const directory = mkdtempSync(join(tmpdir(), 'final-integration-evidence-'))
  const path = join(directory, 'evidence.md')
  try {
    writeFileSync(path, markdown)
    const cycles = validateReviewLifecycleFile(path)
    const lifecycle = cycles.at(-1)
    const summary = task.terminalSummary
    if (!summary || !task.summaryReference?.trim()) throw new Error('terminal Summary fields and reference are required')
    const blocks = parseReviewLifecycleBlocks(markdown)
    const batchIds = new Set(lifecycle.batches.map((batch) => batch.id))
    const closures = blocks.filter((block) => block.type === 'Closure' && batchIds.has(block.closure.batchId)).map((block) => block.closure)
    const authorityPasses = task.authorityPasses
    if (!Array.isArray(authorityPasses)) throw new Error('terminal Summary authorityPasses is required')
    return { lifecycle, summary, closures, authorityPasses }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

function malformed(evidence) {
  const { branch, task } = evidence ?? {}
  const lifecycle = task?.lifecycle
  const booleans = ['clean', 'mergeAffected', 'conflictResolved', 'designatedHighRisk']
  const lifecycleBooleans = ['coverageComplete', 'requiredAuthoritiesClosed', 'invalidated', 'rewritten', 'stale', 'unaccountedIntegration', 'scopeDrift']
  if (!branch || !task || !lifecycle || typeof branch !== 'object' || typeof task !== 'object' || typeof lifecycle !== 'object') return true
  const arrays = [branch.planningCommits, branch.preCandidateCommits, branch.nonPlanningCommits, branch.taskIds, lifecycle.accountedCommits, lifecycle.closures, lifecycle.invalidators, lifecycle.expectedCoverageRows, lifecycle.coveredCoverageRows, lifecycle.requiredAuthorityIds]
  if (arrays.some((value) => !Array.isArray(value)) || (task.summary && !Array.isArray(task.summary.commitBoundaries))) return true
  const summaryShas = task.summary ? [task.summary.terminalSha, ...task.summary.commitBoundaries] : []
  const shaValues = [branch.headSha, ...branch.planningCommits, ...branch.preCandidateCommits, ...branch.nonPlanningCommits, ...lifecycle.accountedCommits, lifecycle.taskBaseSha, lifecycle.candidateSha, lifecycle.terminalSha, ...summaryShas]
  return !/^TREK-\d+$/.test(task.id ?? '')
    || !branch.commitTaskIds || booleans.some((key) => typeof branch[key] !== 'boolean')
    || lifecycleBooleans.some((key) => typeof lifecycle[key] !== 'boolean') || !lifecycle.authorityKinds
    || typeof lifecycle.baselineId !== 'string' || !lifecycle.producerValidation || typeof lifecycle.producerValidation.state !== 'string' || !lifecycle.producerValidation.reference?.trim()
    || shaValues.some((value) => !sha.test(value ?? ''))
}

const sameOrder = (left, right) => left.length === right.length && left.every((value, index) => value === right[index])
const duplicate = (values) => new Set(values).size !== values.length

export function isCanonicalBaselineId(taskId, baselineId) {
  return new RegExp(`^RB-${taskId}-(?:0[1-9]|[1-9]\\d)$`).test(baselineId)
}

export function createGitTopologyVerifier(cwd = process.cwd()) {
  const run = (args) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
  }
  return ({ branch, task }) => {
    const { taskBaseSha, candidateSha, terminalSha } = task.lifecycle
    if (branch.planningCommits.some((commit) => run(['merge-base', '--is-ancestor', commit, taskBaseSha]) === null)) return false
    if (run(['merge-base', '--is-ancestor', taskBaseSha, candidateSha]) === null) return false
    if (run(['merge-base', '--is-ancestor', candidateSha, terminalSha]) === null) return false
    const commits = run(['rev-list', '--reverse', `${taskBaseSha}..${terminalSha}`])
    return commits !== null && sameOrder(commits.split(/\r?\n/).filter(Boolean), [...branch.preCandidateCommits, ...branch.nonPlanningCommits])
  }
}

export function evaluateFinalIntegration(evidence, { topologyVerifier } = {}) {
  try {
    const canonical = consumeCanonicalEvidence(evidence?.task)
    const authorities = canonical.lifecycle.baseline.authorities
    const closureRecords = canonical.closures.map((closure) => ({ authorityId: closure.authorityId, kind: authorities.find((authority) => authority.id === closure.authorityId)?.kind, disposition: closure.disposition, reviewedSha: closure.terminalSha, reference: closure.id }))
    const passRecords = canonical.authorityPasses.map((pass) => ({ authorityId: pass.authorityId, kind: pass.kind, disposition: pass.disposition, reviewedSha: pass.reviewedSha, reference: pass.reference }))
    evidence = {
      ...evidence,
      task: {
        ...evidence.task,
        lifecycle: {
          taskBaseSha: canonical.lifecycle.baseline.taskBaseSha,
          candidateSha: canonical.lifecycle.baseline.candidateSha,
          terminalSha: canonical.lifecycle.currentTerminalSha,
          baselineId: canonical.lifecycle.baseline.id,
          producerValidation: { state: 'valid', reference: canonical.lifecycle.baseline.id },
          invalidators: canonical.lifecycle.invalidators,
          coverageComplete: canonical.lifecycle.matrix.length > 0,
          requiredAuthoritiesClosed: true,
          expectedCoverageRows: canonical.lifecycle.matrix.map((row) => row.id),
          coveredCoverageRows: canonical.lifecycle.matrix.map((row) => row.id),
          requiredAuthorityIds: authorities.map((authority) => authority.id),
          authorityKinds: Object.fromEntries(authorities.map((authority) => [authority.id, authority.kind])),
          closures: [...closureRecords, ...passRecords],
          invalidated: canonical.lifecycle.invalidators.length > 0,
          rewritten: canonical.lifecycle.history.rewritten,
          stale: canonical.lifecycle.history.staleUpstream,
          unaccountedIntegration: canonical.lifecycle.history.unaccountedIntegration,
          scopeDrift: canonical.lifecycle.invalidators.some((invalidator) => invalidator.trigger === 'approved-intent-change' || invalidator.trigger === 'unrelated-range'),
          accountedCommits: evidence.task.canonicalCommitRange,
        },
        summary: canonical.summary,
      },
    }
  } catch { return ineligible(['CANONICAL_EVIDENCE_INVALID']) }
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
  add(!isCanonicalBaselineId(task.id, lifecycle.baselineId), 'BASELINE_ID_MISMATCH')
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
  const taskRangeCommits = [...branch.preCandidateCommits, ...commits]
  const accountedCommitsMatch = sameOrder(lifecycle.accountedCommits, taskRangeCommits)
  const topologyMismatch = !commits.length || duplicate(taskRangeCommits) || duplicate(branch.planningCommits)
    || branch.planningCommits.some((commit) => taskRangeCommits.includes(commit)) || commits[0] !== lifecycle.candidateSha
    || branch.planningCommits.includes(lifecycle.taskBaseSha) || branch.planningCommits.includes(lifecycle.candidateSha) || branch.planningCommits.includes(lifecycle.terminalSha)
    || commits.at(-1) !== lifecycle.terminalSha || !accountedCommitsMatch
  add(topologyMismatch, 'ORDERED_TOPOLOGY_MISMATCH')
  add(!commits.includes(lifecycle.candidateSha) || !commits.includes(lifecycle.terminalSha) || !accountedCommitsMatch, 'UNACCOUNTED_COMMIT')
  add(!sameOrder(Object.keys(branch.commitTaskIds).sort(), [...taskRangeCommits].sort()), 'COMMIT_TASK_MAPPING_MISMATCH')
  add(taskRangeCommits.some((commit) => branch.commitTaskIds[commit] !== task.id), 'CROSS_TASK_INTEGRATION')
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
