// This native Node test is invoked by ci:agent-models, not Vitest discovery.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentsDirectory = path.join(repositoryRoot, '.codex', 'agents');
const allowedModels = new Set(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
const allowedReasoning = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);

test('active custom agents use fully specified supported GPT-5.6 routes', async () => {
  const agentFiles = (await readdir(agentsDirectory)).filter((file) => file.endsWith('.toml'));

  for (const agentFile of agentFiles) {
    const contents = await readFile(path.join(agentsDirectory, agentFile), 'utf8');
    const model = contents.match(/^model = "([^"]+)"$/m)?.[1];
    const reasoning = contents.match(/^model_reasoning_effort = "([^"]+)"$/m)?.[1];

    assert.ok(model, `${agentFile} must declare a model`);
    assert.ok(
      allowedModels.has(model),
      `${agentFile} must use one of ${[...allowedModels].join(', ')}, received ${model}`,
    );
    assert.ok(reasoning, `${agentFile} must declare a reasoning effort`);
    assert.ok(
      allowedReasoning.has(reasoning),
      `${agentFile} must use one of ${[...allowedReasoning].join(', ')}, received ${reasoning}`,
    );
  }
});
