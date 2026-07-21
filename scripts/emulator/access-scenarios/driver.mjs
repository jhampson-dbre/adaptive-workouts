export function stageAccessAction({ manifest, scenario, action }) {
  if (!manifest.scenarios[scenario]?.actions.includes(action)) throw new Error(`Unregistered access action: ${action}`);
  return { marker: 'private-access-scenario-control-v1', scenario, action, acknowledgement: true };
}
