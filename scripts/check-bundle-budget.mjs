import { checkBuild } from './bundle-budget.mjs'

checkBuild().catch(error => { console.error(error.message); process.exitCode = 1 })
