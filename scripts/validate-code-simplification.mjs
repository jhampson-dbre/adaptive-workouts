import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const normalize = (value) => value.replace(/\s+/g, ' ').trim()

function readContract(path) {
  return normalize(readFileSync(resolve(root, path), 'utf8'))
}

const contracts = [
  ['AGENTS.md', ['$code-simplification', 'at most once', 'current session']],
  ['docs/agent-workflow.md', ['$code-simplification', 'before/after rationale', 'repository-wide']],
  ['docs/agents/main-coordinator.md', ['$code-simplification', 'fresh code and task-conformance reviewers']],
  ['docs/agents/code-simplifier.md', ['approved task/spec', 'side-effect order', 'Never update Trekker']],
  ['.codex/agents/code-simplifier.toml', ['approved Trekker task/spec', 'side-effect order', 'Never update Trekker']],
  ['.codex/skills/code-simplification/SKILL.md', ['current-session task diff', 'at most one post-review rerun', 'Any later change to that diff requires renewed reviews']],
]

for (const [path, phrases] of contracts) {
  const contents = readContract(path)
  for (const phrase of phrases) {
    assert.ok(contents.includes(normalize(phrase)), `${path} must include contract phrase: ${phrase}`)
  }
}

const requiredDispatch = 'Every non-trivial green code diff requires a fresh code-simplifier dispatch, even when it may return no edits.'
const permittedSkip = 'Pre-dispatch skip is allowed only for documentation/copy-only work or tiny mechanical configuration changes.'
const noEditResult = 'No meaningful simplification opportunity is a valid no-edit simplifier result, not a pre-dispatch skip.'
const gateContracts = [
  'AGENTS.md',
  'docs/agent-workflow.md',
  '.codex/skills/code-simplification/SKILL.md',
]

for (const path of gateContracts) {
  const contents = readContract(path)
  for (const phrase of [requiredDispatch, permittedSkip, noEditResult]) {
    assert.ok(contents.includes(phrase), `${path} must use the shared required-dispatch/skip contract: ${phrase}`)
  }

  for (const bypass of [
    'or when the coordinator records why the green diff has no meaningful simplification opportunity',
    'or a green diff with no meaningful simplification opportunity',
    'or when inspection shows no meaningful simplification opportunity',
  ]) {
    assert.ok(!contents.includes(bypass), `${path} must not allow this non-trivial-code bypass: ${bypass}`)
  }
}

const synchronizedRoleContracts = [
  {
    role: 'implementor',
    paths: ['docs/agents/implementor.md', '.codex/agents/implementor.toml'],
    sharedConcepts: ['green diff and evidence', 'coordinator-owned', 'code-simplification', 'gate', 'final verification', 'simplifier edits'],
  },
  {
    role: 'code reviewer',
    paths: ['docs/agents/code-reviewer.md', '.codex/agents/code-reviewer.toml'],
    sharedConcepts: ['coordinator-owned simplification gate and final verification', 'simplification run/skip rationale', 'before/after rationale'],
  },
]

for (const { role, paths, sharedConcepts } of synchronizedRoleContracts) {
  for (const path of paths) {
    const contents = readContract(path)
    for (const concept of sharedConcepts) {
      assert.ok(contents.includes(concept), `${path} is out of sync with the ${role} contract: ${concept}`)
    }
  }
}

// Representative green implementation: correct, but needlessly duplicates the
// append operation and nests the eligibility path.
function complexWorkoutSummary(exercises, minimumReps, events) {
  if (!Array.isArray(exercises)) throw new TypeError('exercises must be an array')

  const result = []
  for (const exercise of exercises) {
    if (exercise.reps >= minimumReps) {
      if (exercise.enabled) {
        const entry = `${exercise.name}:${exercise.reps}`
        result.push(entry)
        events.push(`included:${exercise.name}`)
      } else {
        events.push(`skipped:${exercise.name}`)
      }
    } else {
      events.push(`skipped:${exercise.name}`)
    }
  }
  return result
}

// Applied simplification proposal: combine the duplicated skip paths with an
// explicit eligibility name and use an early continue. This removes nesting and
// duplication while retaining the domain concept and operation order.
function simplifiedWorkoutSummary(exercises, minimumReps, events) {
  if (!Array.isArray(exercises)) throw new TypeError('exercises must be an array')

  const result = []
  for (const exercise of exercises) {
    const isEligible = exercise.reps >= minimumReps && exercise.enabled
    if (!isEligible) {
      events.push(`skipped:${exercise.name}`)
      continue
    }

    result.push(`${exercise.name}:${exercise.reps}`)
    events.push(`included:${exercise.name}`)
  }
  return result
}

const cases = [
  [],
  [
    { name: 'squat', reps: 8, enabled: true },
    { name: 'row', reps: 4, enabled: true },
    { name: 'press', reps: 10, enabled: false },
    { name: 'carry', reps: 12, enabled: true },
  ],
]

for (const exercises of cases) {
  const beforeEvents = []
  const afterEvents = []
  const before = complexWorkoutSummary(exercises, 8, beforeEvents)
  const after = simplifiedWorkoutSummary(exercises, 8, afterEvents)
  assert.deepEqual(after, before, 'outputs and deterministic ordering must match')
  assert.deepEqual(afterEvents, beforeEvents, 'side-effect order must match')
}

for (const implementation of [complexWorkoutSummary, simplifiedWorkoutSummary]) {
  assert.throws(
    () => implementation(null, 8, []),
    (error) => error instanceof TypeError && error.message === 'exercises must be an array',
    'error type and message must remain exact',
  )
}

console.log('Representative diff inspected: duplicated skip paths and nested eligibility branch.')
console.log('Applied proposal: explicit isEligible guard removes duplication/nesting while preserving domain structure.')
console.log('Equivalent behavior validated: outputs, order, side-effect order, determinism, and error semantics.')
console.log('Markdown, TOML, and skill workflow contracts validated.')
