// This native Node test is invoked by ci:workflow, not Vitest discovery.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentsDirectory = path.join(repositoryRoot, '.codex', 'agents');
const allowedModels = new Set(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);

const documentedRolePolicies = [
  {
    agent: 'architecture-design-reviewer.toml',
    doc: 'docs/agents/architecture-design-reviewer.md',
    model: 'gpt-5.6-sol',
    reasoning: 'high',
    primary: 'GPT-5.6 Sol with high reasoning',
    fallback: 'GPT-5.6 Terra with medium reasoning',
  },
  {
    agent: 'epic-reviewer.toml',
    doc: 'docs/agents/epic-reviewer.md',
    model: 'gpt-5.6-sol',
    reasoning: 'high',
    primary: 'GPT-5.6 Sol with high reasoning',
    fallback: 'GPT-5.6 Terra with high reasoning',
  },
  {
    agent: 'feature-planner-advisor.toml',
    doc: 'docs/agents/feature-planner.md',
    model: 'gpt-5.6-sol',
    reasoning: 'high',
    primary: 'GPT-5.6 Sol with high reasoning',
    fallback: 'GPT-5.6 Terra with medium reasoning',
  },
  { agent: 'code-reviewer.toml', doc: 'docs/agents/code-reviewer.md', model: 'gpt-5.6-terra', reasoning: 'medium', primary: 'GPT-5.6 Terra with medium reasoning', fallback: 'GPT-5.6 Sol with high reasoning' },
  { agent: 'code-simplifier.toml', doc: 'docs/agents/code-simplifier.md', model: 'gpt-5.6-terra', reasoning: 'medium', primary: 'GPT-5.6 Terra with medium reasoning', fallback: 'GPT-5.6 Sol with high reasoning' },
  { agent: 'implementor.toml', doc: 'docs/agents/implementor.md', model: 'gpt-5.6-terra', reasoning: 'medium', primary: 'GPT-5.6 Terra with medium reasoning', fallback: 'GPT-5.6 Sol with high reasoning' },
  { agent: 'senior-developer-reviewer.toml', doc: 'docs/agents/senior-developer-reviewer.md', model: 'gpt-5.6-terra', reasoning: 'high', primary: 'GPT-5.6 Terra with high reasoning', fallback: 'GPT-5.6 Sol with high reasoning' },
  { agent: 'spec-reviewer.toml', doc: 'docs/agents/spec-reviewer.md', model: 'gpt-5.6-luna', reasoning: 'high', primary: 'GPT-5.6 Luna with high reasoning', fallback: 'GPT-5.6 Terra with high reasoning' },
];

test('active custom agents use fully specified supported GPT-5.6 models', async () => {
  const agentFiles = (await readdir(agentsDirectory)).filter((file) => file.endsWith('.toml'));

  for (const agentFile of agentFiles) {
    const contents = await readFile(path.join(agentsDirectory, agentFile), 'utf8');
    const model = contents.match(/^model = "([^"]+)"$/m)?.[1];

    assert.ok(model, `${agentFile} must declare a model`);
    assert.ok(
      allowedModels.has(model),
      `${agentFile} must use one of ${[...allowedModels].join(', ')}, received ${model}`,
    );
  }
});

test('high-rigor role docs state their configured primary and fallback policies', async () => {
  for (const policy of documentedRolePolicies) {
    const agentContents = await readFile(path.join(agentsDirectory, policy.agent), 'utf8');
    const contents = await readFile(path.join(repositoryRoot, policy.doc), 'utf8');

    assert.match(agentContents, new RegExp(`^model = "${policy.model}"$`, 'm'));
    assert.match(agentContents, new RegExp(`^model_reasoning_effort = "${policy.reasoning}"$`, 'm'));
    assert.match(contents, new RegExp(`Primary: ${policy.primary}`));
    assert.match(contents, new RegExp(`Fallback: ${policy.fallback}`));
  }
});
