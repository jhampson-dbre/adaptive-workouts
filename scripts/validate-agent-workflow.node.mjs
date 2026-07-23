import assert from 'node:assert/strict'
import test from 'node:test'

import { runWorkflowContracts } from './validate-agent-workflow.mjs'
import { validateFinalIntegrationContract } from './validate-final-integration-contract.mjs'

test('workflow aggregator propagates child validator failures', () => {
  assert.throws(
    () => runWorkflowContracts([() => {}, () => { throw new Error('review lifecycle contract failed') }]),
    (error) => error instanceof AggregateError && error.errors[0].message === 'review lifecycle contract failed',
  )
})

test('workflow aggregator includes the final-integration consumer contract', () => {
  assert.doesNotThrow(() => runWorkflowContracts([validateFinalIntegrationContract]))
})
