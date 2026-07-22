const timing = (id, title, start, actions, expected) => ({ id, title, group: 'timing', start, actions, expected });
const recovery = (id, title, status, expected) => ({ id, title, group: 'recovery', start: 'Generated workout with injected recovery adapter', actions: [`Present synthetic ${status} result`], expected, recoveryStatus: status });

export const TIMING_SCENARIOS = Object.freeze([
  timing('T-01', 'Start and Warmup', 'Generated workout', ['Start Workout', 'Advance clock to zero', 'Advance clock to overtime'], 'Warmup heading, countdown, zero, and labeled overtime remain until Start first set.'),
  timing('T-02', 'Performance entry', 'Warmup after Start Workout', ['Start first set', 'Cancel work timer'], 'Performance keeps the exercise and next action after cancellation.'),
  timing('T-03', 'Normal Cooldown', 'Performance with one ready final set', ['Start set', 'Confirm set'], 'Cooldown heading receives focus and exposes Finish Workout.'),
  timing('T-04', 'Early end and cancellation', 'Performance with partial work / no work', ['Confirm early finish with completed work', 'Confirm early finish with no completed work'], 'Partial work enters Cooldown; no-work confirmation cancels without history.'),
  timing('T-05', 'Cooldown timing', 'Cooldown after final confirmation', ['Advance clock to target', 'Advance clock to overtime', 'Finish Workout'], 'Countdown, zero, overtime, and frozen total are visible.'),
  timing('T-06', 'Resume and re-entry', 'Cooldown with a final confirmed set', ['Resume Workout', 'Reconfirm final set', 'Undo final set'], 'Performance/Cooldown re-entry keeps cumulative phase time.'),
  timing('T-07', 'Review lifecycle', 'Cooldown with completed work', ['Finish Workout', 'Back', 'Finish Workout'], 'Review is frozen; Back returns to Cooldown and excludes the Review gap.'),
  timing('T-08', 'Clock behavior', 'Warmup with injected clock', ['Advance forward/sleep', 'Move clock backward', 'Advance to rounded boundary'], 'Displayed elapsed time never decreases after a backward clock change.'),
  timing('T-09', 'V4 History and save', 'Injected v4, malformed, and legacy history fixtures', ['Select valid v4 History', 'Select malformed History', 'Select legacy History', 'Present save reconciliation outcome'], 'History distinguishes valid phase durations from unavailable/legacy details; save outcome is explicit.'),
  timing('T-10', 'Integrated accessibility', 'Performance with long content and concurrent-rest proxy', ['Inspect keyboard actions', 'Inspect reduced-motion-neutral state', 'Inspect viewport list'], 'Semantic heading, quiet tick status, 44px actions, and viewport probes remain available.'),
  recovery('C-01', 'Reload restore', 'resumable', 'Synthetic restore availability is visible with resume/discard actions.'),
  recovery('C-02', 'Exclusive mutation', 'conflict', 'Synthetic second-owner conflict is visible and prevents silent takeover.'),
  recovery('C-03', 'Acquisition and loss', 'timeout', 'Synthetic timeout/loss is visible with retry/recovery and exit actions.'),
  recovery('C-04', 'Draft validation', 'malformed', 'Synthetic malformed/unsupported/stale/identity disposition is visible without hydration.'),
  recovery('C-05', 'Draft lifecycle', 'storage-error', 'Synthetic local-storage failure is visible and actionable.'),
  recovery('C-06', 'Immutable server result', 'reconcile-indeterminate', 'Synthetic indeterminate reconciliation stays pending with retry action.'),
]);

export const TIMING_VIEWPORTS = Object.freeze(['320x640', '375x667', '568x320', '768x1024', '1280x800', '200% reflow']);
const IDS = ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08', 'T-09', 'T-10', 'C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06'];
const RECOVERY_DEFAULTS = Object.freeze({ 'C-01': 'resumable', 'C-02': 'conflict', 'C-03': 'timeout', 'C-04': 'malformed', 'C-05': 'storage-error', 'C-06': 'reconcile-indeterminate' });

export function validateTimingScenarioManifest(scenarios = TIMING_SCENARIOS, viewports = TIMING_VIEWPORTS) {
  if (!Array.isArray(scenarios) || scenarios.length !== IDS.length) throw new Error('Timing scenario manifest must contain every approved scenario exactly once.');
  const ids = scenarios.map(scenario => scenario?.id);
  if (new Set(ids).size !== IDS.length || IDS.some((id, index) => ids[index] !== id)) throw new Error('Timing scenario IDs must be the ordered T-01 through T-10 and C-01 through C-06 matrix.');
  if (!Array.isArray(viewports) || viewports.length !== TIMING_VIEWPORTS.length || TIMING_VIEWPORTS.some((viewport, index) => viewports[index] !== viewport)) throw new Error('Timing viewport list must exactly match the approved ordered viewport matrix.');
  for (const scenario of scenarios) {
    if (!['timing', 'recovery'].includes(scenario.group) || ![scenario.title, scenario.start, scenario.expected].every(value => typeof value === 'string' && value.trim()) || !Array.isArray(scenario.actions) || scenario.actions.length === 0 || scenario.actions.some(action => typeof action !== 'string' || !action.trim())) throw new Error(`Timing scenario ${scenario.id} requires title, start state, action path, and expected visible outcome.`);
    if (scenario.group === 'recovery' && (typeof scenario.recoveryStatus !== 'string' || !scenario.recoveryStatus)) throw new Error(`Recovery scenario ${scenario.id} requires an injected outcome status.`);
    if (Object.hasOwn(RECOVERY_DEFAULTS, scenario.id) && (scenario.group !== 'recovery' || scenario.recoveryStatus !== RECOVERY_DEFAULTS[scenario.id])) throw new Error(`Recovery scenario ${scenario.id} must keep its approved group and default status.`);
  }
  return true;
}
