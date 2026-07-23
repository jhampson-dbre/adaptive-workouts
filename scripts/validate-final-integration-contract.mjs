import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const normalize = (value) => value.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const contracts = {
  'AGENTS.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  'docs/agent-workflow.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  'docs/agents/main-coordinator.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  'docs/agents/epic-reviewer.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  'docs/agents/spec-reviewer.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  '.codex/agents/epic-reviewer.toml': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  '.codex/agents/spec-reviewer.toml': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
  '.codex/skills/epic-development-branch-completion/SKILL.md': ['final-integration equivalence', 'full cumulative gates', 'reviewed sha'],
}

export function validateFinalIntegrationContract(repositoryRoot = root) {
  for (const [path, phrases] of Object.entries(contracts)) {
    const absolutePath = resolve(repositoryRoot, path)
    assert.ok(existsSync(absolutePath), `missing final-integration contract: ${path}`)
    const contents = normalize(readFileSync(absolutePath, 'utf8'))
    for (const phrase of phrases) assert.ok(contents.includes(normalize(phrase)), `${path} must include final-integration phrase: ${phrase}`)
  }
}
