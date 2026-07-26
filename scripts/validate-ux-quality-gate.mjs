import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..')

export const requiredPaths = [
  '.codex/skills/ux-quality-gate/SKILL.md',
  '.codex/skills/ux-quality-gate/agents/openai.yaml',
  'docs/templates/ux-evidence-matrix.md',
  '.codex/agents/ux-design-reviewer.toml',
  '.codex/agents/ux-usability-reviewer.toml',
  'package.json',
  '.github/workflows/ci.yml',
]

function read(root, path) {
  const absolutePath = resolve(root, path)
  assert.ok(existsSync(absolutePath), `missing UX quality gate file: ${path}`)
  return readFileSync(absolutePath, 'utf8')
}

export function validate(root = repositoryRoot) {
  for (const path of requiredPaths) read(root, path)

  const evidence = read(root, 'docs/templates/ux-evidence-matrix.md')
  for (const field of [
    'Classification:',
    'Approved scenario or artifact:',
    'Build / commit:',
    'Viewport and starting state:',
    'Actions:',
    'Observed result:',
    'Rendered evidence:',
    'Material limitation:',
  ]) assert.ok(evidence.includes(field), `UX evidence record must include: ${field}`)

  const skill = read(root, '.codex/skills/ux-quality-gate/SKILL.md')
  assert.match(skill, /synthetic or de-identified/i)
  assert.match(skill, /direct\s+changed-surface\s+defect/i)
  assert.match(skill, /missing rendered evidence/i)

  const design = read(root, '.codex/agents/ux-design-reviewer.toml')
  assert.match(design, /model\s*=\s*"gpt-5\.6-sol"/)
  assert.match(design, /model_reasoning_effort\s*=\s*"high"/)

  const usability = read(root, '.codex/agents/ux-usability-reviewer.toml')
  assert.match(usability, /model\s*=\s*"gpt-5\.6-sol"/)
  assert.match(usability, /model_reasoning_effort\s*=\s*"high"/)

  const registration = read(root, '.codex/skills/ux-quality-gate/agents/openai.yaml')
  assert.match(registration, /display_name:\s*["']?UX Quality Gate/i)
  assert.match(registration, /default_prompt:/)

  assert.match(read(root, 'package.json'), /validate-ux-quality-gate\.mjs/)
  assert.match(read(root, '.github/workflows/ci.yml'), /ci:workflow/)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  validate()
  console.log('UX quality gate contract validated.')
}
