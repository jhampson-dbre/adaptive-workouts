import { describe, expect, it, vi } from 'vitest';
import { ACCESS_SCENARIO_CONTROL_MARKER, createAccessScenarioEvaluator } from '../utils/accessScenarioControl';
import { createControlServer } from '../../scripts/emulator/access-scenarios/control-server.mjs';
describe('access scenario control', () => it('has a stable dev-only protocol marker', () => expect(ACCESS_SCENARIO_CONTROL_MARKER).toBe('private-access-scenario-control-v1')));

describe('baseline evaluator protocol', () => {
  it('uses the exact registered reject/hold/pass IDs and consumes each queued action once', async () => {
    const priorMode = import.meta.env.MODE; import.meta.env.MODE = 'baseline';
    const evaluate = vi.fn(async () => 'real'); const queued = ['reject-next-evaluation', undefined]; const controlled = createAccessScenarioEvaluator(evaluate, { consume: async () => queued.shift() });
    await expect(controlled()).rejects.toThrow('Scenario verification rejection'); expect(await controlled()).toBe('real'); expect(evaluate).toHaveBeenCalledOnce();
    const hold = createAccessScenarioEvaluator(evaluate, { consume: async () => 'hold-next-evaluation' })();
    expect(await Promise.race([hold.then(() => 'settled'), Promise.resolve('still-pending')])).toBe('still-pending');
    expect(await createAccessScenarioEvaluator(evaluate, { consume: async () => 'pass' })()).toBe('real'); import.meta.env.MODE = priorMode;
  });
});

describe('loopback scenario action queue', () => {
  it('accepts a registered session action once and acknowledges it without cross-session access', async () => {
    const server = createControlServer({ sessionId: 'only-this-session', onAction: ({ action }) => ({ action, ...(action === 'hold-next-evaluation' ? { queueAction: action } : {}), acknowledgement: true }) });
    await new Promise(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/sessions/only-this-session`;
    try {
      const staged = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'hold-next-evaluation' }) });
      expect(await staged.json()).toEqual({ action: 'hold-next-evaluation', queueAction: 'hold-next-evaluation', acknowledgement: true });
      expect(await (await fetch(endpoint)).json()).toEqual({ action: 'hold-next-evaluation', acknowledgement: true });
      expect(await (await fetch(endpoint)).json()).toEqual({ acknowledgement: true });
      expect((await (await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'revoke-user' }) })).json())).toEqual({ action: 'revoke-user', acknowledgement: true });
      expect(await (await fetch(endpoint)).json()).toEqual({ acknowledgement: true });
      expect((await fetch(`${endpoint.replace('only-this-session', 'different-session')}`)).status).toBe(404);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  it('permits browser queue reads only from the fixed Vite loopback origin and handles its preflight', async () => {
    const server = createControlServer({ sessionId: 'cors-session', onAction: ({ action }) => ({ action, queueAction: action, acknowledgement: true }) });
    await new Promise(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/sessions/cors-session`;
    try {
      const options = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5175', 'Access-Control-Request-Method': 'GET' } });
      expect(options.status).toBe(204); expect(options.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5175'); expect(options.headers.get('access-control-allow-methods')).toContain('GET'); expect(options.headers.get('access-control-allow-credentials')).toBeNull();
      const allowed = await fetch(endpoint, { headers: { Origin: 'http://127.0.0.1:5175' } });
      expect(allowed.status).toBe(200); expect(allowed.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5175');
      expect((await fetch(endpoint, { headers: { Origin: 'http://localhost:5175' } })).status).toBe(403);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
