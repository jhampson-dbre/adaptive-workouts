import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..')

export const requiredPaths = [
  '.codex/skills/ux-quality-gate/SKILL.md',
  '.codex/skills/ux-quality-gate/agents/openai.yaml',
  'docs/agents/ux-design-reviewer.md',
  '.codex/agents/ux-design-reviewer.toml',
  'docs/agents/ux-usability-reviewer.md',
  '.codex/agents/ux-usability-reviewer.toml',
  'package.json',
  '.github/workflows/ci.yml',
]

const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()

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
    'ux-usability-reviewer, code reviewer, and task-conformance reviewer run in parallel',
    'must not invoke agents, skills, browsers, llms, or external network tooling',
  ]) assertIncludes(skill, '.codex/skills/ux-quality-gate/SKILL.md', phrase)
  assertOrdered(skill, '.codex/skills/ux-quality-gate/SKILL.md', [
    'during discovery, classify ui work as',
    'for required work, dispatch a fresh ux-design-reviewer before architecture-design-reviewer',
    'after implementation and the required simplification pass',
    'after rendered verification, the fresh ux-usability-reviewer, code reviewer, and task-conformance reviewer run in parallel',
  ])

  const registration = readContract(root, '.codex/skills/ux-quality-gate/agents/openai.yaml')
  assertIncludes(registration, '.codex/skills/ux-quality-gate/agents/openai.yaml', 'display_name: "ux quality gate"')
  assertIncludes(registration, '.codex/skills/ux-quality-gate/agents/openai.yaml', 'default_prompt: "use $ux-quality-gate')
  const registrationRaw = readRawContract(root, '.codex/skills/ux-quality-gate/agents/openai.yaml')
  assertLineMatches(registrationRaw, '.codex/skills/ux-quality-gate/agents/openai.yaml', /^\s*display_name:\s*"UX Quality Gate"\s*$/m, 'display_name')
  assertLineMatches(registrationRaw, '.codex/skills/ux-quality-gate/agents/openai.yaml', /^\s*default_prompt:\s*"Use \$ux-quality-gate[^\n]*"\s*$/m, 'default_prompt')

  const roleContracts = [
    {
      role: 'ux design reviewer',
      paths: ['docs/agents/ux-design-reviewer.md', '.codex/agents/ux-design-reviewer.toml'],
      concepts: [
        'gpt-5.6-sol with high reasoning',
        'gpt-5.6-terra with high reasoning is the nearest-tier fallback',
        'fresh ux-design-reviewer before architecture-design-reviewer',
        'do not create or update trekker records',
        'do not start implementation',
      ],
    },
    {
      role: 'ux usability reviewer',
      paths: ['docs/agents/ux-usability-reviewer.md', '.codex/agents/ux-usability-reviewer.toml'],
      concepts: [
        'gpt-5.6-sol with high reasoning',
        'gpt-5.6-terra with high reasoning is the nearest-tier fallback',
        'coordinator-owned rendered verification',
        'after implementation and the required simplification pass',
        'do not create or update trekker records',
        'do not start implementation',
      ],
    },
  ]

  for (const { role, paths, concepts } of roleContracts) {
    for (const path of paths) {
      const contents = readContract(root, path)
      for (const concept of concepts) assertIncludes(contents, path, concept)
    }
    for (const path of paths) assertIncludes(readContract(root, path), path, role)
  }

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
