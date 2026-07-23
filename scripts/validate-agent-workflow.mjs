import { validate as validateUxQualityGate } from './validate-ux-quality-gate.mjs'
import { validateReviewLifecycleContract } from './validate-review-lifecycle-contract.mjs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function runWorkflowContracts(validators = [validateUxQualityGate, validateReviewLifecycleContract]) {
  const failures = []
  for (const validate of validators) {
    try {
      validate()
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} workflow contract validator(s) failed`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWorkflowContracts()
  console.log('Agent workflow contracts validated.')
}
