import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const normalize = (value) => value.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const contracts = {
  'docs/templates/review-lifecycle-evidence.md': ['append-only', 'review-baseline:', 'review-batch:', 'review-closure:', 'review-invalidator:', 'sanitized', 'exactly one fresh replacement scoped closer', 'checkpoint:', 'coordinator escalation'],
  'AGENTS.md': ['immutable review baseline', 'coverage and authority matrix', 'p0/p1', 'review-baseline:', 'review-batch:', 'review-closure:', 'review-invalidator:'],
  'docs/agent-workflow.md': ['immutable review baseline', 'coverage and authority matrix', 'p0/p1', 'review-baseline:', 'review-batch:', 'review-closure:', 'review-invalidator:'],
  'docs/agents/main-coordinator.md': ['immutable review baseline', 'coverage and authority matrix', 'p0/p1', 'review-baseline:', 'review-batch:', 'review-closure:', 'review-invalidator:'],
  'docs/agents/implementor.md': ['review baseline', 'do not create', 'review-baseline:'],
  '.codex/agents/implementor.toml': ['review baseline', 'do not create', 'review-baseline:'],
  'docs/agents/code-reviewer.md': ['immutable review baseline', 'scoped closure', 'p0/p1'],
  '.codex/agents/code-reviewer.toml': ['immutable review baseline', 'scoped closure', 'p0/p1'],
  'docs/agents/spec-reviewer.md': ['immutable review baseline', 'scoped closure', 'p0/p1'],
  '.codex/agents/spec-reviewer.toml': ['immutable review baseline', 'scoped closure', 'p0/p1'],
  'docs/agents/ux-usability-reviewer.md': ['scoped closure', 'prescribed ux evidence'],
  '.codex/agents/ux-usability-reviewer.toml': ['scoped closure', 'prescribed ux evidence'],
}

export function validateReviewLifecycleContract(repositoryRoot = root) {
  for (const [path, phrases] of Object.entries(contracts)) {
    const absolutePath = resolve(repositoryRoot, path)
    assert.ok(existsSync(absolutePath), `missing review lifecycle contract: ${path}`)
    const contents = normalize(readFileSync(absolutePath, 'utf8'))
    for (const phrase of phrases) assert.ok(contents.includes(normalize(phrase)), `${path} must include review lifecycle phrase: ${phrase}`)
  }
}
