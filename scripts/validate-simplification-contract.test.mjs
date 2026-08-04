import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

test('workflow validates one bounded ponytail proposal pass before simplification', () => {
  const coordinator = read('docs/agents/main-coordinator.md')
  const global = read('AGENTS.md')
  const skill = read('.codex/skills/code-simplification/SKILL.md')
  const prompt = read('.codex/skills/code-simplification/agents/openai.yaml')
  const agent = read('.codex/agents/code-simplifier.toml')

  for (const contract of [coordinator, global]) {
    assert.match(contract, /one bounded `?\$ponytail-review`? proposal pass/i)
    assert.match(contract, /materially changed, stabilized green in-scope diff/i)
    assert.match(contract, /one-line proposals and net estimate/i)
    assert.match(contract, /findings (?:as|are) hypotheses/i)
    assert.match(contract, /accepted, rejected, or deferred/i)
    assert.match(contract, /unchanged evidence never retriggers/i)
    assert.match(contract, /not a ledger or transcript/i)
    assert.match(contract, /callers, state, trust, security, data loss, concurrency, accessibility, focus, persistence, schema, fingerprint, ordering, determinism, errors, and tests/i)
    assert.match(contract, /line reduction alone is insufficient/i)
    assert.match(contract, /public behavior, persistence\/schema\/fingerprint compatibility, and error behavior/i)
    assert.match(contract, /final handoff records dispositions, cuts, verification, and routing/i)
  }

  assert.match(coordinator, /redundant mirrored state, dead payload plumbing, or duplicate unchanged-input validation/i)
  assert.match(coordinator, /security-rule deduplication, shared mutation locks, and two-version fingerprint abstractions/i)
  assert.match(skill, /accepted complexity signal/i)
  assert.match(skill, /^description: Remove an accepted complexity signal from the bounded \$ponytail-review pass/m)
  assert.match(skill, /not edit authority/i)
  assert.match(prompt, /accepted signal/i)
  assert.match(agent, /accepted complexity signal/i)
})
