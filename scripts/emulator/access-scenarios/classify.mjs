export const classifyAccessScenarioEvidence = ({ preflight, observation, capture = true }) => {
  if (!preflight?.acknowledgement || !capture || !observation?.valid) return { classification: 'harness-invalid', blocking: true };
  return observation.matchesExpected ? { classification: 'pass', blocking: false } : { classification: 'ux-defect', blocking: true };
};
