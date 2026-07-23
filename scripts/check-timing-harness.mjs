import { TIMING_SCENARIOS, TIMING_VIEWPORTS, validateTimingScenarioManifest } from '../src/utils/timingScenarioManifest.js';
validateTimingScenarioManifest(TIMING_SCENARIOS, TIMING_VIEWPORTS);
console.log(`Timing harness manifest: ${TIMING_SCENARIOS.length} scenarios, ${TIMING_VIEWPORTS.length} viewport probes.`);
