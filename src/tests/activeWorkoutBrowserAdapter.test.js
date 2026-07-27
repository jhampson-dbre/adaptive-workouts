import { afterEach, expect, test, vi } from 'vitest';
import { createBrowserActiveWorkoutAdapter } from '../utils/activeWorkoutBrowserAdapter';

class Channel {
  static channels = [];
  constructor(name) { this.name = name; Channel.channels.push(this); }
  postMessage(message) { Channel.channels.filter(channel => channel !== this && channel.name === this.name).forEach(channel => channel.onmessage?.({ data: message })); }
  close() { Channel.channels = Channel.channels.filter(channel => channel !== this); }
}

afterEach(() => { Channel.channels = []; vi.unstubAllGlobals(); });

test('owner listener ignores its own handoff request and acknowledges a matching peer request', async () => {
  vi.stubGlobal('BroadcastChannel', Channel); vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('owner').mockReturnValueOnce('requester') });
  const owner = createBrowserActiveWorkoutAdapter(); const requester = createBrowserActiveWorkoutAdapter();
  const handler = vi.fn(async message => ({ status: 'accepted', nonce: message.nonce }));
  owner.subscribeHandoff({ projectId: 'p', uid: 'u' }, handler);
  await expect(requester.handoffTransport.request({ projectId: 'p', uid: 'u' }, { nonce: 'n', draftId: 'd', ownershipGeneration: 1 })).resolves.toMatchObject({ type: 'handoff-response', status: 'accepted', nonce: 'n' });
  expect(handler).toHaveBeenCalledTimes(1);
});

test('request ignores a same-nonce handoff request until its targeted response arrives', async () => {
  vi.stubGlobal('BroadcastChannel', Channel); vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('requester').mockReturnValueOnce('attacker') });
  const requester = createBrowserActiveWorkoutAdapter(); const attacker = new Channel('active-workout:p:u');
  let settled = false;
  const pending = requester.handoffTransport.request({ projectId: 'p', uid: 'u' }, { nonce: 'n', draftId: 'd', ownershipGeneration: 1 }).then(() => { settled = true; });
  attacker.postMessage({ type: 'handoff-request', senderId: 'attacker', nonce: 'n', draftId: 'd', ownershipGeneration: 1 }); await Promise.resolve();
  expect(settled).toBe(false);
  attacker.postMessage({ type: 'handoff-response', targetId: 'requester', nonce: 'n', status: 'accepted' }); await pending;
  expect(settled).toBe(true);
});
