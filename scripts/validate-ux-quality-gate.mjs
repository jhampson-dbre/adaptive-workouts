import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..')
const usabilityRecommendation = 'recommendation: rendered-usability-pass, evidence-complete-with-residual-capability-risk, needs-changes, or blocked.'

export const requiredPaths = [
  '.codex/skills/ux-quality-gate/SKILL.md',
  '.codex/skills/ux-quality-gate/agents/openai.yaml',
  '.codex/skills/feature-discovery/SKILL.md',
  'docs/templates/ux-evidence-matrix.md',
  'docs/feature-planning.md',
  'docs/agents/feature-planner.md',
  '.codex/agents/feature-planner-advisor.toml',
  'docs/agents/architecture-design-reviewer.md',
  '.codex/agents/architecture-design-reviewer.toml',
  'docs/agents/senior-developer-reviewer.md',
  '.codex/agents/senior-developer-reviewer.toml',
  'docs/agents/main-coordinator.md',
  'docs/agent-workflow.md',
  'docs/agents/implementor.md',
  '.codex/agents/implementor.toml',
  'docs/agents/code-simplifier.md',
  '.codex/agents/code-simplifier.toml',
  'docs/agents/code-reviewer.md',
  '.codex/agents/code-reviewer.toml',
  'docs/agents/spec-reviewer.md',
  '.codex/agents/spec-reviewer.toml',
  'AGENTS.md',
  'docs/agents/ux-design-reviewer.md',
  '.codex/agents/ux-design-reviewer.toml',
  'docs/agents/ux-usability-reviewer.md',
  '.codex/agents/ux-usability-reviewer.toml',
  'package.json',
  '.github/workflows/ci.yml',
]

const normalize = (value) => value.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function readContract(root, path) {
  const absolutePath = resolve(root, path)
  assert.ok(existsSync(absolutePath), `missing required UX quality gate contract: ${path}`)
  return normalize(readFileSync(absolutePath, 'utf8'))
}

function readRawContract(root, path) {
  const absolutePath = resolve(root, path)
  assert.ok(existsSync(absolutePath), `missing required UX quality gate contract: ${path}`)
  return readFileSync(absolutePath, 'utf8')
}

function assertIncludes(contents, path, phrase) {
  assert.ok(contents.includes(normalize(phrase)), `${path} must include contract phrase: ${phrase}`)
}

function assertLineMatches(contents, path, pattern, phrase) {
  assert.match(contents, pattern, `${path} must contain a configured ${phrase} field`)
}

function assertOrdered(contents, path, phrases) {
  let previousIndex = -1

  for (const phrase of phrases) {
    const index = contents.indexOf(normalize(phrase))
    assert.ok(index > previousIndex, `${path} must keep contract concepts in order: ${phrase}`)
    previousIndex = index
  }
}

