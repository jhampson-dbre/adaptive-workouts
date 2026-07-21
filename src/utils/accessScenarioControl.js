export const ACCESS_SCENARIO_CONTROL_MARKER = 'private-access-scenario-control-v1';

export const createAccessScenarioEvaluator = (evaluate, control = {}) => async (...args) => {
  if (control.consume) control.mode = await control.consume();
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'baseline' || !control.mode) return evaluate(...args);
  if (control.mode === 'reject-next-evaluation') { control.mode = undefined; throw new Error('Scenario verification rejection'); }
  if (control.mode === 'hold-next-evaluation') { control.mode = undefined; return new Promise(() => {}); }
  return evaluate(...args);
};

export const loadAccessScenarioEvaluator = async evaluate => {
  const session = import.meta.env.VITE_ACCESS_SCENARIO_CONTROL_SESSION;
  const endpoint = import.meta.env.VITE_ACCESS_SCENARIO_CONTROL_URL;
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'baseline') {
    if (session) throw new Error('Scenario control is development baseline only');
    return evaluate;
  }
  if (!session) return evaluate;
  if (!endpoint?.startsWith('http://127.0.0.1:')) throw new Error('Invalid scenario control endpoint');
  return createAccessScenarioEvaluator(evaluate, {
    mode: undefined,
    async consume() {
      const response = await fetch(endpoint); const payload = await response.json(); return payload.action;
    },
  });
};
