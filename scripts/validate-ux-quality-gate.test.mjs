import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { requiredPaths, validate } from './validate-ux-quality-gate.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ux-contract-'))
  for (const path of requiredPaths) {
    const source = resolve(import.meta.dirname, '..', path)
    const target = resolve(root, path)
    mkdirSync(resolve(target, '..'), { recursive: true })
    cpSync(source, target, { recursive: true })
  }
  return root
}

function mutate(root, path, update) {
  const target = resolve(root, path)
  writeFileSync(target, update(readFileSync(target, 'utf8')))
}

test('accepts the repository contract', () => validate())

test('rejects a missing evidence field', (t) => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mutate(root, 'docs/templates/ux-evidence-matrix.md', (value) =>
    value.replace('- Rendered evidence:', '- Screenshot:'))
  assert.throws(() => validate(root), /Rendered evidence/)
})

test('rejects usability model drift', (t) => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mutate(root, '.codex/agents/ux-usability-reviewer.toml', (value) =>
    value.replace('gpt-5.6-sol', 'gpt-5.6-terra'))
  assert.throws(() => validate(root))
})

test('rejects missing CI wiring', (t) => {
  const root = fixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mutate(root, 'package.json', (value) =>
    value.replace('validate-ux-quality-gate.mjs', 'removed-validator.mjs'))
  assert.throws(() => validate(root), /validate-ux-quality-gate/)
})