export function validate(root = repositoryRoot) {
  for (const path of requiredPaths) readContract(root, path)

  const skill = readContract(root, '.codex/skills/ux-quality-gate/SKILL.md')
  for (const phrase of [
    'during discovery, classify ui work as',
    'classify ui work as',
    'skip-recorded',
    'fresh ux-design-reviewer before architecture-design-reviewer',
    'after implementation and the required simplification pass',
    'coordinator-owned rendered verification',
    'docs/templates/ux-evidence-matrix.md',
    'requires a resumable `checkpoint:`',
    'ux-usability-reviewer, code reviewer, and task-conformance reviewer run in parallel',
    'must not invoke agents, skills, browsers, llms, or external network tooling',
  ]) assertIncludes(skill, '.codex/skills/ux-quality-gate/SKILL.md', phrase)
  assertOrdered(skill, '.codex/skills/ux-quality-gate/SKILL.md', [
    'during discovery, classify ui work as',
    'for required work, dispatch a fresh ux-design-reviewer before architecture-design-reviewer',
    'after implementation and the required simplification pass',
    'after rendered verification, the fresh ux-usability-reviewer, code reviewer, and task-conformance reviewer run in parallel',
  ])

  const matrix = readContract(root, 'docs/templates/ux-evidence-matrix.md')
  for (const phrase of [
    'scenario-indexed ux evidence matrix',
    'required, optional, or skip-recorded',
    'applicability',
    'per-run capability probe',
    'capability_state',
    'capability_reason: unsupported-by-harness',
    'evidence kind',
    'outcome',
    'evidence obligation',
    'disposition',
    'changed-surface routing',
    'allowed recommendation',
    'build / commit',
    'fixture / data revision',
    'requested and actual viewport',
    'starting state',
    'action',
    'observed result',
    'representative synthetic or de-identified screenshots',
    'text-only rationale',
    'never require sensitive, personal, or production evidence',
  ]) assertIncludes(matrix, 'docs/templates/ux-evidence-matrix.md', phrase)
  const scenarioMatrix = matrix.slice(matrix.indexOf('## per-scenario record'))
  assertOrdered(scenarioMatrix, 'docs/templates/ux-evidence-matrix.md', [
    '| applicability |',
    '| per-run capability probe |',
    '| evidence kind |',
    '| outcome |',
    '| changed-surface routing |',
    '| evidence obligation |',
    '| disposition |',
    '| allowed recommendation |',
  ])

  const planningContracts = {
    '.codex/skills/feature-discovery/SKILL.md': [
      'required, optional, or skip-recorded',
      'docs/templates/ux-evidence-matrix.md',
    ],
    'docs/feature-planning.md': [
      'required, optional, or skip-recorded',
      'fresh ux-design-reviewer before architecture-design-reviewer',
      'through ux design review before user approval',
      'architecture retains authority',
      're-probe capability',
      'do not cache waivers',
    ],
  }
  for (const [path, concepts] of Object.entries(planningContracts)) {
    const contents = readContract(root, path)
    for (const phrase of concepts) assertIncludes(contents, path, phrase)
  }
  assertOrdered(readContract(root, 'docs/feature-planning.md'), 'docs/feature-planning.md', [
    'fresh ux-design-reviewer before architecture-design-reviewer',
    'before telling the user the design is ready for approval, run the architecture-design-reviewer',
  ])

  const executionContracts = {
    'docs/agent-workflow.md': [
      'per-run bounded capability probes',
      'canonical matrix',
      'docs/templates/ux-evidence-matrix.md',
      'missing prescribed rendered evidence blocks',
      'requires a resumable `checkpoint:`',
      'direct changed-surface usability finding blocks',
      'unsupported-by-harness is nonblocking only with complete metadata, fallback, and evidence obligation',
    ],
  }
  for (const [path, concepts] of Object.entries(executionContracts)) {
    const contents = readContract(root, path)
    for (const phrase of concepts) assertIncludes(contents, path, phrase)
  }

  const registration = readContract(root, '.codex/skills/ux-quality-gate/agents/openai.yaml')
  assertIncludes(registration, '.codex/skills/ux-quality-gate/agents/openai.yaml', 'display_name: "ux quality gate"')
  assertIncludes(registration, '.codex/skills/ux-quality-gate/agents/openai.yaml', 'default_prompt: "use $ux-quality-gate')
  const registrationRaw = readRawContract(root, '.codex/skills/ux-quality-gate/agents/openai.yaml')
  assertLineMatches(registrationRaw, '.codex/skills/ux-quality-gate/agents/openai.yaml', /^\s*display_name:\s*"UX Quality Gate"\s*$/m, 'display_name')
  assertLineMatches(registrationRaw, '.codex/skills/ux-quality-gate/agents/openai.yaml', /^\s*default_prompt:\s*"Use \$ux-quality-gate[^\n]*"\s*$/m, 'default_prompt')

  const designToml = readContract(root, '.codex/agents/ux-design-reviewer.toml')
  const usabilityToml = readContract(root, '.codex/agents/ux-usability-reviewer.toml')
  for (const [path, contents] of [
    ['.codex/agents/ux-design-reviewer.toml', designToml],
    ['.codex/agents/ux-usability-reviewer.toml', usabilityToml],
  ]) {
    assertIncludes(contents, path, 'model = "gpt-5.6-sol"')
    assertIncludes(contents, path, 'model_reasoning_effort = "high"')
    const raw = readRawContract(root, path)
    assertLineMatches(raw, path, /^\s*model\s*=\s*"gpt-5\.6-sol"\s*$/m, 'model')
    assertLineMatches(raw, path, /^\s*model_reasoning_effort\s*=\s*"high"\s*$/m, 'model_reasoning_effort')
  }

  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts?.['ci:workflow'], 'node scripts/validate-ux-quality-gate.mjs', 'ci:workflow must run only the static validator')
  assert.ok(packageJson.scripts?.['ci:check']?.includes('npm run ci:workflow'), 'ci:check must include ci:workflow')

  const workflow = readContract(root, '.github/workflows/ci.yml')
  assertIncludes(workflow, '.github/workflows/ci.yml', 'name: validate ux quality gate contract')
  assertIncludes(workflow, '.github/workflows/ci.yml', 'run: npm run ci:workflow')
  assertLineMatches(readRawContract(root, '.github/workflows/ci.yml'), '.github/workflows/ci.yml', /^\s+run:\s+npm run ci:workflow\s*$/m, 'ci:workflow')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validate()
  console.log('UX quality gate workflow contract validated.')
}
