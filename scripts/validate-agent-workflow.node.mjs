import assert from 'node:assert/strict'
import test from 'node:test'

import { runWorkflowContracts } from './validate-agent-workflow.mjs'

test('workflow aggregator propagates child validator failures', () => {
  assert.throws(
    () => runWorkflowContracts([() => {}, () => { throw new Error('review lifecycle contract failed') }]),
    (error) => error instanceof AggregateError && error.errors[0].message === 'review lifecycle contract failed',
  )
})
