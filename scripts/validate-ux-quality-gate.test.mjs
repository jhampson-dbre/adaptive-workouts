import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test } from 'vitest'
import { requiredPaths, validate } from './validate-ux-quality-gate.mjs'

const root = resolve(import.meta.dirname, '..')

function withFixture(callback) {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'ux-quality-gate-validator-'))

  try {
    for (const path of requiredPaths) {
      const target = resolve(fixtureRoot, path)
      cpSync(resolve(root, path), target, { recursive: true })
    }

    callback(fixtureRoot)
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

test('accepts the valid contract', () => {
  withFixture((fixtureRoot) => {
    validate(fixtureRoot)
  })
})

test('rejects deterministic model-policy drift', () => {
  withFixture((fixtureRoot) => {
    const designToml = resolve(fixtureRoot, '.codex/agents/ux-design-reviewer.toml')
    writeFileSync(designToml, readFileSync(designToml, 'utf8').replace('gpt-5.6-sol', 'gpt-5.6-invalid'))

    assert.throws(
      () => validate(fixtureRoot),
      /\.codex\/agents\/ux-design-reviewer\.toml must include contract phrase: model = "gpt-5\.6-sol"/,
    )
  })
})

test('rejects ordering drift', () => {
  withFixture((fixtureRoot) => {
    const skillPath = resolve(fixtureRoot, '.codex/skills/ux-quality-gate/SKILL.md')
    const sections = readFileSync(skillPath, 'utf8').split('\n\n')
    const designIndex = sections.findIndex((section) => section.startsWith('For required work'))
    const implementationIndex = sections.findIndex((section) => section.startsWith('After implementation'))
    ;[sections[designIndex], sections[implementationIndex]] = [sections[implementationIndex], sections[designIndex]]
    writeFileSync(skillPath, sections.join('\n\n'))

    assert.throws(
      () => validate(fixtureRoot),
      /\.codex\/skills\/ux-quality-gate\/SKILL\.md must keep contract concepts in order:/,
    )
  })
})

test('rejects canonical matrix ordering drift', () => {
  withFixture((fixtureRoot) => {
    const matrixPath = resolve(fixtureRoot, 'docs/templates/ux-evidence-matrix.md')
    const outcomeRow = '| Outcome | `observed-pass` / `defect` / `inconclusive` / `not-tested` / `static-risk` |'
    const routingRow = '| Changed-surface routing | Direct changed-surface defect blocks; unrelated finding uses duplicate search and approved follow-up routing |'
    const matrix = readFileSync(matrixPath, 'utf8')
    assert.ok(matrix.includes(`${outcomeRow}\n${routingRow}`), 'fixture must contain adjacent canonical rows')
    writeFileSync(matrixPath, matrix.replace(`${outcomeRow}\n${routingRow}`, `${routingRow}\n${outcomeRow}`))

    assert.throws(
      () => validate(fixtureRoot),
      /docs\/templates\/ux-evidence-matrix\.md must keep contract concepts in order: \| changed-surface routing \|/,
    )
  })
})

test('rejects missing workflow wiring', () => {
  withFixture((fixtureRoot) => {
    const workflowPath = resolve(fixtureRoot, '.github/workflows/ci.yml')
    writeFileSync(workflowPath, readFileSync(workflowPath, 'utf8').replace('run: npm run ci:workflow', 'run: npm run ci:test'))

    assert.throws(
      () => validate(fixtureRoot),
      /\.github\/workflows\/ci\.yml must include contract phrase: run: npm run ci:workflow/,
    )
  })
})

test('rejects commented configuration fields', () => {
  withFixture((fixtureRoot) => {
    const registrationPath = resolve(fixtureRoot, '.codex/skills/ux-quality-gate/agents/openai.yaml')
    const registration = readFileSync(registrationPath, 'utf8').replace('  display_name:', '  # display_name:')
    writeFileSync(registrationPath, registration)

    assert.throws(
      () => validate(fixtureRoot),
      /\.codex\/skills\/ux-quality-gate\/agents\/openai\.yaml must contain a configured display_name field/,
    )
  })
})
